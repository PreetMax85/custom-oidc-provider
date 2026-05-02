import crypto from "node:crypto";
import bcrypt from "bcrypt";
import {
  exportJWK,
  importSPKI,
  importPKCS8,
  calculateJwkThumbprint,
  SignJWT,
  jwtVerify,
} from "jose";
import { PUBLIC_KEY, PRIVATE_KEY } from "../../common/utils/keys.js";
import { OidcRepository } from "./oidc.repository.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { TokenInput } from "./dtos/oidc.dto.js";

const issuer = process.env.ISSUER!;
const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);

let cachedKid: string | null = null;

async function getKid(): Promise<string> {
  if (cachedKid) return cachedKid;
  const publicKey = await importSPKI(PUBLIC_KEY, "RS256");
  const jwk = await exportJWK(publicKey);
  cachedKid = await calculateJwkThumbprint(jwk);
  return cachedKid;
}

// exactOptionalPropertyTypes fix: use `string | undefined` explicitly on optional fields
// so passing `state: undefined` doesn't cause a type error
type IssueAuthCodeParams = {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  state: string | undefined;
  codeChallenge: string | undefined;
  codeChallengeMethod: string | undefined;
};

async function issueAuthCode(params: IssueAuthCodeParams): Promise<string> {
  const code = crypto.randomBytes(32).toString("hex");

  await OidcRepository.insertAuthCode({
    code,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    codeChallenge: params.codeChallenge ?? null,
    codeChallengeMethod: params.codeChallengeMethod ?? null,
  });

  const redirectUrl = new URL(params.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (params.state) redirectUrl.searchParams.set("state", params.state);

  return redirectUrl.toString();
}

type HandleAuthorizeParams = {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string | undefined;
  codeChallenge: string | undefined;
  codeChallengeMethod: string | undefined;
  sessionCookie: string | undefined;
};

type HandleLoginParams = {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string | undefined;
  code_challenge: string | undefined;
  code_challenge_method: string | undefined;
};

export class OidcService {
  static async getJwks() {
    const publicKey = await importSPKI(PUBLIC_KEY, "RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = await getKid();
    jwk.use = "sig";
    jwk.alg = "RS256";
    return { keys: [jwk] };
  }

  static async handleAuthorize(
    params: HandleAuthorizeParams,
  ): Promise<{ redirectUrl: string } | { showLogin: true }> {
    const client = await OidcRepository.findClientById(params.clientId);

    if (!client || !client.redirectUris.includes(params.redirectUri)) {
      throw ApiError.badRequest("invalid_client");
    }

    // SSO — if user already has a valid session, skip login
    if (params.sessionCookie) {
      try {
        const { payload } = await jwtVerify(params.sessionCookie, SESSION_SECRET);
        const userId = payload.sub as string;

        const redirectUrl = await issueAuthCode({
          clientId: params.clientId,
          userId,
          redirectUri: params.redirectUri,
          scope: params.scope,
          state: params.state,
          codeChallenge: params.codeChallenge,
          codeChallengeMethod: params.codeChallengeMethod,
        });

        return { redirectUrl };
      } catch {
        // Expired/invalid session — fall through to show login
      }
    }

    return { showLogin: true };
  }

  static async handleLogin(
    email: string,
    password: string,
    oidcParams: HandleLoginParams,
  ): Promise<{ redirectUrl: string; sessionToken: string }> {
    const user = await OidcRepository.findUserByEmail(email);

    if (!user) throw ApiError.unauthorized("Invalid email or password");

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw ApiError.unauthorized("Invalid email or password");

    const redirectUrl = await issueAuthCode({
      clientId: oidcParams.client_id,
      userId: user.id,
      redirectUri: oidcParams.redirect_uri,
      scope: oidcParams.scope,
      state: oidcParams.state,
      codeChallenge: oidcParams.code_challenge,
      codeChallengeMethod: oidcParams.code_challenge_method,
    });

    const sessionToken = await new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(SESSION_SECRET);

    return { redirectUrl, sessionToken };
  }

  static async exchangeCode(data: TokenInput) {
    const client = await OidcRepository.findClientByCredentials(
      data.client_id,
      data.client_secret,
    );
    if (!client) throw ApiError.unauthorized("invalid_client");

    const authCode = await OidcRepository.findAuthCode(data.code);

    if (!authCode)                                    throw ApiError.badRequest("invalid_grant");
    if (authCode.used)                                throw ApiError.badRequest("invalid_grant");
    if (authCode.redirectUri !== data.redirect_uri)   throw ApiError.badRequest("invalid_grant");
    if (authCode.clientId !== data.client_id)         throw ApiError.badRequest("invalid_grant");
    if (new Date() > authCode.expiresAt)              throw ApiError.badRequest("invalid_grant");

    // PKCE — only S256, plain is rejected at the DTO level
    if (authCode.codeChallenge) {
      if (!data.code_verifier) {
        throw ApiError.badRequest("code_verifier is required");
      }

      const computedChallenge = crypto
        .createHash("sha256")
        .update(data.code_verifier)
        .digest("base64url");

      if (computedChallenge !== authCode.codeChallenge) {
        throw ApiError.badRequest("code_verifier mismatch");
      }
    }

    // Mark used immediately before issuing tokens — prevents replay attacks
    await OidcRepository.markCodeUsed(authCode.id);

    const user = await OidcRepository.findUserById(authCode.userId);
    if (!user) throw ApiError.badRequest("invalid_grant");

    const privateKey = await importPKCS8(PRIVATE_KEY, "RS256");
    const kid = await getKid();
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await new SignJWT({ scope: authCode.scope })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setSubject(user.id)
      .setAudience(data.client_id)
      .setIssuedAt(now)
      .setExpirationTime("1h")
      .sign(privateKey);

    const idToken = await new SignJWT({
      email: user.email,
      email_verified: user.emailVerified,
      given_name: user.firstName,
      family_name: user.lastName ?? undefined,
      name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setSubject(user.id)
      .setAudience(data.client_id)
      .setIssuedAt(now)
      .setExpirationTime("1h")
      .sign(privateKey);

    return {
      access_token: accessToken,
      id_token: idToken,
      token_type: "Bearer",
      expires_in: 3600,
    };
  }

  static async getUserInfo(authHeader: string | undefined) {
    if (!authHeader?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("invalid_token");
    }

    const token = authHeader.slice(7);
    const publicKey = await importSPKI(PUBLIC_KEY, "RS256");

    let payload;
    try {
      ({ payload } = await jwtVerify(token, publicKey, { issuer }));
    } catch {
      throw ApiError.unauthorized("invalid_token");
    }

    const user = await OidcRepository.findUserById(payload.sub!);
    if (!user) throw ApiError.notFound("User not found");

    return {
      sub: user.id,
      email: user.email,
      email_verified: user.emailVerified,
      given_name: user.firstName,
      family_name: user.lastName,
      name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    };
  }
}
import { Request, Response, NextFunction } from "express";
import path from "node:path";
import { OidcService } from "./oidc.service.js";
import { authorizeSchema, tokenSchema } from "./dtos/oidc.dto.js";
import { OidcRepository } from "./oidc.repository.js";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export class OidcController {
  static getDiscovery(_req: Request, res: Response): void {
    const issuer = process.env.ISSUER!;
    res.status(200).json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email"],
      code_challenge_methods_supported: ["S256"],
    });
  }

  static async getJwks(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const jwks = await OidcService.getJwks();
      res.status(200).json(jwks);
    } catch (error) {
      next(error);
    }
  }

  static async authorize(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = authorizeSchema.safeParse(req.query);

      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? "invalid_request";
        res.redirect(`/error.html?error=${encodeURIComponent(msg)}`);
        return;
      }

      const {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
      } = parsed.data;

      const result = await OidcService.handleAuthorize({
        clientId: client_id,
        redirectUri: redirect_uri,
        scope,
        state: state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        sessionCookie: req.cookies?.oidc_session as string | undefined,
      });

      if ("redirectUrl" in result) {
        // SSO — skip login, go straight back to client
        res.redirect(result.redirectUrl);
        return;
      }

      res.cookie(
        "oidc_params",
        JSON.stringify({
          client_id,
          redirect_uri,
          scope,
          state,
          code_challenge,
          code_challenge_method,
        }),
        { httpOnly: true, maxAge: 10 * 60 * 1000 },
      );

      res.sendFile(path.resolve("public", "login.html"));
    } catch (error) {
      next(error);
    }
  }

  // Returns JSON { redirectUrl } instead of a 302 redirect.
  // This lets the frontend use window.location.href for the redirect,
  // which is a navigation (not a fetch) and won't be blocked by CSP connect-src.
  static async authorizeCallback(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      const oidcParams = req.cookies?.oidc_params;

      if (!oidcParams) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "Session expired, please start login again",
        });
        return;
      }

      const params = JSON.parse(oidcParams);
      const { redirectUrl, sessionToken } = await OidcService.handleLogin(
        email,
        password,
        params,
      );

      res.clearCookie("oidc_params");
      res.cookie("oidc_session", sessionToken, SESSION_COOKIE_OPTIONS);

      // Return JSON — frontend does window.location.href = redirectUrl
      res.json({ redirectUrl });
    } catch (error) {
      next(error);
    }
  }

  static async token(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = tokenSchema.safeParse(req.body);

      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? "invalid_request";
        res.status(400).json({ error: msg });
        return;
      }

      const tokens = await OidcService.exchangeCode(parsed.data);
      res.json(tokens);
    } catch (error) {
      next(error);
    }
  }

  static async userinfo(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userInfo = await OidcService.getUserInfo(req.headers.authorization);
      res.json(userInfo);
    } catch (error) {
      next(error);
    }
  }

  // Returns just the app name for a given client_id
  static async getClientName(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { clientId } = req.params;
      if (typeof clientId !== "string") {
        throw new Error("Invalid or missing client ID");
      }
      const client = await OidcRepository.findClientById(clientId);
      if (!client) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ name: client.name });
    } catch (error) {
      next(error);
    }
  }

  static logout(_req: Request, res: Response): void {
    res.clearCookie("oidc_session");
     res.redirect("/login.html");
  }
}

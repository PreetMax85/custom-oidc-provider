import { eq, and } from "drizzle-orm";
import { db } from "../../common/db/index.js";
import { users, oauthClientsTable, authorizationCodesTable } from "../../common/db/schema.js";

export class OidcRepository {
  static async findClientById(clientId: string) {
    const [client] = await db
      .select()
      .from(oauthClientsTable)
      .where(eq(oauthClientsTable.clientId, clientId))
      .limit(1);
    return client;
  }

  static async findClientByCredentials(clientId: string, clientSecret: string) {
    const [client] = await db
      .select()
      .from(oauthClientsTable)
      .where(
        and(
          eq(oauthClientsTable.clientId, clientId),
          eq(oauthClientsTable.clientSecret, clientSecret),
        ),
      )
      .limit(1);
    return client;
  }

  static async findUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  static async findUserById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  static async insertAuthCode(values: {
    code: string;
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string;
    expiresAt: Date;
    codeChallenge?: string | null;
    codeChallengeMethod?: string | null;
  }) {
    await db.insert(authorizationCodesTable).values(values);
  }

  static async findAuthCode(code: string) {
    const [authCode] = await db
      .select()
      .from(authorizationCodesTable)
      .where(eq(authorizationCodesTable.code, code))
      .limit(1);
    return authCode;
  }

  static async markCodeUsed(id: string) {
    await db
      .update(authorizationCodesTable)
      .set({ used: true })
      .where(eq(authorizationCodesTable.id, id));
  }
}
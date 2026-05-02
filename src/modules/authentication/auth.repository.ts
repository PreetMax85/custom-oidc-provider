import { eq } from "drizzle-orm";
import { db } from "../../common/db/index.js";
import { users } from "../../common/db/schema.js";
import { RegisterInput } from "./dtos/auth.dto.js";
import { ApiError } from "../../common/utils/ApiError.js";

export class AuthRepository {
  // Returns full user including password hash — never send this directly to client
  static async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  // Returns only safe fields — used to verify user still exists
  static async findById(id: string) { // ← string, not number (uuid)
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  static async createUser(data: RegisterInput, hashedPassword: string) {
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: data.firstName,   // ← was: users.firstName (column ref, not value)
        lastName: data.lastName ?? null,
        email: data.email,
        password: hashedPassword,
      })
      .returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      });

    if (!newUser) {
      throw ApiError.internal("Failed to create user record");
    }

    return newUser;
  }
}
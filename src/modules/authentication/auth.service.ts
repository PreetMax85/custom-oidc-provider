import bcrypt from "bcrypt";
import { AuthRepository } from "./auth.repository.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { RegisterInput, LoginInput } from "./dtos/auth.dto.js";

const SALT_ROUNDS = 10;

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await AuthRepository.findByEmail(data.email);
    if (existingUser) {
      throw ApiError.conflict("A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const newUser = await AuthRepository.createUser(data, hashedPassword);

    return { user: newUser };
  }

  static async login(data: LoginInput) {
    const user = await AuthRepository.findByEmail(data.email);

    // Same error message for both "user not found" and "wrong password" —
    // prevents user enumeration attacks (attacker can't tell which one failed)
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    // Strip sensitive fields before returning
    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    return { user: safeUser };
  }
}
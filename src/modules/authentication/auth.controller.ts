import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { ApiResponse } from "../../common/utils/ApiResponse.js";
import { registerSchema, loginSchema } from "./dtos/auth.dto.js";

export class AuthController {
  static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const { user } = await AuthService.register(validatedData);
      ApiResponse.created(res, "Account created successfully", { user });
    } catch (error) {
      next(error);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const { user } = await AuthService.login(validatedData);
      ApiResponse.ok(res, "Login successful", { user });
    } catch (error) {
      next(error);
    }
  }
}
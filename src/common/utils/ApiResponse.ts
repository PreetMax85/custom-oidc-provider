import { Response } from "express";
import { HttpStatus } from "./httpStatus.js";

export class ApiResponse {
  static ok<T>(
    res: Response,
    message: string,
    data: T | null = null,
  ): Response {
    return res.status(HttpStatus.OK).json({
      success: true,
      message,
      data,
    });
  }

  static created<T>(
    res: Response,
    message: string,
    data: T | null = null,
  ): Response {
    return res.status(HttpStatus.CREATED).json({
      success: true,
      message,
      data,
    });
  }

  static noContent(res: Response) {
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}

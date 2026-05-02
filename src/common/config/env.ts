import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ISSUER: z.url(),
  PRIVATE_KEY: z.string(),
  PUBLIC_KEY: z.string(),
  CLIENT_URL: z.string().optional(),
  ADMIN_PASSWORD: z.string(),
  ADMIN_JWT_SECRET: z.string(),
  SESSION_SECRET: z.string(),
});

export const env = envSchema.parse(process.env);

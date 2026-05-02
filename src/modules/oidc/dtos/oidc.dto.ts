import { z } from "zod";

export const authorizeSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.url("Invalid redirect_uri"),
  response_type: z.literal("code", { message: "unsupported_response_type" }),
  scope: z.string().refine((s) => s.includes("openid"), {
    message: "scope must include openid",
  }),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256"]).optional(),
});

export const tokenSchema = z.object({
  grant_type: z.literal("authorization_code", { message: "unsupported_grant_type" }),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code_verifier: z.string().optional(),
});

export type AuthorizeInput = z.infer<typeof authorizeSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
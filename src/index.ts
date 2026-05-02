import path from "node:path";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import "./common/config/env.js";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import "./common/db/index.js";

import { authRoutes } from "./modules/authentication/auth.routes.js";
import { oidcRouter } from "./modules/oidc/oidc.routes.js";
import { adminRoutes } from "./admin/admin.routes.js";
import { errorHandler } from "./common/middleware/error.middleware.js";

const app = express();
app.set("trust proxy", true);

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "*",
    credentials: true,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }),
);

app.use(express.json());
app.use(cookieParser());

// Request logger
if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log("REQ:", req.method, req.url);
    next();
  });
}

app.use(express.static(path.resolve("./public")));

// Health check
app.get("/health", (_req: Request, res: Response): void => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// OIDC routes (/, /authorize, /token, /userinfo, /.well-known/*)
app.use("/", oidcRouter);

// Auth routes (register, login)
app.use("/api/auth", authRoutes);

// Admin routes (verify, client registration)
app.use("/api/admin", adminRoutes);

// 404 catch-all for unknown /api routes
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

// Global error handler — formats ApiError and ZodError into clean JSON
app.use(errorHandler);

const PORT = parseInt(process.env.PORT ?? "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Running in ${process.env.NODE_ENV} mode`);
  console.log(`[Server] Listening on 0.0.0.0:${PORT}`);
});
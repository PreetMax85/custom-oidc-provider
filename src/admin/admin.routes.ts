import { Router, Request, Response, NextFunction} from "express";
import { db } from "../common/db/index.js";
import { oauthClientsTable } from "../common/db/schema.js";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const router = Router();

const ADMIN_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);

// Middleware to protect client creation
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    await jwtVerify(auth.slice(7), ADMIN_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired admin token" });
  }
}

// POST /api/admin/verify
// Checks admin password, returns short-lived JWT
router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    // Delay to slow down brute force
    await new Promise(r => setTimeout(r, 500));
    res.status(401).json({ message: "Incorrect password" });
    return;
  }

  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m") // 30 min session to fill the form
    .sign(ADMIN_SECRET);

  res.json({ token });
});

// POST /api/admin/clients
// Registers a new OAuth client, returns client_id + client_secret
router.post("/clients", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, contactEmail, appUrl, redirectUris } = req.body;

  if (!name || !contactEmail || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    res.status(400).json({ message: "name, contactEmail, and redirectUris are required" });
    return;
  }

  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomBytes(32).toString("hex");

  await db.insert(oauthClientsTable).values({
    name,
    contactEmail,
    appUrl: appUrl || null,
    clientId,
    clientSecret,
    redirectUris,
  });

  // Secret is shown only once — we store it plaintext here but
  // you can hash it later if you want extra security
  res.status(201).json({ clientId, clientSecret });
});

export const adminRoutes = router;
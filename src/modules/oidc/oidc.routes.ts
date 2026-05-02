import { Router } from "express";
import { OidcController } from "./oidc.controller.js";

const router = Router();

router.get("/.well-known/openid-configuration", OidcController.getDiscovery);
router.get("/.well-known/jwks.json", OidcController.getJwks);
router.get("/authorize", OidcController.authorize);
router.post("/authorize/callback", OidcController.authorizeCallback);
router.post("/token", OidcController.token);
router.get("/userinfo", OidcController.userinfo);
router.get("/logout", OidcController.logout);

// Used by login.html to show app name instead of raw client_id UUID
router.get("/api/clients/:clientId/name", OidcController.getClientName);

export const oidcRouter = router;
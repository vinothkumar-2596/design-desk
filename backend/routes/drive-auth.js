import express from "express";
import { getDriveAuthUrl, getDriveConnectionInfo, saveDriveToken } from "../lib/drive.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

const getRequestOrigin = (req) => {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host");
  if (!host) {
    throw new Error("Request host is unavailable");
  }
  return `${protocol}://${host}`;
};

const getDriveRedirectUri = (req) => {
  return new URL("/api/drive/callback", getRequestOrigin(req)).toString();
};

router.get("/auth-url", requireRole(["staff", "designer", "treasurer"]), async (req, res) => {
  try {
    try {
      const connection = await getDriveConnectionInfo();
      return res.json({
        connected: true,
        email: connection.email,
        name: connection.name,
      });
    } catch {
      // No active Drive session. Fall through to OAuth URL generation.
    }

    const url = getDriveAuthUrl(getDriveRedirectUri(req));
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate auth URL." });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const oauthError = String(req.query?.error || "").trim();
    const oauthErrorDescription = String(req.query?.error_description || "").trim();

    if (oauthError) {
      const suffix = oauthErrorDescription ? `: ${oauthErrorDescription}` : "";
      return res.status(400).json({ error: `Google OAuth error (${oauthError})${suffix}` });
    }

    if (!code) {
      return res
        .status(400)
        .json({ error: "Missing OAuth code. Start from /api/drive/auth-url and complete consent." });
    }
    const { tokens, tokenPath } = await saveDriveToken(String(code), getDriveRedirectUri(req));

    if (tokenPath) {
      return res.send(`Drive connected. Token saved to ${tokenPath}. You can close this tab.`);
    }

    const refreshToken = String(tokens?.refresh_token || "").trim();
    const accessToken = String(tokens?.access_token || "").trim();
    const tokenBase64 = Buffer.from(JSON.stringify(tokens || {}), "utf-8").toString("base64");

    if (!refreshToken) {
      return res.send(
        "Drive connected, but no refresh token was returned. Set prompt=consent in OAuth and reconnect."
      );
    }

    const envLines = [
      "Drive connected.",
      "Add these backend environment variables and redeploy:",
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`,
      accessToken ? `GOOGLE_ACCESS_TOKEN=${accessToken}` : "",
      `GOOGLE_DRIVE_OAUTH_TOKEN_BASE64=${tokenBase64}`,
    ].filter(Boolean);

    return res.type("text/plain").send(envLines.join("\n"));
  } catch (error) {
    res.status(500).json({ error: "Failed to save Drive token." });
  }
});

export default router;

import express from "express";
import { getDriveAuthUrl, saveDriveToken } from "../lib/drive.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole(["treasurer"]));

router.get("/auth-url", (_req, res) => {
  try {
    const url = getDriveAuthUrl();
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate auth URL." });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Missing code." });
    }
    const { tokens, tokenPath } = await saveDriveToken(String(code));

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

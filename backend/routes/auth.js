import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import User from "../models/User.js";
import Task from "../models/Task.js";
import RefreshToken from "../models/RefreshToken.js";
import { sendPasswordResetEmail } from "../lib/notifications.js";
import { signAccessToken, requireAuth, requireRole } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { logAudit, logAuditFromRequest } from "../lib/audit.js";
import { isMainDesignerUser } from "../lib/designerAccess.js";

const router = express.Router();

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";
const DEV_FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "https://designdesk.vercel.app",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
];

const hashToken = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const createRefreshToken = async (user, req) => {
  const rawToken = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    createdByIp: req.clientIp || "",
    userAgent: req.userAgent || ""
  });
  return { rawToken, tokenHash, expiresAt };
};

const setRefreshCookie = (res, token, expiresAt) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    expires: expiresAt,
    path: "/api/auth"
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
};

const getRefreshTokenFromRequest = (req) => {
  const headerToken = req.header("x-refresh-token");
  if (headerToken) return headerToken;
  if (req.body?.refreshToken) return req.body.refreshToken;
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.split("=");
    acc[key.trim()] = decodeURIComponent(rest.join("=").trim());
    return acc;
  }, {});
  return cookies[REFRESH_COOKIE_NAME] || null;
};

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret);
};

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

const getGoogleRedirectUri = (req) => {
  const requestOrigin = getRequestOrigin(req);
  if (isLoopbackOrigin(requestOrigin)) {
    return new URL("/api/auth/google/callback", requestOrigin).toString();
  }
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  return new URL("/api/auth/google/callback", requestOrigin).toString();
};

const normalizeRole = (role) => {
  const allowedRoles = ["staff", "treasurer", "designer", "other", "admin"];
  return role && allowedRoles.includes(role) ? role : "staff";
};

const normalizeGoogleRole = (role) => {
  const normalized = normalizeRole(String(role || "").trim().toLowerCase());
  if (normalized === "admin") return "staff";
  return normalized;
};

const normalizeSignupRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  const allowedRoles = new Set(["staff", "designer", "treasurer"]);
  return allowedRoles.has(normalized) ? normalized : "staff";
};

const normalizeLoopbackHost = (host) => {
  const value = String(host || "").toLowerCase();
  if (value === "127.0.0.1" || value === "::1" || value === "[::1]") {
    return "localhost";
  }
  return value;
};

const isLoopbackOrigin = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return normalizeLoopbackHost(parsed.hostname) === "localhost";
  } catch {
    return false;
  }
};

const parseOrigin = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const getFrontendOrigin = () => {
  const base = process.env.FRONTEND_URL || "http://localhost:8080";
  return parseOrigin(base) || "http://localhost:8080";
};

const getAllowedFrontendOrigins = () => {
  const configuredOrigins = new Set([getFrontendOrigin()]);
  const extraOrigins = String(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((entry) => parseOrigin(entry.trim()))
    .filter(Boolean);

  for (const origin of extraOrigins) {
    configuredOrigins.add(origin);
  }

  for (const origin of DEV_FRONTEND_ORIGINS) {
    configuredOrigins.add(origin);
  }

  return configuredOrigins;
};

const decodeJwtPayload = (value) => {
  try {
    const decoded = jwt.decode(String(value || ""));
    return decoded && typeof decoded === "object" ? decoded : null;
  } catch {
    return null;
  }
};

const normalizeRequestedFrontendOrigin = (requestedOrigin) => {
  const fallback = getFrontendOrigin();
  const requested = parseOrigin(requestedOrigin);
  if (!requested) return fallback;

  const configuredOrigins = getAllowedFrontendOrigins();
  if (configuredOrigins.has(requested)) {
    return requested;
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const requestedUrl = new URL(requested);
      if (normalizeLoopbackHost(requestedUrl.hostname) === "localhost") {
        return requested;
      }
    } catch {
      // ignore invalid request value
    }
  }

  return fallback;
};

const resolveGoogleAuthFrontendOrigin = (state) => {
  const decodedState = decodeJwtPayload(state);
  return normalizeRequestedFrontendOrigin(decodedState?.frontendOrigin);
};

const buildGoogleAuthRedirectUrl = ({ frontendOrigin, token, error }) => {
  const origin = normalizeRequestedFrontendOrigin(frontendOrigin);
  const redirectUrl = new URL("/login", origin);
  redirectUrl.searchParams.set("provider", "google");
  redirectUrl.searchParams.set("openerOrigin", origin);
  if (token) {
    redirectUrl.searchParams.set("token", token);
  }
  if (error) {
    redirectUrl.searchParams.set("authError", error);
  }
  return redirectUrl.toString();
};

const resolveGoogleProviderError = (errorCode) => {
  const normalized = String(errorCode || "").trim().toLowerCase();
  if (normalized === "access_denied") {
    return "Google sign-in was canceled.";
  }
  return "Google sign-in could not be completed.";
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderGoogleAuthCallbackPage = ({ title, frontendOrigin, token, error }) => {
  const origin = normalizeRequestedFrontendOrigin(frontendOrigin);
  const redirectUrl = buildGoogleAuthRedirectUrl({
    frontendOrigin: origin,
    token,
    error,
  });
  const popupPayload = error
    ? { type: "google-auth-error", error }
    : { type: "google-auth", token };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <script>
      (function () {
        var payload = ${JSON.stringify(popupPayload)};
        var openerOrigin = ${JSON.stringify(origin)};
        var redirectUrl = ${JSON.stringify(redirectUrl)};
        var hasOpener = false;

        try {
          hasOpener = Boolean(window.opener && !window.opener.closed);
          if (hasOpener) {
            window.opener.postMessage(payload, openerOrigin);
            window.close();
          }
        } catch (error) {
          hasOpener = false;
        }

        if (!hasOpener) {
          window.location.replace(redirectUrl);
          return;
        }

        setTimeout(function () {
          if (!window.closed) {
            try {
              window.close();
            } catch (error) {
              // Ignore close failures.
            }
          }
        }, 80);

        setTimeout(function () {
          if (!window.closed) {
            window.location.replace(redirectUrl);
          }
        }, 240);
      })();
    </script>
    <noscript>
      <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
    </noscript>
  </body>
</html>`;
};

const respondGoogleAuthCallback = (res, { frontendOrigin, title, token, error }) => {
  res
    .status(200)
    .type("html")
    .send(renderGoogleAuthCallbackPage({ title, frontendOrigin, token, error }));
};

const respondGoogleAuthError = (res, { frontendOrigin, title, message }) => {
  return respondGoogleAuthCallback(res, {
    frontendOrigin,
    title,
    error: message,
  });
};

const buildResetUrl = (token) => {
  const base =
    process.env.RESET_PASSWORD_URL ||
    `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password`;
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
};

const getTwoFactorApiKey = () =>
  process.env.TWO_FACTOR_API_KEY || process.env.TWOFACTOR_API_KEY || "";

const normalizeOtpPhone = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.startsWith("91") && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+${digits}`;
};

const EMPTY_ID_VALUES = new Set([
  "",
  "null",
  "undefined",
  "none",
  "na",
  "n/a",
  "unassigned",
  "false"
]);

const normalizeTaskAssignedRef = (value) => {
  if (value === undefined || value === null) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  if (EMPTY_ID_VALUES.has(normalized.toLowerCase())) return "";
  return normalized;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const TASK_ROLES = new Set(["staff", "designer", "treasurer", "admin", "other", "manager"]);
const normalizeTaskRole = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return TASK_ROLES.has(normalized) ? normalized : "";
};
const getLatestTaskChangeValue = (task, targetField) => {
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  const normalizedField = String(targetField || "").trim().toLowerCase();
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (String(entry?.field || "").trim().toLowerCase() === normalizedField) {
      return String(entry?.newValue || "").trim();
    }
  }
  return "";
};
const parseAssignmentCcEmails = (rawValue) => {
  if (!rawValue) return [];
  const text = String(rawValue).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(parsed.map((entry) => normalizeEmail(entry)).filter(Boolean))
      );
    }
  } catch {
    // Fall through to delimited parsing.
  }
  return Array.from(
    new Set(
      text
        .split(/[,\n;]/g)
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean)
    )
  );
};
const extractTaskCcEmails = (task) => {
  const directCc = Array.isArray(task?.cc_emails)
    ? Array.from(new Set(task.cc_emails.map((entry) => normalizeEmail(entry)).filter(Boolean)))
    : Array.isArray(task?.ccEmails)
      ? Array.from(new Set(task.ccEmails.map((entry) => normalizeEmail(entry)).filter(Boolean)))
      : [];
  if (directCc.length > 0) return directCc;
  return parseAssignmentCcEmails(getLatestTaskChangeValue(task, "cc_emails"));
};
const findLatestTaskChangeEntry = (task, targetField) => {
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  const normalizedField = String(targetField || "").trim().toLowerCase();
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (String(entry?.field || "").trim().toLowerCase() === normalizedField) {
      return entry;
    }
  }
  return null;
};
const resolveEmailTaskViewerAccess = (task, viewerPayload) => {
  const ccEmails = extractTaskCcEmails(task);
  const fallback = {
    canOpenTask: false,
    accessMode: "none",
    accessReason: viewerPayload ? "not_authorized" : "sign_in_required",
    ccEmails,
  };

  if (!viewerPayload) return fallback;

  const viewerRole = normalizeTaskRole(viewerPayload.role);
  const viewerId = normalizeTaskAssignedRef(viewerPayload.sub);
  const viewerEmail = normalizeEmail(viewerPayload.email);
  const requesterId = normalizeTaskAssignedRef(task?.requesterId);
  const requesterEmail = normalizeEmail(task?.requesterEmail);
  const assignedRef = normalizeTaskAssignedRef(task?.assignedToId || task?.assignedTo);
  const assignedEmail = assignedRef.includes("@") ? normalizeEmail(assignedRef) : "";
  const createdEntry = findLatestTaskChangeEntry(task, "created");
  const createdById = normalizeTaskAssignedRef(createdEntry?.userId);
  const createdByEmail = normalizeEmail(createdEntry?.userName);

  const isAssignedDesigner =
    viewerRole === "designer" &&
    (
      (viewerId && assignedRef && viewerId === assignedRef) ||
      (viewerEmail && assignedEmail && viewerEmail === assignedEmail)
    );
  const isMainDesigner =
    viewerRole === "designer" &&
    isMainDesignerUser({ role: "designer", email: viewerEmail });
  const isRequester =
    (requesterId && viewerId && requesterId === viewerId) ||
    (requesterEmail && viewerEmail && requesterEmail === viewerEmail) ||
    (createdById && viewerId && createdById === viewerId) ||
    (createdByEmail && viewerEmail && createdByEmail === viewerEmail);
  const isCcRecipient = Boolean(viewerEmail && ccEmails.includes(viewerEmail));

  if (viewerRole === "admin" || viewerRole === "treasurer") {
    return {
      canOpenTask: true,
      accessMode: "full",
      accessReason: viewerRole === "admin" ? "admin" : "treasurer",
      ccEmails,
    };
  }

  if (isAssignedDesigner) {
    return {
      canOpenTask: true,
      accessMode: "full",
      accessReason: "assigned_designer",
      ccEmails,
    };
  }

  if (isRequester) {
    return {
      canOpenTask: true,
      accessMode: "full",
      accessReason: "request_owner",
      ccEmails,
    };
  }

  if (isMainDesigner) {
    return {
      canOpenTask: true,
      accessMode: "view_only",
      accessReason: "design_lead",
      ccEmails,
    };
  }

  if (isCcRecipient) {
    return {
      canOpenTask: true,
      accessMode: "view_only",
      accessReason: viewerRole === "manager" ? "cc_manager" : "cc_recipient",
      ccEmails,
    };
  }

  return fallback;
};
const STAFF_EMAIL_DOMAIN = String(process.env.STAFF_EMAIL_DOMAIN || "smvec.ac.in")
  .trim()
  .replace(/^@+/, "")
  .toLowerCase();
const STAFF_EMAIL_DOMAIN_LABEL = STAFF_EMAIL_DOMAIN ? `@${STAFF_EMAIL_DOMAIN}` : "";
const hasStaffEmailDomain = (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !STAFF_EMAIL_DOMAIN) return false;
  return normalizedEmail.endsWith(`@${STAFF_EMAIL_DOMAIN}`);
};
const buildStaffDomainError = () =>
  STAFF_EMAIL_DOMAIN_LABEL
    ? `Use your ${STAFF_EMAIL_DOMAIN_LABEL} email address.`
    : "Use your institutional email address.";
const FORCED_DESIGNER_EMAILS = new Set([
  "chandruvino003@gmail.com",
  "zayaaa1432004@gmail.com",
  "graphics@indbazaar.com",
].map((entry) => normalizeEmail(entry)));

const enforceDesignerRoleForConfiguredEmails = async (user) => {
  const normalizedEmail = normalizeEmail(user?.email);
  if (!normalizedEmail || !FORCED_DESIGNER_EMAILS.has(normalizedEmail)) {
    return user;
  }
  if (user.role === "designer") return user;
  user.role = "designer";
  await user.save();
  return user;
};

const getOptionalAuthPayload = (req) => {
  const header = req.header("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

router.post("/login", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const { email, password } = req.body;
    const requestedRole = normalizeRole(req.body?.role || "staff");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    const shouldEnforceStaffDomain =
      requestedRole === "staff" &&
      !hasStaffEmailDomain(normalizedEmail) &&
      (!user || user.role === "staff");

    if (shouldEnforceStaffDomain) {
      return res.status(403).json({ error: buildStaffDomainError() });
    }

    if (!user || user.isActive === false) {
      await logAudit({
        actorUserId: user?._id,
        actorRole: user?.role || "",
        action: "LOGIN_FAILED",
        targetId: user?._id?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail }
      });
      return res.status(401).json({ error: "Invalid credentials." });
    }
    if (user.authProvider === "google" && !user.password) {
      await logAudit({
        actorUserId: user._id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        targetId: user._id.toString(),
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail }
      });
      return res.status(401).json({ error: "Use Google sign-in for this account." });
    }

    if (user.role === "staff" && !hasStaffEmailDomain(normalizedEmail)) {
      return res.status(403).json({ error: buildStaffDomainError() });
    }

    const storedPassword = user.password || "";
    let passwordMatch = false;
    if (storedPassword.startsWith("$2")) {
      passwordMatch = await bcrypt.compare(password, storedPassword);
    } else {
      passwordMatch = storedPassword === password;
      if (passwordMatch) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }

    if (!passwordMatch) {
      await logAudit({
        actorUserId: user._id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        targetId: user._id.toString(),
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail }
      });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const effectiveUser = await enforceDesignerRoleForConfiguredEmails(user);

    const accessToken = signAccessToken(effectiveUser);
    const { rawToken, expiresAt } = await createRefreshToken(effectiveUser, req);
    setRefreshCookie(res, rawToken, expiresAt);

    await logAudit({
      actorUserId: effectiveUser._id,
      actorRole: effectiveUser.role,
      action: "LOGIN_SUCCESS",
      targetId: effectiveUser._id.toString(),
      ipAddress: req.clientIp || "",
      userAgent: req.userAgent || "",
      meta: { email: normalizedEmail }
    });

    res.json({ token: accessToken, user: effectiveUser.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});

router.post("/refresh", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      await logAudit({
        actorUserId: null,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "missing" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    if (!storedToken) {
      await logAudit({
        actorUserId: null,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "not_found" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    if (storedToken.revokedAt || storedToken.replacedByTokenHash) {
      await logAudit({
        actorUserId: storedToken.userId,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: storedToken.userId?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "reused" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    if (storedToken.expiresAt && storedToken.expiresAt <= new Date()) {
      await logAudit({
        actorUserId: storedToken.userId,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: storedToken.userId?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "expired" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    const user = await User.findById(storedToken.userId);
    if (!user || user.isActive === false) {
      await logAudit({
        actorUserId: storedToken.userId,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: storedToken.userId?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "user_inactive" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    const { rawToken, tokenHash: newHash, expiresAt } = await createRefreshToken(user, req);
    storedToken.revokedAt = new Date();
    storedToken.replacedByTokenHash = newHash;
    storedToken.revokedReason = "rotated";
    await storedToken.save();

    setRefreshCookie(res, rawToken, expiresAt);

    await logAudit({
      actorUserId: user._id,
      actorRole: user.role,
      action: "REFRESH_ROTATED",
      targetId: user._id.toString(),
      ipAddress: req.clientIp || "",
      userAgent: req.userAgent || "",
      meta: { refreshTokenId: storedToken.id }
    });

    res.json({ token: signAccessToken(user) });
  } catch (error) {
    res.status(500).json({ error: "Failed to refresh session." });
  }
});

router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { email, password, role, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedRole = normalizeSignupRole(role);
    const normalizedEmail = normalizeEmail(email);
    if (!hasStaffEmailDomain(normalizedEmail)) {
      return res.status(403).json({ error: buildStaffDomainError() });
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "Email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      password: passwordHash,
      role: normalizedRole,
      name: name || normalizedEmail.split("@")[0],
      authProvider: "local",
    });
    req.auditTargetId = user.id || user._id?.toString?.() || "";

    const accessToken = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);
    setRefreshCookie(res, rawToken, expiresAt);

    res.status(201).json({ token: accessToken, user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create account." });
  }
});

router.post("/password/forgot", async (req, res) => {
  try {
    const { email, phone, sessionId, otp } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!phone || !sessionId || !otp) {
      return res.status(400).json({ error: "Phone, session ID, and OTP are required." });
    }

    const apiKey = getTwoFactorApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "OTP service is not configured." });
    }

    const normalizedPhone = normalizeOtpPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number." });
    }

    const verifyUrl = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(
      sessionId
    )}/${encodeURIComponent(otp)}`;
    const verifyResponse = await fetch(verifyUrl, { method: "POST" });
    const verifyData = await verifyResponse.json().catch(() => ({}));
    const verifyStatus = String(verifyData?.Status || "").toLowerCase();
    if (!verifyResponse.ok || verifyStatus !== "success") {
      return res
        .status(400)
        .json({ error: verifyData?.Details || "OTP verification failed." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = hashToken(token);
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const resetUrl = buildResetUrl(token);
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    }

    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to start password reset." });
  }
});

router.post("/password/otp/send", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    const apiKey = getTwoFactorApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "OTP service is not configured." });
    }
    const normalized = normalizeOtpPhone(phone);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid phone number." });
    }
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${encodeURIComponent(
      normalized
    )}/AUTOGEN/OTP1`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    const status = String(data?.Status || "").toLowerCase();
    if (!response.ok || status !== "success") {
      return res
        .status(400)
        .json({ error: data?.Details || "Failed to send OTP." });
    }
    return res.json({ success: true, sessionId: data?.Details || "" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

router.post("/password/otp/verify", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) {
      return res.status(400).json({ error: "Session ID and OTP are required." });
    }
    const apiKey = getTwoFactorApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "OTP service is not configured." });
    }
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(
      sessionId
    )}/${encodeURIComponent(otp)}`;
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    const status = String(data?.Status || "").toLowerCase();
    if (!response.ok || status !== "success") {
      return res
        .status(400)
        .json({ error: data?.Details || "OTP verification failed." });
    }
    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify OTP." });
  }
});

router.post("/password/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required." });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password." });
  }
});

router.post("/password/change", requireAuth, authLimiter, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password." });
    }

    const user = await User.findById(req.user?._id);
    if (!user || user.isActive === false) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.authProvider === "google" && !user.password) {
      return res.status(400).json({ error: "Password change is unavailable for Google-only accounts." });
    }

    const storedPassword = user.password || "";
    let currentPasswordMatch = false;
    if (storedPassword.startsWith("$2")) {
      currentPasswordMatch = await bcrypt.compare(currentPassword, storedPassword);
    } else {
      currentPasswordMatch = storedPassword === currentPassword;
    }
    if (!currentPasswordMatch) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: "password_changed" } }
    );

    clearRefreshCookie(res);
    req.skipAudit = true;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to change password." });
  }
});

router.get("/google/start", (req, res) => {
  try {
    const redirectUri = getGoogleRedirectUri(req);
    const role = normalizeGoogleRole(req.query.role);
    if (role !== "staff") {
      return res.status(403).json({ error: "Google sign-in is available for staff accounts only." });
    }
    const frontendOrigin = normalizeRequestedFrontendOrigin(req.query.origin);
    const stateToken = jwt.sign(
      { role, purpose: "google", frontendOrigin },
      getJwtSecret(),
      { expiresIn: "10m" }
    );
    const oauthClient = getGoogleClient();
    const url = oauthClient.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      redirect_uri: redirectUri,
      state: stateToken,
    });
    res.json({ url });
  } catch (error) {
    console.error("Google OAuth start failed:", error?.message || error);
    res.status(500).json({ error: "Google OAuth is not configured." });
  }
});

router.get("/google/callback", async (req, res) => {
  const frontendOrigin = resolveGoogleAuthFrontendOrigin(req.query?.state);
  try {
    const { code, state, error: providerError } = req.query;
    if (providerError) {
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Sign-in canceled",
        message: resolveGoogleProviderError(providerError),
      });
    }
    if (!code || !state) {
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Sign-in unavailable",
        message: "Google sign-in could not be completed.",
      });
    }

    let statePayload;
    try {
      statePayload = jwt.verify(state, getJwtSecret());
    } catch (error) {
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Session expired",
        message: "Your sign-in session expired. Please try again.",
      });
    }

    if (!statePayload || statePayload.purpose !== "google") {
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Session expired",
        message: "Your sign-in session expired. Please try again.",
      });
    }

    const requestedRole = normalizeGoogleRole(statePayload.role);

    const oauthClient = getGoogleClient();
    const { tokens } = await oauthClient.getToken({
      code,
      redirect_uri: getGoogleRedirectUri(req),
    });
    oauthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauthClient, version: "v2" });
    const { data } = await oauth2.userinfo.get();

    if (!data?.email || data.verified_email === false) {
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Verified email required",
        message: "Your Google account email must be verified before you can sign in.",
      });
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    if (requestedRole === "staff" && !hasStaffEmailDomain(normalizedEmail)) {
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Use your staff account",
        message: buildStaffDomainError(),
      });
    }
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: data.name || normalizedEmail.split("@")[0],
        role: requestedRole,
        authProvider: "google",
        googleId: data.id,
        avatar: data.picture,
      });
    } else {
      const updates = {};
      if (!user.googleId && data.id) updates.googleId = data.id;
      if (!user.avatar && data.picture) updates.avatar = data.picture;
      if (!user.name && data.name) updates.name = data.name;
      if (
        user.authProvider === "google" &&
        user.role === "staff" &&
        requestedRole !== "staff"
      ) {
        updates.role = requestedRole;
      }
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }

    if (user.isActive === false) {
      await logAudit({
        actorUserId: user._id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        targetId: user._id.toString(),
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail, provider: "google", reason: "inactive" }
      });
      return respondGoogleAuthError(res, {
        frontendOrigin,
        title: "Account inactive",
        message: "Your account is inactive. Contact the administrator for access.",
      });
    }

    const token = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);
    setRefreshCookie(res, rawToken, expiresAt);

    await logAudit({
      actorUserId: user._id,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      targetId: user._id.toString(),
      ipAddress: req.clientIp || "",
      userAgent: req.userAgent || "",
      meta: { email: normalizedEmail, provider: "google" }
    });

    return respondGoogleAuthCallback(res, {
      frontendOrigin: statePayload.frontendOrigin,
      title: "Completing Google sign-in",
      token,
    });
  } catch (error) {
    console.error("Google OAuth callback failed:", error?.message || error);
    return respondGoogleAuthError(res, {
      frontendOrigin,
      title: "Sign-in failed",
      message: "Google sign-in failed. Please try again.",
    });
  }
});

router.get("/email-task/resolve", async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Missing email task token." });
    }

    let tokenPayload;
    try {
      tokenPayload = jwt.verify(token, getJwtSecret());
    } catch (error) {
      if (error?.name === "TokenExpiredError") {
        return res.status(410).json({ error: "This email link has expired." });
      }
      return res.status(400).json({ error: "Invalid email task token." });
    }

    if (!tokenPayload || tokenPayload.purpose !== "email_task_link" || !tokenPayload.taskId) {
      return res.status(400).json({ error: "Invalid email task token." });
    }

    const task = await Task.findById(String(tokenPayload.taskId).trim())
      .select(
        "_id requestType title description status category urgency approvalStatus isEmergency deadline requesterId requesterName requesterDepartment requesterEmail assignedToId assignedTo assignedToName changeCount createdAt updatedAt campaign collaterals files changeHistory"
      )
      .lean();

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    const viewerPayload = getOptionalAuthPayload(req);
    const viewerRole = normalizeTaskRole(viewerPayload?.role);
    const viewerEmail = normalizeEmail(viewerPayload?.email);
    const viewerAccess = resolveEmailTaskViewerAccess(task, viewerPayload);
    const inputReferenceFiles = Array.isArray(task.files)
      ? task.files.filter((file) => String(file?.type || "").trim().toLowerCase() === "input")
      : [];

    const preview = {
      id: task._id?.toString?.() || "",
      requestType: task.requestType || "single_task",
      title: task.title || "Task",
      description: task.description || "",
      status: task.status || "pending",
      category: task.category || "",
      urgency: task.urgency || "normal",
      approvalStatus: task.approvalStatus || "",
      isEmergency: Boolean(task.isEmergency),
      deadline: task.deadline || null,
      requesterId: task.requesterId || "",
      requesterName: task.requesterName || "",
      requesterDepartment: task.requesterDepartment || "",
      requesterEmail: task.requesterEmail || "",
      assignedToId: task.assignedToId || task.assignedTo || "",
      assignedToName: task.assignedToName || "",
      changeCount: Number(task.changeCount || 0) || 0,
      referenceFileCount: inputReferenceFiles.length,
      ccEmails: viewerAccess.ccEmails,
      campaign: task.campaign
        ? {
            requestName: task.campaign.requestName || "",
            brief: task.campaign.brief || "",
            deadlineMode: task.campaign.deadlineMode || "common",
            commonDeadline: task.campaign.commonDeadline || null,
          }
        : null,
      collaterals: Array.isArray(task.collaterals)
        ? task.collaterals.map((collateral) => ({
            id: collateral?.id || "",
            title: collateral?.title || "",
            collateralType: collateral?.collateralType || "",
            platform: collateral?.platform || "",
            usageType: collateral?.usageType || "",
            width: collateral?.width,
            height: collateral?.height,
            unit: collateral?.unit || "px",
            sizeLabel: collateral?.sizeLabel || "",
            ratioLabel: collateral?.ratioLabel || "",
            customSizeLabel: collateral?.customSizeLabel || "",
            orientation: collateral?.orientation || "portrait",
            brief: collateral?.brief || "",
            deadline: collateral?.deadline || null,
            priority: collateral?.priority || "normal",
            status: collateral?.status || "pending",
            assignedToId: collateral?.assignedToId || "",
            assignedToName: collateral?.assignedToName || "",
            referenceFileCount: Array.isArray(collateral?.referenceFiles)
              ? collateral.referenceFiles.length
              : 0,
          }))
        : [],
      createdAt: task.createdAt || null,
      updatedAt: task.updatedAt || task.createdAt || null
    };

    return res.json({
      taskId: preview.id,
      preview,
      canOpenTask: viewerAccess.canOpenTask,
      openPath: preview.id ? `/task/${preview.id}` : "/dashboard",
      viewer: {
        isAuthenticated: Boolean(viewerPayload),
        role: viewerRole || "",
        email: viewerEmail || "",
        accessMode: viewerAccess.accessMode,
        accessReason: viewerAccess.accessReason,
      }
    });
  } catch {
    return res.status(500).json({ error: "Failed to resolve email task link." });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  req.skipAudit = true;
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.updateOne(
        { tokenHash, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokedReason: "logout" } }
      );
    }
    clearRefreshCookie(res);
    await logAuditFromRequest(req, "LOGOUT", req.user?._id?.toString?.() || "");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to logout." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "Failed to load user." });
  }
});

router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ preferences: user.notificationPreferences || {} });
  } catch (error) {
    res.status(500).json({ error: "Failed to load preferences." });
  }
});

router.patch("/preferences", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const current = user.notificationPreferences || {};
    const next = { ...current };
    if (typeof req.body?.emailNotifications === "boolean") {
      next.emailNotifications = req.body.emailNotifications;
    }
    if (typeof req.body?.whatsappNotifications === "boolean") {
      next.whatsappNotifications = req.body.whatsappNotifications;
    }
    if (typeof req.body?.deadlineReminders === "boolean") {
      next.deadlineReminders = req.body.deadlineReminders;
    }
    user.notificationPreferences = next;
    await user.save();
    res.json({ preferences: user.notificationPreferences });
  } catch (error) {
    res.status(500).json({ error: "Failed to update preferences." });
  }
});

router.post("/users", requireRole(["admin"]), async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    const allowedRoles = ["staff", "treasurer", "designer", "other", "admin"];

    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "Email already exists." });
    }

    const user = await User.create({
      email,
      password,
      role,
      name: name || ""
    });
    req.auditTargetId = user.id || user._id?.toString?.() || "";

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create user." });
  }
});

router.get("/users", requireRole(["admin"]), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map((user) => user.toJSON()));
  } catch (error) {
    res.status(500).json({ error: "Failed to load users." });
  }
});

export default router;

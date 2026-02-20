import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { Readable } from "stream";
import { fileURLToPath } from "url";

const DRIVE_SCOPE_FULL = "https://www.googleapis.com/auth/drive";
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const readEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const resolveBackendPath = (value) =>
  path.isAbsolute(value) ? value : path.resolve(BACKEND_ROOT, value);

const parseBooleanEnv = (value, defaultValue = false) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  return TRUTHY_ENV_VALUES.has(normalized);
};

const parseJsonEnvValue = ({ jsonValue, base64Value, jsonVarName, base64VarName }) => {
  const rawJson = String(jsonValue || "").trim();
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch {
      throw new Error(`${jsonVarName} is not valid JSON.`);
    }
  }

  const rawBase64 = String(base64Value || "").trim();
  if (rawBase64) {
    try {
      const decoded = Buffer.from(rawBase64, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch {
      throw new Error(`${base64VarName} is not valid base64 JSON.`);
    }
  }

  return null;
};

const normalizeServiceAccountCredentials = (credentials) => {
  if (!credentials || typeof credentials !== "object") return credentials;
  if (typeof credentials.private_key !== "string") return credentials;
  return {
    ...credentials,
    // Some deployment systems escape newlines in env values; normalize before auth.
    private_key: credentials.private_key.replace(/\\n/g, "\n"),
  };
};

const parseServiceAccountCredentialsFromSplitEnv = () => {
  const projectId = readEnv("GOOGLE_PROJECT_ID", "GOOGLE_DRIVE_PROJECT_ID");
  const privateKeyId = readEnv("GOOGLE_PRIVATE_KEY_ID", "GOOGLE_DRIVE_PRIVATE_KEY_ID");
  const privateKey = readEnv("GOOGLE_PRIVATE_KEY", "GOOGLE_DRIVE_PRIVATE_KEY");
  const clientEmail = readEnv("GOOGLE_CLIENT_EMAIL", "GOOGLE_DRIVE_CLIENT_EMAIL");

  const hasAnyField = Boolean(projectId || privateKeyId || privateKey || clientEmail);
  if (!hasAnyField) {
    return null;
  }
  if (!projectId || !privateKey || !clientEmail) {
    throw new Error(
      "Incomplete Google service account env vars. Set GOOGLE_PROJECT_ID, GOOGLE_PRIVATE_KEY, and GOOGLE_CLIENT_EMAIL."
    );
  }

  return normalizeServiceAccountCredentials({
    type: "service_account",
    project_id: projectId,
    private_key_id: privateKeyId || undefined,
    private_key: privateKey,
    client_email: clientEmail,
  });
};

const getGoogleErrorReason = (error) => {
  const responseErrors = error?.response?.data?.error?.errors;
  if (Array.isArray(responseErrors) && responseErrors.length > 0) {
    return String(responseErrors[0]?.reason || "");
  }
  const directErrors = error?.errors;
  if (Array.isArray(directErrors) && directErrors.length > 0) {
    return String(directErrors[0]?.reason || "");
  }
  return "";
};

const isParentPermissionError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const reason = getGoogleErrorReason(error).toLowerCase();
  return (
    message.includes("insufficient permissions for the specified parent") ||
    (message.includes("file not found") && message.includes("parent")) ||
    reason === "insufficientfilepermissions" ||
    reason === "forbidden" ||
    reason === "notfound"
  );
};

const resolveKeyFile = () => {
  const keyFile = process.env.GOOGLE_DRIVE_KEYFILE;
  if (!keyFile) {
    return null;
  }
  const resolvedPath = resolveBackendPath(keyFile);
  return fs.existsSync(resolvedPath) ? resolvedPath : null;
};

const parseServiceAccountCredentialsFromEnv = () => {
  const splitCredentials = parseServiceAccountCredentialsFromSplitEnv();
  if (splitCredentials) {
    return splitCredentials;
  }

  const parsed = parseJsonEnvValue({
    jsonValue: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
    base64Value: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64,
    jsonVarName: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
    base64VarName: "GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64",
  });
  return normalizeServiceAccountCredentials(parsed);
};

const parseOAuthTokenFromSplitEnv = () => {
  const refreshToken = readEnv("GOOGLE_REFRESH_TOKEN", "GOOGLE_DRIVE_REFRESH_TOKEN");
  const accessToken = readEnv("GOOGLE_ACCESS_TOKEN", "GOOGLE_DRIVE_ACCESS_TOKEN");

  const hasAnyField = Boolean(refreshToken || accessToken);
  if (!hasAnyField) {
    return null;
  }
  if (!refreshToken) {
    throw new Error(
      "Incomplete Drive OAuth env vars. Set GOOGLE_REFRESH_TOKEN (or GOOGLE_DRIVE_REFRESH_TOKEN)."
    );
  }

  return {
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
  };
};

const parseOAuthTokenFromEnv = () => {
  const splitToken = parseOAuthTokenFromSplitEnv();
  if (splitToken) {
    return splitToken;
  }
  return parseJsonEnvValue({
    jsonValue: process.env.GOOGLE_DRIVE_OAUTH_TOKEN_JSON,
    base64Value: process.env.GOOGLE_DRIVE_OAUTH_TOKEN_BASE64,
    jsonVarName: "GOOGLE_DRIVE_OAUTH_TOKEN_JSON",
    base64VarName: "GOOGLE_DRIVE_OAUTH_TOKEN_BASE64",
  });
};

const getServiceAccountClient = () => {
  const envCredentials = parseServiceAccountCredentialsFromEnv();
  if (envCredentials) {
    return new google.auth.GoogleAuth({
      credentials: envCredentials,
      scopes: [DRIVE_SCOPE_FULL],
    });
  }

  const keyFile = resolveKeyFile();
  if (!keyFile) {
    throw new Error(
      "Google Drive service account credentials are missing. Set GOOGLE_PROJECT_ID/GOOGLE_PRIVATE_KEY/GOOGLE_CLIENT_EMAIL (recommended), GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64/JSON, or GOOGLE_DRIVE_KEYFILE."
    );
  }
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: [DRIVE_SCOPE_FULL],
  });
};

const resolveTokenPath = () => {
  const tokenPath = process.env.GOOGLE_DRIVE_TOKEN_PATH;
  if (!tokenPath) {
    return null;
  }
  return resolveBackendPath(tokenPath);
};

const resolveOAuthToken = () => {
  const envToken = parseOAuthTokenFromEnv();
  if (envToken) {
    return envToken;
  }
  const tokenPath = resolveTokenPath();
  if (!tokenPath || !fs.existsSync(tokenPath)) {
    throw new Error(
      "Drive OAuth not connected. Set GOOGLE_REFRESH_TOKEN (recommended), GOOGLE_DRIVE_OAUTH_TOKEN_BASE64/JSON, or configure GOOGLE_DRIVE_TOKEN_PATH."
    );
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
};

const getOAuthClient = () => {
  const clientId = readEnv("GOOGLE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET", "GOOGLE_DRIVE_CLIENT_SECRET");
  const redirectUri = readEnv("GOOGLE_REDIRECT_URI", "GOOGLE_DRIVE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI (or GOOGLE_DRIVE_CLIENT_ID/SECRET/REDIRECT_URI) must be set for OAuth."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const getDriveClient = () => {
  const useOAuth = parseBooleanEnv(process.env.GOOGLE_DRIVE_OAUTH);
  if (!useOAuth) {
    const auth = getServiceAccountClient();
    return google.drive({ version: "v3", auth });
  }
  const oauth = getOAuthClient();
  const token = resolveOAuthToken();
  oauth.setCredentials(token);
  return google.drive({ version: "v3", auth: oauth });
};

export const getDriveAuthUrl = () => {
  const oauth = getOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [DRIVE_SCOPE_FULL],
  });
};

export const saveDriveToken = async (code) => {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  const tokenPath = resolveTokenPath();
  if (tokenPath) {
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  }
  return { tokens, tokenPath };
};

const sanitizeFolderName = (name) =>
  name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

const findOrCreateFolder = async (drive, { name, parentId }) => {
  const safeName = sanitizeFolderName(name);
  if (!safeName) return parentId;

  const existing = await drive.files.list({
    q: [
      "mimeType = 'application/vnd.google-apps.folder'",
      `name = '${safeName.replace(/'/g, "\\'")}'`,
      parentId ? `'${parentId}' in parents` : null,
      "trashed = false",
    ]
      .filter(Boolean)
      .join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  const match = existing.data.files?.[0];
  if (match?.id) {
    return match.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return created.data.id || parentId;
};

export const uploadToDrive = async ({ buffer, filename, mimeType, folderId, makePublic, subfolderName }) => {
  const drive = getDriveClient();
  const useDateFolders = parseBooleanEnv(process.env.DRIVE_DATE_FOLDERS, true);
  let targetFolder = folderId || undefined;

  if (useDateFolders && folderId) {
    try {
      const dateLabel = new Date().toISOString().slice(0, 10);
      targetFolder = await findOrCreateFolder(drive, { name: dateLabel, parentId: folderId });
    } catch (error) {
      if (isParentPermissionError(error)) {
        console.warn("Drive base folder is not accessible; falling back to Drive root.");
        targetFolder = undefined;
      } else {
        throw error;
      }
    }
  }

  if (subfolderName) {
    try {
      targetFolder = await findOrCreateFolder(drive, { name: subfolderName, parentId: targetFolder });
    } catch (error) {
      if (isParentPermissionError(error)) {
        console.warn("Drive subfolder is not accessible; uploading to Drive root.");
        targetFolder = undefined;
      } else {
        throw error;
      }
    }
  }

  const createFile = (parentFolderId) =>
    drive.files.create({
      requestBody: {
        name: filename,
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id,name,webViewLink,webContentLink,size,thumbnailLink",
      supportsAllDrives: true,
    });

  let createResponse;
  try {
    createResponse = await createFile(targetFolder);
  } catch (error) {
    if (targetFolder && isParentPermissionError(error)) {
      console.warn("Drive parent folder is not writable; retrying upload in Drive root.");
      createResponse = await createFile(undefined);
    } else {
      throw error;
    }
  }

  const file = createResponse.data;
  if (makePublic && file?.id) {
    try {
      await drive.permissions.create({
        fileId: file.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
        supportsAllDrives: true,
      });
    } catch (error) {
      console.warn("Failed to make uploaded Drive file public:", error?.message || error);
    }
  }

  return file;
};

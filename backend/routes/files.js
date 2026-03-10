import express from "express";
import multer from "multer";
import {
  createDriveResumableUploadSession,
  getDriveClient,
  getDriveRequestHeaders,
  makeDriveFilePublic,
  uploadToDrive,
} from "../lib/drive.js";
import { extractText } from "../lib/extractor.js";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole(["staff", "designer", "treasurer"]));

const maxUploadBytes = Number(process.env.UPLOAD_MAX_BYTES || 50 * 1024 * 1024);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
  },
});
const maxWorkingUploadBytes = Number(
  process.env.WORKING_UPLOAD_MAX_BYTES || Math.floor(2.5 * 1024 * 1024 * 1024)
);
const workingUploadChunkBytes = Number(
  process.env.WORKING_UPLOAD_CHUNK_BYTES || 16 * 1024 * 1024
);
const workingChunkUpload = express.raw({
  type: "application/octet-stream",
  limit: workingUploadChunkBytes,
});
const isDriveParentPermissionError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const reason = String(error?.response?.data?.error?.errors?.[0]?.reason || "").toLowerCase();
  return (
    message.includes("insufficient permissions for the specified parent") ||
    reason === "insufficientfilepermissions" ||
    reason === "notfound"
  );
};

const isDriveAuthFailure = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const reason = String(error?.response?.data?.error?.errors?.[0]?.reason || "").toLowerCase();
  const apiError = String(error?.response?.data?.error || "").toLowerCase();
  const apiMessage = String(error?.response?.data?.error?.message || "").toLowerCase();
  const apiDescription = String(error?.response?.data?.error_description || "").toLowerCase();
  const statusCode = Number(
    error?.response?.status || error?.response?.data?.error?.code || error?.status || 0
  );
  return (
    message.includes("invalid_grant") ||
    message.includes("deleted_client") ||
    message.includes("invalid_client") ||
    message.includes("invalid credentials") ||
    message.includes("invalid jwt signature") ||
    message.includes("unauthorized_client") ||
    apiError === "invalid_grant" ||
    apiError === "deleted_client" ||
    apiError === "invalid_client" ||
    apiError === "unauthorized_client" ||
    apiMessage.includes("invalid credentials") ||
    apiDescription.includes("invalid jwt signature") ||
    apiDescription.includes("token has been expired or revoked") ||
    reason === "autherror" ||
    reason === "invalidcredentials" ||
    statusCode === 401
  );
};
const buildDriveViewLink = (fileId) => {
  const normalizedId = String(fileId || "").trim();
  if (!normalizedId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(normalizedId)}/view?usp=drivesdk`;
};
const buildDriveDownloadLink = (fileId) => {
  const normalizedId = String(fileId || "").trim();
  if (!normalizedId) return "";
  return `https://drive.google.com/uc?id=${encodeURIComponent(normalizedId)}&export=download`;
};
const buildTaskSubfolderPath = ({ aiMode, taskId, taskTitle, taskSection }) => {
  const normalizedTaskId = String(taskId || "").trim();
  const normalizedTaskTitle = String(taskTitle || "").trim();
  const normalizedTaskSection = String(taskSection || "").trim();
  const taskFolderLabel = normalizedTaskId
    ? `Task-${normalizedTaskId}`
    : normalizedTaskTitle;
  const subfolderPath = aiMode
    ? ["AI Mode Files"]
    : [
      ...(taskFolderLabel ? [taskFolderLabel] : []),
      ...(normalizedTaskSection ? [normalizedTaskSection] : []),
    ];

  return {
    taskFolderLabel,
    subfolderPath,
  };
};
const parseUploadedRange = (rangeHeader) => {
  const match = String(rangeHeader || "").match(/bytes=0-(\d+)/i);
  if (!match) return 0;
  const end = Number(match[1]);
  if (!Number.isFinite(end) || end < 0) return 0;
  return end + 1;
};
const parseTotalBytesFromContentRange = (value) => {
  const match = String(value || "").match(/bytes\s+\d+-\d+\/(\d+)/i);
  if (!match) return 0;
  const total = Number(match[1]);
  return Number.isFinite(total) && total > 0 ? total : 0;
};
const readJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("File upload request received.");
    if (!req.file) {
      console.warn("Upload missing file payload.");
      return res.status(400).json({ error: "File is required." });
    }

    const { aiMode, taskTitle } = req.body;
    const taskId = String(req.body?.taskId || "").trim();
    const taskSection = String(req.body?.taskSection || "").trim();
    const uploadedBy = req.user?.email || req.user?.name || req.body.uploadedBy || "Guest";
    const isAiMode = aiMode === "true";

    const baseFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    const makePublic = process.env.DRIVE_PUBLIC !== "false";
    const { taskFolderLabel, subfolderPath } = buildTaskSubfolderPath({
      aiMode: isAiMode,
      taskId,
      taskTitle,
      taskSection,
    });

    let file;
    try {
      file = await uploadToDrive({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        folderId: baseFolderId,
        makePublic,
        subfolderPath: subfolderPath.length > 0 ? subfolderPath : undefined,
      });
    } catch (error) {
      const canRetryInTaskFolder =
        !isAiMode &&
        subfolderPath.length > 1 &&
        taskFolderLabel;
      if (!canRetryInTaskFolder) {
        throw error;
      }

      console.warn(
        "Nested Drive folder upload failed; retrying in task folder:",
        error?.message || error
      );
      file = await uploadToDrive({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        folderId: baseFolderId,
        makePublic,
        subfolderPath: [taskFolderLabel],
      });
    }
    req.auditTargetId = file?.id || "";

    console.log("Drive upload success:", file?.id);

    let extractedContent = "";
    if (isAiMode) {
      extractedContent = await extractText(req.file.buffer, req.file.mimetype);

      // Save metadata to MongoDB
      const aiFile = new AIFile({
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        driveId: file.id,
        driveUrl: file.webViewLink,
        extractedContent,
        uploadedBy,
      });
      await aiFile.save();
      console.log("AI File metadata saved to MongoDB");
    }

    const webViewLink = file?.webViewLink || buildDriveViewLink(file?.id);
    const webContentLink = file?.webContentLink || buildDriveDownloadLink(file?.id);

    res.json({
      id: file.id,
      name: file.name,
      webViewLink,
      webContentLink,
      size: req.file.size,
      thumbnailLink: file.thumbnailLink,
      extractedContent, // Return extracted content for UI usage
    });
  } catch (error) {
    console.error("File upload failed:", error?.message || error);
    if (isDriveAuthFailure(error)) {
      const detail = String(error?.message || "").trim();
      const isLocalDev =
        process.env.NODE_ENV !== "production" ||
        String(process.env.FRONTEND_URL || "").includes("localhost");
      return res.status(500).json({
        error:
          isLocalDev && detail
            ? `Google Drive authentication failed: ${detail}`
            : "Google Drive authentication failed. Update OAuth env vars (GOOGLE_REFRESH_TOKEN / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) or service-account env vars (GOOGLE_PROJECT_ID / GOOGLE_PRIVATE_KEY / GOOGLE_CLIENT_EMAIL), then redeploy.",
      });
    }
    if (isDriveParentPermissionError(error)) {
      return res.status(500).json({
        error: "Drive upload folder is not accessible. Reconnect Drive and ensure the destination folder is shared with the connected account.",
      });
    }
    res.status(500).json({ error: error?.message || "Upload failed." });
  }
});

router.post("/resumable/init", async (req, res) => {
  try {
    const filename = String(req.body?.filename || "").trim();
    const mimeType = String(req.body?.mimeType || "application/octet-stream").trim();
    const fileSize = Number(req.body?.size || 0);
    const taskId = String(req.body?.taskId || "").trim();
    const taskTitle = String(req.body?.taskTitle || "").trim();
    const taskSection = String(req.body?.taskSection || "").trim();

    if (!filename) {
      return res.status(400).json({ error: "Filename is required." });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({ error: "Valid file size is required." });
    }
    if (fileSize > maxWorkingUploadBytes) {
      return res.status(413).json({
        error: `Working file too large. Max ${Math.round(maxWorkingUploadBytes / (1024 * 1024 * 1024) * 10) / 10} GB.`,
      });
    }

    const baseFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    const { taskFolderLabel, subfolderPath } = buildTaskSubfolderPath({
      aiMode: false,
      taskId,
      taskTitle,
      taskSection,
    });

    let session;
    try {
      session = await createDriveResumableUploadSession({
        filename,
        mimeType,
        fileSize,
        folderId: baseFolderId,
        subfolderPath,
      });
    } catch (error) {
      const canRetryInTaskFolder =
        subfolderPath.length > 1 &&
        taskFolderLabel;
      if (!canRetryInTaskFolder) {
        throw error;
      }
      console.warn(
        "Nested Drive resumable session failed; retrying in task folder:",
        error?.message || error
      );
      session = await createDriveResumableUploadSession({
        filename,
        mimeType,
        fileSize,
        folderId: baseFolderId,
        subfolderPath: [taskFolderLabel],
      });
    }

    return res.json({
      sessionUri: session.sessionUri,
      chunkSize: workingUploadChunkBytes,
      maxBytes: maxWorkingUploadBytes,
    });
  } catch (error) {
    console.error("Resumable upload init failed:", error?.message || error);
    if (isDriveAuthFailure(error)) {
      return res.status(500).json({
        error: "Google Drive authentication failed. Update Drive credentials and redeploy.",
      });
    }
    if (isDriveParentPermissionError(error)) {
      return res.status(500).json({
        error: "Drive upload folder is not accessible. Reconnect Drive and ensure the destination folder is shared with the connected account.",
      });
    }
    return res.status(500).json({ error: error?.message || "Failed to initialize resumable upload." });
  }
});

router.put("/resumable/chunk", workingChunkUpload, async (req, res) => {
  try {
    const sessionUri = String(req.headers["x-upload-session-uri"] || "").trim();
    const contentRange = String(req.headers["x-upload-content-range"] || "").trim();
    const contentType = String(req.headers["x-upload-content-type"] || "application/octet-stream").trim();
    const totalBytes = parseTotalBytesFromContentRange(contentRange);
    const makePublic = process.env.DRIVE_PUBLIC !== "false";
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);

    if (!sessionUri) {
      return res.status(400).json({ error: "Upload session is required." });
    }
    if (!contentRange) {
      return res.status(400).json({ error: "Upload content range is required." });
    }
    if (body.length === 0) {
      return res.status(400).json({ error: "Chunk payload is required." });
    }

    const driveHeaders = await getDriveRequestHeaders(sessionUri);
    const response = await fetch(sessionUri, {
      method: "PUT",
      headers: {
        ...driveHeaders,
        "Content-Length": String(body.length),
        "Content-Range": contentRange,
        "Content-Type": contentType || "application/octet-stream",
      },
      body,
    });

    if (response.status === 308) {
      return res.json({
        complete: false,
        uploadedBytes: parseUploadedRange(response.headers.get("range")),
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const normalizedDetail = detail.trim().toLowerCase();
      if (response.status === 401 || normalizedDetail.includes("invalid credentials")) {
        return res.status(500).json({
          error: "Google Drive authentication failed. Update Drive credentials and redeploy.",
          detail: detail.trim() || "Drive upload failed with invalid credentials.",
        });
      }
      return res.status(response.status).json({
        error: "Chunk upload failed.",
        detail: detail.trim() || `Drive upload failed (${response.status}).`,
      });
    }

    const payload = await readJsonSafe(response);
    if (makePublic && payload?.id) {
      try {
        await makeDriveFilePublic(payload.id);
      } catch (error) {
        console.warn("Failed to make resumable Drive file public:", error?.message || error);
      }
    }

    return res.json({
      complete: true,
      uploadedBytes: totalBytes || body.length,
      file: {
        id: payload?.id,
        name: payload?.name,
        webViewLink: payload?.webViewLink || buildDriveViewLink(payload?.id),
        webContentLink: payload?.webContentLink || buildDriveDownloadLink(payload?.id),
        size: payload?.size ? Number(payload.size) : totalBytes || body.length,
        mimeType: payload?.mimeType || contentType,
        thumbnailLink: payload?.thumbnailLink,
      },
    });
  } catch (error) {
    console.error("Resumable chunk upload failed:", error?.message || error);
    if (isDriveAuthFailure(error)) {
      return res.status(500).json({
        error: "Google Drive authentication failed. Update Drive credentials and redeploy.",
        detail: error?.message || "Unexpected Drive authentication error.",
      });
    }
    return res.status(500).json({
      error: "Chunk upload failed.",
      detail: error?.message || "Unexpected upload error.",
    });
  }
});

router.use((err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.round(maxUploadBytes / (1024 * 1024));
      return res.status(413).json({ error: `File too large. Max ${maxMb}MB.` });
    }
    return res.status(400).json({ error: err.message || "Upload failed." });
  }
  return next(err);
});

router.post("/ai-process", async (req, res) => {
  try {
    const { fileId, action, instruction } = req.body;

    if (!fileId || !action) {
      return res.status(400).json({ error: "fileId and action are required." });
    }
    req.auditTargetId = fileId;

    // 1. Get file metadata/content from MongoDB
    const aiFile = await AIFile.findOne({ driveId: fileId });
    if (!aiFile) {
      return res.status(404).json({ error: "File not found or not processed for AI." });
    }

    const extractedText = aiFile.extractedContent;
    if (!extractedText) {
      return res.status(400).json({ error: "No text found in file to process." });
    }

    // 2. Prepare Master Prompt
    const masterPrompt = `If the document is already good, still enhance it slightly instead of repeating it.
You are an expert content editor and communication specialist.

Your task is to carefully read the uploaded document and transform it based on the user's selected action and instruction.

STRICT RULES:
- Always read and use the FULL document content
- Preserve the original meaning
- Improve clarity, structure, and language quality
- Make the content professional and submission-ready
- Do NOT explain what you are doing
- Do NOT add meta comments
- Output ONLY the final processed content

USER ACTION:
{{ACTION}}

USER INSTRUCTION (optional):
{{USER_INSTRUCTION}}

DOCUMENT CONTENT:
{{FILE_TEXT}}`;

    const finalPrompt = masterPrompt
      .replace("{{ACTION}}", action)
      .replace("{{USER_INSTRUCTION}}", instruction || "None")
      .replace("{{FILE_TEXT}}", extractedText);

    console.log(`Processing AI request for action: ${action}`);

    // 3. Generate content via Ollama
    const processedContent = await generateAIContent(finalPrompt);

    res.json({
      originalName: aiFile.originalName,
      action,
      processedContent
    });

  } catch (error) {
    console.error("AI processing failed:", error?.message || error);
    res.status(500).json({ error: error?.message || "AI processing failed." });
  }
});

router.post("/metadata", async (req, res) => {
  try {
    const fileId = req.body?.fileId;
    if (!fileId) {
      return res.status(400).json({ error: "File id is required." });
    }
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,thumbnailLink",
      supportsAllDrives: true,
    });
    const sizeValue = response?.data?.size ? Number(response.data.size) : undefined;
    res.json({
      id: response?.data?.id,
      name: response?.data?.name,
      mimeType: response?.data?.mimeType,
      size: Number.isNaN(sizeValue) ? undefined : sizeValue,
      thumbnailLink: response?.data?.thumbnailLink,
    });
  } catch (error) {
    console.error("Drive metadata lookup failed:", error?.message || error);
    res.status(500).json({ error: "Failed to load file metadata." });
  }
});

router.get("/download/:fileId", async (req, res) => {
  try {
    const fileId = String(req.params?.fileId || "").trim();
    if (!fileId) {
      return res.status(400).json({ error: "File id is required." });
    }
    req.auditTargetId = fileId;

    const drive = getDriveClient();
    const metaResponse = await drive.files.get({
      fileId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });

    const fileName = String(metaResponse?.data?.name || "download");
    const mimeType = String(metaResponse?.data?.mimeType || "application/octet-stream");

    const mediaResponse = await drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "stream" }
    );

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    mediaResponse.data.on("error", (streamError) => {
      console.error("Drive download stream failed:", streamError?.message || streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download file." });
      } else {
        res.end();
      }
    });

    mediaResponse.data.pipe(res);
  } catch (error) {
    console.error("Drive download failed:", error?.message || error);
    res.status(500).json({ error: "Failed to download file." });
  }
});

export default router;

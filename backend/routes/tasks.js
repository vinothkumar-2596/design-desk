import express from "express";
import Task from "../models/Task.js";
import TaskView from "../models/TaskView.js";
import mongoose from "mongoose";
import JSZip from "jszip";
import { getDriveClient } from "../lib/drive.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import {
  sendFinalFilesEmail,
  sendFinalFilesSms,
  sendTaskCreatedSms,
  sendCommentNotificationSms,
  sendStatusUpdateSms,
  sendSms,
} from "../lib/notifications.js";
import {
  createNotification,
  createNotificationsForUsers,
} from "../lib/notificationService.js";
import { getSocket } from "../socket.js";
import { requireRole } from "../middleware/auth.js";
import { globalLimiter } from "../middleware/rateLimit.js";
import {
  buildDesignerPortalId,
  getDesignerScope,
  hasMainDesignerConfig,
  isMainDesignerUser,
} from "../lib/designerAccess.js";

const router = express.Router();
const TASK_ROLES = ["staff", "designer", "treasurer", "admin", "other", "manager"];
router.use(requireRole(TASK_ROLES));

const getUserId = (req) => (req.user?._id ? req.user._id.toString() : "");
const getViewerId = (viewer) =>
  String(viewer?._id || viewer?.id || viewer?.userId || "").trim();
const getTaskDocumentId = (task) => String(task?.id || task?._id || "").trim();
const normalizeValue = (value) => (value ? String(value).trim().toLowerCase() : "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
const normalizeId = (value) => {
  if (value === undefined || value === null) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  if (EMPTY_ID_VALUES.has(normalized.toLowerCase())) return "";
  return normalized;
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const EXCLUDED_ASSIGNABLE_DESIGNER_EMAILS = new Set();
const EXCLUDED_ASSIGNABLE_DESIGNER_KEYWORDS = ["demo", "debug"];
const hasExcludedAssignableDesignerKeyword = (value) => {
  const normalized = normalizeValue(value);
  if (!normalized) return false;
  return EXCLUDED_ASSIGNABLE_DESIGNER_KEYWORDS.some((keyword) => normalized.includes(keyword));
};
const isExcludedAssignableDesigner = (designer) => {
  const email = normalizeValue(designer?.email);
  if (email && EXCLUDED_ASSIGNABLE_DESIGNER_EMAILS.has(email)) {
    return true;
  }
  return (
    hasExcludedAssignableDesignerKeyword(designer?.name) ||
    hasExcludedAssignableDesignerKeyword(designer?.email)
  );
};
const isObjectIdLike = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const buildAssignmentActorLabel = (user) => {
  const role = normalizeTaskRole(user?.role);
  if (role === "designer" && isMainDesignerUser(user)) {
    const portalId = buildDesignerPortalId(user);
    return portalId ? `Design Lead (${portalId})` : "Design Lead";
  }
  if (role === "admin") return "Admin";
  if (role === "treasurer") return "Treasurer";
  return String(user?.name || user?.email || "Manager").trim() || "Manager";
};
const resolveAssignedIdentifier = (task) => {
  const assignedToId = normalizeId(task?.assignedToId);
  if (assignedToId) return assignedToId;
  const legacyAssigned = normalizeId(task?.assignedTo);
  if (!legacyAssigned) return "";
  // Ignore legacy name-like values carried in old assignedTo fields.
  if (isObjectIdLike(legacyAssigned) || EMAIL_REGEX.test(legacyAssigned)) {
    return legacyAssigned;
  }
  return "";
};
const normalizeEmailList = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeValue(entry))
        .filter(Boolean)
    )
  );
};
const toObjectId = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};
const buildTaskLink = (taskId) => (taskId ? `/task/${taskId}` : "");
const ASSIGNMENT_META_FIELDS = new Set([
  "assigned_designer",
  "task_status",
  "cc_emails"
]);
const defaultNotificationPreferences = {
  emailNotifications: true,
  whatsappNotifications: false,
  deadlineReminders: true,
};

const emitNotification = (notification) => {
  if (!notification) return;
  const io = getSocket();
  if (!io) return;
  const data = typeof notification.toJSON === "function" ? notification.toJSON() : notification;
  if (!data?.userId) return;
  io.to(String(data.userId)).emit("notification:new", data);
};

const emitNotifications = (notifications) => {
  if (!Array.isArray(notifications)) return;
  notifications.forEach((note) => emitNotification(note));
};

const getUserIdsByRole = async (roles = []) => {
  if (!roles.length) return [];
  const users = await User.find({
    role: { $in: roles },
    isActive: { $ne: false }
  }).select("_id");
  return users.map((user) => user._id.toString());
};

const getActiveDesignerUsers = async () => {
  const designers = await User.find({
    role: "designer",
    isActive: { $ne: false },
    email: { $nin: Array.from(EXCLUDED_ASSIGNABLE_DESIGNER_EMAILS) }
  })
    .sort({ name: 1, email: 1 })
    .select("_id name email role");

  return designers.filter((designer) => !isExcludedAssignableDesigner(designer));
};

const splitDesignersByScope = (designers = []) => {
  const mainDesigners = [];
  const juniorDesigners = [];
  designers.forEach((designer) => {
    if (getDesignerScope(designer) === "main") {
      mainDesigners.push(designer);
      return;
    }
    juniorDesigners.push(designer);
  });
  return { mainDesigners, juniorDesigners };
};

const getQueueDesignerUserIds = async () => {
  const designers = await getActiveDesignerUsers();
  if (!hasMainDesignerConfig()) {
    return designers.map((designer) => designer._id?.toString?.() || "").filter(Boolean);
  }
  const { mainDesigners } = splitDesignersByScope(designers);
  return mainDesigners.map((designer) => designer._id?.toString?.() || "").filter(Boolean);
};

const resolveUserIdByEmail = async (email) => {
  const normalized = normalizeValue(email);
  if (!normalized) return "";
  const user = await User.findOne({ email: normalized });
  return user?._id?.toString?.() || "";
};

const resolveNotificationPreferences = async ({ userId, email, fallbackUser }) => {
  if (fallbackUser && userId) {
    const fallbackId =
      typeof fallbackUser._id === "string"
        ? fallbackUser._id
        : fallbackUser._id?.toString?.();
    if (fallbackId && fallbackId === userId) {
      return { ...defaultNotificationPreferences, ...(fallbackUser.notificationPreferences || {}) };
    }
  }
  let user = null;
  if (userId) {
    user = await User.findById(userId).select("notificationPreferences");
  } else if (email) {
    const normalized = normalizeValue(email);
    if (normalized) {
      user = await User.findOne({ email: normalized }).select("notificationPreferences");
    }
  }
  return { ...defaultNotificationPreferences, ...(user?.notificationPreferences || {}) };
};

const buildFrontendTaskUrl = (taskId) => {
  const normalizedTaskId = String(taskId || "").trim();
  const baseUrl = String(process.env.FRONTEND_URL || "").trim();
  if (!normalizedTaskId || !baseUrl) return undefined;
  return `${baseUrl.replace(/\/$/, "")}/task/${normalizedTaskId}`;
};

const resolveRequesterEmailFromTask = async (task) => {
  let requesterEmail = String(task?.requesterEmail || "").trim();
  if (requesterEmail) return requesterEmail;

  const requesterId = String(task?.requesterId || "").trim();
  if (requesterId) {
    const requesterUser = await User.findById(requesterId).select("email");
    requesterEmail = String(requesterUser?.email || "").trim();
    if (requesterEmail) return requesterEmail;
  }

  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  const createdEntry = history.find((entry) => entry?.field === "created");
  if (createdEntry?.userId) {
    const requesterUser = await User.findById(createdEntry.userId).select("email");
    requesterEmail = String(requesterUser?.email || "").trim();
    if (requesterEmail) return requesterEmail;
  }

  if (createdEntry?.userName) {
    const requesterUser = await User.findOne({
      name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
      isActive: { $ne: false }
    }).select("email");
    requesterEmail = String(requesterUser?.email || "").trim();
  }

  return requesterEmail;
};

const sendTaskLifecycleEmailIfEnabled = async ({
  task,
  userId = "",
  email = "",
  fallbackUser,
  emailType,
  actorName = "",
  note = "",
  files = [],
  submittedAt = new Date(),
}) => {
  const resolvedEmail = String(email || "").trim() || await resolveRequesterEmailFromTask(task);
  const resolvedUserId = String(userId || task?.requesterId || "").trim();
  const requesterPrefs = await resolveNotificationPreferences({
    userId: resolvedUserId,
    email: resolvedEmail,
    fallbackUser,
  });

  if (!resolvedEmail || !requesterPrefs.emailNotifications) {
    return false;
  }

  const taskId = task?.id || task?._id?.toString?.() || "";
  return sendFinalFilesEmail({
    to: resolvedEmail,
    taskTitle: task?.title,
    files,
    designerName: actorName,
    taskUrl: buildFrontendTaskUrl(taskId),
    submittedAt,
    taskDetails: {
      id: taskId || task?._id,
      status: task?.status,
      category: task?.category,
      deadline: task?.deadline,
      requesterName: task?.requesterName,
      requesterEmail: resolvedEmail,
      requesterDepartment: task?.requesterDepartment,
      description: task?.description,
    },
    emailType,
    assignmentMessage: note,
  });
};

const normalizeAssignedName = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.replace(/\(.*?\)/g, "").trim();
};

const DRIVE_FILE_ID_PATTERNS = [
  /\/api\/files\/download\/([A-Za-z0-9_-]{10,})/i,
  /\/file(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
  /\/document(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
  /\/spreadsheets(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
  /\/presentation(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
  /\/forms(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
];

const extractDriveId = (...values) => {
  for (const value of values) {
    const source = String(value || "").trim();
    if (!source) continue;
    if (/^[A-Za-z0-9_-]{10,}$/.test(source)) {
      return source;
    }
    try {
      const parsed = new URL(source, "https://drive.google.com");
      const idFromQuery = String(parsed.searchParams.get("id") || "").trim();
      if (idFromQuery) {
        return idFromQuery;
      }
      const decodedPath = decodeURIComponent(parsed.pathname || "");
      for (const pattern of DRIVE_FILE_ID_PATTERNS) {
        const match = decodedPath.match(pattern);
        if (match?.[1]) {
          return match[1];
        }
      }
    } catch {
      // Fall through to raw regex extraction.
    }
    for (const pattern of DRIVE_FILE_ID_PATTERNS) {
      const match = source.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    const queryMatch = source.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
    if (queryMatch?.[1]) {
      return queryMatch[1];
    }
  }
  return "";
};

const buildDriveViewUrl = (driveId) => {
  const normalizedId = String(driveId || "").trim();
  if (!normalizedId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(normalizedId)}/view?usp=drivesdk`;
};

const buildDriveDownloadUrl = (driveId) => {
  const normalizedId = String(driveId || "").trim();
  if (!normalizedId) return "";
  return `https://drive.google.com/uc?id=${encodeURIComponent(normalizedId)}&export=download`;
};

const normalizeTaskFileLinks = (file) => {
  const fileData =
    typeof file?.toObject === "function" ? file.toObject() : { ...(file || {}) };
  const url = String(fileData?.url || "").trim();
  const driveId =
    String(fileData?.driveId || "").trim() ||
    extractDriveId(fileData?.webViewLink, fileData?.webContentLink, url);
  const webViewLink =
    String(fileData?.webViewLink || "").trim() ||
    (driveId ? buildDriveViewUrl(driveId) : "");
  const webContentLink =
    String(fileData?.webContentLink || "").trim() ||
    (driveId ? buildDriveDownloadUrl(driveId) : "");

  return {
    ...fileData,
    url: url || webViewLink || webContentLink,
    driveId,
    webViewLink,
    webContentLink,
  };
};

const normalizeTaskFileCollection = (files) =>
  Array.isArray(files) ? files.map((file) => normalizeTaskFileLinks(file)) : [];

const parseRequestedFileIds = (value) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .flatMap((entry) => String(entry || "").split(","))
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
};

const inferFileNameFromUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    return decodeURIComponent(
      (parsed.pathname || "")
        .split("/")
        .filter(Boolean)
        .pop() || ""
    ).trim();
  } catch {
    return "";
  }
};

const fetchRemoteFileBuffer = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Remote download failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const COLLATERAL_STATUS_ORDER = {
  pending: "pending",
  in_progress: "in_progress",
  submitted_for_review: "submitted_for_review",
  approved: "approved",
  rework: "rework",
  completed: "completed",
};
const COLLATERAL_PRIORITY_ORDER = {
  low: "low",
  normal: "normal",
  high: "high",
  critical: "critical",
};
const COLLATERAL_ORIENTATION_ORDER = {
  portrait: "portrait",
  landscape: "landscape",
  square: "square",
  custom: "custom",
};
const COLLATERAL_UNIT_ORDER = {
  px: "px",
  mm: "mm",
  cm: "cm",
  in: "in",
  ft: "ft",
};
const COLLATERAL_SIZE_MODE_ORDER = {
  preset: "preset",
  custom: "custom",
};
const COLLATERAL_PRIORITY_WEIGHT = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

const normalizeCollateralStatus = (value) => {
  const normalized = normalizeValue(value).replace(/[\s-]+/g, "_");
  return COLLATERAL_STATUS_ORDER[normalized] || "pending";
};

const normalizeCollateralPriority = (value) => {
  const normalized = normalizeValue(value).replace(/[\s-]+/g, "_");
  return COLLATERAL_PRIORITY_ORDER[normalized] || "normal";
};

const normalizeCollateralOrientation = (value, width, height) => {
  const normalized = normalizeValue(value).replace(/[\s-]+/g, "_");
  if (COLLATERAL_ORIENTATION_ORDER[normalized]) {
    return COLLATERAL_ORIENTATION_ORDER[normalized];
  }
  if (width && height) {
    if (width === height) return "square";
    return width > height ? "landscape" : "portrait";
  }
  return "custom";
};

const normalizeCollateralUnit = (value) => {
  const normalized = normalizeValue(value);
  return COLLATERAL_UNIT_ORDER[normalized] || "px";
};

const normalizeCollateralSizeMode = (value) => {
  const normalized = normalizeValue(value);
  return COLLATERAL_SIZE_MODE_ORDER[normalized] || "preset";
};

const normalizeCampaignDeadlineMode = (value) => {
  const normalized = normalizeValue(value);
  return normalized === "itemized" ? "itemized" : "common";
};

const parseOptionalDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const deriveTaskUrgencyFromCollaterals = (collaterals = []) => {
  const highest = collaterals.reduce((current, collateral) => {
    const priority = normalizeCollateralPriority(collateral?.priority);
    return COLLATERAL_PRIORITY_WEIGHT[priority] > COLLATERAL_PRIORITY_WEIGHT[current]
      ? priority
      : current;
  }, "low");

  if (highest === "critical") return "urgent";
  if (highest === "high") return "intermediate";
  if (highest === "normal") return "normal";
  return "low";
};

const inferTaskCategoryFromCollateralType = (value) => {
  const normalized = normalizeValue(value);
  if (!normalized) return "campaign_or_others";
  if (["standee", "banner", "arch", "backdrop"].some((keyword) => normalized.includes(keyword))) {
    return normalized.includes("led") ? "led_backdrop" : "banner";
  }
  if (
    ["instagram", "facebook", "youtube", "whatsapp", "social", "story", "poster"].some((keyword) =>
      normalized.includes(keyword)
    )
  ) {
    return "social_media_creative";
  }
  if (normalized.includes("brochure")) return "brochure";
  if (normalized.includes("flyer")) return "flyer";
  return "campaign_or_others";
};

const deriveTaskCategoryFromCollaterals = (collaterals = []) => {
  if (!Array.isArray(collaterals) || collaterals.length === 0) {
    return "campaign_or_others";
  }

  const counts = new Map();
  collaterals.forEach((collateral) => {
    const category = inferTaskCategoryFromCollateralType(
      collateral?.collateralType || collateral?.platform || collateral?.usageType
    );
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  let winner = "campaign_or_others";
  let highest = -1;
  counts.forEach((count, category) => {
    if (count > highest) {
      highest = count;
      winner = category;
    }
  });

  return winner;
};

const deriveTaskStatusFromCollaterals = (collaterals = [], fallback = "pending") => {
  if (!Array.isArray(collaterals) || collaterals.length === 0) return fallback;
  const statuses = collaterals.map((collateral) => normalizeCollateralStatus(collateral?.status));

  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.some((status) => status === "rework")) return "clarification_required";
  if (statuses.some((status) => status === "in_progress" || status === "approved")) {
    return "in_progress";
  }
  if (statuses.some((status) => status === "submitted_for_review")) return "under_review";
  if (statuses.every((status) => status === "pending")) return "pending";
  return fallback;
};

const deriveTaskDeadlineFromCollaterals = (collaterals = [], campaign = {}) => {
  if (normalizeCampaignDeadlineMode(campaign?.deadlineMode) === "common" && campaign?.commonDeadline) {
    return parseOptionalDate(campaign.commonDeadline);
  }

  const deadlines = collaterals
    .map((collateral) => parseOptionalDate(collateral?.deadline))
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  return deadlines[0];
};

const buildCampaignDescription = (brief = "", collaterals = []) => {
  const normalizedBrief = String(brief || "").trim();
  const collateralLines = collaterals.map((collateral, index) => {
    const parts = [
      collateral?.title || collateral?.presetLabel || collateral?.collateralType || `Collateral ${index + 1}`,
      collateral?.platform || collateral?.usageType,
      collateral?.customSizeLabel || collateral?.sizeLabel,
      collateral?.brief,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    return `${index + 1}. ${parts.join(" | ")}`;
  });

  const lines = [];
  if (normalizedBrief) {
    lines.push(normalizedBrief, "");
  }
  lines.push("Collateral Scope", ...collateralLines);
  return lines.join("\n");
};

const normalizeCampaignPayload = (campaign = {}, fallbacks = {}) => {
  const requestName = String(
    campaign?.requestName || fallbacks?.requestName || fallbacks?.title || ""
  ).trim();
  const brief = String(campaign?.brief || fallbacks?.brief || fallbacks?.description || "").trim();
  const deadlineMode = normalizeCampaignDeadlineMode(campaign?.deadlineMode);
  const commonDeadline = parseOptionalDate(campaign?.commonDeadline || fallbacks?.commonDeadline);

  return {
    requestName,
    brief,
    deadlineMode,
    commonDeadline,
  };
};

const normalizeCollateralInput = (input, options = {}) => {
  const now = options?.now || new Date();
  const defaultDeadline = parseOptionalDate(options?.defaultDeadline);
  const source = input || {};
  const width = toFiniteNumber(source?.width);
  const height = toFiniteNumber(source?.height);
  const referenceFiles = normalizeTaskFileCollection(
    source?.referenceFiles || source?.references || source?.files
  );

  const deadline = parseOptionalDate(source?.deadline) || defaultDeadline;
  const sizeMode = normalizeCollateralSizeMode(source?.sizeMode);
  const normalized = {
    id: String(source?.id || new mongoose.Types.ObjectId().toString()).trim(),
    title: String(source?.title || "").trim(),
    collateralType: String(source?.collateralType || source?.type || "").trim(),
    presetCategory: String(source?.presetCategory || "").trim(),
    presetKey: String(source?.presetKey || "").trim(),
    presetLabel: String(source?.presetLabel || "").trim(),
    sizeMode,
    width,
    height,
    unit: normalizeCollateralUnit(source?.unit),
    sizeLabel: String(source?.sizeLabel || "").trim(),
    ratioLabel: String(source?.ratioLabel || "").trim(),
    customSizeLabel: String(source?.customSizeLabel || "").trim(),
    orientation: normalizeCollateralOrientation(source?.orientation, width, height),
    platform: String(source?.platform || "").trim(),
    usageType: String(source?.usageType || "").trim(),
    brief: String(source?.brief || source?.contentBrief || "").trim(),
    deadline,
    priority: normalizeCollateralPriority(source?.priority),
    status: normalizeCollateralStatus(source?.status),
    referenceFiles,
    assignedToId: normalizeId(source?.assignedToId),
    assignedToName: String(source?.assignedToName || "").trim(),
    createdAt: parseOptionalDate(source?.createdAt) || now,
    updatedAt: now,
  };

  if (!normalized.collateralType) {
    throw new Error("Collateral type is required.");
  }
  if (!normalized.brief) {
    throw new Error(`Brief is required for ${normalized.collateralType}.`);
  }
  if (!normalized.deadline) {
    throw new Error(`Deadline is required for ${normalized.collateralType}.`);
  }
  if (sizeMode === "custom" && !normalized.customSizeLabel && !(width && height)) {
    throw new Error(`Custom size is required for ${normalized.collateralType}.`);
  }

  return normalized;
};

const normalizeCollateralCollection = (collaterals, options = {}) => {
  if (!Array.isArray(collaterals)) return [];
  return collaterals.map((collateral) => normalizeCollateralInput(collateral, options));
};

const syncTaskFromCampaignData = (task) => {
  const collaterals = Array.isArray(task?.collaterals) ? task.collaterals : [];
  if (collaterals.length === 0) {
    task.requestType = task.requestType || "single_task";
    return task;
  }

  const normalizedCampaign = normalizeCampaignPayload(task?.campaign, {
    title: task?.title,
    description: task?.campaign?.brief || task?.description,
    commonDeadline: task?.campaign?.commonDeadline || task?.deadline,
  });
  const effectiveDeadline = deriveTaskDeadlineFromCollaterals(collaterals, normalizedCampaign);

  task.requestType = "campaign_request";
  task.campaign = {
    ...normalizedCampaign,
    requestName: normalizedCampaign.requestName || String(task?.title || "").trim(),
    brief: normalizedCampaign.brief || String(task?.description || "").trim(),
  };
  task.description = buildCampaignDescription(task.campaign.brief, collaterals);
  task.category = deriveTaskCategoryFromCollaterals(collaterals);
  task.urgency = deriveTaskUrgencyFromCollaterals(collaterals);
  task.status = deriveTaskStatusFromCollaterals(collaterals, task?.status || "pending");
  if (effectiveDeadline) {
    task.deadline = effectiveDeadline;
  }
  return task;
};

const normalizeFileNameKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const toFiniteNumber = (value) => {
  const numeric = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : undefined;
};

const normalizeCommentAttachments = (attachments, uploadedBy = "") => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((attachment, index) => {
      const normalized = normalizeTaskFileLinks({
        ...(attachment || {}),
        type: "input",
      });
      const name = String(normalized?.name || "").trim() || `Attachment ${index + 1}`;
      const uploadedAt = normalized?.uploadedAt ? new Date(normalized.uploadedAt) : new Date();
      return {
        name,
        url: String(normalized?.url || "").trim(),
        driveId: String(normalized?.driveId || "").trim(),
        webViewLink: String(normalized?.webViewLink || "").trim(),
        webContentLink: String(normalized?.webContentLink || "").trim(),
        type: "input",
        uploadedAt,
        uploadedBy: String(normalized?.uploadedBy || uploadedBy || "").trim(),
        size: toFiniteNumber(normalized?.size),
        mime: String(normalized?.mime || "").trim(),
        thumbnailUrl: String(normalized?.thumbnailUrl || "").trim(),
      };
    })
    .filter(
      (attachment) =>
        Boolean(
          attachment.name ||
            attachment.url ||
            attachment.driveId ||
            attachment.webViewLink ||
            attachment.webContentLink
        )
    );
};

const hasUsableTaskFileLink = (file) => {
  const normalizedFile = normalizeTaskFileLinks(file);
  return Boolean(
    String(normalizedFile?.url || "").trim() ||
    String(normalizedFile?.driveId || "").trim() ||
    String(normalizedFile?.webViewLink || "").trim() ||
    String(normalizedFile?.webContentLink || "").trim()
  );
};

const mergeResolvedFileData = (file, resolvedFile) => {
  const target =
    typeof file?.toObject === "function" ? file.toObject() : { ...(file || {}) };
  const normalizedTarget = normalizeTaskFileLinks(target);
  const normalizedResolved = normalizeTaskFileLinks(resolvedFile);

  return {
    ...target,
    name: String(target?.name || normalizedResolved?.name || "").trim(),
    url: String(
      normalizedTarget?.url ||
      normalizedResolved?.url ||
      normalizedResolved?.webViewLink ||
      normalizedResolved?.webContentLink ||
      ""
    ).trim(),
    driveId: String(normalizedTarget?.driveId || normalizedResolved?.driveId || "").trim(),
    webViewLink: String(
      normalizedTarget?.webViewLink || normalizedResolved?.webViewLink || ""
    ).trim(),
    webContentLink: String(
      normalizedTarget?.webContentLink || normalizedResolved?.webContentLink || ""
    ).trim(),
    size: toFiniteNumber(target?.size) ?? toFiniteNumber(normalizedResolved?.size),
    mime: String(target?.mime || normalizedResolved?.mime || "").trim(),
    thumbnailUrl: String(
      target?.thumbnailUrl || normalizedResolved?.thumbnailUrl || ""
    ).trim(),
    uploadedAt: target?.uploadedAt || normalizedResolved?.uploadedAt,
    uploadedBy: String(target?.uploadedBy || normalizedResolved?.uploadedBy || "").trim(),
  };
};

const fileLinkFieldsChanged = (file, nextFile) => {
  const current = normalizeTaskFileLinks(file);
  const next = normalizeTaskFileLinks(nextFile);
  const stringFields = [
    "name",
    "url",
    "driveId",
    "webViewLink",
    "webContentLink",
    "mime",
    "thumbnailUrl",
    "uploadedBy",
  ];

  if (
    stringFields.some(
      (field) => String(current?.[field] || "").trim() !== String(next?.[field] || "").trim()
    )
  ) {
    return true;
  }

  return toFiniteNumber(current?.size) !== toFiniteNumber(next?.size);
};

const findMatchingTaskFile = (files, targetFile) => {
  const target = normalizeTaskFileLinks(targetFile);
  const targetDriveId = String(target?.driveId || "").trim();
  const targetNameKey = normalizeFileNameKey(target?.name);
  const targetSize = toFiniteNumber(target?.size);
  const targetUrl = String(target?.url || "").trim();

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of Array.isArray(files) ? files : []) {
    const normalizedCandidate = normalizeTaskFileLinks(candidate);
    if (!hasUsableTaskFileLink(normalizedCandidate)) continue;

    let score = 0;
    if (
      targetDriveId &&
      normalizedCandidate.driveId &&
      normalizedCandidate.driveId === targetDriveId
    ) {
      score += 10;
    }
    if (
      targetNameKey &&
      normalizeFileNameKey(normalizedCandidate.name) === targetNameKey
    ) {
      score += 5;
    }
    if (
      targetSize !== undefined &&
      toFiniteNumber(normalizedCandidate.size) === targetSize
    ) {
      score += 3;
    }
    if (targetUrl && normalizedCandidate.url === targetUrl) {
      score += 1;
    }

    if (score > bestScore) {
      bestMatch = normalizedCandidate;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestMatch : null;
};

const searchDriveFileByName = async (drive, targetFile) => {
  const targetName = String(targetFile?.name || "").trim();
  if (!targetName) return null;

  const response = await drive.files.list({
    q: [
      `name = '${targetName.replace(/'/g, "\\'")}'`,
      "mimeType != 'application/vnd.google-apps.folder'",
      "trashed = false",
    ].join(" and "),
    fields:
      "files(id,name,size,thumbnailLink,webViewLink,webContentLink,mimeType,modifiedTime)",
    spaces: "drive",
    pageSize: 10,
    orderBy: "modifiedTime desc",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const candidates = Array.isArray(response?.data?.files) ? response.data.files : [];
  if (candidates.length === 0) return null;

  const targetSize = toFiniteNumber(targetFile?.size);
  const exactSizeMatches =
    targetSize === undefined
      ? []
      : candidates.filter((file) => toFiniteNumber(file?.size) === targetSize);
  const selected = exactSizeMatches[0] || candidates[0];
  if (!selected?.id) return null;

  return normalizeTaskFileLinks({
    name: selected.name || targetName,
    url: selected.webViewLink || selected.webContentLink || buildDriveViewUrl(selected.id),
    driveId: selected.id,
    webViewLink: selected.webViewLink || "",
    webContentLink: selected.webContentLink || "",
    size: toFiniteNumber(selected.size) ?? targetSize,
    mime: selected.mimeType || "",
    thumbnailUrl: selected.thumbnailLink || "",
  });
};

const isSameTaskFileCandidate = (candidate, targetFile) => {
  const normalizedCandidate = normalizeTaskFileLinks(candidate);
  const normalizedTarget = normalizeTaskFileLinks(targetFile);
  const candidateDriveId = String(normalizedCandidate?.driveId || "").trim();
  const targetDriveId = String(normalizedTarget?.driveId || "").trim();
  if (candidateDriveId && targetDriveId && candidateDriveId === targetDriveId) {
    return true;
  }

  const candidateNameKey = normalizeFileNameKey(normalizedCandidate?.name);
  const targetNameKey = normalizeFileNameKey(normalizedTarget?.name);
  if (!candidateNameKey || !targetNameKey || candidateNameKey !== targetNameKey) {
    return false;
  }

  const candidateSize = toFiniteNumber(normalizedCandidate?.size);
  const targetSize = toFiniteNumber(normalizedTarget?.size);
  if (candidateSize !== undefined && targetSize !== undefined) {
    return candidateSize === targetSize;
  }

  return true;
};

const applyResolvedFileToOutputFiles = (task, targetFile, resolvedFile) => {
  const outputFiles = Array.isArray(task?.files)
    ? task.files.filter((file) => normalizeValue(file?.type) === "output")
    : [];
  let changed = false;

  for (const outputFile of outputFiles) {
    if (!isSameTaskFileCandidate(outputFile, targetFile)) continue;

    const merged = mergeResolvedFileData(outputFile, resolvedFile);
    if (!fileLinkFieldsChanged(outputFile, merged)) continue;

    Object.assign(outputFile, merged);
    changed = true;
  }

  return changed;
};

const repairMissingFinalDeliverableFiles = async (task) => {
  if (!task) return task;

  task = await ensureFinalDeliverableVersions(task);
  const versions = Array.isArray(task.finalDeliverableVersions)
    ? task.finalDeliverableVersions
    : [];
  if (versions.length === 0) return task;

  const outputFiles = Array.isArray(task.files)
    ? task.files.filter((file) => normalizeValue(file?.type) === "output")
    : [];
  let drive = null;
  let versionsChanged = false;
  let outputFilesChanged = false;

  for (const version of versions) {
    if (!Array.isArray(version?.files)) continue;

    for (let index = 0; index < version.files.length; index += 1) {
      const currentFile = version.files[index];
      let resolvedFile = normalizeTaskFileLinks(currentFile);
      const matchedOutput = findMatchingTaskFile(outputFiles, resolvedFile);

      if (matchedOutput) {
        resolvedFile = mergeResolvedFileData(resolvedFile, matchedOutput);
      }

      if (!hasUsableTaskFileLink(resolvedFile) && String(resolvedFile?.name || "").trim()) {
        try {
          if (!drive) {
            drive = getDriveClient();
          }
          const driveMatch = await searchDriveFileByName(drive, resolvedFile);
          if (driveMatch) {
            resolvedFile = mergeResolvedFileData(resolvedFile, driveMatch);
          }
        } catch (error) {
          console.error("Drive final-file repair lookup failed:", error?.message || error);
        }
      }

      if (fileLinkFieldsChanged(currentFile, resolvedFile)) {
        Object.assign(currentFile, resolvedFile);
        versionsChanged = true;
      }

      if (applyResolvedFileToOutputFiles(task, currentFile, resolvedFile)) {
        outputFilesChanged = true;
      }
    }
  }

  if (!versionsChanged && !outputFilesChanged) {
    return task;
  }

  if (versionsChanged) {
    task.markModified("finalDeliverableVersions");
  }
  if (outputFilesChanged) {
    task.markModified("files");
  }
  await task.save();
  return task;
};

const mapOutputFileToFinal = (file) => {
  const normalizedFile = normalizeTaskFileLinks(file);
  return {
    name: normalizedFile?.name || "",
    url: normalizedFile?.url || "",
    driveId: normalizedFile?.driveId || "",
    webViewLink: normalizedFile?.webViewLink || "",
    webContentLink: normalizedFile?.webContentLink || "",
    size: typeof normalizedFile?.size === "number" ? normalizedFile.size : undefined,
    mime: normalizedFile?.mime || "",
    thumbnailUrl: normalizedFile?.thumbnailUrl || "",
    uploadedAt: normalizedFile?.uploadedAt || new Date(),
    uploadedBy: normalizedFile?.uploadedBy || ""
  };
};

const buildLegacyFinalVersion = (task) => {
  const files = Array.isArray(task?.files)
    ? task.files.filter((file) => file?.type === "output")
    : [];
  if (files.length === 0) return null;
  const uploadedAt =
    files.find((file) => file?.uploadedAt)?.uploadedAt ||
    task.updatedAt ||
    task.createdAt ||
    new Date();
  const uploadedBy =
    files.find((file) => file?.uploadedBy)?.uploadedBy || task.assignedToId || "";
  return {
    version: 1,
    uploadedAt,
    uploadedBy,
    note: "",
    files: files.map(mapOutputFileToFinal)
  };
};

const normalizeFinalDeliverableVersions = (task) => {
  const versions = Array.isArray(task?.finalDeliverableVersions)
    ? task.finalDeliverableVersions
    : [];
  if (versions.length > 0) {
    return versions.slice().sort((a, b) => (b.version || 0) - (a.version || 0));
  }
  const legacy = buildLegacyFinalVersion(task);
  return legacy ? [legacy] : [];
};

const ensureFinalDeliverableVersions = async (task) => {
  if (!task) return task;
  const existing = Array.isArray(task.finalDeliverableVersions)
    ? task.finalDeliverableVersions
    : [];
  if (existing.length > 0) return task;
  const legacy = buildLegacyFinalVersion(task);
  if (!legacy) return task;
  task.finalDeliverableVersions = [legacy];
  task.markModified("finalDeliverableVersions");
  await task.save();
  return task;
};

const FINAL_DELIVERABLE_REVIEW_STATUSES = new Set([
  "not_submitted",
  "pending",
  "approved",
  "rejected",
]);

const normalizeFinalDeliverableReviewStatus = (value, fallback = "not_submitted") => {
  const normalized = normalizeValue(value);
  if (FINAL_DELIVERABLE_REVIEW_STATUSES.has(normalized)) {
    return normalized;
  }
  return fallback;
};

const clampUnitInterval = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return Number(numeric.toFixed(4));
};

const sanitizeReviewAnnotationText = (value, maxLength = 500) =>
  String(value || "").trim().slice(0, maxLength);

const sanitizeFinalDeliverableReviewAnnotations = (value) => {
  if (!Array.isArray(value)) return [];
  const SHAPE_KINDS = new Set([
    "pen",
    "highlighter",
    "arrow",
    "rect",
    "ellipse",
    "text",
    "blur_rect",
    "highlight_rect",
  ]);
  return value
    .slice(0, 25)
    .map((entry, index) => {
      const fileId = String(entry?.fileId || "").trim();
      const fileName = String(entry?.fileName || "").trim();
      const fileUrl = String(entry?.fileUrl || "").trim();

      const comments = Array.isArray(entry?.comments)
        ? entry.comments
          .slice(0, 100)
          .map((comment, commentIndex) => {
            const thread = Array.isArray(comment?.thread)
              ? comment.thread
                .slice(0, 60)
                .map((message, messageIndex) => {
                  const text = sanitizeReviewAnnotationText(message?.text, 300);
                  if (!text) return null;
                  const createdAtCandidate = new Date(message?.createdAt || "");
                  return {
                    id: String(message?.id || `thread-${index}-${commentIndex}-${messageIndex}`),
                    text,
                    author: String(message?.author || "").trim().slice(0, 120),
                    createdAt: Number.isNaN(createdAtCandidate.getTime())
                      ? new Date()
                      : createdAtCandidate,
                  };
                })
                .filter((message) => Boolean(message))
              : [];

            const fallbackText = sanitizeReviewAnnotationText(comment?.text, 300);
            const normalizedThread = thread.length > 0
              ? thread
              : (fallbackText
                ? [
                  {
                    id: `thread-${index}-${commentIndex}-0`,
                    text: fallbackText,
                    author: "",
                    createdAt: new Date(),
                  }
                ]
                : []);
            const topLevelText =
              normalizedThread[normalizedThread.length - 1]?.text || fallbackText;
            if (!topLevelText) return null;
            return {
              id: String(comment?.id || `comment-${index}-${commentIndex}`),
              x: clampUnitInterval(comment?.x),
              y: clampUnitInterval(comment?.y),
              text: topLevelText,
              thread: normalizedThread,
            };
          })
          .filter((comment) => Boolean(comment && comment.text))
        : [];

      const strokes = Array.isArray(entry?.strokes)
        ? entry.strokes
          .slice(0, 60)
          .map((stroke, strokeIndex) => {
            const points = Array.isArray(stroke?.points)
              ? stroke.points
                .slice(0, 2000)
                .map((point) => ({
                  x: clampUnitInterval(point?.x),
                  y: clampUnitInterval(point?.y),
                }))
              : [];
            return {
              id: String(stroke?.id || `stroke-${index}-${strokeIndex}`),
              color: String(stroke?.color || "#ef4444").trim().slice(0, 20),
              width: Number.isFinite(Number(stroke?.width))
                ? Math.max(1, Math.min(12, Number(stroke.width)))
                : 2,
              points,
            };
          })
          .filter((stroke) => Array.isArray(stroke.points) && stroke.points.length >= 2)
        : [];

      const shapes = Array.isArray(entry?.shapes)
        ? entry.shapes
          .slice(0, 300)
          .map((shape, shapeIndex) => {
            const kind = String(shape?.kind || "").trim().toLowerCase();
            if (!SHAPE_KINDS.has(kind)) return null;
            const base = {
              id: String(shape?.id || `shape-${index}-${shapeIndex}`),
              kind,
              color: String(shape?.color || "#ef4444").trim().slice(0, 20),
              width: Number.isFinite(Number(shape?.width))
                ? Math.max(1, Math.min(20, Number(shape.width)))
                : 2,
              opacity: Number.isFinite(Number(shape?.opacity))
                ? Math.max(0.1, Math.min(1, Number(shape.opacity)))
                : 1,
            };
            if (kind === "pen" || kind === "highlighter") {
              const points = Array.isArray(shape?.points)
                ? shape.points
                  .slice(0, 3000)
                  .map((point) => ({
                    x: clampUnitInterval(point?.x),
                    y: clampUnitInterval(point?.y),
                  }))
                : [];
              if (points.length < 2) return null;
              return {
                ...base,
                points,
              };
            }
            if (kind === "text") {
              const text = sanitizeReviewAnnotationText(shape?.text, 200);
              if (!text) return null;
              return {
                ...base,
                x: clampUnitInterval(shape?.x),
                y: clampUnitInterval(shape?.y),
                text,
                fontSize: Number.isFinite(Number(shape?.fontSize))
                  ? Math.max(10, Math.min(96, Number(shape.fontSize)))
                  : 24,
                fillColor: String(shape?.fillColor || "").trim().slice(0, 20),
              };
            }
            return {
              ...base,
              startX: clampUnitInterval(shape?.startX),
              startY: clampUnitInterval(shape?.startY),
              endX: clampUnitInterval(shape?.endX),
              endY: clampUnitInterval(shape?.endY),
            };
          })
          .filter((shape) => Boolean(shape))
        : [];

      if (shapes.length > 0 && strokes.length === 0) {
        shapes.forEach((shape, shapeIndex) => {
          if ((shape?.kind !== "pen" && shape?.kind !== "highlighter") || !Array.isArray(shape?.points)) {
            return;
          }
          if (shape.points.length < 2) return;
          strokes.push({
            id: String(shape.id || `shape-stroke-${index}-${shapeIndex}`),
            color: String(shape.color || "#ef4444"),
            width: Number.isFinite(Number(shape.width))
              ? Math.max(1, Math.min(12, Number(shape.width)))
              : 2,
            points: shape.points.map((point) => ({
              x: clampUnitInterval(point?.x),
              y: clampUnitInterval(point?.y),
            })),
          });
        });
      }

      const imageWidth = Number.isFinite(Number(entry?.imageWidth))
        ? Math.max(0, Number(entry.imageWidth))
        : undefined;
      const imageHeight = Number.isFinite(Number(entry?.imageHeight))
        ? Math.max(0, Number(entry.imageHeight))
        : undefined;

      const createdAtCandidate = new Date(entry?.createdAt || "");
      const createdAt = Number.isNaN(createdAtCandidate.getTime())
        ? new Date()
        : createdAtCandidate;
      const createdBy = String(entry?.createdBy || "").trim().slice(0, 120);

      return {
        id: String(entry?.id || `annotation-${index}`),
        fileId,
        fileName,
        fileUrl,
        imageWidth,
        imageHeight,
        comments,
        strokes,
        shapes,
        createdAt,
        createdBy,
      };
    })
    .filter((annotation) => {
      const hasFeedback =
        (Array.isArray(annotation.comments) && annotation.comments.length > 0) ||
        (Array.isArray(annotation.strokes) && annotation.strokes.length > 0) ||
        (Array.isArray(annotation.shapes) && annotation.shapes.length > 0);
      if (!hasFeedback) return false;
      return Boolean(annotation.fileId || annotation.fileUrl);
    });
};

const isMainDesignerActor = (user) =>
  normalizeTaskRole(user?.role) === "designer" && isMainDesignerUser(user);

const requiresMainDesignerFinalReview = (user) => {
  if (!hasMainDesignerConfig()) return false;
  const role = normalizeTaskRole(user?.role);
  if (role !== "designer") return false;
  return !isMainDesignerActor(user);
};

const resolveFinalDeliverableReviewState = (task) => {
  const versions = normalizeFinalDeliverableVersions(task);
  const explicitStatus = normalizeFinalDeliverableReviewStatus(
    task?.finalDeliverableReviewStatus,
    ""
  );
  if (explicitStatus) {
    return {
      status: explicitStatus,
      reviewedBy: String(task?.finalDeliverableReviewedBy || ""),
      reviewedAt: task?.finalDeliverableReviewedAt || undefined,
      reviewNote: String(task?.finalDeliverableReviewNote || ""),
    };
  }
  if (versions.length === 0) {
    return {
      status: "not_submitted",
      reviewedBy: "",
      reviewedAt: undefined,
      reviewNote: "",
    };
  }
  const latestVersion = versions[0] || {};
  return {
    status: normalizeFinalDeliverableReviewStatus(latestVersion?.reviewStatus, "approved"),
    reviewedBy: String(latestVersion?.reviewedBy || ""),
    reviewedAt: latestVersion?.reviewedAt || undefined,
    reviewNote: String(latestVersion?.reviewNote || ""),
  };
};

const buildTaskViewLookup = async (tasks, viewer) => {
  const viewerId = getViewerId(viewer);
  const taskIds = Array.from(
    new Set(
      (Array.isArray(tasks) ? tasks : [])
        .map((task) => getTaskDocumentId(task))
        .filter(Boolean)
    )
  );
  if (!viewerId || taskIds.length === 0) return new Map();

  const entries = await TaskView.find({
    userId: viewerId,
    taskId: { $in: taskIds },
  }).select("taskId readAt");

  return new Map(
    entries.map((entry) => [String(entry.taskId || "").trim(), entry.readAt || undefined])
  );
};

const buildTaskPayloadForViewer = (task, viewer, options = {}) => {
  const payload = typeof task?.toJSON === "function" ? task.toJSON() : { ...(task || {}) };
  payload.files = Array.isArray(payload.files)
    ? payload.files.map((file) => normalizeTaskFileLinks(file))
    : [];
  payload.campaign = payload.campaign
    ? {
        ...payload.campaign,
        commonDeadline: payload.campaign.commonDeadline || undefined,
      }
    : undefined;
  payload.collaterals = Array.isArray(payload.collaterals)
    ? payload.collaterals.map((collateral) => ({
        ...(typeof collateral?.toObject === "function" ? collateral.toObject() : { ...(collateral || {}) }),
        referenceFiles: Array.isArray(collateral?.referenceFiles)
          ? collateral.referenceFiles.map((file) => normalizeTaskFileLinks(file))
          : [],
      }))
    : [];
  const normalizedOutputFiles = payload.files.filter(
    (file) => normalizeValue(file?.type) === "output"
  );
  payload.finalDeliverableVersions = normalizeFinalDeliverableVersions(task).map((version) => ({
    ...(typeof version?.toObject === "function" ? version.toObject() : { ...(version || {}) }),
    files: Array.isArray(version?.files)
      ? version.files.map((file) => {
        const normalizedFile = normalizeTaskFileLinks(file);
        const matchedOutput = findMatchingTaskFile(normalizedOutputFiles, normalizedFile);
        return matchedOutput
          ? mergeResolvedFileData(normalizedFile, matchedOutput)
          : normalizedFile;
      })
      : [],
  }));
  const reviewState = resolveFinalDeliverableReviewState(task);
  payload.finalDeliverableReviewStatus = reviewState.status;
  payload.finalDeliverableReviewedBy = reviewState.reviewedBy;
  payload.finalDeliverableReviewedAt = reviewState.reviewedAt;
  payload.finalDeliverableReviewNote = reviewState.reviewNote;
  payload.viewerReadAt = options.viewerReadAt || task?.viewerReadAt || undefined;

  const viewerRole = normalizeTaskRole(viewer?.role);
  if (viewerRole === "staff") {
    payload.files = Array.isArray(payload.files)
      ? payload.files.filter((file) => normalizeValue(file?.type) !== "working")
      : [];
    if (reviewState.status !== "approved") {
      payload.finalDeliverableVersions = [];
      payload.files = payload.files.filter((file) => normalizeValue(file?.type) !== "output");
    }
  }

  return payload;
};

const resolveAssignedUser = async ({
  assignedToId,
  assignedTo,
  assignedToName,
  assignedToEmail
} = {}) => {
  let resolvedId = assignedToId || assignedTo || "";
  let resolvedName = assignedToName || "";
  const cleanedName = normalizeAssignedName(resolvedName);
  const normalizedEmail = normalizeValue(assignedToEmail);
  let user = null;

  if (!resolvedId && normalizedEmail) {
    resolvedId = await resolveUserIdByEmail(normalizedEmail);
  }

  if (resolvedId) {
    user = await User.findById(resolvedId).select("_id name email role isActive");
  }

  if (!user && normalizedEmail) {
    user = await User.findOne({
      email: normalizedEmail,
      role: "designer",
      isActive: { $ne: false }
    }).select("_id name email role isActive");
  }

  if (!user && cleanedName) {
    user = await User.findOne({
      name: new RegExp(`^${escapeRegExp(cleanedName)}$`, "i"),
      role: "designer",
      isActive: { $ne: false }
    }).select("_id name email role isActive");
  }

  if (user) {
    resolvedId = resolvedId || user._id?.toString?.() || "";
    if (user.name) {
      resolvedName = user.name;
    } else if (!resolvedName && user.email) {
      resolvedName = user.email.split("@")[0] || "";
    }
  } else if (!resolvedName && cleanedName) {
    resolvedName = cleanedName;
  }

  return {
    assignedToId: resolvedId || "",
    assignedToName: resolvedName || ""
  };
};

const isManagerRole = (role) =>
  ["manager", "treasurer", "admin"].includes(normalizeValue(role));

const normalizeTaskRole = (role) => {
  const normalizedRole = normalizeValue(role);
  if (normalizedRole === "other") return "staff";
  if (normalizedRole === "manager") return "treasurer";
  return normalizedRole;
};

const getLatestChangeValue = (task, fieldName) => {
  const targetField = normalizeValue(fieldName);
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) === targetField) {
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
      return normalizeEmailList(parsed);
    }
  } catch {
    // Fall through to delimited parsing.
  }
  return normalizeEmailList(text.split(/[,\n;]/g));
};

const extractTaskCcEmails = (task) => {
  const taskData = typeof task?.toObject === "function" ? task.toObject() : task || {};
  const directCc = normalizeEmailList(taskData?.cc_emails || taskData?.ccEmails || []);
  if (directCc.length > 0) return directCc;
  const rawFromHistory = getLatestChangeValue(task, "cc_emails");
  return parseAssignmentCcEmails(rawFromHistory);
};

const hasAssignedDesignerAccessMetadata = (task) => {
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  if (history.some((entry) => ASSIGNMENT_META_FIELDS.has(normalizeValue(entry?.field)))) {
    return true;
  }
  const taskData = typeof task?.toObject === "function" ? task.toObject() : task || {};
  return (
    Array.isArray(taskData?.cc_emails) ||
    Array.isArray(taskData?.ccEmails)
  );
};

const isTaskAssignedByUser = (task, user) => {
  if (!user) return false;
  const userId = normalizeId(user._id?.toString?.() || user._id);
  const userEmail = normalizeValue(user.email);
  if (!userId && !userEmail) return false;
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) !== "assigned_designer") continue;
    const assignerId = normalizeId(entry?.userId);
    if (userId && assignerId && userId === assignerId) return true;
    const assignerEmail = normalizeValue(entry?.userName);
    if (userEmail && assignerEmail && userEmail === assignerEmail) return true;
    return false;
  }
  return false;
};

const resolveAssignedDesignerEmail = async (task) => {
  const assignedId = resolveAssignedIdentifier(task);
  if (assignedId) {
    if (EMAIL_REGEX.test(assignedId)) {
      return normalizeValue(assignedId);
    }
    if (isObjectIdLike(assignedId)) {
      const assignedUser = await User.findById(assignedId).select("email");
      const assignedEmail = normalizeValue(assignedUser?.email);
      if (EMAIL_REGEX.test(assignedEmail)) {
        return assignedEmail;
      }
    }
  }
  const assignedName = normalizeValue(task?.assignedToName);
  if (EMAIL_REGEX.test(assignedName)) {
    return assignedName;
  }
  const rawAssigned = normalizeValue(getLatestChangeValue(task, "assigned_designer"));
  if (EMAIL_REGEX.test(rawAssigned)) {
    return rawAssigned;
  }
  return "";
};

const isTaskEffectivelyUnassigned = async (task) => {
  const assignedId = normalizeId(task?.assignedToId);
  if (!assignedId) return true;
  if (EMAIL_REGEX.test(assignedId)) {
    const assignedEmail = normalizeValue(assignedId);
    const assignedUser = await User.findOne({ email: assignedEmail }).select("role isActive");
    const assignedRole = normalizeTaskRole(assignedUser?.role);
    return !assignedUser || assignedUser.isActive === false || assignedRole !== "designer";
  }
  if (!isObjectIdLike(assignedId)) {
    return true;
  }
  const assignedUser = await User.findById(assignedId).select("role isActive");
  const assignedRole = normalizeTaskRole(assignedUser?.role);
  return !assignedUser || assignedUser.isActive === false || assignedRole !== "designer";
};

const resolveTaskAccessContext = async (task, user) => {
  const fallback = {
    mode: "none",
    assignedDesignerEmail: "",
    ccEmails: []
  };
  if (!user) return fallback;
  const userRole = normalizeTaskRole(user.role);
  const isMainDesigner = userRole === "designer" && isMainDesignerUser(user);
  const userId = normalizeId(user._id?.toString?.() || user._id);
  const userEmail = normalizeValue(user.email);
  const ccEmails = extractTaskCcEmails(task);
  const assignedDesignerEmail = await resolveAssignedDesignerEmail(task);
  const assignedId = resolveAssignedIdentifier(task);
  let effectiveAssignedId = assignedId;
  if (effectiveAssignedId && isObjectIdLike(effectiveAssignedId)) {
    const assignedUser = await User.findById(effectiveAssignedId).select("role isActive");
    const assignedRole = normalizeTaskRole(assignedUser?.role);
    if (!assignedUser || assignedUser.isActive === false || assignedRole !== "designer") {
      effectiveAssignedId = "";
    }
  }
  if (isManagerRole(userRole)) {
    return {
      mode: "view_only",
      assignedDesignerEmail,
      ccEmails
    };
  }
  const hasPrimaryTaskAccess = canAccessTask(task, user);

  // Authenticated users who already own/are assigned to the task should keep full access.
  if (hasPrimaryTaskAccess) {
    return {
      mode: "full",
      assignedDesignerEmail,
      ccEmails
    };
  }
  // Designers can work from the unassigned queue and self-assign via change updates.
  if (userRole === "designer" && isMainDesigner && !effectiveAssignedId) {
    return {
      mode: "full",
      assignedDesignerEmail: userEmail || assignedDesignerEmail,
      ccEmails
    };
  }
  if (effectiveAssignedId && userId && effectiveAssignedId === userId) {
    return {
      mode: "full",
      assignedDesignerEmail: userEmail || assignedDesignerEmail,
      ccEmails
    };
  }
  if (userEmail && assignedDesignerEmail && userEmail === assignedDesignerEmail) {
    return {
      mode: "full",
      assignedDesignerEmail,
      ccEmails
    };
  }
  // Junior designers can access only the tasks explicitly assigned to them.
  if (userRole === "designer" && !isMainDesigner) {
    return fallback;
  }
  if (userEmail && ccEmails.includes(userEmail)) {
    return {
      mode: "view_only",
      assignedDesignerEmail,
      ccEmails
    };
  }
  if (isTaskAssignedByUser(task, user)) {
    return {
      mode: "view_only",
      assignedDesignerEmail,
      ccEmails
    };
  }
  return {
    mode: "view_only",
    assignedDesignerEmail,
    ccEmails
  };
};

const findLatestAssignmentEntry = (task) => {
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) === "assigned_designer") {
      return entry;
    }
  }
  return null;
};

const resolveAssignmentManagerRecipient = async (task) => {
  const assignmentEntry = findLatestAssignmentEntry(task);
  if (!assignmentEntry) return null;
  const assignedByUserId = normalizeId(assignmentEntry.userId);
  if (assignedByUserId) {
    const managerUser = await User.findById(assignedByUserId)
      .select("_id name email role isActive");
    const managerEmail = normalizeValue(managerUser?.email);
    if (managerUser && managerUser.isActive !== false && EMAIL_REGEX.test(managerEmail)) {
      return {
        id: managerUser._id?.toString?.() || assignedByUserId,
        name: managerUser.name || managerEmail.split("@")[0] || "Manager",
        email: managerEmail
      };
    }
  }
  const fallbackEmail = normalizeValue(assignmentEntry?.userName);
  if (EMAIL_REGEX.test(fallbackEmail)) {
    return {
      id: "",
      name: fallbackEmail.split("@")[0] || "Manager",
      email: fallbackEmail
    };
  }
  return null;
};

const canAccessTask = (task, user) => {
  if (!user) return false;
  const userRole = normalizeTaskRole(user.role);
  if (userRole === "admin" || userRole === "treasurer") return true;
  const userId = user._id?.toString?.() || user._id;
  if (userRole === "staff") {
    const userEmail = normalizeValue(user.email);
    const requesterEmail = normalizeValue(task?.requesterEmail);
    const userName = normalizeValue(user.name);
    const requesterName = normalizeValue(task?.requesterName);
    const emailPrefix = userEmail.split("@")[0];
    const requesterId = normalizeId(task?.requesterId);
    if (
      (requesterId && requesterId === userId) ||
      (userEmail && requesterEmail && requesterEmail === userEmail) ||
      (requesterName && userName && (requesterName === userName || requesterName.includes(userName) || userName.includes(requesterName))) ||
      (requesterName && emailPrefix && requesterName.includes(emailPrefix))
    ) {
      return true;
    }
    const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
    const createdEntry = history.find((entry) => entry?.field === "created");
    const createdUserId = normalizeId(createdEntry?.userId);
    if (createdUserId && createdUserId === userId) return true;
    const creatorName = normalizeValue(createdEntry?.userName);
    if (
      creatorName &&
      userName &&
      (creatorName === userName || creatorName.includes(userName) || userName.includes(creatorName))
    ) {
      return true;
    }
    if (creatorName && emailPrefix && creatorName.includes(emailPrefix)) {
      return true;
    }
    if (history.some((entry) => normalizeId(entry?.userId) === userId)) return true;
    return false;
  }
  if (userRole === "designer") {
    const assignedName = normalizeValue(task?.assignedToName);
    const assignedId = resolveAssignedIdentifier(task);
    const userName = normalizeValue(user.name);
    const userEmail = normalizeValue(user.email);
    const emailPrefix = userEmail.split("@")[0];
    const nameMatches =
      assignedName &&
      userName &&
      (assignedName === userName ||
        assignedName.includes(userName) ||
        userName.includes(assignedName));
    const emailMatches = assignedName && emailPrefix && assignedName.includes(emailPrefix);
    const assignedEmailMatches =
      assignedId && EMAIL_REGEX.test(assignedId) && userEmail && normalizeValue(assignedId) === userEmail;
    return Boolean(
      (assignedId && assignedId === userId) ||
      assignedEmailMatches ||
      nameMatches ||
      emailMatches
    );
  }
  return false;
};

const buildAvailabilityTaskTitle = (task, user) => {
  const role = normalizeTaskRole(user?.role);
  const userIsMainDesigner = role === "designer" && isMainDesignerUser(user);
  if (role === "admin" || role === "treasurer" || role === "manager") {
    return task?.title || "Untitled";
  }
  if (role === "designer" && userIsMainDesigner) {
    return task?.title || "Untitled";
  }
  if (role === "designer" && canAccessTask(task, user)) {
    return task?.title || "Untitled";
  }
  return "Design team committed with some work";
};

const buildAvailabilityDesignerScopeMaps = async (tasks = []) => {
  const designerIds = new Set();
  const designerEmails = new Set();

  tasks.forEach((task) => {
    const assignedId = normalizeId(task?.assignedToId);
    if (assignedId && isObjectIdLike(assignedId)) {
      designerIds.add(assignedId);
    }

    const assignedEmail = normalizeValue(task?.assignedToEmail);
    if (assignedEmail) {
      designerEmails.add(assignedEmail);
    }

    const assignedIdentifier = resolveAssignedIdentifier(task);
    if (assignedIdentifier && isObjectIdLike(assignedIdentifier)) {
      designerIds.add(assignedIdentifier);
    } else if (assignedIdentifier && EMAIL_REGEX.test(assignedIdentifier)) {
      designerEmails.add(normalizeValue(assignedIdentifier));
    }
  });

  if (designerIds.size === 0 && designerEmails.size === 0) {
    return { byId: new Map(), byEmail: new Map() };
  }

  const orClauses = [];
  if (designerIds.size > 0) {
    orClauses.push({
      _id: { $in: Array.from(designerIds).map((id) => new mongoose.Types.ObjectId(id)) }
    });
  }
  if (designerEmails.size > 0) {
    orClauses.push({ email: { $in: Array.from(designerEmails) } });
  }

  const designers = await User.find({
    role: "designer",
    isActive: { $ne: false },
    $or: orClauses
  }).select("_id email role");

  const byId = new Map();
  const byEmail = new Map();

  designers.forEach((designer) => {
    const scope = getDesignerScope(designer) || "junior";
    const id = designer?._id?.toString?.();
    const email = normalizeValue(designer?.email);
    if (id) {
      byId.set(id, scope);
    }
    if (email) {
      byEmail.set(email, scope);
    }
  });

  return { byId, byEmail };
};

const resolveAvailabilityAssignedScope = (task, designerScopeMaps) => {
  const assignedId = normalizeId(task?.assignedToId);
  if (assignedId && designerScopeMaps.byId.has(assignedId)) {
    return designerScopeMaps.byId.get(assignedId);
  }

  const assignedIdentifier = resolveAssignedIdentifier(task);
  if (assignedIdentifier && designerScopeMaps.byId.has(assignedIdentifier)) {
    return designerScopeMaps.byId.get(assignedIdentifier);
  }
  if (assignedIdentifier && EMAIL_REGEX.test(assignedIdentifier)) {
    const normalizedEmail = normalizeValue(assignedIdentifier);
    if (designerScopeMaps.byEmail.has(normalizedEmail)) {
      return designerScopeMaps.byEmail.get(normalizedEmail);
    }
  }

  const assignedEmail = normalizeValue(task?.assignedToEmail);
  if (assignedEmail && designerScopeMaps.byEmail.has(assignedEmail)) {
    return designerScopeMaps.byEmail.get(assignedEmail);
  }

  return "";
};

const buildAvailabilityTaskPreview = (task, user, designerScopeMaps) => {
  const assignedIdentifier = resolveAssignedIdentifier(task);
  if (!assignedIdentifier) return null;
  return {
    id: task?._id?.toString?.() || "",
    title: buildAvailabilityTaskTitle(task, user),
    assignedToId: task?.assignedToId || assignedIdentifier || "",
    assignedTo: task?.assignedTo || assignedIdentifier || "",
    assignedToName: task?.assignedToName || "",
    deadline: task?.deadline || null,
    estimatedDays: Number(task?.estimatedDays || 0) || 0,
    urgency: task?.urgency || "normal",
    status: task?.status || "pending",
    assignedToScope: resolveAvailabilityAssignedScope(task, designerScopeMaps),
    createdAt: task?.createdAt || new Date(),
  };
};

const ensureTaskAccess = async (req, res, next) => {
  try {
    const rawTaskParam = String(req.params.id || "").trim();
    const isReadOnly =
      req.method === "GET" ||
      req.method === "HEAD";
    let task = null;
    if (mongoose.Types.ObjectId.isValid(rawTaskParam)) {
      task = await Task.findById(rawTaskParam);
    }
    // Backward compatibility: some older links may carry task code/title instead of ObjectId.
    if (!task && isReadOnly && rawTaskParam) {
      task = await Task.findOne({ title: rawTaskParam }).sort({ createdAt: -1 });
    }
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    const userRole = normalizeTaskRole(req.user?.role);
    const isMainDesigner = userRole === "designer" && isMainDesignerUser(req.user);
    const isUnassigned = await isTaskEffectivelyUnassigned(task);
    const requestPath = typeof req.path === "string" ? req.path : "";
    const isCommentWrite =
      req.method === "POST" && requestPath.endsWith("/comments");
    const isCommentMutationWrite =
      !requestPath.endsWith("/comments/seen") &&
      (
        (
          (req.method === "PATCH" || req.method === "DELETE") &&
          /\/comments\/[^/]+$/.test(requestPath)
        ) ||
        (
          req.method === "POST" &&
          /\/comments\/[^/]+\/reactions$/.test(requestPath)
        )
      );
    const isChangeWrite =
      req.method === "POST" && requestPath.endsWith("/changes");
    const isAssignDesignerWrite =
      req.method === "POST" && requestPath.endsWith("/assign-designer");
    const isLegacyAssignWrite =
      req.method === "POST" && requestPath.endsWith("/assign");
    const isFinalDeliverablesWrite =
      req.method === "POST" && requestPath.endsWith("/final-deliverables");
    const isFinalDeliverablesReviewWrite =
      req.method === "POST" && requestPath.endsWith("/final-deliverables/review");
    const isFinalDeliverableNoteWrite =
      req.method === "PATCH" && requestPath.endsWith("/note");
    const isAcceptWrite =
      req.method === "POST" && requestPath.endsWith("/accept");
    const isCommentsSeenWrite =
      req.method === "POST" && requestPath.endsWith("/comments/seen");
    const isTaskViewedWrite =
      req.method === "POST" && requestPath.endsWith("/viewed");
    const usesAssignedAccessRules = hasAssignedDesignerAccessMetadata(task);

    if (usesAssignedAccessRules) {
      const accessContext = await resolveTaskAccessContext(task, req.user);
      const canAssignDesignerFromUnassigned =
        userRole === "designer" &&
        isMainDesigner &&
        isUnassigned &&
        isAssignDesignerWrite;
      const canAssignDesignerAsManager =
        isAssignDesignerWrite &&
        (userRole === "admin" || (userRole === "designer" && isMainDesigner));
      const canLegacyAssignAsManager =
        isLegacyAssignWrite &&
        (userRole === "admin" || (userRole === "designer" && isMainDesigner));
      const managerApprovalFields = new Set([
        "approval_status",
        "deadline_request",
        "emergency_approval",
      ]);
      const managerApprovalUpdateKeys = new Set([
        "approvalStatus",
        "approvedBy",
        "approvalDate",
        "deadlineApprovalStatus",
        "deadlineApprovedBy",
        "deadlineApprovedAt",
        "emergencyApprovalStatus",
        "emergencyApprovedBy",
        "emergencyApprovedAt",
        "updatedAt",
      ]);
      const bodyChanges = Array.isArray(req.body?.changes) ? req.body.changes : [];
      const bodyUpdates = req.body?.updates && typeof req.body.updates === "object" ? req.body.updates : {};
      const fileWriteUpdateKeys = new Set(["files", "updatedAt"]);
      const hasOnlyFileChanges =
        bodyChanges.length > 0 &&
        bodyChanges.every((change) => normalizeValue(change?.field) === "files");
      const hasOnlyFileUpdates =
        Object.keys(bodyUpdates).length === 0 ||
        Object.keys(bodyUpdates).every((key) => fileWriteUpdateKeys.has(key));
      const canPrivilegedFileWrite =
        isChangeWrite &&
        hasOnlyFileChanges &&
        hasOnlyFileUpdates &&
        (
          userRole === "admin" ||
          (userRole === "designer" && isMainDesigner)
        );
      const hasManagerApprovalChanges =
        bodyChanges.length > 0 &&
        bodyChanges.every((change) =>
          managerApprovalFields.has(normalizeValue(change?.field))
        );
      const hasOnlyManagerApprovalUpdates =
        Object.keys(bodyUpdates).length === 0 ||
        Object.keys(bodyUpdates).every((key) => managerApprovalUpdateKeys.has(key));
      const canManagerApprovalWrite =
        isChangeWrite &&
        ["treasurer", "admin"].includes(userRole) &&
        hasManagerApprovalChanges &&
        hasOnlyManagerApprovalUpdates;
      const canVisibleUserReadWrite =
        (isCommentWrite ||
          isCommentMutationWrite ||
          isCommentsSeenWrite ||
          isTaskViewedWrite) &&
        accessContext.mode !== "none";
      const completionWriteFields = new Set(["status"]);
      const completionWriteUpdateKeys = new Set(["status", "updatedAt"]);
      const hasCompletionStatusChange =
        bodyChanges.some(
          (change) =>
            normalizeValue(change?.field) === "status" &&
            normalizeValue(change?.newValue) === "completed"
        ) || normalizeValue(bodyUpdates?.status) === "completed";
      const hasOnlyCompletionStatusChanges =
        bodyChanges.length > 0 &&
        bodyChanges.every((change) => completionWriteFields.has(normalizeValue(change?.field)));
      const hasOnlyCompletionUpdates =
        Object.keys(bodyUpdates).length === 0 ||
        Object.keys(bodyUpdates).every((key) => completionWriteUpdateKeys.has(key));
      const canMainDesignerFinalizeWrite =
        (
          (userRole === "designer" && isMainDesigner) ||
          userRole === "admin"
        ) &&
        (
          isFinalDeliverablesWrite ||
          isFinalDeliverablesReviewWrite ||
          isFinalDeliverableNoteWrite ||
          (
            isChangeWrite &&
            hasCompletionStatusChange &&
            hasOnlyCompletionStatusChanges &&
            hasOnlyCompletionUpdates
          )
        );

      if (isReadOnly) {
        if (accessContext.mode === "none") {
          return res.status(403).json({ error: "Forbidden." });
        }
        req.task = task;
        req.taskAccessMode = accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (
        isAssignDesignerWrite &&
        (accessContext.mode === "full" || canAssignDesignerFromUnassigned || canAssignDesignerAsManager)
      ) {
        req.task = task;
        req.taskAccessMode = accessContext.mode === "none" ? "full" : accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canLegacyAssignAsManager) {
        req.task = task;
        req.taskAccessMode = accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canManagerApprovalWrite) {
        req.task = task;
        req.taskAccessMode = "full";
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canVisibleUserReadWrite) {
        req.task = task;
        req.taskAccessMode = accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canPrivilegedFileWrite) {
        req.task = task;
        req.taskAccessMode = "full";
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canMainDesignerFinalizeWrite) {
        req.task = task;
        req.taskAccessMode = accessContext.mode === "none" ? "full" : accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (accessContext.mode !== "full") {
        return res.status(403).json({ error: "Forbidden." });
      }

      req.task = task;
      req.taskAccessMode = accessContext.mode;
      req.taskAccessContext = accessContext;
      return next();
    }

    if (userRole === "staff" && isReadOnly) {
      req.task = task;
      return next();
    }
    if (
      userRole === "designer" &&
      isMainDesigner &&
      isUnassigned &&
      (isReadOnly ||
        isCommentWrite ||
        isCommentMutationWrite ||
        isChangeWrite ||
        isAssignDesignerWrite ||
        isFinalDeliverablesWrite ||
        isFinalDeliverablesReviewWrite ||
        isFinalDeliverableNoteWrite ||
        isAcceptWrite ||
        isCommentsSeenWrite ||
        isTaskViewedWrite)
    ) {
      req.task = task;
      req.taskAccessMode = "full";
      req.taskAccessContext = {
        mode: "full",
        assignedDesignerEmail: normalizeValue(req.user?.email),
        ccEmails: extractTaskCcEmails(task)
      };
      return next();
    }
    if (userRole === "staff" && isChangeWrite) {
      const bodyChanges = Array.isArray(req.body?.changes) ? req.body.changes : [];
      const isFileOnly =
        bodyChanges.length > 0 &&
        bodyChanges.every(
          (change) =>
            (change?.type === "file_added" && change?.field === "files") ||
            (change?.type === "update" && change?.field === "design_version")
        );
      const updates = req.body?.updates || {};
      const allowedKeys = ["files", "designVersions", "activeDesignVersionId", "updatedAt"];
      const updatesOk =
        updates && Object.keys(updates).every((key) => allowedKeys.includes(key));
      if (isFileOnly && updatesOk) {
        req.task = task;
        return next();
      }
    }
    if (
      isChangeWrite &&
      (userRole === "admin" || (userRole === "designer" && isMainDesigner))
    ) {
      const bodyChanges = Array.isArray(req.body?.changes) ? req.body.changes : [];
      const bodyUpdates = req.body?.updates && typeof req.body.updates === "object" ? req.body.updates : {};
      const isFileOnly =
        bodyChanges.length > 0 &&
        bodyChanges.every((change) => normalizeValue(change?.field) === "files");
      const updatesOk =
        Object.keys(bodyUpdates).length === 0 ||
        Object.keys(bodyUpdates).every((key) => ["files", "updatedAt"].includes(key));
      if (isFileOnly && updatesOk) {
        req.task = task;
        req.taskAccessMode = "full";
        req.taskAccessContext = {
          mode: "full",
          assignedDesignerEmail: await resolveAssignedDesignerEmail(task),
          ccEmails: extractTaskCcEmails(task)
        };
        return next();
      }
    }
    if (!canAccessTask(task, req.user)) {
      if (userRole === "designer" && !isMainDesigner) {
        return res.status(403).json({ error: "Forbidden." });
      }
      if (isReadOnly) {
        req.task = task;
        req.taskAccessMode = "view_only";
        req.taskAccessContext = {
          mode: "view_only",
          assignedDesignerEmail: await resolveAssignedDesignerEmail(task),
          ccEmails: extractTaskCcEmails(task)
        };
        return next();
      }
      return res.status(403).json({ error: "Forbidden." });
    }
    req.task = task;
    return next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid task id." });
  }
};

router.get("/", globalLimiter, async (req, res) => {
  try {
    const { status, category, urgency, requesterId, requesterEmail, assignedToId, limit } = req.query;
    const query = {};
    const userRole = normalizeTaskRole(req.user?.role);
    const userId = getUserId(req);
    const userEmail = normalizeValue(req.user?.email);
    const userName = normalizeValue(req.user?.name);
    const userIsMainDesigner = userRole === "designer" && isMainDesignerUser(req.user);

    if (status) query.status = status;
    if (category) query.category = category;
    if (urgency) query.urgency = urgency;
    if (requesterId && requesterEmail) {
      query.$or = [
        { requesterId },
        { requesterEmail }
      ];
    } else {
      if (requesterId) query.requesterId = requesterId;
      if (requesterEmail) query.requesterEmail = requesterEmail;
    }
    if (assignedToId) query.assignedToId = assignedToId;

    if (userRole === "staff") {
      const orClauses = [{ requesterId: userId }];
      const userObjectId = toObjectId(userId);
      if (userObjectId) {
        orClauses.push({ requesterId: userObjectId });
      }
      if (userEmail) {
        orClauses.push({ requesterEmail: userEmail });
        orClauses.push({
          changeHistory: {
            $elemMatch: {
              field: "cc_emails",
              newValue: new RegExp(escapeRegExp(userEmail), "i")
            }
          }
        });
      }
      if (userName) {
        const nameRegex = new RegExp(escapeRegExp(userName), "i");
        orClauses.push({ requesterName: nameRegex });
        orClauses.push({
          changeHistory: {
            $elemMatch: { field: "created", userName: nameRegex }
          }
        });
      }
      if (userId) {
        orClauses.push({
          changeHistory: {
            $elemMatch: { field: "created", userId }
          }
        });
      }
      query.$or = orClauses;
    } else if (userRole === "designer") {
      // Main designers can monitor the unassigned queue; junior designers are limited to assigned tasks.
    } else if (userRole !== "treasurer" && userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden." });
    }

    const safeLimit = Math.min(parseInt(limit || "100", 10), 500);
    const tasks = await Task.find(query).sort({ createdAt: -1 }).limit(safeLimit);
    const filteredTasks =
      userRole === "designer"
        ? (
          await Promise.all(
            tasks.map(async (task) => {
              if (!userIsMainDesigner) {
                return canAccessTask(task, req.user) ? task : null;
              }
              if (!hasAssignedDesignerAccessMetadata(task)) {
                if (await isTaskEffectivelyUnassigned(task)) return task;
                return canAccessTask(task, req.user) ? task : null;
              }
              if (await isTaskEffectivelyUnassigned(task)) return task;
              const assignedId = resolveAssignedIdentifier(task);
              if (assignedId && userId && assignedId === userId) return task;
              if (assignedId && EMAIL_REGEX.test(assignedId) && userEmail && normalizeValue(assignedId) === userEmail) {
                return task;
              }
              const ccEmails = extractTaskCcEmails(task);
              if (isTaskAssignedByUser(task, req.user)) return task;
              if (userEmail && ccEmails.includes(userEmail)) return task;
              return task;
            })
          )
        ).filter(Boolean)
        : tasks;
    const taskViewLookup = await buildTaskViewLookup(filteredTasks, req.user);
    res.json(
      filteredTasks.map((task) =>
        buildTaskPayloadForViewer(task, req.user, {
          viewerReadAt: taskViewLookup.get(getTaskDocumentId(task)),
        })
      )
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to load tasks." });
  }
});

router.get("/availability", globalLimiter, async (req, res) => {
  try {
    const { status, category, urgency, assignedToId, limit } = req.query;
    const query = {};
    const userRole = normalizeTaskRole(req.user?.role);
    const userIsMainDesigner = userRole === "designer" && isMainDesignerUser(req.user);

    if (status) query.status = status;
    if (category) query.category = category;
    if (urgency) query.urgency = urgency;
    if (assignedToId) query.assignedToId = assignedToId;

    const safeLimit = Math.min(parseInt(limit || "250", 10), 500);
    const tasks = await Task.find(query).sort({ createdAt: -1 }).limit(safeLimit);
    const visibleTasks = (
      await Promise.all(
        tasks.map(async (task) => {
          if (userRole === "admin" || userRole === "treasurer" || userRole === "manager" || userRole === "staff") {
            return task;
          }
          if (userRole === "designer") {
            if (userIsMainDesigner) {
              return task;
            }
            return canAccessTask(task, req.user) ? task : null;
          }
          return null;
        })
      )
    ).filter(Boolean);
    const designerScopeMaps = await buildAvailabilityDesignerScopeMaps(visibleTasks);
    const availabilityTasks = visibleTasks
      .map((task) => buildAvailabilityTaskPreview(task, req.user, designerScopeMaps))
      .filter(Boolean);

    return res.json(availabilityTasks);
  } catch (error) {
    return res.status(500).json({ error: "Failed to load availability." });
  }
});

router.get("/designers", async (req, res) => {
  try {
    const role = normalizeTaskRole(req.user?.role);
    const canViewAssignableDesigners =
      role === "admin" || (role === "designer" && isMainDesignerUser(req.user));
    if (!canViewAssignableDesigners) {
      return res.status(403).json({ error: "Only the Design Lead can view assignable designers." });
    }

    const designers = await getActiveDesignerUsers();
    const assignableDesigners = hasMainDesignerConfig()
      ? splitDesignersByScope(designers).juniorDesigners
      : designers;

    res.json(
      assignableDesigners.map((designer) => {
        const email = normalizeValue(designer.email);
        const fallbackName = email ? email.split("@")[0] : "Designer";
        const designerScope = getDesignerScope(designer) || "junior";
        return {
          id: designer._id?.toString?.() || "",
          name: designer.name || fallbackName,
          email,
          role: designer.role || "designer",
          designerScope,
          portalId: buildDesignerPortalId(designer)
        };
      })
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to load designers." });
  }
});

router.post("/", requireRole(["staff", "treasurer", "designer"]), async (req, res) => {
  try {
    const now = new Date();
    const actorId = getUserId(req);
    const actorRole = req.user?.role || "staff";
    const requesterName = req.body.requesterName || req.user?.name || "";
    const requesterId = actorRole === "staff" ? actorId : (req.body.requesterId || actorId);
    const requesterEmail = actorRole === "staff" ? (req.user?.email || "") : (req.body.requesterEmail || req.user?.email || "");
    const createdEntry = {
      type: "status",
      field: "created",
      oldValue: "",
      newValue: "Created",
      note: `New request submitted by ${requesterName || "Staff"}`,
      userId: requesterId || "",
      userName: requesterName || "",
      userRole: actorRole || "staff",
      createdAt: now
    };
    const payload = {
      ...req.body,
      requesterId,
      requesterEmail,
      files: normalizeTaskFileCollection(req.body?.files),
      changeHistory: [createdEntry, ...(Array.isArray(req.body.changeHistory) ? req.body.changeHistory : [])]
    };
    const normalizedCampaign = normalizeCampaignPayload(req.body?.campaign, {
      title: req.body?.title,
      description: req.body?.description,
      commonDeadline: req.body?.deadline,
    });
    const incomingCollaterals = normalizeCollateralCollection(req.body?.collaterals, {
      defaultDeadline: normalizedCampaign.commonDeadline || req.body?.deadline,
      now,
    });
    const isCampaignRequest =
      normalizeValue(req.body?.requestType) === "campaign_request" || incomingCollaterals.length > 0;

    if (isCampaignRequest && incomingCollaterals.length === 0) {
      return res.status(400).json({ error: "At least one collateral is required." });
    }

    payload.requestType = isCampaignRequest ? "campaign_request" : "single_task";
    if (isCampaignRequest) {
      payload.collaterals = incomingCollaterals;
      payload.campaign = {
        ...normalizedCampaign,
        requestName: normalizedCampaign.requestName || String(req.body?.title || "").trim(),
        brief: normalizedCampaign.brief || String(req.body?.description || "").trim(),
      };
      payload.title = payload.campaign.requestName || String(req.body?.title || "").trim();
      payload.description = buildCampaignDescription(payload.campaign.brief, incomingCollaterals);
      payload.category = deriveTaskCategoryFromCollaterals(incomingCollaterals);
      payload.urgency = deriveTaskUrgencyFromCollaterals(incomingCollaterals);
      payload.status = deriveTaskStatusFromCollaterals(incomingCollaterals, payload.status || "pending");
      payload.deadline = deriveTaskDeadlineFromCollaterals(incomingCollaterals, payload.campaign);
    }

    if (!payload.title) {
      return res.status(400).json({ error: "Request title is required." });
    }
    if (!payload.category) {
      return res.status(400).json({ error: "Category is required." });
    }
    if (!payload.deadline) {
      return res.status(400).json({ error: "Deadline is required." });
    }
    const parsedDeadline = new Date(payload.deadline);
    if (Number.isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ error: "Invalid deadline." });
    }
    payload.deadline = parsedDeadline;
    if (payload.isEmergency) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const deadlineStart = new Date(parsedDeadline);
      deadlineStart.setHours(0, 0, 0, 0);
      if (deadlineStart < todayStart) {
        return res.status(400).json({ error: "Emergency deadline cannot be before today." });
      }
    }
    // Staff/treasurer cannot directly assign designers while creating a task.
    payload.assignedToId = "";
    payload.assignedToName = "";
    payload.assignedTo = "";
    payload.assignedToEmail = "";
    const dedupeWindowMs = Number(process.env.TASK_DEDUPE_WINDOW_MS || 120000);
    const dedupeSince = new Date(Date.now() - dedupeWindowMs);
    const baseDedupeQuery = {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      urgency: payload.urgency,
      deadline: payload.deadline,
      createdAt: { $gte: dedupeSince },
    };
    const dedupeQuery = requesterId
      ? { ...baseDedupeQuery, requesterId }
      : requesterEmail
        ? { ...baseDedupeQuery, requesterEmail }
        : null;
    if (dedupeQuery) {
      let existingTask = await Task.findOne(dedupeQuery).sort({ createdAt: -1 });
      if (existingTask) {
        existingTask = await hydrateMissingFileMeta(existingTask);
        return res.status(200).json(buildTaskPayloadForViewer(existingTask, req.user));
      }
    }
    let task = await Task.create(payload);
    task = await hydrateMissingFileMeta(task);
    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "created",
      userId: requesterId || "",
      userName: requesterName || ""
    });

    const io = getSocket();
    const taskId = task.id || task._id?.toString?.();
    console.log("Request created:", taskId);
    const taskLink = buildTaskLink(taskId);
    const createdEventId = `task:${taskId}:created`;
    getUserIdsByRole(["treasurer"]).then((userIds) => {
      if (userIds.length === 0) return;
      return createNotificationsForUsers(userIds, {
        title: `New request: ${task.title}`,
        message: `Submitted by ${requesterName || "Staff"}`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: createdEventId,
      }).then(emitNotifications);
    }).catch((error) => {
      console.error("Notification error (task created):", error?.message || error);
    });

    if (requesterId) {
      createNotification({
        userId: requesterId,
        title: `Request submitted: ${task.title}`,
        message: "Your request has been submitted.",
        type: "task",
        link: taskLink,
        taskId,
        eventId: `requester:${taskId}:created`,
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (requester created):", error?.message || error);
        });
    }

    if (task.assignedToId) {
      createNotification({
        userId: task.assignedToId,
        title: `New task assigned: ${task.title}`,
        message: `${requesterName || "Staff"} assigned a task to you.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `assign:${taskId}:${task.assignedToId}:${now.toISOString()}`,
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (assign on create):", error?.message || error);
        });
    }

    if (io) {
      const payloadTask = typeof task.toJSON === "function" ? task.toJSON() : task;
      const targetRoom = task.assignedToId ? String(task.assignedToId) : "designers:queue";
      io.to(targetRoom).emit("request:new", payloadTask);
      console.log(`Emitted request:new to room: ${targetRoom}`);
      getUserIdsByRole(["treasurer"]).then((userIds) => {
        userIds.forEach((treasurerId) => {
          io.to(String(treasurerId)).emit("request:new", payloadTask);
        });
        if (userIds.length > 0) {
          console.log(`Emitted request:new to ${userIds.length} treasurer rooms`);
        }
      }).catch((error) => {
        console.error("Request emit error (treasurer rooms):", error?.message || error);
      });
      if (!task.assignedToId) {
        getQueueDesignerUserIds().then((userIds) => {
          userIds.forEach((designerId) => {
            io.to(String(designerId)).emit("request:new", payloadTask);
          });
          if (userIds.length > 0) {
            console.log(`Emitted request:new to ${userIds.length} designer rooms`);
          }
        }).catch((error) => {
          console.error("Request emit error (designer rooms):", error?.message || error);
        });
      }
    }

    if (!task.assignedToId) {
      getQueueDesignerUserIds().then((userIds) => {
        if (userIds.length === 0) return;
        return createNotificationsForUsers(userIds, {
          title: `New request: ${task.title}`,
          message: `Submitted by ${requesterName || "Staff"}`,
          type: "task",
          link: taskLink,
          taskId,
          eventId: `queue:${taskId}:created`,
        }).then(emitNotifications);
      }).catch((error) => {
        console.error("Notification error (designer queue):", error?.message || error);
      });
    }

    const taskUrl = buildFrontendTaskUrl(task.id || task._id);

    const requesterPrefs = await resolveNotificationPreferences({
      userId: task.requesterId,
      email: task.requesterEmail,
      fallbackUser: req.user,
    });

    if (requesterPrefs.emailNotifications) {
      const emailSent = await sendTaskLifecycleEmailIfEnabled({
        task,
        userId: task.requesterId,
        email: task.requesterEmail,
        fallbackUser: req.user,
        emailType: "REQUEST_CREATED",
        actorName: requesterName || task.requesterName || "Staff",
        submittedAt: now,
      });
      if (!emailSent) {
        console.warn("Request created email skipped or failed.");
      }
    }

    if (requesterPrefs.whatsappNotifications) {
      const recipients = [
        task.requesterPhone,
        ...(Array.isArray(task.secondaryPhones) ? task.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (recipients.length === 0 && process.env.TWILIO_DEFAULT_TO) {
        recipients.push(process.env.TWILIO_DEFAULT_TO);
      }

      // Non-blocking notification
      Promise.all(recipients.map(to =>
        sendTaskCreatedSms({
          to,
          taskTitle: task.title,
          taskUrl,
          deadline: task.deadline,
          requesterName: task.requesterName,
          taskId: task.id || task._id?.toString?.()
        })
      )).catch(err => console.error("Background Notification Error (Create Task):", err));
    }

    res.status(201).json(buildTaskPayloadForViewer(task, req.user));
  } catch (error) {
    console.error("Failed to create task:", error);
    res.status(400).json({ error: "Failed to create task." });
  }
});

const hydrateMissingFileMeta = async (task) => {
  if (!task?.files?.length) return task;
  const pending = task.files.filter(
    (file) =>
      (
        file.size === undefined ||
        !file.thumbnailUrl ||
        !file.driveId ||
        !file.webViewLink ||
        !file.webContentLink ||
        !file.url
      ) &&
      (
        extractDriveId(file?.driveId, file?.webViewLink, file?.webContentLink, file?.url) ||
        String(file?.name || "").trim()
      )
  );
  if (pending.length === 0) return task;
  try {
    const drive = getDriveClient();
    let changed = false;
    for (const file of pending) {
      let resolved = normalizeTaskFileLinks(file);
      let fileId = extractDriveId(
        resolved?.driveId,
        resolved?.webViewLink,
        resolved?.webContentLink,
        resolved?.url
      );
      if (!fileId) {
        const driveMatch = await searchDriveFileByName(drive, resolved);
        if (driveMatch) {
          resolved = mergeResolvedFileData(resolved, driveMatch);
          fileId = String(resolved?.driveId || "").trim();
        }
      }
      if (!fileId) continue;
      if (!resolved.driveId) {
        resolved.driveId = fileId;
      }
      if (!resolved.webViewLink) {
        resolved.webViewLink = buildDriveViewUrl(fileId);
      }
      if (!resolved.webContentLink) {
        resolved.webContentLink = buildDriveDownloadUrl(fileId);
      }
      if (!resolved.url) {
        resolved.url = resolved.webViewLink || resolved.webContentLink || "";
      }
      const response = await drive.files.get({
        fileId,
        fields: "id,size,thumbnailLink,mimeType,webViewLink,webContentLink,name",
        supportsAllDrives: true,
      });
      const sizeValue = response?.data?.size ? Number(response.data.size) : undefined;
      if (Number.isFinite(sizeValue)) {
        resolved.size = sizeValue;
      }
      if (response?.data?.thumbnailLink) {
        resolved.thumbnailUrl = response.data.thumbnailLink;
      }
      if (response?.data?.mimeType && !resolved.mime) {
        resolved.mime = response.data.mimeType;
      }
      if (response?.data?.webViewLink && !resolved.webViewLink) {
        resolved.webViewLink = response.data.webViewLink;
      }
      if (response?.data?.webContentLink && !resolved.webContentLink) {
        resolved.webContentLink = response.data.webContentLink;
      }
      if (!resolved.url) {
        resolved.url =
          resolved.webViewLink || resolved.webContentLink || buildDriveViewUrl(fileId);
      }
      if (fileLinkFieldsChanged(file, resolved)) {
        Object.assign(file, resolved);
        changed = true;
      }
    }
    if (changed) {
      task.markModified("files");
      await task.save();
    }
  } catch (error) {
    console.error("Drive metadata hydration failed:", error?.message || error);
  }
  return task;
};

router.post("/:id/collaterals", ensureTaskAccess, async (req, res) => {
  try {
    const viewerRole = normalizeTaskRole(req.user?.role);
    if (req.taskAccessMode === "view_only") {
      return res.status(403).json({ error: "View-only users cannot modify collaterals." });
    }
    if (!["staff", "designer", "treasurer", "admin"].includes(viewerRole)) {
      return res.status(403).json({ error: "You do not have permission to add collaterals." });
    }

    const task = req.task;
    const nextCampaign = normalizeCampaignPayload(
      { ...(task?.campaign || {}), ...(req.body?.campaign || {}) },
      {
        title: task?.title,
        description: task?.campaign?.brief || task?.description,
        commonDeadline: task?.campaign?.commonDeadline || task?.deadline,
      }
    );
    const additions = normalizeCollateralCollection(
      Array.isArray(req.body?.collaterals) ? req.body.collaterals : [req.body],
      {
        defaultDeadline: nextCampaign.commonDeadline || task?.deadline,
        now: new Date(),
      }
    );

    if (additions.length === 0) {
      return res.status(400).json({ error: "At least one collateral is required." });
    }

    task.requestType = "campaign_request";
    task.campaign = {
      ...nextCampaign,
      requestName: nextCampaign.requestName || String(task?.title || "").trim(),
      brief: nextCampaign.brief || String(task?.campaign?.brief || task?.description || "").trim(),
    };
    task.collaterals = [...(Array.isArray(task.collaterals) ? task.collaterals : []), ...additions];
    syncTaskFromCampaignData(task);

    const actorId = getUserId(req);
    const actorName = req.user?.name || "";
    task.changeHistory.push({
      type: "update",
      field: "collateral_added",
      oldValue: "",
      newValue: additions.map((item) => item.title || item.presetLabel || item.collateralType).join(", "),
      note: `${additions.length} collateral item${additions.length === 1 ? "" : "s"} added.`,
      userId: actorId,
      userName: actorName,
      userRole: viewerRole,
      createdAt: new Date(),
    });

    task.markModified("campaign");
    task.markModified("collaterals");
    await task.save();

    const payload = buildTaskPayloadForViewer(task, req.user);
    const taskId = task.id || task._id?.toString?.();
    const io = getSocket();
    if (io && taskId) {
      io.to(String(taskId)).emit("task:updated", { taskId, task: payload });
    }

    res.json(payload);
  } catch (error) {
    console.error("Add collateral error:", error?.message || error);
    res.status(400).json({ error: error?.message || "Failed to add collateral." });
  }
});

router.patch("/:id/collaterals/:collateralId", ensureTaskAccess, async (req, res) => {
  try {
    const viewerRole = normalizeTaskRole(req.user?.role);
    if (req.taskAccessMode === "view_only") {
      return res.status(403).json({ error: "View-only users cannot modify collaterals." });
    }
    if (!["staff", "designer", "treasurer", "admin"].includes(viewerRole)) {
      return res.status(403).json({ error: "You do not have permission to update collaterals." });
    }

    const task = req.task;
    const collateralId = String(req.params.collateralId || "").trim();
    const collaterals = Array.isArray(task.collaterals) ? task.collaterals : [];
    const currentIndex = collaterals.findIndex((item) => String(item?.id || "") === collateralId);
    if (currentIndex === -1) {
      return res.status(404).json({ error: "Collateral not found." });
    }

    if (viewerRole === "staff" && req.body?.status) {
      return res.status(403).json({ error: "Staff cannot change collateral status directly." });
    }

    const nextCampaign = normalizeCampaignPayload(
      { ...(task?.campaign || {}), ...(req.body?.campaign || {}) },
      {
        title: task?.title,
        description: task?.campaign?.brief || task?.description,
        commonDeadline: task?.campaign?.commonDeadline || task?.deadline,
      }
    );
    const currentCollateral = collaterals[currentIndex];
    const nextCollateral = normalizeCollateralInput(
      {
        ...(typeof currentCollateral?.toObject === "function"
          ? currentCollateral.toObject()
          : { ...(currentCollateral || {}) }),
        ...(req.body?.collateral || req.body || {}),
        id: currentCollateral?.id,
        createdAt: currentCollateral?.createdAt,
      },
      {
        defaultDeadline: nextCampaign.commonDeadline || task?.deadline,
        now: new Date(),
      }
    );

    collaterals[currentIndex] = nextCollateral;
    task.campaign = {
      ...nextCampaign,
      requestName: nextCampaign.requestName || String(task?.title || "").trim(),
      brief: nextCampaign.brief || String(task?.campaign?.brief || task?.description || "").trim(),
    };
    task.collaterals = collaterals;
    syncTaskFromCampaignData(task);

    const actorId = getUserId(req);
    const actorName = req.user?.name || "";
    task.changeHistory.push({
      type: "update",
      field: "collateral_updated",
      oldValue: currentCollateral?.title || currentCollateral?.presetLabel || currentCollateral?.collateralType || "",
      newValue: nextCollateral?.title || nextCollateral?.presetLabel || nextCollateral?.collateralType || "",
      note: `Updated collateral ${nextCollateral?.title || nextCollateral?.collateralType || collateralId}.`,
      userId: actorId,
      userName: actorName,
      userRole: viewerRole,
      createdAt: new Date(),
    });

    task.markModified("campaign");
    task.markModified("collaterals");
    await task.save();

    const payload = buildTaskPayloadForViewer(task, req.user);
    const taskId = task.id || task._id?.toString?.();
    const io = getSocket();
    if (io && taskId) {
      io.to(String(taskId)).emit("task:updated", { taskId, task: payload });
    }

    res.json(payload);
  } catch (error) {
    console.error("Update collateral error:", error?.message || error);
    res.status(400).json({ error: error?.message || "Failed to update collateral." });
  }
});

router.patch("/:id/collaterals/:collateralId/status", ensureTaskAccess, async (req, res) => {
  try {
    const viewerRole = normalizeTaskRole(req.user?.role);
    if (req.taskAccessMode === "view_only") {
      return res.status(403).json({ error: "View-only users cannot modify collaterals." });
    }
    if (!["designer", "treasurer", "admin"].includes(viewerRole)) {
      return res.status(403).json({ error: "Only designers or approvers can update collateral status." });
    }

    const task = req.task;
    const collateralId = String(req.params.collateralId || "").trim();
    const nextStatus = normalizeCollateralStatus(req.body?.status);
    const note = String(req.body?.note || "").trim();
    const collaterals = Array.isArray(task.collaterals) ? task.collaterals : [];
    const currentIndex = collaterals.findIndex((item) => String(item?.id || "") === collateralId);
    if (currentIndex === -1) {
      return res.status(404).json({ error: "Collateral not found." });
    }

    const currentCollateral = collaterals[currentIndex];
    const updatedCollateral = normalizeCollateralInput(
      {
        ...(typeof currentCollateral?.toObject === "function"
          ? currentCollateral.toObject()
          : { ...(currentCollateral || {}) }),
        status: nextStatus,
        assignedToId: currentCollateral?.assignedToId || getUserId(req) || "",
        assignedToName: currentCollateral?.assignedToName || req.user?.name || "",
        id: currentCollateral?.id,
        createdAt: currentCollateral?.createdAt,
      },
      {
        defaultDeadline: task?.campaign?.commonDeadline || task?.deadline,
        now: new Date(),
      }
    );

    collaterals[currentIndex] = updatedCollateral;
    task.collaterals = collaterals;
    syncTaskFromCampaignData(task);

    task.changeHistory.push({
      type: "status",
      field: "collateral_status",
      oldValue: currentCollateral?.status || "pending",
      newValue: nextStatus,
      note:
        note ||
        `Collateral ${updatedCollateral?.title || updatedCollateral?.collateralType || collateralId} moved to ${nextStatus.replace(/_/g, " ")}.`,
      userId: getUserId(req),
      userName: req.user?.name || "",
      userRole: viewerRole,
      createdAt: new Date(),
    });

    task.markModified("collaterals");
    await task.save();

    const payload = buildTaskPayloadForViewer(task, req.user);
    const taskId = task.id || task._id?.toString?.();
    const io = getSocket();
    if (io && taskId) {
      io.to(String(taskId)).emit("task:updated", { taskId, task: payload });
    }

    res.json(payload);
  } catch (error) {
    console.error("Update collateral status error:", error?.message || error);
    res.status(400).json({ error: error?.message || "Failed to update collateral status." });
  }
});

router.get("/:id", ensureTaskAccess, async (req, res) => {
  try {
    let task = req.task;
    task = await hydrateMissingFileMeta(task);
    task = await repairMissingFinalDeliverableFiles(task);
    const taskViewLookup = await buildTaskViewLookup([task], req.user);
    const accessContext =
      req.taskAccessContext || await resolveTaskAccessContext(task, req.user);
    const payload = buildTaskPayloadForViewer(task, req.user, {
      viewerReadAt: taskViewLookup.get(getTaskDocumentId(task)),
    });
    payload.accessMode = req.taskAccessMode || accessContext?.mode || "full";
    payload.viewOnly = payload.accessMode === "view_only";
    if (accessContext?.assignedDesignerEmail) {
      payload.assignedDesignerEmail = accessContext.assignedDesignerEmail;
    }
    if (accessContext?.ccEmails && accessContext.ccEmails.length > 0) {
      payload.ccEmails = accessContext.ccEmails;
      payload.cc_emails = accessContext.ccEmails;
    }
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.post("/:id/viewed", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const viewerId = String(getUserId(req) || "").trim();
    const taskId = getTaskDocumentId(task);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    if (!viewerId) {
      return res.status(401).json({ error: "Missing user identity." });
    }
    if (!taskId) {
      return res.status(400).json({ error: "Invalid task id." });
    }

    const view = await TaskView.findOneAndUpdate(
      { taskId, userId: viewerId },
      {
        $setOnInsert: {
          taskId,
          userId: viewerId,
          userName: String(req.user?.name || "").trim(),
          readAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    const payload = buildTaskPayloadForViewer(task, req.user, {
      viewerReadAt: view?.readAt || undefined,
    });
    const io = getSocket();
    if (io) {
      io.to(viewerId).emit("task:updated", {
        taskId,
        task: payload,
      });
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task read status." });
  }
});

router.delete("/:id/viewed", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const viewerId = String(getUserId(req) || "").trim();
    const taskId = getTaskDocumentId(task);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    if (!viewerId) {
      return res.status(401).json({ error: "Missing user identity." });
    }
    if (!taskId) {
      return res.status(400).json({ error: "Invalid task id." });
    }

    await TaskView.deleteOne({ taskId, userId: viewerId });

    const payload = buildTaskPayloadForViewer(task, req.user, {
      viewerReadAt: undefined,
    });
    const io = getSocket();
    if (io) {
      io.to(viewerId).emit("task:updated", {
        taskId,
        task: payload,
      });
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task unread status." });
  }
});

router.get("/:id/changes", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    res.json(Array.isArray(task?.changeHistory) ? task.changeHistory : []);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.get("/:id/final-deliverables", ensureTaskAccess, async (req, res) => {
  try {
    let task = req.task;
    task = await repairMissingFinalDeliverableFiles(task);
    const versions = buildTaskPayloadForViewer(task, req.user).finalDeliverableVersions || [];
    res.json(versions);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.patch("/:id/final-deliverables/:versionId/note", ensureTaskAccess, async (req, res) => {
  try {
    const userRole = req.user?.role || "";
    if (userRole !== "designer" && userRole !== "admin" && userRole !== "staff") {
      return res.status(403).json({ error: "Only designers or staff can update final deliverable notes." });
    }
    const taskId = req.params.id;
    const versionId = String(req.params.versionId || "").trim();
    const note = req.body?.note ? String(req.body.note).trim() : "";
    if (!versionId) {
      return res.status(400).json({ error: "Version id is required." });
    }

    let task = req.task;
    task = await ensureFinalDeliverableVersions(task);
    const versions = Array.isArray(task.finalDeliverableVersions) ? task.finalDeliverableVersions : [];
    const targetVersion = versions.find((version) => String(version?._id || version?.id || "") === versionId);
    if (!targetVersion) {
      return res.status(404).json({ error: "Final deliverable version not found." });
    }

    const oldNote = String(targetVersion.note || "");
    if (oldNote === note) {
      return res.json(buildTaskPayloadForViewer(task, req.user));
    }

    targetVersion.note = note;
    const changedAt = new Date();
    const userId = getUserId(req);
    const resolvedUserName = req.user?.name || "";
    task.changeHistory.push({
      type: "update",
      field: "final_deliverable_note",
      oldValue: oldNote,
      newValue: note,
      note: `Updated final deliverable note (v${targetVersion.version || "?"})`,
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: changedAt
    });
    task.markModified("finalDeliverableVersions");
    task.markModified("changeHistory");
    task.updatedAt = changedAt;
    await task.save();

    req.auditTargetId = task.id || task._id?.toString?.() || taskId;

    const io = getSocket();
    if (io) {
      const updatedTaskId = task.id || task._id?.toString?.();
      const updatePayload = {
        taskId: updatedTaskId,
        task: buildTaskPayloadForViewer(task, { role: "staff" })
      };
      io.to(updatedTaskId).emit("task:updated", updatePayload);
      if (userId) {
        io.to(String(userId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: buildTaskPayloadForViewer(task, req.user),
        });
      }
    }

    res.json(buildTaskPayloadForViewer(task, req.user));
  } catch (error) {
    console.error("Final deliverable note update error:", error?.message || error);
    res.status(400).json({ error: "Failed to update final deliverable note." });
  }
});

router.post("/:id/final-deliverables", ensureTaskAccess, async (req, res) => {
  try {
    const userRole = req.user?.role || "";
    if (userRole !== "designer" && userRole !== "admin" && userRole !== "staff") {
      return res.status(403).json({ error: "Only designers or staff can upload final deliverables." });
    }
    const taskId = req.params.id;
    const userId = getUserId(req);
    const resolvedUserName = req.user?.name || "";
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    const note = req.body?.note ? String(req.body.note).trim() : "";
    if (files.length === 0) {
      return res.status(400).json({ error: "Final deliverable files are required." });
    }

    let task = req.task;
    task = await ensureFinalDeliverableVersions(task);
    const previousReviewState = resolveFinalDeliverableReviewState(task);
    const previousTaskStatusLabel = String(task?.status || "");
    const previousTaskStatus = normalizeValue(task?.status).replace(/[\s-]+/g, "_") || "pending";
    const uploadedAt = new Date();
    const reviewRequired = requiresMainDesignerFinalReview(req.user);
    const nextReviewStatus = reviewRequired ? "pending" : "approved";
    const nextTaskStatus = reviewRequired ? "under_review" : "completed";
    const nextReviewedBy = reviewRequired ? "" : (resolvedUserName || req.user?.email || "");
    const nextReviewedAt = reviewRequired ? undefined : uploadedAt;
    const nextReviewNote = "";
    const existingVersions = Array.isArray(task.finalDeliverableVersions)
      ? task.finalDeliverableVersions
      : [];
    const maxVersion = existingVersions.reduce(
      (max, version) => Math.max(max, Number(version?.version) || 0),
      0
    );
    const nextVersion = maxVersion + 1;
    const versionFiles = files.map((file) =>
      normalizeTaskFileLinks({
        name: file?.name || "",
        url: file?.url || "",
        driveId: file?.driveId || "",
        webViewLink: file?.webViewLink || "",
        webContentLink: file?.webContentLink || "",
        size: typeof file?.size === "number" ? file.size : undefined,
        mime: file?.mime || "",
        thumbnailUrl: file?.thumbnailUrl || "",
        uploadedAt,
        uploadedBy: userId || ""
      })
    );

    const newVersion = {
      version: nextVersion,
      uploadedAt,
      uploadedBy: userId || "",
      note,
      files: versionFiles,
      reviewStatus: nextReviewStatus,
      reviewedBy: nextReviewedBy,
      reviewedAt: nextReviewedAt,
      reviewNote: nextReviewNote,
      reviewAnnotations: [],
    };

    const outputFiles = versionFiles.map((file) => ({
      name: file.name,
      url: file.url,
      driveId: file.driveId || "",
      webViewLink: file.webViewLink || "",
      webContentLink: file.webContentLink || "",
      type: "output",
      uploadedAt: file.uploadedAt,
      uploadedBy: file.uploadedBy,
      size: file.size,
      mime: file.mime,
      thumbnailUrl: file.thumbnailUrl
    }));

    const changeEntries = versionFiles.map((file) => ({
      type: "file_added",
      field: "files",
      oldValue: "",
      newValue: file.name,
      note: `Final files uploaded (v${nextVersion})`,
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: uploadedAt
    }));
    changeEntries.push({
      type: "status",
      field: "final_deliverable_review",
      oldValue: previousReviewState.status,
      newValue: nextReviewStatus,
      note: reviewRequired
        ? `Final deliverables submitted for Design Lead review (v${nextVersion}).`
        : `Final deliverables approved (v${nextVersion}).`,
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: uploadedAt
    });
    if (previousTaskStatus !== nextTaskStatus) {
      changeEntries.push({
        type: "status",
        field: "task_status",
        oldValue: previousTaskStatusLabel,
        newValue: nextTaskStatus === "completed" ? "Completed" : "Under Review",
        note: reviewRequired
          ? `Delivery moved to review after final submission (v${nextVersion}).`
          : `Final deliverables approved on upload (v${nextVersion}).`,
        userId: userId || "",
        userName: resolvedUserName || "",
        userRole: userRole || "",
        createdAt: uploadedAt
      });
    }

    const updateDoc = {
      $push: {
        finalDeliverableVersions: newVersion,
        files: { $each: outputFiles },
        changeHistory: { $each: changeEntries }
      },
      $set: {
        status: nextTaskStatus,
        updatedAt: uploadedAt,
        finalDeliverableReviewStatus: nextReviewStatus,
        finalDeliverableReviewedBy: nextReviewedBy,
        finalDeliverableReviewedAt: nextReviewedAt || null,
        finalDeliverableReviewNote: nextReviewNote,
      }
    };

    const updatedTask = await Task.findByIdAndUpdate(taskId, updateDoc, {
      new: true,
      runValidators: true
    });

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = updatedTask.id || updatedTask._id?.toString?.() || "";

    await Activity.create({
      taskId: updatedTask._id,
      taskTitle: updatedTask.title,
      action: "updated",
      userId: userId || "",
      userName: resolvedUserName || ""
    });

    const baseUrl = process.env.FRONTEND_URL || "";
    const taskUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/task/${updatedTask.id || updatedTask._id}`
      : undefined;
    const taskLink = buildTaskLink(updatedTask.id || updatedTask._id?.toString?.());

    let requesterUserId =
      updatedTask.requesterId ||
      task.requesterId ||
      (updatedTask.requesterEmail
        ? await resolveUserIdByEmail(updatedTask.requesterEmail)
        : "");
    if (!requesterUserId) {
      const history = Array.isArray(updatedTask.changeHistory)
        ? updatedTask.changeHistory
        : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      if (createdEntry?.userId) {
        requesterUserId = createdEntry.userId;
      } else if (createdEntry?.userName) {
        const requesterUser = await User.findOne({
          name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
          isActive: { $ne: false }
        });
        requesterUserId = requesterUser?._id?.toString?.() || "";
      }
    }

    let resolvedRequesterEmail =
      updatedTask.requesterEmail || task.requesterEmail || "";
    if (!resolvedRequesterEmail && updatedTask.requesterId) {
      const requesterUser = await User.findById(updatedTask.requesterId);
      resolvedRequesterEmail = requesterUser?.email || "";
    }
    if (!resolvedRequesterEmail && requesterUserId) {
      const requesterUser = await User.findById(requesterUserId);
      resolvedRequesterEmail = requesterUser?.email || "";
    }

    const requesterPrefs = await resolveNotificationPreferences({
      userId: requesterUserId,
      email: resolvedRequesterEmail
    });

    const filesForEmail = versionFiles.map((file) => ({
      name: file.name,
      url: file.url
    }));

    if (!reviewRequired && resolvedRequesterEmail && requesterPrefs.emailNotifications) {
      const emailSent = await sendFinalFilesEmail({
        to: resolvedRequesterEmail,
        taskTitle: updatedTask.title,
        files: filesForEmail,
        designerName: resolvedUserName,
        taskUrl,
        submittedAt: uploadedAt,
        taskDetails: {
          id: updatedTask.id || updatedTask._id?.toString?.() || updatedTask._id,
          status: updatedTask.status,
          category: updatedTask.category,
          deadline: updatedTask.deadline,
          requesterName: updatedTask.requesterName,
          requesterEmail: resolvedRequesterEmail,
          requesterDepartment: updatedTask.requesterDepartment,
        },
      });
      if (!emailSent) {
        console.warn("Final files email failed to send. Check SMTP configuration.");
      }
    }

    if (!reviewRequired && requesterUserId) {
      createNotification({
        userId: requesterUserId,
        title: `Final files uploaded: ${updatedTask.title}`,
        message: `${resolvedUserName || "Designer"} shared final deliverables.`,
        type: "file",
        link: taskLink,
        taskId: updatedTask.id || updatedTask._id?.toString?.(),
        eventId: `final:${taskId}:${uploadedAt.toISOString()}`
      })
        .then((note) => emitNotification(note))
        .catch((error) => {
          console.error("Notification error:", error?.message || error);
        });
    }

    const designers = await getActiveDesignerUsers();
    const { mainDesigners } = splitDesignersByScope(designers);
    const mainDesignerUserIds = mainDesigners
      .map((designer) => designer._id?.toString?.() || "")
      .filter((id) => Boolean(id) && id !== userId);

    if (reviewRequired && mainDesignerUserIds.length > 0) {
      createNotificationsForUsers(mainDesignerUserIds, {
        title: `Review required: ${updatedTask.title}`,
        message: `${resolvedUserName || "Junior designer"} submitted final deliverables (v${nextVersion}).`,
        type: "task",
        link: taskLink,
        taskId: updatedTask.id || updatedTask._id?.toString?.(),
        eventId: `final-review:${taskId}:${uploadedAt.toISOString()}`
      })
        .then((notes) => emitNotifications(notes))
        .catch((error) => {
          console.error("Final review notification error:", error?.message || error);
        });
    }

    const io = getSocket();
    if (io) {
      const updatedTaskId = updatedTask.id || updatedTask._id?.toString?.();
      const staffPayload = buildTaskPayloadForViewer(updatedTask, { role: "staff" });
      io.to(updatedTaskId).emit("task:updated", {
        taskId: updatedTaskId,
        task: staffPayload
      });

      const fullPayload = buildTaskPayloadForViewer(updatedTask, { role: "designer" });
      if (userId) {
        io.to(String(userId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: fullPayload
        });
      }
      if (mainDesignerUserIds.length > 0) {
        mainDesignerUserIds.forEach((designerId) => {
          io.to(String(designerId)).emit("task:updated", {
            taskId: updatedTaskId,
            task: fullPayload
          });
        });
      }
      if (requesterUserId) {
        io.to(String(requesterUserId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: staffPayload
        });
      }
    }

    res.json(buildTaskPayloadForViewer(updatedTask, req.user));
  } catch (error) {
    console.error("Final deliverable upload error:", error?.message || error);
    res.status(400).json({ error: "Failed to upload final deliverables." });
  }
});

const handleDeliverablesZipDownload = async (req, res) => {
  try {
    let task = req.task;
    task = await repairMissingFinalDeliverableFiles(task);
    const versionId = String(req.params.versionId || "").trim();
    const requestedIds = parseRequestedFileIds(
      req.method === "GET" ? req.query?.fileIds : req.body?.fileIds
    );

    const versions = Array.isArray(task.finalDeliverableVersions)
      ? task.finalDeliverableVersions
      : [];
    const version = versions.find((v) => String(v?.id || v?._id || "") === versionId);
    if (!version) {
      return res.status(404).json({ error: "Version not found." });
    }

    const allFiles = normalizeTaskFileCollection(Array.isArray(version.files) ? version.files : []);
    const targets = allFiles.filter((f) => {
      const mime = String(f?.mime || "").toLowerCase();
      if (mime === "link") return false;
      if (!f?.driveId && !f?.url) return false;
      if (requestedIds.length > 0) {
        const candidateIds = [
          f?.id,
          f?._id,
          f?.driveId,
          f?.url,
          f?.webViewLink,
          f?.webContentLink,
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        return candidateIds.some((value) => requestedIds.includes(value));
      }
      return true;
    });

    if (targets.length === 0) {
      return res.status(400).json({ error: "No downloadable files found in this version." });
    }

    const drive = getDriveClient();
    const zip = new JSZip();

    // Helper: stream a drive file into a Buffer
    const streamToBuffer = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });

    // Process sequentially to avoid race conditions on usedNames and Drive rate limits
    const usedNames = new Map();
    let addedCount = 0;
    for (const file of targets) {
      try {
        const driveId = String(file?.driveId || "").trim();
        let rawName =
          String(file?.name || "").trim() ||
          inferFileNameFromUrl(file?.url || file?.webContentLink || file?.webViewLink || "") ||
          driveId;
        let fileBuffer = null;
        let lastFileError = null;

        if (driveId) {
          try {
            const metaResponse = await drive.files.get({
              fileId: driveId,
              fields: "id,name",
              supportsAllDrives: true,
            });
            rawName = String(metaResponse?.data?.name || rawName || driveId);
          } catch {
            rawName = rawName || driveId;
          }
        }

        // Deduplicate filenames safely (sequential, no race)
        let zipName = rawName;
        if (usedNames.has(rawName)) {
          const count = usedNames.get(rawName) + 1;
          usedNames.set(rawName, count);
          const dotIdx = rawName.lastIndexOf(".");
          zipName = dotIdx > -1
            ? `${rawName.slice(0, dotIdx)} (${count})${rawName.slice(dotIdx)}`
            : `${rawName} (${count})`;
        } else {
          usedNames.set(rawName, 1);
        }

        if (driveId) {
          try {
            const mediaResponse = await drive.files.get(
              { fileId: driveId, alt: "media", supportsAllDrives: true },
              { responseType: "stream" }
            );
            fileBuffer = await streamToBuffer(mediaResponse.data);
          } catch (driveError) {
            lastFileError = driveError;
          }
        }

        if (!fileBuffer) {
          const fallbackUrls = Array.from(
            new Set(
              [
                String(file?.webContentLink || "").trim(),
                String(file?.url || "").trim(),
                driveId ? buildDriveDownloadUrl(driveId) : "",
              ].filter(Boolean)
            )
          );

          for (const fallbackUrl of fallbackUrls) {
            try {
              fileBuffer = await fetchRemoteFileBuffer(fallbackUrl);
              break;
            } catch (fallbackError) {
              lastFileError = fallbackError;
            }
          }
        }

        if (!fileBuffer) {
          throw lastFileError || new Error("No ZIP download source available.");
        }

        zip.file(zipName, fileBuffer);
        addedCount += 1;
      } catch (fileError) {
        console.warn(`ZIP: skipped file ${file?.name || file?.driveId} — ${fileError?.message}`);
      }
    }

    if (addedCount === 0) {
      return res.status(502).json({ error: "ZIP archive could not be created for the selected files." });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const taskTitle = String(task?.title || task?._id || "deliverables")
      .replace(/[^a-zA-Z0-9_\-. ]/g, "")
      .trim()
      .slice(0, 60);
    const filename = `${taskTitle}-v${version.version || versionId}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(zipBuffer);
  } catch (error) {
    console.error("ZIP download error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate ZIP archive." });
  }
};

router.get("/:id/deliverables/:versionId/zip", ensureTaskAccess, handleDeliverablesZipDownload);
router.post("/:id/deliverables/:versionId/zip", ensureTaskAccess, handleDeliverablesZipDownload);

router.post("/:id/final-deliverables/review", ensureTaskAccess, async (req, res) => {
  try {
    const normalizedRole = normalizeTaskRole(req.user?.role);
    const canReviewFinalDeliverables =
      normalizedRole === "admin" || (normalizedRole === "designer" && isMainDesignerActor(req.user));
    if (!canReviewFinalDeliverables) {
      return res.status(403).json({ error: "Only the Design Lead can review final deliverables." });
    }

    const decision = normalizeValue(req.body?.decision);
    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "Decision must be approved or rejected." });
    }
    const reviewNote = String(req.body?.note || "").trim();
    const reviewAnnotations = sanitizeFinalDeliverableReviewAnnotations(req.body?.annotations);
    const hasReviewAnnotations = reviewAnnotations.length > 0;
    if (decision === "rejected" && !reviewNote && !hasReviewAnnotations) {
      return res.status(400).json({ error: "Add review note or annotations before requesting updates." });
    }

    let task = req.task;
    task = await ensureFinalDeliverableVersions(task);
    const versions = Array.isArray(task.finalDeliverableVersions) ? task.finalDeliverableVersions : [];
    if (versions.length === 0) {
      return res.status(400).json({ error: "No final deliverables available for review." });
    }

    const targetVersion = versions.reduce((latest, current) => {
      if (!latest) return current;
      return Number(current?.version || 0) > Number(latest?.version || 0) ? current : latest;
    }, null);
    if (!targetVersion) {
      return res.status(400).json({ error: "No final deliverables available for review." });
    }

    const previousReviewState = resolveFinalDeliverableReviewState(task);
    const previousTaskStatusLabel = String(task?.status || "");
    const previousTaskStatus = normalizeValue(task?.status).replace(/[\s-]+/g, "_") || "pending";
    const nextTaskStatus = decision === "approved" ? "completed" : "clarification_required";
    const reviewedAt = new Date();
    const reviewerName = req.user?.name || req.user?.email || "DesignLead";
    targetVersion.reviewStatus = decision;
    targetVersion.reviewedBy = reviewerName;
    targetVersion.reviewedAt = reviewedAt;
    targetVersion.reviewNote = reviewNote;
    targetVersion.reviewAnnotations = decision === "rejected" ? reviewAnnotations : [];

    task.finalDeliverableReviewStatus = decision;
    task.finalDeliverableReviewedBy = reviewerName;
    task.finalDeliverableReviewedAt = reviewedAt;
    task.finalDeliverableReviewNote =
      reviewNote ||
      (decision === "rejected" && hasReviewAnnotations
        ? "Design Lead annotated the deliverables with requested updates."
        : "");
    task.status = nextTaskStatus;
    task.updatedAt = reviewedAt;
    const annotationSummary = hasReviewAnnotations
      ? ` Includes ${reviewAnnotations.length} annotated file${reviewAnnotations.length === 1 ? "" : "s"}.`
      : "";
    task.changeHistory.push({
      type: "status",
      field: "final_deliverable_review",
      oldValue: previousReviewState.status,
      newValue: decision,
      note:
        (reviewNote ? `${reviewNote}${annotationSummary}` : "") ||
        (decision === "approved"
          ? `Final deliverables approved by ${reviewerName}.`
          : `Final deliverables rejected by ${reviewerName}.${annotationSummary}`),
      userId: getUserId(req) || "",
      userName: reviewerName,
      userRole: req.user?.role || "",
      createdAt: reviewedAt
    });
    if (previousTaskStatus !== nextTaskStatus) {
      task.changeHistory.push({
        type: "status",
        field: "task_status",
        oldValue: previousTaskStatusLabel,
        newValue: decision === "approved" ? "Completed" : "Clarification Required",
        note:
          decision === "approved"
            ? `Delivery completed after Design Lead approval.`
            : `Delivery moved back to clarification after Design Lead review.`,
        userId: getUserId(req) || "",
        userName: reviewerName,
        userRole: req.user?.role || "",
        createdAt: reviewedAt
      });
    }
    task.markModified("finalDeliverableVersions");
    task.markModified("changeHistory");
    await task.save();

    req.auditTargetId = task.id || task._id?.toString?.() || req.params.id;

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: getUserId(req) || "",
      userName: reviewerName
    });

    const taskId = task.id || task._id?.toString?.() || "";
    const taskLink = buildTaskLink(taskId);
    const filesForNotification = Array.isArray(targetVersion.files)
      ? targetVersion.files.map((file) => ({
        name: file?.name || "",
        url: file?.url || ""
      }))
      : [];

    let requesterUserId =
      task.requesterId ||
      (task.requesterEmail ? await resolveUserIdByEmail(task.requesterEmail) : "");
    if (!requesterUserId) {
      const history = Array.isArray(task.changeHistory) ? task.changeHistory : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      requesterUserId = createdEntry?.userId || "";
    }

    let requesterEmail = task.requesterEmail || "";
    if (!requesterEmail && requesterUserId) {
      const requesterUser = await User.findById(requesterUserId);
      requesterEmail = requesterUser?.email || "";
    }

    const requesterPrefs = await resolveNotificationPreferences({
      userId: requesterUserId,
      email: requesterEmail
    });

    const assignedDesignerId = normalizeId(task.assignedToId);
    if (assignedDesignerId) {
      createNotification({
        userId: assignedDesignerId,
        title: `Final files ${decision}: ${task.title}`,
        message:
          decision === "approved"
            ? `${reviewerName} approved your final deliverables.`
            : `${reviewerName} requested updates on your final deliverables.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `final-review:${taskId}:${decision}:${reviewedAt.toISOString()}`
      })
        .then((note) => emitNotification(note))
        .catch((error) => {
          console.error("Designer review notification error:", error?.message || error);
        });
    }

    if (decision === "approved" && requesterUserId) {
      createNotification({
        userId: requesterUserId,
        title: `Final files approved: ${task.title}`,
        message: `${reviewerName} approved the final deliverables.`,
        type: "file",
        link: taskLink,
        taskId,
        eventId: `final-approved:${taskId}:${reviewedAt.toISOString()}`
      })
        .then((note) => emitNotification(note))
        .catch((error) => {
          console.error("Requester approval notification error:", error?.message || error);
        });
    }

    if (decision === "approved" && requesterEmail && requesterPrefs.emailNotifications) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${task.id || task._id}`
        : undefined;
      const emailSent = await sendFinalFilesEmail({
        to: requesterEmail,
        taskTitle: task.title,
        files: filesForNotification,
        designerName: task.assignedToName || "Designer",
        taskUrl,
        submittedAt: targetVersion.uploadedAt || reviewedAt,
        taskDetails: {
          id: task.id || task._id?.toString?.() || task._id,
          status: task.status,
          category: task.category,
          deadline: task.deadline,
          requesterName: task.requesterName,
          requesterEmail: requesterEmail,
          requesterDepartment: task.requesterDepartment,
        },
      });
      if (!emailSent) {
        console.warn("Final files approval email failed to send.");
      }
    }

    const io = getSocket();
    if (io) {
      const staffPayload = buildTaskPayloadForViewer(task, { role: "staff" });
      const fullPayload = buildTaskPayloadForViewer(task, { role: "designer" });
      io.to(taskId).emit("task:updated", {
        taskId,
        task: staffPayload
      });
      const reviewerUserId = getUserId(req);
      if (reviewerUserId) {
        io.to(String(reviewerUserId)).emit("task:updated", {
          taskId,
          task: fullPayload
        });
      }
      if (assignedDesignerId) {
        io.to(String(assignedDesignerId)).emit("task:updated", {
          taskId,
          task: fullPayload
        });
      }
      if (requesterUserId) {
        io.to(String(requesterUserId)).emit("task:updated", {
          taskId,
          task: staffPayload
        });
      }
    }

    return res.json(buildTaskPayloadForViewer(task, req.user));
  } catch (error) {
    console.error("Final deliverable review error:", error?.message || error);
    return res.status(400).json({ error: "Failed to review final deliverables." });
  }
});

router.patch("/:id", ensureTaskAccess, async (req, res) => {
  try {
    const userRole = req.user?.role || "";
    if (
      req.body?.status &&
      String(req.body.status).toLowerCase() === "completed" &&
      userRole !== "designer" &&
      userRole !== "admin"
    ) {
      return res.status(403).json({ error: "Only designers can complete tasks." });
    }
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: getUserId(req),
      userName: req.user?.name || req.body.userName || ""
    });

    const io = getSocket();
    if (io) {
      const updatedTaskId = task.id || task._id?.toString?.();
      io.to(updatedTaskId).emit("task:updated", {
        taskId: updatedTaskId,
        task: buildTaskPayloadForViewer(task, { role: "staff" })
      });
      const actorId = getUserId(req);
      if (actorId) {
        io.to(String(actorId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: buildTaskPayloadForViewer(task, req.user),
        });
      }
    }

    res.json(buildTaskPayloadForViewer(task, req.user));
  } catch (error) {
    res.status(400).json({ error: "Failed to update task." });
  }
});

const VALID_COMMENT_ROLES = ["staff", "treasurer", "designer", "admin"];
const QUICK_COMMENT_REACTIONS = new Set([
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F440}",
  "\u{1F527}",
]);

const getTaskIdValue = (task) => task?.id || task?._id?.toString?.() || "";

const getTaskCommentId = (comment) =>
  String(comment?.id || comment?._id?.toString?.() || "").trim();

const buildCommentPayload = (comment) => {
  const payload = typeof comment?.toObject === "function"
    ? comment.toObject()
    : { ...(comment || {}) };
  payload.attachments = Array.isArray(payload.attachments)
    ? payload.attachments.map((attachment) => normalizeTaskFileLinks(attachment))
    : [];
  return payload;
};

const findTaskComment = (task, commentId) => {
  const normalizedId = String(commentId || "").trim();
  if (!normalizedId || !Array.isArray(task?.comments)) return null;
  return task.comments.find((comment) => getTaskCommentId(comment) === normalizedId) || null;
};

const canManageTaskComment = (comment, req) => {
  const actorId = String(getUserId(req) || "").trim();
  const actorRole = normalizeTaskRole(req.user?.role);
  if (actorRole === "admin") return true;
  return actorId && actorId === String(comment?.userId || "").trim();
};

const emitCommentSocketEvent = (eventName, task, comment) => {
  const io = getSocket();
  const taskId = getTaskIdValue(task);
  if (!io || !taskId || !comment) return;
  io.to(String(taskId)).emit(eventName, {
    taskId,
    comment: buildCommentPayload(comment),
  });
};

const emitCommentsSeenSocketEvent = (task, comments) => {
  const io = getSocket();
  const taskId = getTaskIdValue(task);
  if (!io || !taskId || !Array.isArray(comments) || comments.length === 0) return;
  io.to(String(taskId)).emit("comments:seen", {
    taskId,
    comments: comments.map((comment) => buildCommentPayload(comment)),
  });
};

router.post("/:id/comments", ensureTaskAccess, async (req, res) => {
  try {
    const { content, receiverRoles, parentId, mentions, attachments } = req.body;
    const userId = getUserId(req);
    const userName = req.user?.name || req.body.userName || "";
    const userRole = req.user?.role || "";
    const normalizedContent = String(content || "").trim();
    const normalizedAttachments = normalizeCommentAttachments(
      attachments,
      userId || userName || ""
    );

    if (!normalizedContent && normalizedAttachments.length === 0) {
      return res.status(400).json({
        error: "Comment text or at least one attachment is required.",
      });
    }

    const normalizedUserRole = normalizeTaskRole(userRole);
    const senderRole = VALID_COMMENT_ROLES.includes(normalizedUserRole) ? normalizedUserRole : "";
    const normalizedMentions = Array.isArray(mentions)
      ? mentions.filter((role) => VALID_COMMENT_ROLES.includes(role))
      : [];
    const normalizedReceivers = Array.isArray(receiverRoles)
      ? receiverRoles.filter((role) => VALID_COMMENT_ROLES.includes(role))
      : [];
    const resolvedReceivers =
      normalizedMentions.length > 0
        ? normalizedMentions
        : normalizedReceivers.length > 0
          ? normalizedReceivers
          : senderRole
            ? VALID_COMMENT_ROLES.filter((role) => role !== senderRole)
            : VALID_COMMENT_ROLES;
    const uniqueReceivers = [
      ...new Set(
        senderRole
          ? resolvedReceivers.filter((role) => role !== senderRole)
          : resolvedReceivers
      ),
    ];

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: {
            userId,
            userName,
            userRole: senderRole,
            content: normalizedContent,
            parentId: parentId || "",
            mentions: normalizedMentions,
            receiverRoles: uniqueReceivers,
            attachments: normalizedAttachments,
          }
        }
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    const createdComment = Array.isArray(task.comments)
      ? task.comments[task.comments.length - 1]
      : null;
    const taskId = task.id || task._id?.toString?.();

    // Comment save succeeded. Return immediately and run side effects in background.
    res.json(task);

    void (async () => {
      try {
        await Activity.create({
          taskId: task._id,
          taskTitle: task.title,
          action: "commented",
          userId: userId || "",
          userName: userName || ""
        });
      } catch (error) {
        console.error("Activity error (comment):", error?.message || error);
      }

      if (createdComment) {
        try {
          const requesterUserId =
            task.requesterId ||
            (task.requesterEmail ? await resolveUserIdByEmail(task.requesterEmail) : "");
          const designerUserId = task.assignedToId || "";
          const treasurerUserIds = await getUserIdsByRole(["treasurer"]);
          const recipientsByRole = {
            staff: requesterUserId ? [requesterUserId] : [],
            designer: designerUserId ? [designerUserId] : [],
            treasurer: treasurerUserIds,
            admin: [],
          };
          const finalRecipients = Array.from(
            new Set(
              uniqueReceivers.flatMap((role) =>
                Array.isArray(recipientsByRole[role]) ? recipientsByRole[role] : []
              )
            )
          ).filter(Boolean);
          if (finalRecipients.length > 0) {
            const attachmentSnippet =
              normalizedAttachments.length === 1
                ? "attached 1 file"
                : `attached ${normalizedAttachments.length} files`;
            const snippet = normalizedContent
              ? normalizedContent.length > 140
                ? `${normalizedContent.slice(0, 137)}...`
                : normalizedContent
              : attachmentSnippet;
            const commentEventId = createdComment._id
              ? `comment:${createdComment._id.toString()}`
              : undefined;
            createNotificationsForUsers(finalRecipients, {
              title: `New message on ${task.title}`,
              message: `${userName || "Staff"}: ${snippet}`,
              type: "comment",
              link: buildTaskLink(taskId),
              taskId,
              eventId: commentEventId,
            })
              .then(emitNotifications)
              .catch((error) => {
                console.error("Notification error (comment):", error?.message || error);
              });
          }
        } catch (error) {
          console.error("Notification setup error (comment):", error?.message || error);
        }
      }

      try {
        const requesterPrefs = await resolveNotificationPreferences({
          userId: task.requesterId,
          email: task.requesterEmail,
        });

        if (requesterPrefs.whatsappNotifications) {
          const recipients = [
            task.requesterPhone,
            ...(Array.isArray(task.secondaryPhones) ? task.secondaryPhones : [])
          ].filter((p) => p && p.trim() !== "");

          if (recipients.length > 0) {
            const baseUrl = process.env.FRONTEND_URL || "";
            const taskUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/task/${task.id || task._id}` : "";
            const attachmentSnippet =
              normalizedAttachments.length === 1
                ? "Attached 1 file"
                : `Attached ${normalizedAttachments.length} files`;
            const whatsappContent = normalizedContent || attachmentSnippet;

            Promise.all(recipients.map(to =>
              sendCommentNotificationSms({
                to,
                taskTitle: task.title,
                userName: userName,
                content: whatsappContent,
                taskUrl: taskUrl
              })
            )).catch(err => console.error("Background Notification Error (Comment):", err));
          }
        }
      } catch (error) {
        console.error("WhatsApp notification error (comment):", error?.message || error);
      }

      try {
        const io = getSocket();
        if (io && createdComment) {
          io.to(taskId).emit("comment:new", {
            taskId,
            comment: buildCommentPayload(createdComment)
          });
        }
      } catch (error) {
        console.error("Socket emit error (comment):", error?.message || error);
      }
    })();
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error && error.message ? error.message : "Failed to add comment."
    });
  }
});

router.patch("/:id/comments/:commentId", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const comment = findTaskComment(task, req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found." });
    }
    if (!canManageTaskComment(comment, req)) {
      return res.status(403).json({ error: "You can only edit your own messages." });
    }
    if (comment.deletedAt) {
      return res.status(400).json({ error: "Deleted messages cannot be edited." });
    }

    const normalizedContent = String(req.body?.content || "").trim();
    const normalizedUserRole = normalizeTaskRole(comment.userRole || req.user?.role);
    const senderRole = VALID_COMMENT_ROLES.includes(normalizedUserRole) ? normalizedUserRole : "";
    const normalizedMentions = Array.isArray(req.body?.mentions)
      ? req.body.mentions.filter((role) => VALID_COMMENT_ROLES.includes(role))
      : [];
    const normalizedReceivers = Array.isArray(req.body?.receiverRoles)
      ? req.body.receiverRoles.filter((role) => VALID_COMMENT_ROLES.includes(role))
      : [];
    const resolvedReceivers =
      normalizedMentions.length > 0
        ? normalizedMentions
        : normalizedReceivers.length > 0
          ? normalizedReceivers
          : senderRole
            ? VALID_COMMENT_ROLES.filter((role) => role !== senderRole)
            : VALID_COMMENT_ROLES;
    const uniqueReceivers = [
      ...new Set(
        senderRole
          ? resolvedReceivers.filter((role) => role !== senderRole)
          : resolvedReceivers
      ),
    ];
    const existingAttachments = Array.isArray(comment.attachments) ? comment.attachments : [];

    if (!normalizedContent && existingAttachments.length === 0) {
      return res.status(400).json({
        error: "Comment text or at least one attachment is required.",
      });
    }

    comment.content = normalizedContent;
    comment.mentions = normalizedMentions;
    comment.receiverRoles = uniqueReceivers;
    comment.editedAt = new Date();

    task.markModified("comments");
    await task.save();

    emitCommentSocketEvent("comment:updated", task, comment);
    return res.json({ comment: buildCommentPayload(comment) });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error && error.message ? error.message : "Failed to edit comment.",
    });
  }
});

router.delete("/:id/comments/:commentId", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const comment = findTaskComment(task, req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found." });
    }
    if (!canManageTaskComment(comment, req)) {
      return res.status(403).json({ error: "You can only delete your own messages." });
    }
    if (comment.deletedAt) {
      return res.json({ comment: buildCommentPayload(comment) });
    }

    comment.content = "";
    comment.attachments = [];
    comment.mentions = [];
    comment.reactions = [];
    comment.deletedAt = new Date();
    comment.deletedByName = req.user?.name || "";
    comment.editedAt = undefined;

    task.markModified("comments");
    await task.save();

    emitCommentSocketEvent("comment:updated", task, comment);
    return res.json({ comment: buildCommentPayload(comment) });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error && error.message ? error.message : "Failed to delete comment.",
    });
  }
});

router.post("/:id/comments/:commentId/reactions", ensureTaskAccess, async (req, res) => {
  try {
    const emoji = String(req.body?.emoji || "").trim();
    if (!QUICK_COMMENT_REACTIONS.has(emoji)) {
      return res.status(400).json({ error: "Unsupported reaction." });
    }

    const userId = String(getUserId(req) || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "Missing user identity." });
    }

    const task = req.task;
    const comment = findTaskComment(task, req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found." });
    }
    if (comment.deletedAt) {
      return res.status(400).json({ error: "Deleted messages cannot receive reactions." });
    }

    const reactions = Array.isArray(comment.reactions) ? [...comment.reactions] : [];
    const existingIndex = reactions.findIndex(
      (entry) =>
        String(entry?.userId || "").trim() === userId &&
        String(entry?.emoji || "").trim() === emoji
    );

    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1);
    } else {
      reactions.push({
        emoji,
        userId,
        userName: req.user?.name || "User",
        userRole: normalizeTaskRole(req.user?.role),
        createdAt: new Date(),
      });
    }

    comment.reactions = reactions;
    task.markModified("comments");
    await task.save();

    emitCommentSocketEvent("comment:updated", task, comment);
    return res.json({ comment: buildCommentPayload(comment) });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error && error.message ? error.message : "Failed to update reaction.",
    });
  }
});

router.post("/:id/comments/seen", ensureTaskAccess, async (req, res) => {
  try {
    const role = normalizeTaskRole(req.user?.role);
    if (!VALID_COMMENT_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
    const task = req.task;

    let updated = false;
    const now = new Date();
    const actorId = String(getUserId(req) || "").trim();
    const actorName = req.user?.name || "";
    const updatedComments = [];
    task.comments = task.comments.map((comment) => {
      const receivers =
        Array.isArray(comment.receiverRoles) && comment.receiverRoles.length > 0
          ? comment.receiverRoles
          : comment.userRole
            ? VALID_COMMENT_ROLES.filter((validRole) => validRole !== comment.userRole)
            : VALID_COMMENT_ROLES;
      if (!receivers.includes(role)) {
        return comment;
      }
      const seenBy = Array.isArray(comment.seenBy) ? comment.seenBy : [];
      if (
        (actorId && seenBy.some((entry) => String(entry?.userId || "").trim() === actorId)) ||
        (!actorId && seenBy.some((entry) => entry.role === role))
      ) {
        return comment;
      }
      comment.seenBy = [...seenBy, { role, userId: actorId, userName: actorName, seenAt: now }];
      updated = true;
      updatedComments.push(comment);
      return comment;
    });

    if (updated) {
      task.markModified("comments");
      await task.save();
      emitCommentsSeenSocketEvent(task, updatedComments);
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to update comment status." });
  }
});

router.post("/:id/assign", ensureTaskAccess, async (req, res) => {
  try {
    const { assignedToId, assignedToName, assignedTo, assignedToEmail, userName } = req.body;
    const role = normalizeTaskRole(req.user?.role);
    const canAssign =
      role === "admin" || (role === "designer" && isMainDesignerUser(req.user));

    if (!canAssign) {
      return res.status(403).json({ error: "Only the Design Lead can assign tasks." });
    }

    const resolvedAssignment = await resolveAssignedUser({
      assignedToId,
      assignedTo,
      assignedToName,
      assignedToEmail
    });
    if (resolvedAssignment.assignedToId) {
      const assignedDesigner = await User.findById(resolvedAssignment.assignedToId)
        .select("_id name email role isActive");
      if (
        !assignedDesigner ||
        assignedDesigner.role !== "designer" ||
        assignedDesigner.isActive === false
      ) {
        return res.status(404).json({ error: "Assigned designer not found." });
      }
      if (hasMainDesignerConfig() && getDesignerScope(assignedDesigner) !== "junior") {
        return res.status(400).json({ error: "Only junior designers can be assigned." });
      }
      if (!resolvedAssignment.assignedToName) {
        const assignedEmail = normalizeValue(assignedDesigner.email);
        resolvedAssignment.assignedToName =
          assignedDesigner.name || (assignedEmail ? assignedEmail.split("@")[0] : "Designer");
      }
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { assignedToId: resolvedAssignment.assignedToId, assignedToName: resolvedAssignment.assignedToName },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "assigned",
      userId: getUserId(req),
      userName: req.user?.name || userName || ""
    });

    if (resolvedAssignment.assignedToId) {
      const taskId = task.id || task._id?.toString?.();
      const taskLink = buildTaskLink(taskId);
      createNotification({
        userId: resolvedAssignment.assignedToId,
        title: `Task assigned: ${task.title}`,
        message: `${req.user?.name || userName || "Staff"} assigned this task to you.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `assign:${taskId}:${resolvedAssignment.assignedToId}:${new Date().toISOString()}`,
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (assign):", error?.message || error);
        });
    }

    const io = getSocket();
    if (io) {
      const payloadTask = typeof task.toJSON === "function" ? task.toJSON() : task;
      const targetRoom = resolvedAssignment.assignedToId
        ? String(resolvedAssignment.assignedToId)
        : "designers:queue";
      io.to(targetRoom).emit("request:new", payloadTask);
      console.log(`Emitted request:new to room: ${targetRoom}`);
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to assign task." });
  }
});

router.post("/:id/assign-designer", ensureTaskAccess, async (req, res) => {
  try {
    const role = normalizeTaskRole(req.user?.role);
    const canAssign =
      role === "admin" || (role === "designer" && isMainDesignerUser(req.user));
    if (!canAssign) {
      return res.status(403).json({ error: "Only the Design Lead can assign designers." });
    }

    const assignedDesignerRaw = req.body?.assigned_designer_id;
    if (typeof assignedDesignerRaw !== "string" || !assignedDesignerRaw.trim()) {
      return res.status(400).json({ error: "assigned_designer_id is required." });
    }

    if (req.body?.cc_emails !== undefined && !Array.isArray(req.body.cc_emails)) {
      return res.status(400).json({ error: "cc_emails must be an array of email addresses." });
    }

    const ccEmails = normalizeEmailList(req.body?.cc_emails || []);
    const invalidCcEmail = ccEmails.find((email) => !EMAIL_REGEX.test(email));
    if (invalidCcEmail) {
      return res.status(400).json({ error: `Invalid CC email: ${invalidCcEmail}` });
    }

    const assignmentMessage =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const deadlineInput =
      typeof req.body?.deadline === "string" ? req.body.deadline.trim() : "";
    if (!deadlineInput) {
      return res.status(400).json({ error: "deadline is required." });
    }
    const parsedAssignmentDeadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineInput)
      ? new Date(`${deadlineInput}T12:00:00.000Z`)
      : new Date(deadlineInput);
    if (Number.isNaN(parsedAssignmentDeadline.getTime())) {
      return res.status(400).json({ error: "Invalid deadline date." });
    }

    const assignedDesignerInput = assignedDesignerRaw.trim();
    const inputLooksLikeEmail = assignedDesignerInput.includes("@");
    const resolvedAssignment = await resolveAssignedUser({
      assignedToId: inputLooksLikeEmail ? "" : assignedDesignerInput,
      assignedToEmail: inputLooksLikeEmail ? assignedDesignerInput : ""
    });

    if (!resolvedAssignment.assignedToId) {
      return res.status(404).json({ error: "Assigned designer not found." });
    }

    const assignedDesigner = await User.findById(resolvedAssignment.assignedToId)
      .select("_id name email role isActive");
    if (
      !assignedDesigner ||
      assignedDesigner.role !== "designer" ||
      assignedDesigner.isActive === false
    ) {
      return res.status(404).json({ error: "Assigned designer not found." });
    }
    if (hasMainDesignerConfig() && getDesignerScope(assignedDesigner) !== "junior") {
      return res.status(400).json({ error: "Only junior designers can be assigned." });
    }

    const assignedDesignerEmail = normalizeValue(assignedDesigner.email);
    if (!EMAIL_REGEX.test(assignedDesignerEmail)) {
      return res.status(400).json({ error: "Assigned designer does not have a valid email." });
    }

    const task = req.task;
    const previousCcEmails = extractTaskCcEmails(task);
    const formatIsoDate = (value) => {
      if (!value) return "";
      const parsed = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(parsed.getTime())) return "";
      return parsed.toISOString().slice(0, 10);
    };
    const previousDeadline = formatIsoDate(task?.deadline);
    const nextDeadline = formatIsoDate(parsedAssignmentDeadline);
    const deadlineChanged = previousDeadline !== nextDeadline;
    const assignedAt = new Date();
    const assignedBy = req.user?.name || req.user?.email || "Manager";
    const assignedByNotificationLabel = buildAssignmentActorLabel(req.user);
    const assignedById = getUserId(req);
    const assignedDesignerName =
      resolvedAssignment.assignedToName ||
      assignedDesigner.name ||
      assignedDesignerEmail.split("@")[0] ||
      "";

    const assignmentChangeEntries = [
      {
        type: "update",
        field: "assigned_designer",
        oldValue: task.assignedToName || task.assignedToId || "",
        newValue: assignedDesignerName || assignedDesignerEmail,
        note: assignmentMessage || `Assigned by ${assignedBy}.`,
        userId: assignedById || "",
        userName: assignedBy || "",
        userRole: role || "",
        createdAt: assignedAt
      },
      {
        type: "status",
        field: "task_status",
        oldValue: task.status || "",
        newValue: "Assigned",
        note: assignmentMessage || "",
        userId: assignedById || "",
        userName: assignedBy || "",
        userRole: role || "",
        createdAt: assignedAt
      },
      {
        type: "update",
        field: "cc_emails",
        oldValue: JSON.stringify(previousCcEmails),
        newValue: JSON.stringify(ccEmails),
        note: ccEmails.length > 0
          ? `CC recipients: ${ccEmails.join(", ")}`
          : "CC recipients cleared.",
        userId: assignedById || "",
        userName: assignedBy || "",
        userRole: role || "",
        createdAt: assignedAt
      }
    ];
    if (deadlineChanged) {
      assignmentChangeEntries.push({
        type: "update",
        field: "deadline",
        oldValue: previousDeadline,
        newValue: nextDeadline,
        note: `Assignment deadline set to ${nextDeadline}.`,
        userId: assignedById || "",
        userName: assignedBy || "",
        userRole: role || "",
        createdAt: assignedAt
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          assignedToId: resolvedAssignment.assignedToId,
          assignedToName: assignedDesignerName,
          status: "assigned",
          deadline: parsedAssignmentDeadline,
        },
        $push: {
          changeHistory: {
            $each: assignmentChangeEntries
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = updatedTask.id || updatedTask._id?.toString?.() || "";

    await Activity.create({
      taskId: updatedTask._id,
      taskTitle: updatedTask.title,
      action: "assigned",
      userId: assignedById || "",
      userName: assignedBy || ""
    });

    const taskId = updatedTask.id || updatedTask._id?.toString?.();
    const taskLink = taskId ? `/task/${taskId}` : buildTaskLink(taskId);

    createNotification({
      userId: resolvedAssignment.assignedToId,
      title: `Task assigned: ${updatedTask.title}`,
      message: `${assignedBy} assigned this task to you. Deadline: ${nextDeadline || "Not set"}.`,
      type: "task",
      link: taskLink,
      taskId,
      eventId: `assign-designer:${taskId}:${resolvedAssignment.assignedToId}:${assignedAt.toISOString()}`,
    })
      .then(emitNotification)
      .catch((error) => {
        console.error("Notification error (assign-designer):", error?.message || error);
      });

    const baseUrl = process.env.FRONTEND_URL || "";
    const taskUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/task/${taskId}`
      : undefined;
    const assignmentSupportingFiles = (Array.isArray(updatedTask.files) ? updatedTask.files : [])
      .filter((file) => {
        const fileType = normalizeValue(file?.type);
        const fileUrl = String(file?.url || "").trim();
        return fileType === "input" && Boolean(fileUrl);
      })
      .map((file) => ({
        name: file?.name || "Document",
        url: String(file?.url || "").trim()
      }));

    // Do not block assignment UX on external SMTP latency.
    void sendFinalFilesEmail({
      to: assignedDesignerEmail,
      cc: ccEmails,
      taskTitle: updatedTask.title,
      files: assignmentSupportingFiles,
      designerName: assignedDesignerName,
      assignedByName: assignedByNotificationLabel,
      taskUrl,
      submittedAt: assignedAt,
      taskDetails: {
        id: taskId,
        status: "assigned",
        category: updatedTask.category,
        deadline: updatedTask.deadline,
        requesterName: updatedTask.requesterName,
        requesterEmail: updatedTask.requesterEmail,
        requesterDepartment: updatedTask.requesterDepartment,
      },
      emailType: "TASK_ASSIGNED",
      assignmentMessage,
    })
      .then((emailSent) => {
        if (!emailSent) {
          console.warn("Task assignment email failed to send. Check SMTP configuration.");
        }
      })
      .catch((error) => {
        console.error("Task assignment email error:", error?.message || error);
      });

    const io = getSocket();
    if (io) {
      const payloadTask =
        typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
      if (resolvedAssignment.assignedToId) {
        io.to(String(resolvedAssignment.assignedToId)).emit("request:new", payloadTask);
      }
      if (taskId) {
        io.to(String(taskId)).emit("task:updated", {
          taskId,
          task: payloadTask
        });
      }
    }

    const responsePayload =
      typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
    res.json({
      ...responsePayload,
      emailQueued: true,
      accessMode: "full",
      viewOnly: false,
      ccEmails,
      cc_emails: ccEmails
    });
  } catch (error) {
    console.error("Assign designer error:", error?.message || error);
    res.status(400).json({ error: "Failed to assign designer." });
  }
});

router.post("/:id/accept", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const accessContext =
      req.taskAccessContext || await resolveTaskAccessContext(task, req.user);
    if (accessContext.mode !== "full") {
      return res.status(403).json({ error: "Only the assigned designer can accept this task." });
    }

    const acceptedAt = new Date();
    const actorId = getUserId(req);
    const actorName = req.user?.name || req.user?.email || "Designer";
    const actorRole = req.user?.role || "designer";
    const acceptedStatus = "accepted";
    const acceptedStatusLabel = "Accepted";
    const taskId = task.id || task._id?.toString?.() || req.params.id;
    const previousStatus = task.status || "";

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: acceptedStatus,
          accepted_at: acceptedAt,
          updatedAt: acceptedAt
        },
        $push: {
          changeHistory: {
            type: "status",
            field: "task_status",
            oldValue: previousStatus,
            newValue: acceptedStatusLabel,
            note: `Accepted by ${actorName}`,
            userId: actorId || "",
            userName: actorName,
            userRole: actorRole,
            createdAt: acceptedAt
          }
        }
      },
      {
        new: true,
        runValidators: false,
        strict: false
      }
    );

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = updatedTask.id || updatedTask._id?.toString?.() || "";

    await Activity.create({
      taskId: updatedTask._id,
      taskTitle: updatedTask.title,
      action: "updated",
      userId: actorId || "",
      userName: actorName
    });

    const managerRecipient = await resolveAssignmentManagerRecipient(updatedTask);
    const taskLink = taskId ? `/tasks/${taskId}` : buildTaskLink(taskId);
    if (managerRecipient?.id) {
      createNotification({
        userId: managerRecipient.id,
        title: `Task accepted: ${updatedTask.title}`,
        message: `${actorName} accepted this task.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `task-accepted:${taskId}:${actorId}:${acceptedAt.toISOString()}`
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (task accepted):", error?.message || error);
        });
    }

    const managerEmail = normalizeValue(managerRecipient?.email);
    if (EMAIL_REGEX.test(managerEmail)) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${taskId}`
        : undefined;
      const acceptedEmailSent = await sendFinalFilesEmail({
        to: managerEmail,
        taskTitle: updatedTask.title,
        files: [],
        designerName: actorName,
        assignedByName: managerRecipient?.name || "",
        taskUrl,
        submittedAt: acceptedAt,
        taskDetails: {
          id: taskId,
          status: acceptedStatus,
          category: updatedTask.category,
          deadline: updatedTask.deadline,
          requesterName: updatedTask.requesterName,
          requesterEmail: updatedTask.requesterEmail,
          requesterDepartment: updatedTask.requesterDepartment
        },
        emailType: "TASK_ACCEPTED"
      });
      if (!acceptedEmailSent) {
        console.warn("Task accepted email failed to send. Check SMTP configuration.");
      }
    }

    const io = getSocket();
    if (io) {
      const payloadTask = typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
      io.to(String(taskId)).emit("task:updated", {
        taskId,
        task: payloadTask
      });
      if (managerRecipient?.id) {
        io.to(String(managerRecipient.id)).emit("task:updated", {
          taskId,
          task: payloadTask
        });
      }
    }

    const responsePayload = typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
    res.json(responsePayload);
  } catch (error) {
    console.error("Task accept error:", error?.message || error);
    res.status(400).json({ error: "Failed to accept task." });
  }
});

router.post("/:id/changes", ensureTaskAccess, async (req, res) => {
  try {
    const { updates = {}, changes = [], userName } = req.body;
    const userId = getUserId(req);
    const userRole = req.user?.role || "";
    const resolvedUserName = req.user?.name || userName || "";

    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: "Change list is required." });
    }
    const statusChangeInput = changes.find((change) => change?.field === "status");
    const nextStatus =
      updates?.status || statusChangeInput?.newValue || statusChangeInput?.newValue?.toString?.();
    if (
      nextStatus &&
      String(nextStatus).toLowerCase() === "completed" &&
      userRole !== "designer" &&
      userRole !== "admin"
    ) {
      return res.status(403).json({ error: "Only designers can complete tasks." });
    }
    const emergencyDecisionChange = changes.find(
      (change) => normalizeValue(change?.field) === "emergency_approval"
    );
    if (emergencyDecisionChange) {
      const decisionValue = normalizeValue(emergencyDecisionChange?.newValue);
      if (decisionValue === "approved" || decisionValue === "rejected") {
        if (userRole !== "designer" && userRole !== "admin") {
          return res.status(403).json({ error: "Only designers can decide emergency overrides." });
        }
        const decisionNote = String(emergencyDecisionChange?.note || "").trim();
        if (!decisionNote) {
          return res.status(400).json({ error: "Emergency approval reason is required." });
        }
      }
    }
    const hasFileRemovalChange = changes.some(
      (change) => change?.type === "file_removed" && change?.field === "files"
    );
    if (hasFileRemovalChange && userRole !== "designer") {
      return res.status(403).json({ error: "Only designers can remove files." });
    }

    const task = req.task;

    const changeEntries = changes.map((change) => ({
      type: change.type || "update",
      field: change.field || "",
      oldValue: change.oldValue ?? "",
      newValue: change.newValue ?? "",
      note: change.note || "",
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: new Date()
    }));
    const hasFileUploadChange = changes.some(
      (change) => change?.type === "file_added" && change?.field === "files"
    );
    const sanitizedEntries = hasFileUploadChange
      ? changeEntries.filter((entry) => entry.field !== "status")
      : changeEntries;
    const sanitizedChanges = hasFileUploadChange
      ? changes.filter((change) => change?.field !== "status")
      : changes;
    const nextCount = (task.changeCount || 0) + sanitizedEntries.length;
    const isFinalFileChange = (change) => {
      if (!change) return false;
      if (change.type !== "file_added" || change.field !== "files") return false;
      const note = String(change.note || "").toLowerCase();
      return /final\s*file/.test(note);
    };

    const finalChangeEntries = sanitizedEntries.filter(isFinalFileChange);

    const updateDoc = {
      $inc: { changeCount: sanitizedEntries.length },
      $push: { changeHistory: { $each: sanitizedEntries } }
    };

    const nextSet = { ...(Object.keys(updates).length > 0 ? updates : {}) };
    if (Array.isArray(nextSet.files)) {
      nextSet.files = normalizeTaskFileCollection(nextSet.files);
    }
    if (hasFileUploadChange) {
      delete nextSet.status;
      delete nextSet.assignedToId;
      delete nextSet.assignedToName;
      delete nextSet.assignedTo;
      delete nextSet.assignedToEmail;
    }
    const isUnassigned = !normalizeId(task.assignedToId);
    if (userRole === "designer" && isUnassigned) {
      nextSet.assignedToId = userId || "";
      nextSet.assignedToName = resolvedUserName || "";
    }
    if (Object.keys(nextSet).length > 0) {
      updateDoc.$set = nextSet;
    }

    if (nextCount >= 3 && task.approvalStatus !== "pending") {
      updateDoc.$set = { ...(updateDoc.$set || {}), approvalStatus: "pending" };
    }

    let updatedTask = await Task.findByIdAndUpdate(req.params.id, updateDoc, {
      new: true,
      runValidators: true
    });
    if (updatedTask && (hasFileUploadChange || Array.isArray(nextSet.files))) {
      updatedTask = await hydrateMissingFileMeta(updatedTask);
      updatedTask = await repairMissingFinalDeliverableFiles(updatedTask);
    }

    req.auditTargetId = updatedTask?.id || updatedTask?._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: userId || "",
      userName: resolvedUserName || ""
    });

    const finalFileChanges = sanitizedChanges.filter(isFinalFileChange);
    const finalDeliverableReviewState = resolveFinalDeliverableReviewState(updatedTask);
    const canShareFinalFilesWithStaff = finalDeliverableReviewState.status === "approved";

    if (finalFileChanges.length > 0 && canShareFinalFilesWithStaff) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${updatedTask.id || updatedTask._id}`
        : undefined;
      const requesterPrefs = await resolveNotificationPreferences({
        userId: updatedTask.requesterId,
        email: updatedTask.requesterEmail || task.requesterEmail,
      });

      // Notify on status updates
      const statusChange = sanitizedChanges.find(c => c.field === "status");
      if (statusChange && requesterPrefs.whatsappNotifications) {
        const recipients = [
          updatedTask.requesterPhone,
          ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
        ].filter((p) => p && p.trim() !== "");

        if (recipients.length > 0) {
          // Non-blocking notification
          Promise.all(recipients.map(to =>
            sendStatusUpdateSms({
              to,
              taskTitle: updatedTask.title,
              newStatus: statusChange.newValue,
              taskUrl: taskUrl,
              requesterName: updatedTask.requesterName,
              taskId: updatedTask.id || updatedTask._id?.toString?.()
            })
          )).catch(err => console.error("Background Notification Error (Status Update):", err));
        }
      }

      const updatedFiles = Array.isArray(updatedTask.files) ? updatedTask.files : [];
      const newNames = new Set(
        finalFileChanges
          .map((change) => change?.newValue)
          .filter((name) => Boolean(name))
      );
      const files = updatedFiles
        .filter((file) => file?.type === "output" && newNames.has(file.name))
        .map((file) => ({ name: file.name, url: file.url }));
      if (files.length === 0) {
        newNames.forEach((name) => {
          files.push({ name, url: "" });
        });
      }
      const submittedAt = finalChangeEntries[0]?.createdAt;

    let resolvedRequesterEmail = updatedTask.requesterEmail || task.requesterEmail;
    if (!resolvedRequesterEmail && updatedTask.requesterId) {
      const requesterUser = await User.findById(updatedTask.requesterId);
      resolvedRequesterEmail = requesterUser?.email || "";
    }
    if (!resolvedRequesterEmail) {
      const history = Array.isArray(updatedTask.changeHistory) ? updatedTask.changeHistory : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      if (createdEntry?.userId) {
        const requesterUser = await User.findById(createdEntry.userId);
        resolvedRequesterEmail = requesterUser?.email || "";
      } else if (createdEntry?.userName) {
        const requesterUser = await User.findOne({
          name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
          isActive: { $ne: false }
        });
        resolvedRequesterEmail = requesterUser?.email || "";
      }
    }

      if (resolvedRequesterEmail && requesterPrefs.emailNotifications) {
        const emailSent = await sendFinalFilesEmail({
          to: resolvedRequesterEmail,
          taskTitle: task.title,
          files,
          designerName: resolvedUserName,
          taskUrl,
          submittedAt,
          taskDetails: {
            id: updatedTask.id || updatedTask._id?.toString?.() || updatedTask._id,
            status: updatedTask.status,
            category: updatedTask.category,
            deadline: updatedTask.deadline,
            requesterName: updatedTask.requesterName,
            requesterEmail: resolvedRequesterEmail,
            requesterDepartment: updatedTask.requesterDepartment,
          },
        });
        if (!emailSent) {
          console.warn("Final files email failed to send. Check SMTP configuration.");
        }
      } else {
        console.warn("Final files email skipped: requester email missing.");
      }

      const recipients = [
        updatedTask.requesterPhone,
        ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (requesterPrefs.whatsappNotifications) {
        if (recipients.length === 0 && process.env.TWILIO_DEFAULT_TO) {
          recipients.push(process.env.TWILIO_DEFAULT_TO);
        }

        // Non-blocking notification
        Promise.all(recipients.map(to =>
          sendFinalFilesSms({
            to,
            taskTitle: updatedTask.title,
            files,
            designerName: resolvedUserName,
            taskUrl,
            deadline: updatedTask.deadline,
            taskId: updatedTask.id || updatedTask._id?.toString?.(),
            requesterName: updatedTask.requesterName
          })
        )).catch(err => console.error("Background Notification Error (Final Files):", err));
      }
    }

    const taskId = updatedTask?.id || updatedTask?._id?.toString?.();
    const taskLink = buildTaskLink(taskId);
    const changeStamp = changeEntries[0]?.createdAt
      ? new Date(changeEntries[0].createdAt).toISOString()
      : new Date().toISOString();

    let requesterUserId =
      updatedTask.requesterId ||
      task.requesterId ||
      (updatedTask.requesterEmail
        ? await resolveUserIdByEmail(updatedTask.requesterEmail)
        : "");
    if (!requesterUserId) {
      const history = Array.isArray(updatedTask.changeHistory) ? updatedTask.changeHistory : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      if (createdEntry?.userId) {
        requesterUserId = createdEntry.userId;
      } else if (createdEntry?.userName) {
        const requesterUser = await User.findOne({
          name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
          isActive: { $ne: false }
        });
        requesterUserId = requesterUser?._id?.toString?.() || "";
      }
    }
    const designerUserId = updatedTask.assignedToId || task.assignedToId || "";

    const notifyUser = (userId, payload) => {
      if (!userId) return;
      createNotification({ userId, ...payload })
        .then((note) => emitNotification(note))
        .catch((error) => {
          console.error("Notification error:", error?.message || error);
        });
    };

    if (finalFileChanges.length > 0 && canShareFinalFilesWithStaff && requesterUserId) {
      notifyUser(requesterUserId, {
        title: `Final files uploaded: ${updatedTask.title}`,
        message: `${resolvedUserName || "Designer"} shared final deliverables.`,
        type: "file",
        link: taskLink,
        taskId,
        eventId: `final:${taskId}:${changeStamp}`,
      });
    }

    const statusEntry = sanitizedEntries.find((entry) => entry.field === "status");
    if (statusEntry && requesterUserId) {
      const nextStatus = normalizeValue(statusEntry.newValue).replace(/[\s-]+/g, "_");
      if (nextStatus.includes("completed")) {
        notifyUser(requesterUserId, {
          title: `Task completed: ${updatedTask.title}`,
          message: `${resolvedUserName || "Designer"} marked this task as completed.`,
          type: "task",
          link: taskLink,
          taskId,
          eventId: `status:${taskId}:${nextStatus}:${changeStamp}`,
        });
      }
      if (nextStatus === "clarification_required") {
        const emailSent = await sendTaskLifecycleEmailIfEnabled({
          task: updatedTask,
          userId: requesterUserId,
          emailType: "CLARIFICATION_REQUIRED",
          actorName: resolvedUserName || "Designer",
          note: statusEntry.note || "",
          submittedAt: statusEntry.createdAt || new Date(changeStamp),
        });
        if (!emailSent) {
          console.warn("Clarification required email skipped or failed.");
        }
      }
    }

    const deadlineEntry = changeEntries.find((entry) => entry.field === "deadline_request");
    if (deadlineEntry && requesterUserId) {
      const decision = String(deadlineEntry.newValue || "").toLowerCase();
      if (decision.includes("approved")) {
        notifyUser(requesterUserId, {
          title: `Deadline approved: ${updatedTask.title}`,
          message: deadlineEntry.note || "Your deadline request was approved.",
          type: "task",
          link: taskLink,
          taskId,
          eventId: `deadline:${taskId}:${decision}:${changeStamp}`,
        });
        const emailSent = await sendTaskLifecycleEmailIfEnabled({
          task: updatedTask,
          userId: requesterUserId,
          emailType: "DEADLINE_APPROVED",
          actorName: resolvedUserName || "Designer",
          note: deadlineEntry.note || "",
          submittedAt: deadlineEntry.createdAt || new Date(changeStamp),
        });
        if (!emailSent) {
          console.warn("Deadline approved email skipped or failed.");
        }
      } else if (decision.includes("rejected")) {
        notifyUser(requesterUserId, {
          title: `Deadline update: ${updatedTask.title}`,
          message: deadlineEntry.note || "Your deadline request was rejected.",
          type: "task",
          link: taskLink,
          taskId,
          eventId: `deadline:${taskId}:${decision}:${changeStamp}`,
        });
        const emailSent = await sendTaskLifecycleEmailIfEnabled({
          task: updatedTask,
          userId: requesterUserId,
          emailType: "DEADLINE_REJECTED",
          actorName: resolvedUserName || "Designer",
          note: deadlineEntry.note || "",
          submittedAt: deadlineEntry.createdAt || new Date(changeStamp),
        });
        if (!emailSent) {
          console.warn("Deadline rejected email skipped or failed.");
        }
      }
    }

    const emergencyEntry = changeEntries.find((entry) => entry.field === "emergency_approval");
    if (emergencyEntry && requesterUserId) {
      notifyUser(requesterUserId, {
        title: `Emergency ${String(emergencyEntry.newValue || "").toLowerCase()}: ${updatedTask.title}`,
        message: emergencyEntry.note || "Emergency request updated.",
        type: "task",
        link: taskLink,
        taskId,
        eventId: `emergency:${taskId}:${changeStamp}`,
      });
      const emergencyDecision = normalizeValue(emergencyEntry.newValue);
      if (emergencyDecision === "approved" || emergencyDecision === "rejected") {
        const emailSent = await sendTaskLifecycleEmailIfEnabled({
          task: updatedTask,
          userId: requesterUserId,
          emailType:
            emergencyDecision === "approved"
              ? "EMERGENCY_APPROVED"
              : "EMERGENCY_REJECTED",
          actorName: resolvedUserName || "Designer",
          note: emergencyEntry.note || "",
          submittedAt: emergencyEntry.createdAt || new Date(changeStamp),
        });
        if (!emailSent) {
          console.warn(`Emergency ${emergencyDecision} email skipped or failed.`);
        }
      }
    }

    const approvalEntry = sanitizedEntries.find((entry) => entry.field === "approval_status");
    if (approvalEntry && userRole === "treasurer") {
      const decision = String(approvalEntry.newValue || "").toLowerCase();
      const payload = {
        title: `Approval ${decision}: ${updatedTask.title}`,
        message: approvalEntry.note || `Treasurer ${decision} this request.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `approval:${taskId}:${decision}:${changeStamp}`,
      };
      if (requesterUserId) notifyUser(requesterUserId, payload);
      if (designerUserId) notifyUser(designerUserId, payload);
      if ((decision.includes("approved") || decision.includes("rejected")) && requesterUserId) {
        const emailSent = await sendTaskLifecycleEmailIfEnabled({
          task: updatedTask,
          userId: requesterUserId,
          emailType: decision.includes("approved") ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
          actorName: resolvedUserName || "Treasurer",
          note: approvalEntry.note || "",
          submittedAt: approvalEntry.createdAt || new Date(changeStamp),
        });
        if (!emailSent) {
          console.warn(`Approval ${decision} email skipped or failed.`);
        }
      }
    }

    if (userRole === "staff" && designerUserId) {
      const staffFields = new Set([
        "description",
        "files",
        "deadline_request",
        "status",
        "staff_note",
        "created",
      ]);
      const staffEntry = changeEntries.find((entry) => staffFields.has(entry.field));
      if (staffEntry) {
        notifyUser(designerUserId, {
          title: `Task updated: ${updatedTask.title}`,
          message: staffEntry.note || `${resolvedUserName || "Staff"} updated ${staffEntry.field.replace(/_/g, " ")}`,
          type: "task",
          link: taskLink,
          eventId: `staff:${taskId}:${staffEntry.field}:${changeStamp}`,
        });
      }
    }

    // Notify on deadline changes
    const deadlineChange = changes.find(c => c.field === "deadline" || (c.field === "deadline_request" && c.newValue === "Approved"));
    if (deadlineChange) {
      const recipients = [
        updatedTask.requesterPhone,
        ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (recipients.length > 0) {
        const newDeadline = updatedTask.deadline ? new Date(updatedTask.deadline).toLocaleDateString() : "n/a";
        const body = `DesignDesk-Official Update: The deadline for "${updatedTask.title}" has been updated to ${newDeadline}.`;

        // Non-blocking notification
        Promise.all(recipients.map(to => sendSms({ to, body })))
          .catch(err => console.error("Background Notification Error (Deadline Change):", err));
      }
    }

    const io = getSocket();
    if (io) {
      const updatedTaskId = updatedTask.id || updatedTask._id?.toString?.();
      const staffPayload = buildTaskPayloadForViewer(updatedTask, { role: "staff" });
      const fullPayload = buildTaskPayloadForViewer(updatedTask, { role: "designer" });
      io.to(updatedTaskId).emit("task:updated", {
        taskId: updatedTaskId,
        task: staffPayload,
      });
      if (requesterUserId) {
        io.to(String(requesterUserId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: staffPayload,
        });
      }
      const requesterEmail = updatedTask.requesterEmail || task.requesterEmail;
      if (requesterEmail) {
        io.to(String(requesterEmail)).emit("task:updated", {
          taskId: updatedTaskId,
          task: staffPayload,
        });
      }
      if (designerUserId) {
        io.to(String(designerUserId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: fullPayload,
        });
      }
      if (userId) {
        io.to(String(userId)).emit("task:updated", {
          taskId: updatedTaskId,
          task: buildTaskPayloadForViewer(updatedTask, req.user),
        });
      }
      console.log(`Emitted task:updated for ${updatedTaskId}`);
    }

    const approvalChange = changes.find((change) =>
      ["approvalStatus", "deadlineApprovalStatus", "emergencyApprovalStatus"].includes(change.field)
    );
    if (approvalChange) {
      const nextValue = String(approvalChange.newValue || "").toLowerCase();
      if (nextValue === "approved") {
        req.auditAction = approvalChange.field === "emergencyApprovalStatus"
          ? "EMERGENCY_OVERRIDE"
          : "REQUEST_APPROVED";
      } else if (nextValue === "rejected") {
        req.auditAction = "REQUEST_REJECTED";
      }
    }
    if (changes.some((change) => String(change.field || "").toLowerCase().includes("emergency") && String(change.note || "").toLowerCase().includes("override"))) {
      req.auditAction = "EMERGENCY_OVERRIDE";
    }

    res.json(buildTaskPayloadForViewer(updatedTask, req.user));
  } catch (error) {
    console.error("Failed to record change:", error);
    res.status(400).json({ error: "Failed to record change." });
  }
});

export default router;


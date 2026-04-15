import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";

import express from "express";
import mongoose from "mongoose";

import { requireAuth, signAccessToken } from "../middleware/auth.js";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import tasksRouter from "../routes/tasks.js";
import { getSocket, initSocket } from "../socket.js";

const require = createRequire(import.meta.url);
const { io: createClient } = require("../../client/node_modules/socket.io-client");

process.env.JWT_SECRET = "design-desk-test-secret";
process.env.MAIN_DESIGNER_EMAILS = "lead@example.com";
process.env.GMAIL_SMTP_USER = "";
process.env.GMAIL_SMTP_FROM = "";
process.env.GMAIL_APP_PASSWORD = "";
process.env.TWILIO_ACCOUNT_SID = "";
process.env.TWILIO_AUTH_TOKEN = "";
process.env.TWILIO_FROM_NUMBER = "";
process.env.FRONTEND_URL = "http://127.0.0.1:5173";

const newId = () => new mongoose.Types.ObjectId().toString();

const store = {
  tasks: new Map(),
  users: new Map(),
  notifications: [],
  activities: [],
};

const scenarioUsers = {
  staff: {
    _id: newId(),
    name: "Staff User",
    email: "staff@example.com",
    role: "staff",
    isActive: true,
    notificationPreferences: {
      emailNotifications: false,
      whatsappNotifications: false,
      deadlineReminders: false,
    },
  },
  admin: {
    _id: newId(),
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    isActive: true,
    notificationPreferences: {
      emailNotifications: false,
      whatsappNotifications: false,
      deadlineReminders: false,
    },
  },
  lead: {
    _id: newId(),
    name: "Design Lead",
    email: "lead@example.com",
    role: "designer",
    isActive: true,
    notificationPreferences: {
      emailNotifications: false,
      whatsappNotifications: false,
      deadlineReminders: false,
    },
  },
  junior: {
    _id: newId(),
    name: "Junior Designer",
    email: "junior@example.com",
    role: "designer",
    isActive: true,
    notificationPreferences: {
      emailNotifications: false,
      whatsappNotifications: false,
      deadlineReminders: false,
    },
  },
  treasurer: {
    _id: newId(),
    name: "Treasurer User",
    email: "treasurer@example.com",
    role: "treasurer",
    isActive: true,
    notificationPreferences: {
      emailNotifications: false,
      whatsappNotifications: false,
      deadlineReminders: false,
    },
  },
};

Object.values(scenarioUsers).forEach((user) => {
  store.users.set(String(user._id), { ...user });
});

const patchRestoreStack = [];
const sockets = [];

const patchMethod = (target, key, replacement) => {
  const original = target[key];
  target[key] = replacement;
  patchRestoreStack.push(() => {
    target[key] = original;
  });
};

const valuesEqual = (left, right) => {
  if (left instanceof Date || right instanceof Date) {
    return new Date(left || 0).getTime() === new Date(right || 0).getTime();
  }
  return String(left ?? "") === String(right ?? "");
};

const compareOrderValue = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const dateValue = new Date(value || "").getTime();
  if (Number.isFinite(dateValue)) return dateValue;
  return String(value ?? "").toLowerCase();
};

const matchesCondition = (actual, condition) => {
  if (condition instanceof RegExp) {
    return condition.test(String(actual ?? ""));
  }

  if (
    condition &&
    typeof condition === "object" &&
    !Array.isArray(condition) &&
    !(condition instanceof Date)
  ) {
    if (Array.isArray(condition.$in)) {
      return condition.$in.some((entry) => valuesEqual(actual, entry));
    }
    if (Array.isArray(condition.$nin)) {
      return condition.$nin.every((entry) => !valuesEqual(actual, entry));
    }
    if (Object.prototype.hasOwnProperty.call(condition, "$ne")) {
      return !valuesEqual(actual, condition.$ne);
    }
    if (Object.prototype.hasOwnProperty.call(condition, "$gte")) {
      return compareOrderValue(actual) >= compareOrderValue(condition.$gte);
    }
  }

  return valuesEqual(actual, condition);
};

const matchesQuery = (record, query = {}) => {
  if (!query || typeof query !== "object") return true;
  if (Array.isArray(query.$or)) {
    const matched = query.$or.some((entry) => matchesQuery(record, entry));
    if (!matched) return false;
  }

  return Object.entries(query).every(([key, value]) => {
    if (key === "$or") return true;
    return matchesCondition(record?.[key], value);
  });
};

const applySort = (items, sortSpec = {}) => {
  const list = Array.isArray(items) ? [...items] : items;
  if (!Array.isArray(list)) return list;
  const [[field, direction] = []] = Object.entries(sortSpec);
  if (!field) return list;
  const order = Number(direction) >= 0 ? 1 : -1;
  return list.sort((left, right) => {
    const leftValue = compareOrderValue(left?.[field]);
    const rightValue = compareOrderValue(right?.[field]);
    if (leftValue < rightValue) return -1 * order;
    if (leftValue > rightValue) return 1 * order;
    return 0;
  });
};

const createQuery = (resolver) => ({
  select() {
    return createQuery(resolver);
  },
  sort(sortSpec) {
    return createQuery(async () => applySort(await resolver(), sortSpec));
  },
  lean() {
    return createQuery(async () => structuredClone(await resolver()));
  },
  exec() {
    return Promise.resolve().then(resolver);
  },
  then(resolve, reject) {
    return Promise.resolve().then(resolver).then(resolve, reject);
  },
  catch(reject) {
    return Promise.resolve().then(resolver).catch(reject);
  },
  finally(handler) {
    return Promise.resolve().then(resolver).finally(handler);
  },
});

const createTaskDoc = (seed = {}) => {
  const now = new Date();
  const _id = String(seed._id || seed.id || newId());
  const doc = {
    requestType: "single_task",
    title: "",
    description: "",
    category: "banner",
    urgency: "normal",
    status: "pending",
    requesterId: "",
    requesterName: "",
    requesterEmail: "",
    requesterDepartment: "",
    requesterPhone: "",
    secondaryPhones: [],
    assignedToId: "",
    assignedToName: "",
    assignedTo: "",
    changeCount: 0,
    changeHistory: [],
    files: [],
    comments: [],
    collaterals: [],
    designVersions: [],
    finalDeliverableVersions: [],
    approvalStatus: "pending",
    adminReviewStatus: "pending",
    adminReviewedBy: "",
    adminReviewResponseStatus: "pending",
    finalDeliverableReviewStatus: "not_submitted",
    finalDeliverableReviewedBy: "",
    finalDeliverableReviewNote: "",
    isModification: false,
    createdAt: now,
    updatedAt: now,
    ...structuredClone(seed),
    _id,
    id: _id,
  };

  Object.defineProperties(doc, {
    markModified: {
      enumerable: false,
      value() {
        return undefined;
      },
    },
    save: {
      enumerable: false,
      value: async function save() {
        this.updatedAt = this.updatedAt || new Date();
        store.tasks.set(this.id, this);
        return this;
      },
    },
    toJSON: {
      enumerable: false,
      value: function toJSON() {
        return structuredClone({
          ...this,
          _id: this._id,
          id: this.id,
        });
      },
    },
    toObject: {
      enumerable: false,
      value: function toObject() {
        return this.toJSON();
      },
    },
  });

  return doc;
};

const applyUpdate = (doc, update = {}) => {
  const hasOperators = Object.keys(update).some((key) => key.startsWith("$"));
  if (!hasOperators) {
    Object.entries(update).forEach(([key, value]) => {
      doc[key] = structuredClone(value);
    });
    return doc;
  }

  if (update.$set) {
    Object.entries(update.$set).forEach(([key, value]) => {
      doc[key] = structuredClone(value);
    });
  }

  if (update.$inc) {
    Object.entries(update.$inc).forEach(([key, value]) => {
      doc[key] = Number(doc[key] || 0) + Number(value || 0);
    });
  }

  if (update.$unset) {
    Object.keys(update.$unset).forEach((key) => {
      delete doc[key];
    });
  }

  if (update.$push) {
    Object.entries(update.$push).forEach(([key, value]) => {
      const existing = Array.isArray(doc[key]) ? doc[key] : [];
      const valuesToAppend =
        value && typeof value === "object" && Array.isArray(value.$each)
          ? value.$each
          : [value];
      doc[key] = existing.concat(structuredClone(valuesToAppend));
    });
  }

  return doc;
};

patchMethod(Task, "findById", (id) =>
  createQuery(() => store.tasks.get(String(id)) || null)
);
patchMethod(Task, "findOne", (query) =>
  createQuery(() => {
    const tasks = Array.from(store.tasks.values()).filter((task) => matchesQuery(task, query));
    return tasks[0] || null;
  })
);
patchMethod(Task, "create", async (payload) => {
  const doc = createTaskDoc(payload);
  store.tasks.set(doc.id, doc);
  return doc;
});
patchMethod(Task, "findByIdAndUpdate", async (id, update) => {
  const doc = store.tasks.get(String(id));
  if (!doc) return null;
  applyUpdate(doc, update);
  doc.updatedAt =
    update?.$set?.updatedAt ||
    update?.updatedAt ||
    doc.updatedAt ||
    new Date();
  store.tasks.set(doc.id, doc);
  return doc;
});

patchMethod(User, "findById", (id) =>
  createQuery(() => {
    const user = store.users.get(String(id)) || null;
    return user ? structuredClone(user) : null;
  })
);
patchMethod(User, "findOne", (query) =>
  createQuery(() => {
    const user =
      Array.from(store.users.values()).find((entry) => matchesQuery(entry, query)) || null;
    return user ? structuredClone(user) : null;
  })
);
patchMethod(User, "find", (query) =>
  createQuery(() =>
    Array.from(store.users.values())
      .filter((entry) => matchesQuery(entry, query))
      .map((entry) => structuredClone(entry))
  )
);

patchMethod(Activity, "create", async (payload) => {
  const activity = {
    _id: newId(),
    id: newId(),
    createdAt: new Date(),
    ...structuredClone(payload),
  };
  store.activities.push(activity);
  return activity;
});

patchMethod(Notification, "findOne", (query) =>
  createQuery(() => store.notifications.find((entry) => matchesQuery(entry, query)) || null)
);
patchMethod(Notification, "create", async (payload) => {
  const _id = newId();
  const note = {
    _id,
    id: _id,
    createdAt: new Date(),
    ...structuredClone(payload),
  };
  Object.defineProperty(note, "toJSON", {
    enumerable: false,
    value() {
      return structuredClone({
        ...this,
        _id: this._id,
        id: this.id,
      });
    },
  });
  store.notifications.push(note);
  return note;
});

const app = express();
app.use(express.json());
app.use(requireAuth);
app.use("/api/tasks", tasksRouter);

const server = http.createServer(app);
initSocket(server);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const baseUrl = `http://127.0.0.1:${server.address().port}`;

const closeResources = async () => {
  await Promise.allSettled(
    sockets.map(
      (socket) =>
        new Promise((resolve) => {
          socket.once("disconnect", resolve);
          socket.disconnect();
          setTimeout(resolve, 100);
        })
    )
  );

  const io = getSocket();
  if (io) {
    await io.close();
  }

  await new Promise((resolve) => server.close(resolve));

  while (patchRestoreStack.length > 0) {
    const restore = patchRestoreStack.pop();
    restore();
  }
};

const connectUserSocket = async (userId) => {
  const socket = createClient(baseUrl, {
    path: "/socket.io/",
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  await once(socket, "connect");
  socket.emit("join", { userId });
  await delay(30);
  return socket;
};

const connectTaskWatcher = async (taskId) => {
  const socket = createClient(baseUrl, {
    path: "/socket.io/",
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  await once(socket, "connect");
  socket.emit("task:join", { taskId });
  await delay(30);
  return socket;
};

const waitForEvent = (socket, eventName, predicate, timeoutMs = 2500) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, timeoutMs);

    const handler = (payload) => {
      try {
        if (predicate && !predicate(payload)) {
          return;
        }
        clearTimeout(timer);
        socket.off(eventName, handler);
        resolve(payload);
      } catch (error) {
        clearTimeout(timer);
        socket.off(eventName, handler);
        reject(error);
      }
    };

    socket.on(eventName, handler);
  });

const apiRequest = async ({ token, method, path, body }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const expectStatus = (response, expectedStatus) => {
  assert.equal(
    response.status,
    expectedStatus,
    `Expected HTTP ${expectedStatus} but received ${response.status}: ${JSON.stringify(
      response.data
    )}`
  );
};

const tokens = {
  staff: signAccessToken(scenarioUsers.staff),
  admin: signAccessToken(scenarioUsers.admin),
  lead: signAccessToken(scenarioUsers.lead),
  junior: signAccessToken(scenarioUsers.junior),
  treasurer: signAccessToken(scenarioUsers.treasurer),
};

let passed = 0;

try {
  const staffSocket = await connectUserSocket(scenarioUsers.staff._id);
  const leadSocket = await connectUserSocket(scenarioUsers.lead._id);
  const juniorSocket = await connectUserSocket(scenarioUsers.junior._id);
  const treasurerSocket = await connectUserSocket(scenarioUsers.treasurer._id);

  const createLeadEvent = waitForEvent(
    leadSocket,
    "request:new",
    (payload) => payload?.title === "Realtime Workflow Request"
  );
  const createTreasurerEvent = waitForEvent(
    treasurerSocket,
    "request:new",
    (payload) => payload?.title === "Realtime Workflow Request"
  );

  const createResponse = await apiRequest({
    token: tokens.staff,
    method: "POST",
    path: "/api/tasks",
    body: {
      title: "Realtime Workflow Request",
      description: "Initial request brief",
      category: "banner",
      urgency: "normal",
      deadline: "2026-04-20T12:00:00.000Z",
      requesterName: scenarioUsers.staff.name,
      requesterDepartment: "Marketing",
      adminReviewStatus: "pending",
    },
  });
  expectStatus(createResponse, 201);

  const [leadRequestEvent, treasurerRequestEvent] = await Promise.all([
    createLeadEvent,
    createTreasurerEvent,
  ]);

  const createdTask = createResponse.data;
  const taskId = String(createdTask.id || "").trim();
  assert.ok(taskId, "Created task should return an id.");
  assert.equal(leadRequestEvent.title, "Realtime Workflow Request");
  assert.equal(treasurerRequestEvent.title, "Realtime Workflow Request");
  passed += 1;
  console.log("PASS create request emits realtime queue events");

  const taskWatcher = await connectTaskWatcher(taskId);

  const needsInfoEvent = waitForEvent(
    taskWatcher,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.adminReviewStatus === "needs_info"
  );
  const needsInfoResponse = await apiRequest({
    token: tokens.admin,
    method: "PATCH",
    path: `/api/tasks/${taskId}`,
    body: {
      adminReviewStatus: "needs_info",
      adminReviewedBy: scenarioUsers.admin.name,
      adminReviewedAt: "2026-04-15T10:00:00.000Z",
    },
  });
  expectStatus(needsInfoResponse, 200);
  const needsInfoPayload = await needsInfoEvent;
  assert.equal(needsInfoResponse.data.adminReviewStatus, "needs_info");
  assert.equal(needsInfoPayload.task.adminReviewStatus, "needs_info");
  passed += 1;
  console.log("PASS admin needs-info review reaches realtime task listeners");

  const staffResponseEvent = waitForEvent(
    taskWatcher,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.description === "Updated request brief from staff" &&
      payload?.task?.adminReviewResponseStatus === "submitted"
  );
  const staffResponse = await apiRequest({
    token: tokens.staff,
    method: "POST",
    path: `/api/tasks/${taskId}/changes`,
    body: {
      updates: {
        description: "Updated request brief from staff",
        adminReviewResponseStatus: "submitted",
        adminReviewResponseSubmittedAt: "2026-04-15T10:05:00.000Z",
      },
      changes: [
        {
          type: "update",
          field: "description",
          oldValue: "Initial request brief",
          newValue: "Updated request brief from staff",
          note: "Added the missing details requested by admin.",
        },
      ],
    },
  });
  expectStatus(staffResponse, 200);
  const staffResponsePayload = await staffResponseEvent;
  assert.equal(staffResponse.data.description, "Updated request brief from staff");
  assert.equal(staffResponsePayload.task.adminReviewResponseStatus, "submitted");
  passed += 1;
  console.log("PASS staff follow-up update is broadcast in realtime");

  const approveEvent = waitForEvent(
    taskWatcher,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.adminReviewStatus === "approved"
  );
  const approveResponse = await apiRequest({
    token: tokens.admin,
    method: "PATCH",
    path: `/api/tasks/${taskId}`,
    body: {
      adminReviewStatus: "approved",
      adminReviewedBy: scenarioUsers.admin.name,
      adminReviewedAt: "2026-04-15T10:10:00.000Z",
    },
  });
  expectStatus(approveResponse, 200);
  const approvePayload = await approveEvent;
  assert.equal(approveResponse.data.adminReviewStatus, "approved");
  assert.equal(approvePayload.task.adminReviewStatus, "approved");
  passed += 1;
  console.log("PASS admin approval update reaches realtime task listeners");

  const assignDesignerEvent = waitForEvent(
    juniorSocket,
    "request:new",
    (payload) =>
      String(payload?.id || payload?._id || "") === taskId &&
      String(payload?.assignedToId || "") === scenarioUsers.junior._id
  );
  const assignTaskRoomEvent = waitForEvent(
    taskWatcher,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.status === "assigned" &&
      String(payload?.task?.assignedToId || "") === scenarioUsers.junior._id
  );
  const assignResponse = await apiRequest({
    token: tokens.admin,
    method: "POST",
    path: `/api/tasks/${taskId}/assign-designer`,
    body: {
      assigned_designer_id: scenarioUsers.junior._id,
      deadline: "2026-04-22",
      cc_emails: ["copy@example.com"],
      message: "Please take this request.",
    },
  });
  expectStatus(assignResponse, 200);
  const [assignDesignerPayload, assignTaskPayload] = await Promise.all([
    assignDesignerEvent,
    assignTaskRoomEvent,
  ]);
  assert.equal(assignResponse.data.status, "assigned");
  assert.equal(assignResponse.data.assignedToId, scenarioUsers.junior._id);
  assert.equal(assignDesignerPayload.assignedToId, scenarioUsers.junior._id);
  assert.equal(assignTaskPayload.task.status, "assigned");
  passed += 1;
  console.log("PASS designer assignment emits request:new and task:updated");

  const uploadLeadEvent = waitForEvent(
    leadSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "pending" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 1
  );
  const uploadStaffEvent = waitForEvent(
    staffSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "pending" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 0
  );
  const uploadResponse = await apiRequest({
    token: tokens.junior,
    method: "POST",
    path: `/api/tasks/${taskId}/final-deliverables`,
    body: {
      note: "Version one",
      files: [
        {
          name: "draft-final.pdf",
          url: "https://files.example.com/draft-final.pdf",
          mime: "application/pdf",
          size: 1024,
        },
      ],
    },
  });
  expectStatus(uploadResponse, 200);
  const [uploadLeadPayload, uploadStaffPayload] = await Promise.all([
    uploadLeadEvent,
    uploadStaffEvent,
  ]);
  assert.equal(uploadResponse.data.status, "under_review");
  assert.equal(uploadResponse.data.finalDeliverableReviewStatus, "pending");
  assert.equal(uploadResponse.data.finalDeliverableVersions.length, 1);
  assert.equal(uploadLeadPayload.task.finalDeliverableVersions.length, 1);
  assert.equal(uploadStaffPayload.task.finalDeliverableVersions.length, 0);
  passed += 1;
  console.log("PASS final upload notifies lead and staff in realtime");

  const rejectJuniorEvent = waitForEvent(
    juniorSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "rejected" &&
      payload?.task?.status === "clarification_required" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 1
  );
  const rejectStaffEvent = waitForEvent(
    staffSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "rejected" &&
      payload?.task?.status === "clarification_required" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 0
  );
  const rejectResponse = await apiRequest({
    token: tokens.lead,
    method: "POST",
    path: `/api/tasks/${taskId}/final-deliverables/review`,
    body: {
      decision: "rejected",
      note: "Changes requested before final approval.",
      reviewAnnotations: [
        {
          id: "annotation-1",
          fileId: "draft-final.pdf",
          fileName: "draft-final.pdf",
          fileUrl: "https://files.example.com/draft-final.pdf",
          comments: [
            {
              id: "comment-1",
              x: 20,
              y: 30,
              text: "Tighten the spacing here.",
            },
          ],
        },
      ],
    },
  });
  expectStatus(rejectResponse, 200);
  const [rejectJuniorPayload, rejectStaffPayload] = await Promise.all([
    rejectJuniorEvent,
    rejectStaffEvent,
  ]);
  assert.equal(rejectResponse.data.finalDeliverableReviewStatus, "rejected");
  assert.equal(rejectResponse.data.status, "clarification_required");
  assert.equal(
    rejectResponse.data.finalDeliverableVersions[0].reviewAnnotations.length,
    1
  );
  assert.equal(rejectJuniorPayload.task.status, "clarification_required");
  assert.equal(rejectStaffPayload.task.finalDeliverableVersions.length, 0);
  passed += 1;
  console.log("PASS final rejection pushes realtime updates back to designer and staff");

  const resubmitLeadEvent = waitForEvent(
    leadSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "pending" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 2
  );
  const resubmitResponse = await apiRequest({
    token: tokens.junior,
    method: "POST",
    path: `/api/tasks/${taskId}/final-deliverables`,
    body: {
      note: "Version two",
      files: [
        {
          name: "draft-final-v2.pdf",
          url: "https://files.example.com/draft-final-v2.pdf",
          mime: "application/pdf",
          size: 2048,
        },
      ],
    },
  });
  expectStatus(resubmitResponse, 200);
  const resubmitLeadPayload = await resubmitLeadEvent;
  assert.equal(resubmitResponse.data.status, "under_review");
  assert.equal(resubmitResponse.data.finalDeliverableVersions.length, 2);
  assert.equal(resubmitLeadPayload.task.finalDeliverableVersions.length, 2);
  passed += 1;
  console.log("PASS designer resubmission is delivered in realtime");

  const approveStaffEvent = waitForEvent(
    staffSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "approved" &&
      payload?.task?.status === "completed" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 2
  );
  const approveJuniorEvent = waitForEvent(
    juniorSocket,
    "task:updated",
    (payload) =>
      payload?.taskId === taskId &&
      payload?.task?.finalDeliverableReviewStatus === "approved" &&
      payload?.task?.status === "completed" &&
      Array.isArray(payload?.task?.finalDeliverableVersions) &&
      payload.task.finalDeliverableVersions.length === 2
  );
  const finalApproveResponse = await apiRequest({
    token: tokens.lead,
    method: "POST",
    path: `/api/tasks/${taskId}/final-deliverables/review`,
    body: {
      decision: "approved",
      note: "Approved for delivery.",
    },
  });
  expectStatus(finalApproveResponse, 200);
  const [approveStaffPayload, approveJuniorPayload] = await Promise.all([
    approveStaffEvent,
    approveJuniorEvent,
  ]);
  assert.equal(finalApproveResponse.data.finalDeliverableReviewStatus, "approved");
  assert.equal(finalApproveResponse.data.status, "completed");
  assert.equal(approveStaffPayload.task.finalDeliverableVersions.length, 2);
  assert.equal(approveJuniorPayload.task.status, "completed");
  passed += 1;
  console.log("PASS final approval reaches staff and designer in realtime");

  const rejectCreateLeadEvent = waitForEvent(
    leadSocket,
    "request:new",
    (payload) => payload?.title === "Realtime Rejection Request"
  );
  const rejectCreateResponse = await apiRequest({
    token: tokens.staff,
    method: "POST",
    path: "/api/tasks",
    body: {
      title: "Realtime Rejection Request",
      description: "Request that should be rejected at intake",
      category: "banner",
      urgency: "normal",
      deadline: "2026-04-25T12:00:00.000Z",
      requesterName: scenarioUsers.staff.name,
      requesterDepartment: "Marketing",
      adminReviewStatus: "pending",
    },
  });
  expectStatus(rejectCreateResponse, 201);
  await rejectCreateLeadEvent;
  const rejectedTaskId = String(rejectCreateResponse.data.id || "").trim();
  assert.ok(rejectedTaskId, "Rejected-branch task should return an id.");
  const rejectedTaskWatcher = await connectTaskWatcher(rejectedTaskId);

  const rejectIntakeEvent = waitForEvent(
    rejectedTaskWatcher,
    "task:updated",
    (payload) =>
      payload?.taskId === rejectedTaskId &&
      payload?.task?.adminReviewStatus === "rejected"
  );
  const rejectIntakeResponse = await apiRequest({
    token: tokens.admin,
    method: "PATCH",
    path: `/api/tasks/${rejectedTaskId}`,
    body: {
      adminReviewStatus: "rejected",
      adminReviewedBy: scenarioUsers.admin.name,
      adminReviewedAt: "2026-04-15T11:00:00.000Z",
    },
  });
  expectStatus(rejectIntakeResponse, 200);
  const rejectIntakePayload = await rejectIntakeEvent;
  assert.equal(rejectIntakeResponse.data.adminReviewStatus, "rejected");
  assert.equal(rejectIntakePayload.task.adminReviewStatus, "rejected");
  passed += 1;
  console.log("PASS intake rejection is broadcast in realtime");

  console.log(`\n${passed} realtime API scenarios passed.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeResources();
}

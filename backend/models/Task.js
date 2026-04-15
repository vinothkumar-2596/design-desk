import mongoose from "mongoose";

const TaskFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, default: "" },
    driveId: { type: String, default: "" },
    webViewLink: { type: String, default: "" },
    webContentLink: { type: String, default: "" },
    type: { type: String, enum: ["input", "output", "working"], default: "input" },
    uploadedAt: { type: Date },
    uploadedBy: { type: String, default: "" },
    size: { type: Number },
    mime: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" }
  },
  { _id: false }
);

const TaskCommentSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userRole: { type: String, default: "" },
    content: { type: String, default: "", trim: true },
    parentId: { type: String, default: "" },
    mentions: { type: [String], default: [] },
    attachments: { type: [TaskFileSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    editedAt: { type: Date },
    deletedAt: { type: Date },
    deletedByName: { type: String, default: "" },
    receiverRoles: { type: [String], default: [] },
    seenBy: {
      type: [
        {
          role: { type: String, default: "" },
          userId: { type: String, default: "" },
          userName: { type: String, default: "" },
          seenAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    reactions: {
      type: [
        {
          emoji: { type: String, default: "" },
          userId: { type: String, default: "" },
          userName: { type: String, default: "" },
          userRole: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { _id: true }
);

const DesignVersionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, default: "" },
    version: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, default: "" }
  },
  { _id: true }
);

const FinalDeliverableFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, default: "" },
    driveId: { type: String, default: "" },
    webViewLink: { type: String, default: "" },
    webContentLink: { type: String, default: "" },
    size: { type: Number },
    mime: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, default: "" }
  },
  { _id: true }
);

const FinalDeliverableReviewAnnotationPointSchema = new mongoose.Schema(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  { _id: false }
);

const FinalDeliverableReviewAnnotationStrokeSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    color: { type: String, default: "#ef4444" },
    width: { type: Number, default: 2 },
    points: { type: [FinalDeliverableReviewAnnotationPointSchema], default: [] }
  },
  { _id: false }
);

const FinalDeliverableReviewAnnotationCommentSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    text: { type: String, default: "" },
    thread: {
      type: [
        {
          id: { type: String, default: "" },
          text: { type: String, default: "" },
          author: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
        }
      ],
      default: []
    }
  },
  { _id: false }
);

const FinalDeliverableReviewAnnotationSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    fileId: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    imageWidth: { type: Number },
    imageHeight: { type: Number },
    strokes: { type: [FinalDeliverableReviewAnnotationStrokeSchema], default: [] },
    shapes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    comments: { type: [FinalDeliverableReviewAnnotationCommentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: "" },
  },
  { _id: false }
);

const FinalDeliverableVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, default: "" },
    note: { type: String, default: "" },
    files: { type: [FinalDeliverableFileSchema], default: [] },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: "" },
    reviewAnnotations: { type: [FinalDeliverableReviewAnnotationSchema], default: [] },
  },
  { _id: true }
);

const ChangeHistorySchema = new mongoose.Schema(
  {
    type: { type: String, default: "update" },
    field: { type: String, default: "" },
    oldValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    note: { type: String, default: "" },
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userRole: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const CampaignDetailsSchema = new mongoose.Schema(
  {
    requestName: { type: String, default: "", trim: true },
    brief: { type: String, default: "", trim: true },
    deadlineMode: { type: String, enum: ["common", "itemized"], default: "common" },
    commonDeadline: { type: Date }
  },
  { _id: false }
);

const CollateralSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    title: { type: String, default: "", trim: true },
    collateralType: { type: String, required: true, trim: true },
    presetCategory: { type: String, default: "", trim: true },
    presetKey: { type: String, default: "", trim: true },
    presetLabel: { type: String, default: "", trim: true },
    sizeMode: { type: String, enum: ["preset", "custom"], default: "preset" },
    width: { type: Number },
    height: { type: Number },
    unit: { type: String, enum: ["px", "mm", "cm", "in", "ft"], default: "px" },
    sizeLabel: { type: String, default: "", trim: true },
    ratioLabel: { type: String, default: "", trim: true },
    customSizeLabel: { type: String, default: "", trim: true },
    orientation: {
      type: String,
      enum: ["portrait", "landscape", "square", "custom"],
      default: "portrait"
    },
    platform: { type: String, default: "", trim: true },
    usageType: { type: String, default: "", trim: true },
    brief: { type: String, default: "", trim: true },
    deadline: { type: Date },
    priority: { type: String, enum: ["low", "normal", "high", "critical"], default: "normal" },
    status: {
      type: String,
      enum: ["pending", "in_progress", "submitted_for_review", "approved", "rework", "completed"],
      default: "pending"
    },
    referenceFiles: { type: [TaskFileSchema], default: [] },
    assignedToId: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ["single_task", "campaign_request"],
      default: "single_task"
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["poster", "social_media", "banner", "brochure", "others", "campaign_or_others", "social_media_creative", "website_assets", "ui_ux", "led_backdrop", "flyer"],
      required: true
    },
    urgency: { type: String, enum: ["low", "intermediate", "normal", "urgent"], default: "normal" },
    status: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "accepted",
        "in_progress",
        "under_review",
        "completed",
        "clarification",
        "clarification_required"
      ],
      default: "pending"
    },
    isEmergency: { type: Boolean, default: false },
    emergencyApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    emergencyApprovedBy: { type: String, default: "" },
    emergencyApprovedAt: { type: Date },
    emergencyRequestedAt: { type: Date },
    scheduleTaskId: { type: String, default: "" },
    requesterId: { type: String, default: "" },
    requesterName: { type: String, default: "" },
    requesterEmail: { type: String, default: "" },
    requesterPhone: { type: String, default: "" },
    secondaryPhones: { type: [String], default: [] },
    requesterDepartment: { type: String, default: "" },
    assignedToId: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    isModification: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminReviewStatus: {
      type: String,
      enum: ["pending", "needs_info", "approved", "rejected"],
      default: "pending",
    },
    adminReviewedBy: { type: String, default: "" },
    adminReviewedAt: { type: Date },
    adminReviewResponseStatus: {
      type: String,
      enum: ["pending", "submitted"],
      default: "pending",
    },
    adminReviewResponseSubmittedAt: { type: Date },
    approvedBy: { type: String, default: "" },
    approvalDate: { type: Date },
    changeCount: { type: Number, default: 0 },
    deadline: { type: Date },
    proposedDeadline: { type: Date },
    deadlineApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    deadlineApprovedBy: { type: String, default: "" },
    deadlineApprovedAt: { type: Date },
    changeHistory: { type: [ChangeHistorySchema], default: [] },
    reminderSent: { type: Boolean, default: false },
    campaign: { type: CampaignDetailsSchema, default: undefined },
    collaterals: { type: [CollateralSchema], default: [] },
    files: { type: [TaskFileSchema], default: [] },
    designVersions: { type: [DesignVersionSchema], default: [] },
    activeDesignVersionId: { type: String, default: "" },
    finalDeliverableVersions: { type: [FinalDeliverableVersionSchema], default: [] },
    finalDeliverableReviewStatus: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted",
    },
    finalDeliverableReviewedBy: { type: String, default: "" },
    finalDeliverableReviewedAt: { type: Date },
    finalDeliverableReviewNote: { type: String, default: "" },
    comments: { type: [TaskCommentSchema], default: [] }
  },
  { timestamps: true }
);

TaskSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

export default mongoose.model("Task", TaskSchema);


export type UserRole = 'designer' | 'staff' | 'treasurer';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'clarification_required'
  | 'under_review'
  | 'completed';

export type TaskCategory =
  | 'banner'
  | 'campaign_or_others'
  | 'social_media_creative'
  | 'website_assets'
  | 'ui_ux'
  | 'led_backdrop'
  | 'brochure'
  | 'flyer';

export type TaskUrgency = 'low' | 'intermediate' | 'normal' | 'urgent';
export type RequestType = 'single_task' | 'campaign_request';
export type CollateralStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted_for_review'
  | 'approved'
  | 'rework'
  | 'completed';
export type CollateralPriority = 'low' | 'normal' | 'high' | 'critical';
export type CollateralSizeMode = 'preset' | 'custom';
export type CollateralOrientation = 'portrait' | 'landscape' | 'square' | 'custom';
export type CollateralUnit = 'px' | 'mm' | 'cm' | 'in' | 'ft';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type FinalDeliverableReviewStatus =
  | 'not_submitted'
  | 'pending'
  | 'approved'
  | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designerScope?: 'main' | 'junior';
  portalId?: string;
  avatar?: string;
  department?: string;
  phone?: string;
  notificationPreferences?: {
    emailNotifications: boolean;
    whatsappNotifications: boolean;
    deadlineReminders: boolean;
  };
}

export interface TaskComment {
  id: string;
  _id?: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole?: UserRole;
  content: string;
  parentId?: string;
  mentions?: UserRole[];
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  deletedByName?: string;
  receiverRoles?: UserRole[];
  seenBy?: CommentSeen[];
  reactions?: CommentReaction[];
  attachments?: TaskFile[];
}

export interface CommentSeen {
  role: UserRole;
  userId?: string;
  userName?: string;
  seenAt: Date;
}

export interface CommentReaction {
  emoji: string;
  userId: string;
  userName: string;
  userRole?: UserRole;
  createdAt: Date;
}

export interface TaskFile {
  id: string;
  name: string;
  url: string;
  driveId?: string;
  webViewLink?: string;
  webContentLink?: string;
  type: 'input' | 'output' | 'working';
  uploadedAt: Date;
  uploadedBy: string;
  size?: number;
  mime?: string;
  thumbnailUrl?: string;
}

export interface DesignVersion {
  id: string;
  name: string;
  url: string;
  version: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface FinalDeliverableFile {
  id: string;
  name: string;
  url: string;
  driveId?: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: number;
  mime?: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface FinalDeliverableAnnotationPoint {
  x: number;
  y: number;
}

export interface FinalDeliverableAnnotationStroke {
  id: string;
  color?: string;
  width?: number;
  points: FinalDeliverableAnnotationPoint[];
}

export type FinalDeliverableAnnotationShapeKind =
  | 'pen'
  | 'highlighter'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'blur_rect'
  | 'highlight_rect';

export interface FinalDeliverableAnnotationShape {
  id: string;
  kind: FinalDeliverableAnnotationShapeKind;
  color?: string;
  width?: number;
  opacity?: number;
  points?: FinalDeliverableAnnotationPoint[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  fillColor?: string;
}

export interface FinalDeliverableAnnotationThreadMessage {
  id: string;
  text: string;
  author?: string;
  createdAt?: string;
}

export interface FinalDeliverableAnnotationComment {
  id: string;
  x: number;
  y: number;
  text: string;
  thread?: FinalDeliverableAnnotationThreadMessage[];
}

export interface FinalDeliverableReviewAnnotation {
  id: string;
  fileId: string;
  fileName: string;
  fileUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  strokes?: FinalDeliverableAnnotationStroke[];
  shapes?: FinalDeliverableAnnotationShape[];
  comments?: FinalDeliverableAnnotationComment[];
  createdAt?: string;
  createdBy?: string;
}

export interface FinalDeliverableVersion {
  id: string;
  version: number;
  uploadedAt: Date;
  uploadedBy: string;
  note?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  reviewAnnotations?: FinalDeliverableReviewAnnotation[];
  files: FinalDeliverableFile[];
}

export interface CampaignRequestDetails {
  requestName: string;
  brief: string;
  deadlineMode: 'common' | 'itemized';
  commonDeadline?: Date;
}

export interface CollateralItem {
  id: string;
  title?: string;
  collateralType: string;
  presetCategory?: string;
  presetKey?: string;
  presetLabel?: string;
  sizeMode: CollateralSizeMode;
  width?: number;
  height?: number;
  unit?: CollateralUnit;
  sizeLabel?: string;
  ratioLabel?: string;
  customSizeLabel?: string;
  orientation: CollateralOrientation;
  platform?: string;
  usageType?: string;
  brief: string;
  deadline?: Date;
  priority: CollateralPriority;
  status: CollateralStatus;
  referenceFiles: TaskFile[];
  assignedToId?: string;
  assignedToName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Task {
  id: string;
  _id?: string;
  requestType?: RequestType;
  title: string;
  description: string;
  category: TaskCategory;
  urgency: TaskUrgency;
  status: TaskStatus;
  isEmergency?: boolean;
  emergencyApprovalStatus?: 'pending' | 'approved' | 'rejected';
  emergencyApprovedBy?: string;
  emergencyApprovedAt?: Date;
  emergencyRequestedAt?: Date;
  scheduleTaskId?: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterDepartment?: string;
  assignedTo?: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedDesignerEmail?: string;
  ccEmails?: string[];
  cc_emails?: string[];
  accessMode?: 'full' | 'view_only';
  viewOnly?: boolean;
  deadline: Date;
  proposedDeadline?: Date;
  deadlineApprovalStatus?: 'pending' | 'approved' | 'rejected';
  deadlineApprovedBy?: string;
  deadlineApprovedAt?: Date;
  isModification: boolean;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: Date;
  changeCount: number;
  changeHistory: TaskChange[];
  files: TaskFile[];
  designVersions?: DesignVersion[];
  activeDesignVersionId?: string;
  finalDeliverableVersions?: FinalDeliverableVersion[];
  finalDeliverableReviewStatus?: FinalDeliverableReviewStatus;
  finalDeliverableReviewedBy?: string;
  finalDeliverableReviewedAt?: Date;
  finalDeliverableReviewNote?: string;
  campaign?: CampaignRequestDetails;
  collaterals?: CollateralItem[];
  comments: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskChange {
  id: string;
  _id?: string;
  type: 'update' | 'file_added' | 'file_removed' | 'status';
  field: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  createdAt: Date;
}

export interface DashboardStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  urgentTasks: number;
  pendingApprovals: number;
}

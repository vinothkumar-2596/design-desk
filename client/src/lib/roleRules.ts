import type { Task, User, UserRole } from '@/types';
import { isMainDesigner } from '@/lib/designerAccess';

const normalizeRole = (value?: string | null) => String(value || '').trim().toLowerCase();
const normalizeAdminStatus = (value?: string | null) => {
  const normalized = normalizeRole(value);
  if (
    normalized === 'pending' ||
    normalized === 'needs_info' ||
    normalized === 'approved' ||
    normalized === 'rejected'
  ) {
    return normalized;
  }
  return '';
};

const getLatestApprovalStatusFromHistory = (
  task?: Pick<Task, 'changeHistory'> | null
) => {
  const entries = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  let latestStatus = '';
  let latestTime = 0;

  entries.forEach((entry) => {
    if (normalizeRole(entry?.field) !== 'approval_status') return;
    const createdAt = entry?.createdAt ? new Date(entry.createdAt).getTime() : 0;
    if (createdAt < latestTime) return;
    latestTime = createdAt;
    latestStatus = normalizeAdminStatus(entry?.newValue);
  });

  return latestStatus;
};

export const resolveAdminReviewStatus = (
  task?:
    | Pick<
        Task,
        | 'adminReviewStatus'
        | 'approvalStatus'
        | 'status'
        | 'assignedTo'
        | 'assignedToId'
        | 'assignedToName'
        | 'changeHistory'
      >
    | null
) => {
  const explicitStatus = normalizeAdminStatus(task?.adminReviewStatus);
  if (explicitStatus) return explicitStatus;

  const approvalStatus =
    normalizeAdminStatus(task?.approvalStatus) || getLatestApprovalStatusFromHistory(task);
  if (approvalStatus) return approvalStatus;

  const hasAssignedDesigner = Boolean(
    String(task?.assignedToId || task?.assignedTo || task?.assignedToName || '').trim()
  );
  const wasCreatedByStaff = (task?.changeHistory || []).some(
    (entry) => normalizeRole(entry?.field) === 'created' && normalizeRole(entry?.userRole) === 'staff'
  );

  if (wasCreatedByStaff && normalizeRole(task?.status) === 'pending' && !hasAssignedDesigner) {
    return 'pending';
  }

  return '';
};

export const resolveAdminReviewedAt = (
  task?: Pick<Task, 'adminReviewedAt' | 'approvalDate'> | null
) => task?.adminReviewedAt || task?.approvalDate || undefined;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  designer: 'Designer',
  staff: 'Staff',
  treasurer: 'Treasurer',
};

export const isAdminRole = (value?: Pick<User, 'role'> | UserRole | string | null) => {
  if (!value) return false;
  if (typeof value === 'string') return normalizeRole(value) === 'admin';
  return normalizeRole(value.role) === 'admin';
};

export const isDesignLeadRole = (user?: Pick<User, 'role' | 'designerScope' | 'email'> | null) =>
  Boolean(user && normalizeRole(user.role) === 'designer' && isMainDesigner(user));

export const isTaskAwaitingAdminReview = (
  task?:
    | Pick<
        Task,
        | 'adminReviewStatus'
        | 'approvalStatus'
        | 'status'
        | 'assignedTo'
        | 'assignedToId'
        | 'assignedToName'
        | 'changeHistory'
      >
    | null
) => {
  const status = resolveAdminReviewStatus(task);
  return status === 'pending' || status === 'needs_info';
};

export const getAllowedCommentReceiverRoles = (role?: UserRole | null): UserRole[] => {
  switch (role) {
    case 'admin':
      return ['staff', 'designer', 'treasurer'];
    case 'designer':
    case 'staff':
    case 'treasurer':
      return ['admin'];
    default:
      return ['admin'];
  }
};

export const getMentionTargetLabels = (role?: UserRole | null) =>
  getAllowedCommentReceiverRoles(role).map((receiverRole) => ROLE_LABELS[receiverRole]);

export const getModificationApprovalActorLabel = () => 'Design Lead';
export const getAdminReviewLabel = (status?: Task['adminReviewStatus']) => {
  switch (normalizeAdminStatus(status)) {
    case 'approved':
      return 'Admin Approved';
    case 'needs_info':
      return 'Need Info';
    case 'rejected':
      return 'Admin Rejected';
    case 'pending':
      return 'Awaiting Admin Review';
    default:
      return '';
  }
};

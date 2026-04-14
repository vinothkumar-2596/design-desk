import type { Task, User, UserRole } from '@/types';
import { isMainDesigner } from '@/lib/designerAccess';

const normalizeRole = (value?: string | null) => String(value || '').trim().toLowerCase();

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
  task?: Pick<Task, 'adminReviewStatus'> | null
) => {
  const status = normalizeRole(task?.adminReviewStatus);
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
  switch (status) {
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

import React, { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import {
  AlertCircle,
  Bell,
  Calendar,
  Download,
  FileText,
  HelpCircle,
  LayoutGrid,
  ListTodo,
  Paperclip,
  Search,
  User,
  Users,
  X,
  Sparkles,
  Database,
  Clock,
  Eye,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  UserPlus,
  BadgeCheck,
  Send,
  ArrowRight,
  CircleCheckBig,
  ClipboardCheck,
} from 'lucide-react';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { Link, useLocation } from 'react-router-dom';
import {
  clearScheduleNotifications,
  loadScheduleNotifications,
  SCHEDULE_NOTIFICATIONS_PREFIX,
} from '@/lib/designerSchedule';
import { useTasksContext } from '@/contexts/TasksContext';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useTheme } from 'next-themes';

import { API_URL, authFetch, getAuthToken } from '@/lib/api';
import {
  formatCollateralStatusLabel,
  getCollateralDisplayName,
  getCollateralSizeSummary,
} from '@/lib/campaignRequest';
import { getPreferredDesignerDisplayName, isMainDesigner } from '@/lib/designerAccess';
import { DESIGN_GOVERNANCE_NOTICE_COMPACT } from '@/lib/designGovernance';
import {
  getModificationApprovalActorLabel,
  isAdminRole,
} from '@/lib/roleRules';
import { createSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { GridSmallBackground } from '@/components/ui/background';
import { GlassCard } from 'react-glass-ui';
import { UnreadTaskNotificationsContext } from '@/contexts/UnreadTaskNotificationsContext';
import type { CollateralItem, RequestType, Task, TaskCategory, TaskStatus } from '@/types';

interface DashboardLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
  background?: ReactNode;
  hideGrid?: boolean;
  allowContentOverflow?: boolean;
  fitContentHeight?: boolean;
}

type NotificationItem = {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  linkState?: unknown;
  taskId?: string;
  createdAt: Date;
  readAt?: Date | null;
};

type NotificationEventKind =
  | 'request_submitted'
  | 'review_required'
  | 'task_assigned'
  | 'task_accepted'
  | 'clarification_required'
  | 'completed'
  | 'message'
  | 'general';

type NotificationUiItem = NotificationItem & {
  task?: Task;
  eventKind: NotificationEventKind;
  rowPreview: string;
  previewTitle: string;
  previewStatusLabel: string;
  previewTypeLabel: string;
  previewRequesterLabel: string;
  previewAssigneeLabel: string;
  previewDueLabel: string;
  previewSummary: string;
  previewUpdatedLabel: string;
  previewVisualLabel: string;
};

type GlobalViewer = {
  userId: string;
  userName: string;
  userRole?: string;
  userEmail?: string;
  lastSeenAt?: string;
  avatar?: string;
  isOnline?: boolean;
};

const EMAIL_SEND_PENDING_KEY = 'designhub:gmail-send-pending';
const EMAIL_SEND_PENDING_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const NOTIFICATION_PREVIEW_CARD_HEIGHT = 336;
const NOTIFICATION_PREVIEW_OFFSET = 12;

const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  clarification_required: 'Clarification Required',
  under_review: 'Under Review',
  completed: 'Completed',
};

const taskCategoryLabels: Record<TaskCategory, string> = {
  banner: 'Banner',
  campaign_or_others: 'Campaign or others',
  social_media_creative: 'Social Media Creative',
  website_assets: 'Website Assets',
  ui_ux: 'UI/UX',
  led_backdrop: 'LED Backdrop',
  brochure: 'Brochure',
  flyer: 'Flyer',
};

const requestTypeLabels: Record<RequestType, string> = {
  single_task: 'Single request',
  campaign_request: 'Campaign request',
};

const collapseNotificationText = (value?: string | null) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanNotificationTitle = (title?: string | null) =>
  collapseNotificationText(title)
    .replace(/\s*:\s*now$/i, '')
    .replace(/\s+now$/i, '');

const formatTaskStatusLabel = (status?: string | null) => {
  if (!status) return 'Open';
  const normalized = String(status).trim().toLowerCase().replace(/[\s-]+/g, '_') as TaskStatus;
  return taskStatusLabels[normalized] || collapseNotificationText(status);
};

const formatTaskCategoryLabel = (category?: string | null) => {
  if (!category) return '';
  const normalized = String(category).trim().toLowerCase().replace(/[\s-]+/g, '_') as TaskCategory;
  return taskCategoryLabels[normalized] || collapseNotificationText(category);
};

const formatTaskRequestTypeLabel = (requestType?: string | null) => {
  if (!requestType) return '';
  const normalized = String(requestType).trim().toLowerCase().replace(/[\s-]+/g, '_') as RequestType;
  return requestTypeLabels[normalized] || collapseNotificationText(requestType);
};

const formatTaskDueLabel = (deadline?: Date | string | null) => {
  if (!deadline) return 'Deadline not set';
  const parsed = deadline instanceof Date ? deadline : new Date(deadline);
  if (!Number.isFinite(parsed.getTime())) return 'Deadline not set';
  const dueDistance = formatDistanceToNow(parsed, { addSuffix: true });
  if (isToday(parsed)) return 'Due today';
  if (isPast(parsed)) return `Overdue by ${formatDistanceToNow(parsed)}`;
  return `Due ${dueDistance}`;
};

const humanizeNotificationValue = (value?: string | null, fallback = '-') => {
  const normalized = collapseNotificationText(value);
  if (!normalized) return fallback;
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatNotificationShortDate = (value?: Date | string | null, fallback = 'Not set') => {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fallback;
  return format(parsed, 'dd MMM yyyy');
};

const formatNotificationFileSize = (size?: number) => {
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) return '';
  const normalized = Number(size);
  if (normalized < 1024 * 1024) {
    return `${Math.max(1, Math.round(normalized / 1024))} KB`;
  }
  return `${(normalized / (1024 * 1024)).toFixed(1)} MB`;
};

const getNotificationCollateralStatusPillClass = (status?: string) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'completed':
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300';
    case 'in_progress':
    case 'submitted_for_review':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-300';
    case 'rework':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-300';
    default:
      return 'border-[#C9D7FF] bg-white text-[#3555A4] dark:border-white/10 dark:bg-white/5 dark:text-[#D6E2FF]';
  }
};

const getNotificationTaskStatusPillClass = (status?: string) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300';
    case 'in_progress':
    case 'accepted':
    case 'under_review':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-300';
    case 'clarification_required':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-300';
    default:
      return 'border-[#C9D7FF] bg-white text-[#3555A4] dark:border-white/10 dark:bg-white/5 dark:text-[#D6E2FF]';
  }
};

const NotificationSingleTaskSectionPreview = ({ task }: { task: Task }) => {
  const description =
    collapseNotificationText(task.description) || 'No request description added yet.';
  const files = Array.isArray(task.files) ? task.files.filter(Boolean) : [];
  const firstFile = files[0] || null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#FBFDFF] dark:bg-[linear-gradient(180deg,rgba(14,26,48,0.98),rgba(10,18,35,0.98))]">
      <div className="border-b border-[#E7EDF8] px-3 py-2.5 dark:border-[#243654]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.2em] text-[#7E8DAB] dark:text-[#8FA0C4]">
              Request Overview
            </p>
            <h4 className="mt-1 truncate text-[12.5px] font-semibold leading-snug text-[#215ABB] dark:text-[#D6E2FF]">
              {task.title}
            </h4>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[8.5px] font-semibold',
              getNotificationTaskStatusPillClass(task.status)
            )}
          >
            {formatTaskStatusLabel(task.status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-[#E7EDF8] dark:border-[#243654]">
        <div className="px-3 py-2">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-[#8FA0C4]">
            Category
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#1F2F4B] dark:text-[#F5F8FF]">
            {formatTaskCategoryLabel(task.category) || 'General'}
          </p>
        </div>
        <div className="border-l border-[#E7EDF8] px-3 py-2 dark:border-[#243654]">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-[#8FA0C4]">
            Priority
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#1F2F4B] dark:text-[#F5F8FF]">
            {humanizeNotificationValue(task.urgency, 'Normal')}
          </p>
        </div>
        <div className="border-t border-[#E7EDF8] px-3 py-2 dark:border-[#243654]">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-[#8FA0C4]">
            Delivery Target
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#1F2F4B] dark:text-[#F5F8FF]">
            {formatNotificationShortDate(task.deadline)}
          </p>
        </div>
        <div className="border-l border-t border-[#E7EDF8] px-3 py-2 dark:border-[#243654]">
          <p className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-[#8FA0C4]">
            Requested On
          </p>
          <p className="mt-1 text-[9px] font-semibold text-[#1F2F4B] dark:text-[#F5F8FF]">
            {formatNotificationShortDate(task.createdAt)}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 pr-2 scrollbar-thin">
        <p className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB] dark:text-[#8FA0C4]">
          Description
        </p>
        <p className="mt-1.5 text-[8.5px] leading-4 text-[#536482] dark:text-[#C4D0EA]">
          {description}
        </p>

        <div className="mt-2">
          <div className="flex items-center justify-between gap-2 text-[7.5px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB] dark:text-[#8FA0C4]">
            <span>References</span>
            <span>
              {files.length} file{files.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-1 rounded-[12px] border border-[#E4ECFB] bg-white px-2.5 py-2 dark:border-[#243654] dark:bg-white/5">
            {firstFile ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[8.5px] font-medium text-[#1E2E52] dark:text-[#F5F8FF]">
                    {firstFile.name}
                  </p>
                  <p className="mt-0.5 text-[7.5px] text-[#7A8AA9] dark:text-[#91A3C5]">
                    {formatNotificationFileSize(firstFile.size) || 'Attachment available'}
                  </p>
                </div>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#D7E4FF] bg-[#F5F8FF] text-[#5270C7] dark:border-white/10 dark:bg-white/5 dark:text-[#B8CBFF]">
                  <Paperclip className="h-2.5 w-2.5" />
                </span>
              </div>
            ) : (
              <p className="text-[8.5px] text-[#536482] dark:text-[#C4D0EA]">
                No reference files attached yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NotificationCampaignSectionPreview = ({ task }: { task: Task }) => {
  const collateralItems = Array.isArray(task.collaterals) ? task.collaterals.filter(Boolean) : [];
  const visibleItems = collateralItems.slice(0, 2);
  const selectedCollateral =
    visibleItems[0] || collateralItems[0] || null;
  const overallBrief =
    collapseNotificationText(task.campaign?.brief) ||
    collapseNotificationText(task.description) ||
    'No request brief was included.';
  const selectedDeadline = selectedCollateral?.deadline || task.deadline;
  const selectedReferenceCount = selectedCollateral?.referenceFiles?.length || 0;
  const firstReference = selectedCollateral?.referenceFiles?.[0] || null;
  const selectedTypeLine = [
    selectedCollateral?.collateralType,
    selectedCollateral?.usageType,
    getCollateralSizeSummary((selectedCollateral || {}) as Partial<CollateralItem>),
  ]
    .map((value) => collapseNotificationText(value))
    .filter(Boolean)
    .join(' | ');

  if (!selectedCollateral) return null;

  return (
    <div className="h-full overflow-hidden bg-[#FBFDFF] dark:bg-[linear-gradient(180deg,rgba(14,26,48,0.98),rgba(10,18,35,0.98))]">
      <div className="grid h-full grid-cols-[108px_minmax(0,1fr)]">
        <div className="border-r border-[#DCE7FB] bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(240,246,255,0.86))] px-2.5 py-2.5 dark:border-[#243654] dark:bg-[linear-gradient(180deg,rgba(17,30,56,0.94),rgba(13,24,46,0.94))]">
          <p className="text-[7px] font-semibold uppercase tracking-[0.22em] text-[#7E8DAB] dark:text-[#8FA0C4]">
            Collateral Flow
          </p>
          <p className="mt-1 text-[8px] leading-3.5 text-[#6B7C9F] line-clamp-3 dark:text-[#91A3C5]">
            Select an item to review its brief, references, and delivery specs.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {visibleItems.map((item, index) => {
              const isActive = item.id === selectedCollateral.id;
              return (
                <div
                  key={item.id || `preview-collateral-${index}`}
                  className={cn(
                    'rounded-[12px] border px-2 py-2',
                    isActive
                      ? 'border-[#8FB0FF] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(235,243,255,0.94))] shadow-[0_12px_28px_-24px_rgba(54,90,187,0.65)] dark:border-[#36508E] dark:bg-[linear-gradient(135deg,rgba(23,40,74,0.96),rgba(18,32,61,0.94))]'
                      : 'border-[#D9E6FF] bg-white/75 dark:border-white/10 dark:bg-white/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold',
                        isActive
                          ? 'bg-[#3366E8] text-white'
                          : 'border border-[#D7E4FF] bg-[#F7FAFF] text-[#5270C7] dark:border-white/10 dark:bg-white/5 dark:text-[#B8CBFF]'
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="truncate text-[8.5px] font-semibold text-[#203254] dark:text-[#F5F8FF]">
                          {getCollateralDisplayName(item as Partial<CollateralItem>)}
                        </p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] font-semibold',
                            getNotificationCollateralStatusPillClass(item.status)
                          )}
                        >
                          {formatCollateralStatusLabel(item.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[7.5px] text-[#7A8AA9] dark:text-[#91A3C5]">
                        {[
                          humanizeNotificationValue(item.collateralType, ''),
                          getCollateralSizeSummary(item as Partial<CollateralItem>),
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[7px] text-[#7A8AA9] dark:text-[#91A3C5]">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatNotificationShortDate(item.deadline)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-2.5 w-2.5" />
                          {item.referenceFiles?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3">
          <div className="border-b border-[#E6EEF9] pb-2.5 dark:border-[#243654]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-[13px] font-semibold text-[#18315F] dark:text-[#F5F8FF]">
                  {getCollateralDisplayName(selectedCollateral as Partial<CollateralItem>)}
                </h4>
                <p className="mt-0.5 truncate text-[8.5px] text-[#7383A3] dark:text-[#91A3C5]">
                  {selectedTypeLine || 'No specs added yet.'}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold',
                  getNotificationCollateralStatusPillClass(selectedCollateral.status)
                )}
              >
                {formatCollateralStatusLabel(selectedCollateral.status)}
              </span>
            </div>
            <p className="mt-1.5 text-[8px] text-[#617291] dark:text-[#91A3C5]">
              {`Deadline: ${formatNotificationShortDate(selectedDeadline)} | Progress: ${formatCollateralStatusLabel(selectedCollateral.status)}${selectedCollateral.assignedToName ? ` | Owner: ${selectedCollateral.assignedToName}` : ''}`}
            </p>
          </div>

          <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_106px] gap-3">
            <div className="space-y-2.5">
              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB] dark:text-[#8FA0C4]">
                  Overall Brief
                </p>
                <div className="mt-1 border-t border-[#E7EDF8] pt-1.5 text-[8px] leading-3.5 text-[#536482] line-clamp-3 dark:border-[#243654] dark:text-[#C4D0EA]">
                  {overallBrief}
                </div>
              </div>

              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB] dark:text-[#8FA0C4]">
                  Content Brief
                </p>
                <div className="mt-1 border-t border-[#E7EDF8] pt-1.5 text-[8px] leading-3.5 text-[#536482] line-clamp-3 dark:border-[#243654] dark:text-[#C4D0EA]">
                  {collapseNotificationText(selectedCollateral.brief) ||
                    'No collateral-specific brief was added for this item.'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 text-[7px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB] dark:text-[#8FA0C4]">
                  <span>References</span>
                  <span>
                    {selectedReferenceCount} file{selectedReferenceCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-1 rounded-[12px] border border-[#E4ECFB] bg-white px-2.5 py-2 text-[#536482] dark:border-[#243654] dark:bg-white/5 dark:text-[#C4D0EA]">
                  {firstReference ? (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[8px] font-medium text-[#1E2E52] dark:text-[#F5F8FF]">
                          {firstReference.name}
                        </p>
                        <p className="mt-0.5 text-[7px] text-[#7A8AA9] dark:text-[#91A3C5]">
                          {formatNotificationFileSize(firstReference.size) || `${selectedReferenceCount} file attached`}
                        </p>
                      </div>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#D7E4FF] bg-[#F5F8FF] text-[#5270C7] dark:border-white/10 dark:bg-white/5 dark:text-[#B8CBFF]">
                        <Eye className="h-2.5 w-2.5" />
                      </span>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#D7E4FF] bg-[#F5F8FF] text-[#5270C7] dark:border-white/10 dark:bg-white/5 dark:text-[#B8CBFF]">
                        <Download className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  ) : (
                    <p className="text-[8px]">
                      No reference files attached yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB] dark:text-[#8FA0C4]">
                  Specifications
                </p>
                <div className="mt-1 space-y-1 border-t border-[#E7EDF8] pt-1.5 text-[8px] text-[#536482] dark:border-[#243654] dark:text-[#C4D0EA]">
                  <div className="flex items-center justify-between gap-2"><span>Platform</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{selectedCollateral.platform || '—'}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>Usage</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{selectedCollateral.usageType || humanizeNotificationValue(selectedCollateral.collateralType)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>Size</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{getCollateralSizeSummary(selectedCollateral as Partial<CollateralItem>) || '—'}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>Orientation</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{humanizeNotificationValue(selectedCollateral.orientation)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>Priority</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{humanizeNotificationValue(selectedCollateral.priority, 'Normal')}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>Owner</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{selectedCollateral.assignedToName || task.assignedToName || 'Unassigned'}</span></div>
                </div>
              </div>

              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB] dark:text-[#8FA0C4]">
                  Delivery
                </p>
                <div className="mt-1 space-y-1 border-t border-[#E7EDF8] pt-1.5 text-[8px] text-[#536482] dark:border-[#243654] dark:text-[#C4D0EA]">
                  <div className="flex items-center justify-between gap-2"><span>Deadline</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{formatNotificationShortDate(selectedDeadline)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>References</span><span className="text-right font-medium text-[#1E2E52] dark:text-[#F5F8FF]">{selectedReferenceCount} file{selectedReferenceCount === 1 ? '' : 's'}</span></div>
                </div>
              </div>

              <div>
                <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB] dark:text-[#8FA0C4]">
                  Status
                </p>
                <div className="mt-1 rounded-full border border-[#C9D7FF] bg-white px-2.5 py-1 text-[8px] font-semibold text-[#1E2E52] dark:border-white/10 dark:bg-white/5 dark:text-[#F5F8FF]">
                  {formatCollateralStatusLabel(selectedCollateral.status)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getNotificationPreviewSummary = (entry: NotificationItem, task?: Task) => {
  const explicitMessage = collapseNotificationText(entry.message);
  if (explicitMessage) return explicitMessage;

  const latestComment = [...(task?.comments || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )[0];
  if (latestComment?.content) {
    return collapseNotificationText(latestComment.content);
  }

  const latestChange = [...(task?.changeHistory || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )[0];
  if (latestChange?.note) {
    return collapseNotificationText(latestChange.note);
  }

  const description = collapseNotificationText(task?.description);
  if (description) return description;

  return 'Open this task to review the latest activity.';
};

const resolveNotificationEventKind = (entry: NotificationItem, task?: Task): NotificationEventKind => {
  const title = cleanNotificationTitle(entry.title).toLowerCase();
  const message = collapseNotificationText(entry.message).toLowerCase();
  const type = collapseNotificationText(entry.type).toLowerCase();
  const content = `${title} ${message} ${type}`;

  if (content.includes('clarification required')) return 'clarification_required';
  if (content.includes('review required') || content.includes('under review')) return 'review_required';
  if (content.includes('task assigned') || content.includes('assigned this task')) return 'task_assigned';
  if (content.includes('task accepted') || content.includes('accepted this task')) return 'task_accepted';
  if (
    content.includes('task completed') ||
    content.includes('final files approved') ||
    content.includes('approved the final deliverables') ||
    content.includes('marked this task as completed')
  ) {
    return 'completed';
  }
  if (
    content.includes('new request') ||
    content.includes('request created') ||
    content.includes('request submitted') ||
    content.includes('submitted by')
  ) {
    return 'request_submitted';
  }
  if (content.includes('message') || content.includes('comment')) return 'message';

  if (task?.status === 'clarification_required') return 'clarification_required';
  if (task?.status === 'under_review') return 'review_required';
  if (task?.status === 'completed') return 'completed';

  return 'general';
};

const getNotificationIconConfig = (
  eventKind: NotificationEventKind
): { Icon: React.ElementType; containerClassName: string; iconClassName: string } => {
  switch (eventKind) {
    case 'request_submitted':
      return {
        Icon: ClipboardCheck,
        containerClassName: 'bg-[#EEF4FF] dark:bg-[#1A2748]',
        iconClassName: 'text-[#4562B2] dark:text-[#B8CBFF]',
      };
    case 'review_required':
      return {
        Icon: AlertCircle,
        containerClassName: 'bg-[#FFF3EC] dark:bg-[#3C2513]',
        iconClassName: 'text-[#D9722D] dark:text-[#FDBA74]',
      };
    case 'task_assigned':
      return {
        Icon: UserPlus,
        containerClassName: 'bg-[#EEF2FF] dark:bg-[#1E2550]',
        iconClassName: 'text-[#5A67D8] dark:text-[#C7D2FE]',
      };
    case 'task_accepted':
      return {
        Icon: CheckCircle2,
        containerClassName: 'bg-[#ECFDF3] dark:bg-[#142C22]',
        iconClassName: 'text-[#1F9D61] dark:text-[#86EFAC]',
      };
    case 'clarification_required':
      return {
        Icon: AlertTriangle,
        containerClassName: 'bg-[#FFF7E8] dark:bg-[#3A2B0C]',
        iconClassName: 'text-[#D79523] dark:text-[#FCD34D]',
      };
    case 'completed':
      return {
        Icon: CircleCheckBig,
        containerClassName: 'bg-[#ECFDF3] dark:bg-[#142C22]',
        iconClassName: 'text-[#17905E] dark:text-[#86EFAC]',
      };
    case 'message':
      return {
        Icon: MessageSquare,
        containerClassName: 'bg-[#EEF7FF] dark:bg-[#14283C]',
        iconClassName: 'text-[#3182CE] dark:text-[#93C5FD]',
      };
    default:
      return {
        Icon: FileText,
        containerClassName: 'bg-slate-100 dark:bg-slate-800',
        iconClassName: 'text-slate-500 dark:text-slate-300',
      };
  }
};

const formatViewerLastSeenLabel = (lastSeenAt?: string) => {
  if (!lastSeenAt) return 'Unavailable';
  const parsed = new Date(lastSeenAt);
  if (!Number.isFinite(parsed.getTime())) return 'Unavailable';
  return `Last seen ${formatDistanceToNow(parsed, { addSuffix: true })}`;
};

const formatViewerLastSeenExact = (lastSeenAt?: string) => {
  if (!lastSeenAt) return '';
  const parsed = new Date(lastSeenAt);
  if (!Number.isFinite(parsed.getTime())) return '';
  return format(parsed, 'MMM d, h:mm a');
};

export function DashboardLayout({
  children,
  headerActions,
  background,
  hideGrid = false,
  allowContentOverflow = false,
  fitContentHeight = false,
}: DashboardLayoutProps) {
  const { isAuthenticated, user } = useAuth();
  const { tasks: hydratedTasks } = useTasksContext();
  const apiUrl = API_URL;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [serverNotifications, setServerNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalViewers, setGlobalViewers] = useState<GlobalViewer[]>([]);
  const [globalTypers, setGlobalTypers] = useState<GlobalViewer[]>([]);
  const [localSelfTyping, setLocalSelfTyping] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const autoPreviewShownRef = useRef(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationHoverPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const lastFetchedAtRef = useRef<string | null>(null);
  const notificationsSocketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const notificationRateLimitedUntilRef = useRef(0);
  const notificationsFetchInFlightRef = useRef(false);
  const unreadCountFetchInFlightRef = useRef(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localSelfTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const userId = user?.id || (user as { _id?: string } | null)?._id || '';
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const isStaffUser = user?.role === 'staff';
  const isMainDesignerUser = isMainDesigner(user);
  const useServerNotifications = Boolean(apiUrl);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const [canUseNotificationHoverPreview, setCanUseNotificationHoverPreview] = useState(false);
  const [activeNotificationPreviewId, setActiveNotificationPreviewId] = useState<string | null>(null);
  const [notificationPreviewTop, setNotificationPreviewTop] = useState(NOTIFICATION_PREVIEW_OFFSET);
  const notificationPreviewCardRef = useRef<HTMLDivElement | null>(null);
  const notificationPreviewAnchorTopRef = useRef(NOTIFICATION_PREVIEW_OFFSET);
  const [notificationTaskCache, setNotificationTaskCache] = useState<Record<string, Task>>({});
  const notificationTaskFetchInFlightRef = useRef<Set<string>>(new Set());

  const isCurrentUserViewer = useCallback(
    (viewer?: GlobalViewer | null) => {
      if (!viewer) return false;
      const viewerId = String(viewer.userId || '').trim();
      const viewerEmail = String(viewer.userEmail || '').trim().toLowerCase();
      if (userId && viewerId === userId) return true;
      if (userEmail && viewerEmail && viewerEmail === userEmail) return true;
      if (userEmail && viewerId && viewerId.toLowerCase() === userEmail) return true;
      return false;
    },
    [userEmail, userId]
  );

  const getViewerRoleLabel = useCallback(
    (viewer?: GlobalViewer | null) => {
      const normalizedRole = String(viewer?.userRole || '').trim().toLowerCase();
      if (!normalizedRole) return 'User';
      if (normalizedRole !== 'designer') {
        return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
      }

      const viewerId = String(viewer?.userId || '').trim();
      const viewerEmail = String(viewer?.userEmail || '').trim().toLowerCase();
      const isSelf = Boolean(
        (userId && viewerId === userId) ||
        (userEmail && viewerEmail && viewerEmail === userEmail) ||
        (userEmail && viewerId && viewerId.toLowerCase() === userEmail)
      );

      if (
        isSelf
          ? isMainDesignerUser
          : isMainDesigner({
              role: 'designer',
              email: viewerEmail || undefined,
            })
      ) {
        return 'Design Lead';
      }

      return 'Designer';
    },
    [isMainDesignerUser, userEmail, userId]
  );

  const getViewerDisplayName = useCallback(
    (viewer?: GlobalViewer | null) => {
      const fallbackName = String(viewer?.userName || '').trim() || 'Someone';
      if (!viewer) return fallbackName;

      const isSelf = isCurrentUserViewer(viewer);
      return (
        getPreferredDesignerDisplayName({
          role: isSelf ? user?.role : viewer.userRole,
          email: isSelf ? user?.email : viewer.userEmail,
          designerScope: isSelf ? user?.designerScope : undefined,
          name: isSelf ? user?.name || viewer.userName : viewer.userName,
        }) || fallbackName
      );
    },
    [isCurrentUserViewer, user]
  );


  const normalizeNotification = useCallback((entry: any): NotificationItem => {
    const createdAt = entry?.createdAt ? new Date(entry.createdAt) : new Date();
    const readAt = entry?.readAt ? new Date(entry.readAt) : null;
    const rawLink = entry?.link || '';
    const rawTaskId = entry?.taskId || entry?.taskID || entry?.task_id || '';
    let normalizedLink = rawLink;
    if (normalizedLink && normalizedLink.startsWith('http')) {
      try {
        const url = new URL(normalizedLink);
        normalizedLink = `${url.pathname}${url.search}${url.hash}`;
      } catch {
        // ignore invalid URL
      }
    }
    const inferredTaskId =
      rawTaskId ||
      ((normalizedLink.startsWith('/task/') || normalizedLink.startsWith('/tasks/'))
        ? normalizedLink.replace('/tasks/', '').replace('/task/', '').split(/[?#]/)[0]
        : '');
    const resolvedLink = normalizedLink || (inferredTaskId ? `/task/${inferredTaskId}` : '');
    return {
      id: entry?.id || entry?._id || `${entry?.userId || 'note'}-${createdAt.getTime()}`,
      userId: entry?.userId,
      title: entry?.title || 'Notification',
      message: entry?.message || '',
      type: entry?.type || 'system',
      link: resolvedLink,
      taskId: inferredTaskId || undefined,
      createdAt,
      readAt,
    };
  }, []);

  const updateLastFetchedAt = useCallback((items: NotificationItem[]) => {
    if (!items || items.length === 0) return;
    const latest = items.reduce((max, item) => {
      const time = new Date(item.createdAt).getTime();
      return time > max ? time : max;
    }, lastFetchedAtRef.current ? new Date(lastFetchedAtRef.current).getTime() : 0);
    if (Number.isFinite(latest) && latest > 0) {
      lastFetchedAtRef.current = new Date(latest).toISOString();
    }
  }, []);

  const mergeNotifications = useCallback((incoming: NotificationItem[], limit = 20) => {
    if (!incoming || incoming.length === 0) return;
    setServerNotifications((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      incoming.forEach((item) => {
        map.set(item.id, item);
      });
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return merged.slice(0, limit);
    });
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!apiUrl || !userId) return;
    if (Date.now() < notificationRateLimitedUntilRef.current) return;
    if (unreadCountFetchInFlightRef.current) return;
    unreadCountFetchInFlightRef.current = true;
    try {
      const response = await authFetch(`${apiUrl}/api/notifications/unread-count`);
      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get('retry-after') || 10);
        notificationRateLimitedUntilRef.current = Date.now() + retryAfterSeconds * 1000;
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCount(Number(data?.count || 0));
    } catch (error) {
      console.error('Notification unread count failed:', error);
    } finally {
      unreadCountFetchInFlightRef.current = false;
    }
  }, [apiUrl, userId]);

  const fetchNotifications = useCallback(
    async (after?: string | null) => {
      if (!apiUrl || !userId) return;
      if (Date.now() < notificationRateLimitedUntilRef.current) return;
      if (notificationsFetchInFlightRef.current) return;
      notificationsFetchInFlightRef.current = true;
      try {
        const params = new URLSearchParams();
        if (after) params.set('after', after);
        params.set('limit', '20');
        const response = await authFetch(`${apiUrl}/api/notifications?${params.toString()}`);
        if (response.status === 429) {
          const retryAfterSeconds = Number(response.headers.get('retry-after') || 10);
          notificationRateLimitedUntilRef.current = Date.now() + retryAfterSeconds * 1000;
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data)) return;
        const normalized = data.map(normalizeNotification);
        if (after) {
          mergeNotifications(normalized);
          const newUnread = normalized.filter((item) => !item.readAt).length;
          if (newUnread > 0) {
            setUnreadCount((prev) => prev + newUnread);
          }
        } else {
          setServerNotifications(normalized);
          setUnreadCount(normalized.filter((item) => !item.readAt).length);
        }
        updateLastFetchedAt(normalized);
      } catch (error) {
        console.error('Notification fetch failed:', error);
      } finally {
        notificationsFetchInFlightRef.current = false;
      }
    },
    [apiUrl, userId, mergeNotifications, normalizeNotification, updateLastFetchedAt]
  );

  const markNotificationRead = useCallback(
    async (note: NotificationItem) => {
      if (!useServerNotifications || !apiUrl || !note.id || note.readAt) return;
      const readAt = new Date();
      setServerNotifications((prev) =>
        prev.map((item) => (item.id === note.id ? { ...item, readAt } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await authFetch(`${apiUrl}/api/notifications/${note.id}/read`, {
          method: 'PATCH',
        });
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
    },
    [apiUrl, useServerNotifications]
  );

  const markTaskRead = useCallback(
    (taskId: string) => {
      if (!taskId) return;
      const toMark = serverNotifications.filter(
        (n) => String(n.taskId || '').trim() === taskId && !n.readAt
      );
      if (toMark.length === 0) return;
      const readAt = new Date();
      setServerNotifications((prev) =>
        prev.map((item) =>
          String(item.taskId || '').trim() === taskId && !item.readAt
            ? { ...item, readAt }
            : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - toMark.length));
      if (useServerNotifications && apiUrl) {
        toMark.forEach((n) => {
          if (n.id) {
            authFetch(`${apiUrl}/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
          }
        });
      }
    },
    [serverNotifications, apiUrl, useServerNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!useServerNotifications || !apiUrl || unreadCount === 0) return;
    const readAt = new Date();
    setServerNotifications((prev) => prev.map((item) => ({ ...item, readAt })));
    setUnreadCount(0);
    try {
      await authFetch(`${apiUrl}/api/notifications/mark-all-read`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  }, [apiUrl, unreadCount, useServerNotifications]);

  useEffect(() => {
    if (!user) return;
    const emitNotifications = () => {
      const notifications = loadScheduleNotifications(user.id);
      if (notifications.length === 0) return;
      notifications.forEach((note) => {
        toast.message(note.message, {
          description: format(note.createdAt, 'MMM d, h:mm a'),
        });
      });
      clearScheduleNotifications(user.id);
    };
    emitNotifications();
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (!event.key.startsWith(SCHEDULE_NOTIFICATIONS_PREFIX)) return;
      emitNotifications();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;

    const handleSelfTyping = (event: Event) => {
      const detail = (event as CustomEvent<{ isTyping?: boolean; userId?: string }>).detail;
      const sourceUserId = String(detail?.userId || '');
      if (sourceUserId && sourceUserId !== userId) return;

      const isTyping = Boolean(detail?.isTyping);
      setLocalSelfTyping(isTyping);

      if (localSelfTypingTimeoutRef.current) {
        clearTimeout(localSelfTypingTimeoutRef.current);
        localSelfTypingTimeoutRef.current = null;
      }

      if (isTyping) {
        localSelfTypingTimeoutRef.current = setTimeout(() => {
          setLocalSelfTyping(false);
          localSelfTypingTimeoutRef.current = null;
        }, 1600);
      }
    };

    window.addEventListener('designhub:self-typing', handleSelfTyping as EventListener);
    return () => {
      window.removeEventListener('designhub:self-typing', handleSelfTyping as EventListener);
      if (localSelfTypingTimeoutRef.current) {
        clearTimeout(localSelfTypingTimeoutRef.current);
        localSelfTypingTimeoutRef.current = null;
      }
    };
  }, [userId]);

  const consumePendingEmailSendFlag = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const raw = window.localStorage.getItem(EMAIL_SEND_PENDING_KEY);
    if (!raw) return false;

    let openedAt = 0;
    try {
      const parsed = JSON.parse(raw);
      openedAt = Number(parsed?.openedAt || 0);
    } catch {
      openedAt = Number(raw) || 0;
    }

    if (openedAt) {
      const ageMs = Date.now() - openedAt;
      if (ageMs > EMAIL_SEND_PENDING_MAX_AGE_MS) {
        window.localStorage.removeItem(EMAIL_SEND_PENDING_KEY);
        return false;
      }
    }

    window.localStorage.removeItem(EMAIL_SEND_PENDING_KEY);
    return true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!consumePendingEmailSendFlag()) return;
    // intentionally no UI after returning from Gmail
  }, [consumePendingEmailSendFlag]);

  useEffect(() => {
    if (!apiUrl || !userId) {
      setServerNotifications([]);
      setUnreadCount(0);
      lastFetchedAtRef.current = null;
      return;
    }
    lastFetchedAtRef.current = null;
    fetchNotifications(null);
    fetchUnreadCount();
  }, [apiUrl, userId, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!apiUrl || !userId) return;
    const socket = createSocket(apiUrl);
    notificationsSocketRef.current = socket;

    const handleConnect = () => {
      setIsRealtimeConnected(true);
      console.log('Socket connected');
      socket.emit('join', { userId });
      console.log('Joined room', userId);
      if (user?.email) {
        socket.emit('join', { userId: user.email });
        console.log('Joined room', user.email);
      }
      if (isMainDesigner(user)) {
        socket.emit('join', { userId: 'designers:queue' });
        console.log('Joined room designers:queue');
      }
      socket.emit('presence:global:join', {
        userId,
        userName: user?.name,
        userRole: user?.role,
        userEmail: user?.email,
        avatar: user?.avatar,
      });
      socket.emit('notifications:join', { userId });
      fetchNotifications(lastFetchedAtRef.current);
      fetchUnreadCount();
    };

    const handleDisconnect = () => {
      setIsRealtimeConnected(false);
      setGlobalViewers([]);
      setGlobalTypers([]);
    };

    const handleNewNotification = (payload: any) => {
      const normalized = normalizeNotification(payload);
      mergeNotifications([normalized]);
      if (!normalized.readAt) {
        setUnreadCount((prev) => prev + 1);
      }
      updateLastFetchedAt([normalized]);
    };

    const handleNewRequest = (payload: any) => {
      console.log('Received request:new');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('designhub:request:new', { detail: payload }));
      }
    };

    const handleTaskUpdated = (payload: any) => {
      if (!payload?.task) return;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('designhub:task:updated', { detail: payload.task }));
      }
    };

    const handleGlobalPresenceUpdate = (payload: any) => {
      const viewers = Array.isArray(payload?.viewers) ? payload.viewers : [];
      setGlobalViewers(
        viewers.map((viewer: any) => ({
          userId: viewer.userId,
          userName: viewer.userName || 'Someone',
          userRole: viewer.userRole,
          userEmail: viewer.userEmail,
          avatar: viewer.avatar || (viewer.userId === userId ? user?.avatar : undefined),
          isOnline: viewer.isOnline !== false,
          lastSeenAt: viewer.lastSeenAt,
        }))
      );
    };

    const handleGlobalTypingUpdate = (payload: any) => {
      const typers = Array.isArray(payload?.typers) ? payload.typers : [];
      setGlobalTypers(
        typers.map((viewer: any) => ({
          userId: viewer.userId,
          userName: viewer.userName || 'Someone',
          userRole: viewer.userRole,
          userEmail: viewer.userEmail,
          avatar: viewer.avatar || (viewer.userId === userId ? user?.avatar : undefined),
          lastSeenAt: viewer.lastTypingAt,
        }))
      );
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notification:new', handleNewNotification);
    socket.on('request:new', handleNewRequest);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('presence:global:update', handleGlobalPresenceUpdate);
    socket.on('typing:global:update', handleGlobalTypingUpdate);

    return () => {
      socket.emit('presence:global:leave', { userId });
      socket.emit('notifications:leave', { userId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNewNotification);
      socket.off('request:new', handleNewRequest);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('presence:global:update', handleGlobalPresenceUpdate);
      socket.off('typing:global:update', handleGlobalTypingUpdate);
      socket.disconnect();
      notificationsSocketRef.current = null;
      setIsRealtimeConnected(false);
    };
  }, [
    apiUrl,
    userId,
    user?.email,
    user?.name,
    user?.role,
    user?.avatar,
    fetchNotifications,
    fetchUnreadCount,
    mergeNotifications,
    normalizeNotification,
    updateLastFetchedAt,
  ]);

  useEffect(() => {
    if (!isRealtimeConnected || !notificationsSocketRef.current || !userId) return;
    notificationsSocketRef.current.emit('presence:global:join', {
      userId,
      userName: user?.name,
      userRole: user?.role,
      userEmail: user?.email,
      avatar: user?.avatar,
    });
  }, [isRealtimeConnected, userId, user?.name, user?.role, user?.email, user?.avatar]);

  useEffect(() => {
    if (!apiUrl || !userId || isRealtimeConnected) return;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(() => {
      fetchNotifications(lastFetchedAtRef.current);
    }, 30000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [apiUrl, userId, isRealtimeConnected, fetchNotifications]);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!contentScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);


  const taskIndex = useMemo(() => {
    const byId = new Map<string, Task>();
    const byTitle = new Map<string, Task>();
    hydratedTasks.forEach((task) => {
      const id = String(task?.id || task?._id || '').trim();
      if (id) {
        byId.set(id, task);
      }
      const title = String(task?.title || '').trim();
      if (title) {
        const key = title.toLowerCase();
        if (!byTitle.has(key)) {
          byTitle.set(key, task);
        }
      }
    });
    return { byId, byTitle };
  }, [hydratedTasks]);

  const notificationTaskIndex = useMemo(() => {
    const byId = new Map<string, Task>();
    Object.entries(notificationTaskCache).forEach(([id, task]) => {
      if (id) byId.set(id, task);
    });
    return byId;
  }, [notificationTaskCache]);

  const globalPresenceList = useMemo(() => {
    const list = [...globalViewers];
    list.sort((a, b) => {
      if (isCurrentUserViewer(a)) return -1;
      if (isCurrentUserViewer(b)) return 1;
      if (Boolean(a.isOnline) !== Boolean(b.isOnline)) return a.isOnline ? -1 : 1;
      const aTime = new Date(a.lastSeenAt || 0).getTime();
      const bTime = new Date(b.lastSeenAt || 0).getTime();
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return bTime - aTime;
      }
      return (a.userName || '').localeCompare(b.userName || '');
    });
    return list;
  }, [globalViewers, isCurrentUserViewer]);

  const globalPresenceSummary = useMemo(() => {
    const visible = globalPresenceList.slice(0, 4);
    const onlineCount = globalPresenceList.filter((viewer) => viewer.isOnline).length;
    return {
      visible,
      extraCount: Math.max(0, globalPresenceList.length - visible.length),
      onlineCount,
      total: globalPresenceList.length,
    };
  }, [globalPresenceList]);

  const globalTypingList = useMemo(() => {
    const list = [...globalTypers].filter(
      (viewer) => !isCurrentUserViewer(viewer) || localSelfTyping
    );
    if (localSelfTyping) {
      const alreadyHasSelf = list.some((viewer) => isCurrentUserViewer(viewer));
      if (!alreadyHasSelf) {
        list.unshift({
          userId: userId || userEmail || 'self',
          userName: user?.name || 'You',
          userRole: user?.role,
          userEmail: user?.email,
          avatar: user?.avatar,
          lastSeenAt: new Date().toISOString(),
        });
      }
    }
    list.sort((a, b) => {
      if (isCurrentUserViewer(a)) return -1;
      if (isCurrentUserViewer(b)) return 1;
      return (a.userName || '').localeCompare(b.userName || '');
    });
    return list;
  }, [
    globalTypers,
    isCurrentUserViewer,
    localSelfTyping,
    user?.avatar,
    user?.email,
    user?.name,
    user?.role,
    userEmail,
    userId,
  ]);

  const globalTypingSummary = useMemo(() => {
    const visible = globalTypingList.slice(0, 4);
    return {
      visible,
      extraCount: Math.max(0, globalTypingList.length - visible.length),
      total: globalTypingList.length,
    };
  }, [globalTypingList]);

  const extractTitleFromNotification = useCallback((title: string) => {
    if (!title) return '';
    const colonIndex = title.indexOf(':');
    if (colonIndex >= 0 && colonIndex < title.length - 1) {
      return title.slice(colonIndex + 1).trim();
    }
    const onMatch = title.match(/message on\s(.+)$/i);
    if (onMatch && onMatch[1]) {
      return onMatch[1].trim();
    }
    return '';
  }, []);

  const resolveNotificationTarget = useCallback(
    (entry: NotificationItem) => {
      let link = entry.link || '';
      let taskId = entry.taskId || '';
      if (link && !link.startsWith('/') && !link.startsWith('http')) {
        link = `/${link}`;
      }
      if (!taskId && link) {
        const match = link.match(/\/tasks?\/([^/?#]+)/);
        if (match && match[1]) {
          taskId = match[1];
        }
      }
      let task = entry.task || (taskId ? taskIndex.byId.get(taskId) || notificationTaskIndex.get(taskId) : undefined);
      if (!task) {
        const candidate = extractTitleFromNotification(entry.title || '');
        if (candidate) {
          task = taskIndex.byTitle.get(candidate.toLowerCase());
          if (task) {
            taskId = String(task?.id || task?._id || taskId);
          }
        }
      }
      if (!task && taskId) {
        task = taskIndex.byId.get(taskId) || notificationTaskIndex.get(taskId);
      }
      const linkTaskMatch = link ? link.match(/\/tasks?\/([^/?#]+)/) : null;
      const linkTaskId = linkTaskMatch && linkTaskMatch[1] ? linkTaskMatch[1] : '';
      if (taskId && (!link || (linkTaskId && linkTaskId !== taskId))) {
        link = `/task/${taskId}`;
      }
      return { link, taskId, task };
    },
    [extractTitleFromNotification, notificationTaskIndex, taskIndex]
  );

  const getLatestEntry = (entries: any[]) => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, current) => {
      const latestTime = new Date(latest.createdAt ?? 0).getTime();
      const currentTime = new Date(current.createdAt ?? 0).getTime();
      return currentTime > latestTime ? current : latest;
    }, entries[0]);
  };

  const staffNotifications = useMemo(() => {
    if (useServerNotifications || !user || user.role !== 'staff') return [];
    return hydratedTasks
      .filter((task) => task.requesterId === user.id)
      .flatMap((task) =>
        (task.changeHistory || [])
          .filter((entry: any) => {
            const isDesignerCompletion =
              entry.userRole === 'designer' &&
              entry.field === 'status' &&
              (entry.newValue === 'Completed' || entry.newValue === 'completed');
            const isDesignerDeadlineApproval =
              entry.userRole === 'designer' &&
              entry.field === 'deadline_request' &&
              entry.newValue === 'Approved';
            const isDesignLeadApproval =
              entry.userRole === 'designer' && entry.field === 'approval_status';
            const isAdminReview =
              entry.userRole === 'admin' && entry.field === 'admin_review_status';
            const isEmergencyApproval =
              entry.userRole === 'designer' && entry.field === 'emergency_approval';
            return (
              isDesignerCompletion ||
              isDesignerDeadlineApproval ||
              isDesignLeadApproval ||
              isAdminReview ||
              isEmergencyApproval
            );
          })
          .map((entry: any) => ({ ...entry, taskId: task.id, taskTitle: task.title, task }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user, useServerNotifications]);

  const buildCommentNotifications = (role: 'admin' | 'designer' | 'treasurer') =>
    hydratedTasks
      .flatMap((task) => {
        const comments = task.comments || [];
        const roleComments = comments.filter((comment: any) => {
          if (comment.userRole !== 'staff') return false;
          if (Array.isArray(comment.receiverRoles) && comment.receiverRoles.length > 0) {
            return comment.receiverRoles.includes(role);
          }
          return true;
        });
        if (roleComments.length === 0) {
          return [];
        }
        const latest = roleComments.reduce((current: any, next: any) => {
          const currentTime = new Date(current.createdAt ?? 0).getTime();
          const nextTime = new Date(next.createdAt ?? 0).getTime();
          return nextTime > currentTime ? next : current;
        });
        return [
          {
            id: latest.id || `${task.id}-comment-${latest.createdAt ?? ''}`,
            taskId: task.id,
            taskTitle: task.title,
            task,
            field: 'comment',
            note: latest.content,
            userName: latest.userName,
            userRole: latest.userRole,
            createdAt: latest.createdAt,
          },
        ];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const designerNotifications = useMemo(() => {
    if (useServerNotifications || !user || user.role !== 'designer') return [];
    const base = hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const adminEntries = history.filter(
          (entry: any) => entry.userRole === 'admin' && entry.field === 'admin_review_status'
        );
        if (adminEntries.length > 0) {
          const latestAdmin = getLatestEntry(adminEntries);
          return latestAdmin
            ? [{ ...latestAdmin, taskId: task.id, taskTitle: task.title, task }]
            : [];
        }
        const staffEntries = history.filter(
          (entry: any) =>
            entry.userRole === 'staff' &&
            [
              'description',
              'files',
              'deadline_request',
              'status',
              'staff_note',
              'created',
            ].includes(entry.field)
        );
        const latestStaff = getLatestEntry(staffEntries);
        return latestStaff
          ? [{ ...latestStaff, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const comments = buildCommentNotifications('designer');
    return [...base, ...comments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user, useServerNotifications]);

  const adminNotifications = useMemo(() => {
    if (useServerNotifications || !user || !isAdminRole(user)) return [];
    const base = hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const createdEntries = history.filter(
          (entry: any) => entry.userRole === 'staff' && entry.field === 'created'
        );
        if (createdEntries.length === 0) {
          return [];
        }
        const latestCreated = getLatestEntry(createdEntries);
        return latestCreated
          ? [{ ...latestCreated, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const comments = buildCommentNotifications('admin');
    return [...base, ...comments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user, useServerNotifications]);

  const localNotifications =
    user?.role === 'staff'
      ? staffNotifications
      : user?.role === 'designer'
        ? designerNotifications
        : user?.role === 'admin'
          ? adminNotifications
          : [];

  const activeNotifications = useServerNotifications ? serverNotifications : localNotifications;
  const hasNotifications = activeNotifications.length > 0;
  const displayUnreadCount = useServerNotifications ? unreadCount : activeNotifications.length;
  const canShowNotifications =
    user?.role === 'staff' ||
    user?.role === 'designer' ||
    user?.role === 'treasurer' ||
    user?.role === 'admin';

  const getNotificationTitle = (entry: any) => {
    if (entry.field === 'comment') {
      return `${entry.userName || 'Staff'} messaged ${entry.taskTitle}`;
    }
    if (entry.field === 'created') {
      return `New request: ${entry.taskTitle}`;
    }
    if (user?.role === 'staff') {
      if (entry.userRole === 'designer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return `${getModificationApprovalActorLabel()} ${decision} ${entry.taskTitle}`;
      }
      if (entry.userRole === 'admin' && entry.field === 'admin_review_status') {
        return `Admin updated ${entry.taskTitle}`;
      }
      return `Designer completed ${entry.taskTitle}`;
    }
    if (entry.userRole === 'designer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return `${getModificationApprovalActorLabel()} ${decision} ${entry.taskTitle}`;
    }
    if (entry.userRole === 'admin' && entry.field === 'admin_review_status') {
      return `Admin updated ${entry.taskTitle}`;
    }
    return `Staff updated ${entry.taskTitle}`;
  };

  const getNotificationNote = (entry: any) => {
    if (entry.field === 'comment') {
      return entry.note || 'New message received.';
    }
    if (entry.field === 'created') {
      return entry.note || `Submitted by ${entry.userName}`;
    }
    if (user?.role === 'staff') {
      if (entry.userRole === 'designer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return entry.note || `Approval ${decision}`;
      }
      if (entry.userRole === 'admin' && entry.field === 'admin_review_status') {
        return entry.note || 'Admin review updated';
      }
      return entry.note || 'Status updated to completed';
    }
    if (entry.userRole === 'designer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return entry.note || `Approval ${decision}`;
    }
    if (entry.userRole === 'admin' && entry.field === 'admin_review_status') {
      return entry.note || 'Admin review updated';
    }
    return entry.note || `${entry.userName} updated ${entry.field}`;
  };

  const uiNotifications = useMemo<NotificationUiItem[]>(() => {
    const baseNotifications = useServerNotifications
      ? activeNotifications.map((entry: any) => normalizeNotification(entry))
      : activeNotifications.map((entry: any) => ({
        id: entry.id || `${entry.taskId}-${entry.createdAt}`,
        title: cleanNotificationTitle(getNotificationTitle(entry)),
        message: collapseNotificationText(getNotificationNote(entry)),
        type: entry.field || 'task',
        link: entry.taskId ? `/task/${entry.taskId}` : '',
        linkState: entry.taskId ? { task: entry.task, highlightChangeId: entry.id } : undefined,
        createdAt: new Date(entry.createdAt),
        readAt: null,
      }));

    return baseNotifications.map((entry) => {
      const resolved = resolveNotificationTarget(entry);
      const task = resolved.task;
      const title = cleanNotificationTitle(entry.title);
      const message = collapseNotificationText(entry.message);
      const previewSummary = getNotificationPreviewSummary({ ...entry, title, message }, task);
      const linkState =
        entry.linkState ?? (task ? { task } : undefined);
      const eventKind = resolveNotificationEventKind({ ...entry, title, message }, task);
      return {
        ...entry,
        title,
        message,
        link: resolved.link || entry.link,
        taskId: resolved.taskId || entry.taskId,
        linkState,
        task,
        eventKind,
        rowPreview: previewSummary,
        previewTitle: collapseNotificationText(task?.title) || title || 'Task update',
        previewStatusLabel: formatTaskStatusLabel(task?.status),
        previewTypeLabel:
          formatTaskCategoryLabel(task?.category) ||
          formatTaskRequestTypeLabel(task?.requestType) ||
          'Task update',
        previewRequesterLabel: task?.requesterName
          ? `Requested by ${task.requesterName}`
          : 'Requester not available',
        previewAssigneeLabel: task?.assignedToName
          ? `Assigned to ${task.assignedToName}`
          : 'Assigned user not set',
        previewDueLabel: formatTaskDueLabel(task?.deadline),
        previewSummary,
        previewUpdatedLabel: task?.updatedAt
          ? `Updated ${formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}`
          : '',
        previewVisualLabel: task ? 'Live task snapshot' : 'Live notification snapshot',
      };
    });
  }, [
    activeNotifications,
    getNotificationNote,
    getNotificationTitle,
    normalizeNotification,
    resolveNotificationTarget,
    useServerNotifications,
  ]);

  const activeNotificationPreview = useMemo(
    () => uiNotifications.find((entry) => entry.id === activeNotificationPreviewId) ?? null,
    [activeNotificationPreviewId, uiNotifications]
  );
  const activeNotificationPreviewIconConfig = useMemo(
    () =>
      activeNotificationPreview
        ? getNotificationIconConfig(activeNotificationPreview.eventKind)
        : null,
    [activeNotificationPreview]
  );
  const activeNotificationPreviewFrameHeight = useMemo(() => {
    if (!activeNotificationPreview?.task) return 188;
    return activeNotificationPreview.task.collaterals?.length ? 188 : 238;
  }, [activeNotificationPreview]);

  useEffect(() => {
    if (!notificationsOpen || !useServerNotifications || !apiUrl) {
      return;
    }

    const taskIdsToLoad = Array.from(
      new Set(
        uiNotifications
          .slice(0, 8)
          .map((entry) => String(entry.taskId || '').trim())
          .filter(Boolean)
      )
    ).filter(
      (taskId) =>
        !taskIndex.byId.has(taskId) &&
        !notificationTaskIndex.has(taskId) &&
        !notificationTaskFetchInFlightRef.current.has(taskId)
    );

    if (taskIdsToLoad.length === 0) {
      return;
    }

    let cancelled = false;

    const loadNotificationTasks = async () => {
      await Promise.all(
        taskIdsToLoad.map(async (taskId) => {
          notificationTaskFetchInFlightRef.current.add(taskId);
          try {
            const response = await authFetch(`${apiUrl}/api/tasks/${encodeURIComponent(taskId)}`);
            if (!response.ok) return;
            const task = await response.json();
            const resolvedTaskId = String(task?.id || task?._id || taskId).trim();
            if (cancelled || !resolvedTaskId) return;
            setNotificationTaskCache((prev) => {
              const cacheIds = Array.from(new Set([taskId, resolvedTaskId].filter(Boolean)));
              const hasAllEntries = cacheIds.every((id) => prev[id]);
              if (hasAllEntries) return prev;
              const next = { ...prev };
              cacheIds.forEach((id) => {
                next[id] = task;
              });
              return next;
            });
          } catch (error) {
            console.error('Failed to load notification task preview:', error);
          } finally {
            notificationTaskFetchInFlightRef.current.delete(taskId);
          }
        })
      );
    };

    void loadNotificationTasks();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, notificationTaskIndex, notificationsOpen, taskIndex.byId, uiNotifications, useServerNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 1180px) and (hover: hover) and (pointer: fine)');
    const syncMatches = () => setCanUseNotificationHoverPreview(mediaQuery.matches);
    syncMatches();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMatches);
      return () => mediaQuery.removeEventListener('change', syncMatches);
    }
    mediaQuery.addListener(syncMatches);
    return () => mediaQuery.removeListener(syncMatches);
  }, []);

  const clearNotificationHoverPreviewTimer = useCallback(() => {
    if (!notificationHoverPreviewTimeoutRef.current) return;
    clearTimeout(notificationHoverPreviewTimeoutRef.current);
    notificationHoverPreviewTimeoutRef.current = null;
  }, []);

  const scheduleNotificationHoverPreviewClear = useCallback(() => {
    clearNotificationHoverPreviewTimer();
    notificationHoverPreviewTimeoutRef.current = setTimeout(() => {
      setActiveNotificationPreviewId(null);
      notificationHoverPreviewTimeoutRef.current = null;
    }, 120);
  }, [clearNotificationHoverPreviewTimer]);

  const clampNotificationPreviewTop = useCallback((anchorTop?: number) => {
    if (!notificationsPanelRef.current) return;
    const nextAnchorTop =
      typeof anchorTop === 'number' ? anchorTop : notificationPreviewAnchorTopRef.current;
    const measuredCardHeight =
      notificationPreviewCardRef.current?.offsetHeight || NOTIFICATION_PREVIEW_CARD_HEIGHT;
    const maxTop = Math.max(
      NOTIFICATION_PREVIEW_OFFSET,
      notificationsPanelRef.current.offsetHeight - measuredCardHeight - NOTIFICATION_PREVIEW_OFFSET
    );
    setNotificationPreviewTop(
      Math.min(Math.max(NOTIFICATION_PREVIEW_OFFSET, nextAnchorTop), maxTop)
    );
  }, []);

  const handleNotificationRowHoverStart = useCallback(
    (entryId: string, rowElement: HTMLButtonElement) => {
      if (!canUseNotificationHoverPreview) return;
      clearNotificationHoverPreviewTimer();
      setActiveNotificationPreviewId(entryId);
      if (!notificationsPanelRef.current) return;
      const panelRect = notificationsPanelRef.current.getBoundingClientRect();
      const rowRect = rowElement.getBoundingClientRect();
      const nextTop = rowRect.top - panelRect.top - 8;
      notificationPreviewAnchorTopRef.current = nextTop;
      clampNotificationPreviewTop(nextTop);
    },
    [canUseNotificationHoverPreview, clampNotificationPreviewTop, clearNotificationHoverPreviewTimer]
  );

  useEffect(() => {
    if (!notificationsOpen || !canUseNotificationHoverPreview || !activeNotificationPreviewId) return;
    if (typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      clampNotificationPreviewTop();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeNotificationPreviewId,
    activeNotificationPreview?.previewSummary,
    activeNotificationPreview?.task?.id,
    activeNotificationPreview?.task?.collaterals?.length,
    canUseNotificationHoverPreview,
    clampNotificationPreviewTop,
    notificationsOpen,
  ]);

  useEffect(() => {
    if (notificationsOpen && canUseNotificationHoverPreview) return;
    clearNotificationHoverPreviewTimer();
    setActiveNotificationPreviewId(null);
  }, [canUseNotificationHoverPreview, clearNotificationHoverPreviewTimer, notificationsOpen]);

  useEffect(
    () => () => {
      clearNotificationHoverPreviewTimer();
    },
    [clearNotificationHoverPreviewTimer]
  );

  const openNotificationEntry = useCallback(
    (entry: NotificationUiItem) => {
      markNotificationRead(entry);
      clearNotificationHoverPreviewTimer();
      setActiveNotificationPreviewId(null);
      setNotificationsOpen(false);
      const resolvedLink =
        entry.link ||
        (entry.taskId ? `/task/${entry.taskId}` : '');
      if (resolvedLink) {
        navigate(
          resolvedLink,
          entry.linkState ? { state: entry.linkState } : undefined
        );
      }
    },
    [clearNotificationHoverPreviewTimer, markNotificationRead, navigate]
  );

  const isNotificationNow = (createdAt: Date | string) => {
    const createdTime = new Date(createdAt).getTime();
    if (!Number.isFinite(createdTime)) return false;
    const diffMs = Date.now() - createdTime;
    return diffMs >= 0 && diffMs <= 2 * 60 * 1000;
  };

  const unreadTaskNotificationIds = useMemo(() => {
    const ids = new Set<string>();
    uiNotifications.forEach((entry) => {
      const taskId = String(entry.taskId || '').trim();
      if (!taskId || entry.readAt) return;
      ids.add(taskId);
    });
    return ids;
  }, [uiNotifications]);

  useEffect(() => {
    if (!user || !hasNotifications) return;
    if (user.role === 'staff') return;
    if (useServerNotifications && displayUnreadCount === 0) return;
    if (autoPreviewShownRef.current) return;
    if (typeof window === 'undefined') return;
    const lastSeenKey = `designhub.notifications.lastSeen.${user.id}`;
    const lastSeenValue = Number(window.localStorage.getItem(lastSeenKey) || 0);
    const latestCreatedAt = Math.max(
      ...uiNotifications.map((entry) => new Date(entry.createdAt ?? 0).getTime())
    );
    if (!Number.isFinite(latestCreatedAt) || latestCreatedAt <= lastSeenValue) {
      return;
    }
    autoPreviewShownRef.current = true;
    setNotificationsOpen(true);
    window.localStorage.setItem(lastSeenKey, String(latestCreatedAt));
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = setTimeout(() => {
      setNotificationsOpen(false);
      previewTimeoutRef.current = null;
    }, 10000);
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    };
  }, [displayUnreadCount, hasNotifications, uiNotifications, useServerNotifications, user]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!notificationsRef.current) return;
      if (notificationsRef.current.contains(event.target as Node)) return;
      setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [notificationsOpen]);

  const headerPresenceAction = useMemo(() => {
    if (!user) return null;
    const isTyping = globalTypingSummary.total > 0 || localSelfTyping;
    if (isStaffUser && !isTyping) return null;
    const avatars = isTyping ? globalTypingSummary.visible : globalPresenceSummary.visible;
    if (avatars.length === 0) return null;
    const extraCount = isTyping ? globalTypingSummary.extraCount : globalPresenceSummary.extraCount;
    const label = isTyping
        ? (() => {
        const selfTyping = globalTypingList.some((viewer) => isCurrentUserViewer(viewer));
        const others = globalTypingList.filter((viewer) => !isCurrentUserViewer(viewer));
        const firstOtherName = getViewerDisplayName(others[0]);

        if (selfTyping && others.length === 0) {
          return 'You are typing...';
        }
        if (selfTyping && others.length === 1) {
          return `You and ${firstOtherName} are typing...`;
        }
        if (selfTyping && others.length > 1) {
          return `You and ${others.length} others are typing...`;
        }
        if (others.length <= 1) {
          return `${firstOtherName} is typing...`;
        }
        return `${firstOtherName} and ${others.length - 1} others are typing...`;
      })()
      : globalPresenceSummary.onlineCount === 0
        ? 'Last seen'
        : globalPresenceSummary.onlineCount < globalPresenceSummary.total
          ? 'Viewing / recent'
          : 'Currently viewing';
    return (
      <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 dark:bg-slate-900/70 dark:border-white/10 dark:text-white px-3 py-1.5 shadow-none">
        <span
          className={
            (isTyping
              ? 'text-xs font-semibold text-muted-foreground'
              : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground') +
            ' whitespace-nowrap'
          }
        >
          {label}
        </span>
        {isTyping && (
          <span className="flex items-center gap-1 typing-dots">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          </span>
        )}
        <div className="flex -space-x-2">
          {avatars.map((viewer) => {
            const isSelf = isCurrentUserViewer(viewer);
            const avatarSrc = isSelf ? user?.avatar || viewer.avatar : viewer.avatar;
            const labelRole = getViewerRoleLabel(viewer);
            const displayName = getViewerDisplayName(viewer);
            const isOnline = Boolean(viewer.isOnline);
            const lastSeenText = isOnline
              ? 'Available now'
              : formatViewerLastSeenLabel(viewer.lastSeenAt);
            const lastSeenExact = isOnline ? '' : formatViewerLastSeenExact(viewer.lastSeenAt);
            return (
              <Tooltip key={viewer.userId}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'relative inline-flex rounded-full',
                      isSelf ? '' : 'presence-highlight'
                    )}
                  >
                    <UserAvatar
                      name={displayName}
                      avatar={avatarSrc}
                      className={cn(
                        'h-6 w-6 border-2 border-white shadow-sm bg-white/90 dark:border-white/10 dark:bg-slate-900/80',
                        isSelf && 'ring-2 ring-primary/40',
                        !isOnline && 'opacity-70'
                      )}
                      fallbackClassName="bg-primary/10 text-primary dark:text-[white] text-[9px] font-semibold"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <div className="text-xs font-semibold">
                    {displayName}
                    {isSelf ? ' (you)' : ''}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{labelRole}</div>
                  {!isStaffUser && (
                    <>
                      <div
                        className={cn(
                          'text-[11px] font-medium',
                          isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                        )}
                      >
                        {lastSeenText}
                      </div>
                      {!isOnline && lastSeenExact && (
                        <div className="text-[10px] text-muted-foreground/80">{lastSeenExact}</div>
                      )}
                    </>
                  )}
                  {viewer.userEmail && (
                    <div className="text-[11px] text-muted-foreground">{viewer.userEmail}</div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {extraCount > 0 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-white/10 bg-[#E6F1FF] dark:bg-slate-900/70 text-[9px] font-semibold text-primary shadow-sm">
              +{extraCount}
            </div>
          )}
        </div>
      </div>
    );
  }, [
    globalPresenceSummary,
    globalTypingList,
    globalTypingSummary,
    getViewerDisplayName,
    getViewerRoleLabel,
    isCurrentUserViewer,
    isStaffUser,
    localSelfTyping,
    user,
    userId,
  ]);
  const keepHeaderPinned = globalTypingSummary.total > 0 || localSelfTyping;
  const closeGuidelines = useCallback(() => {
    setIsGuidelinesOpen(false);
    window.dispatchEvent(new CustomEvent('designhub:close-guidelines'));
  }, []);

  useEffect(() => {
    const onOpenGuidelines = () => {
      setIsGuidelinesOpen(true);
      window.dispatchEvent(new CustomEvent('designhub:guidelines-state', { detail: { open: true } }));
    };
    const onCloseGuidelines = () => {
      setIsGuidelinesOpen(false);
    };
    window.addEventListener('designhub:open-guidelines', onOpenGuidelines as EventListener);
    window.addEventListener('designhub:close-guidelines', onCloseGuidelines as EventListener);
    return () =>
      {
        window.removeEventListener('designhub:open-guidelines', onOpenGuidelines as EventListener);
        window.removeEventListener('designhub:close-guidelines', onCloseGuidelines as EventListener);
      };
  }, []);

  const notificationPopover = notificationsOpen ? (
    <div className="absolute right-0 mt-2 z-50 flex items-start gap-3">
      {canUseNotificationHoverPreview && activeNotificationPreview ? (
        <div
          className="hidden min-[1180px]:block"
          style={{ marginTop: `${notificationPreviewTop}px` }}
        >
          <div
            ref={notificationPreviewCardRef}
            onMouseEnter={clearNotificationHoverPreviewTimer}
            onMouseLeave={scheduleNotificationHoverPreviewClear}
            className="w-[336px] rounded-[20px] border border-[#E4EAF5] bg-white p-4 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] dark:border-[#2A3A5A] dark:bg-[linear-gradient(180deg,rgba(15,24,42,0.985),rgba(10,17,31,0.985))] dark:shadow-[0_28px_58px_-32px_rgba(2,8,23,0.96)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8C9DB8] dark:text-[#8FA0C4]">
                Task Preview
              </span>
              {activeNotificationPreview.previewUpdatedLabel ? (
                <span className="text-[10.5px] text-[#9BA8BE] dark:text-[#7F91B5]">
                  {activeNotificationPreview.previewUpdatedLabel}
                </span>
              ) : null}
            </div>
            <div
              className="relative mt-3 overflow-hidden rounded-[16px] border border-[#D8E4FB] bg-[linear-gradient(135deg,rgba(247,250,255,0.98),rgba(235,242,255,0.95))] dark:border-[#243654] dark:bg-[linear-gradient(180deg,rgba(15,29,58,0.98),rgba(10,19,39,0.98))]"
              style={{ height: `${activeNotificationPreviewFrameHeight}px` }}
            >
              {activeNotificationPreview.task ? (
                activeNotificationPreview.task.collaterals?.length ? (
                  <NotificationCampaignSectionPreview task={activeNotificationPreview.task} />
                ) : (
                  <NotificationSingleTaskSectionPreview task={activeNotificationPreview.task} />
                )
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,141,233,0.18),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.16),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(109,141,233,0.24),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.16),transparent_40%)]" />
                  <div className="relative flex h-full flex-col justify-between p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-[#36559E] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.3)] dark:bg-[#17233E] dark:text-[#D6E2FF] dark:shadow-none">
                          {activeNotificationPreview.previewVisualLabel}
                        </span>
                        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#203052] line-clamp-2 dark:text-[#F5F8FF]">
                          {activeNotificationPreview.rowPreview}
                        </p>
                      </div>
                      {activeNotificationPreviewIconConfig ? (
                        <div
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.45)] dark:border-white/10 dark:shadow-none',
                            activeNotificationPreviewIconConfig.containerClassName
                          )}
                        >
                          <activeNotificationPreviewIconConfig.Icon
                            className={cn('h-5 w-5', activeNotificationPreviewIconConfig.iconClassName)}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A9AB8] dark:text-[#7F91B5]">
                          Status
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-[#1E2A43] line-clamp-1 dark:text-[#F5F8FF]">
                          {activeNotificationPreview.previewStatusLabel}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A9AB8] dark:text-[#7F91B5]">
                          Type
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-[#1E2A43] line-clamp-1 dark:text-[#F5F8FF]">
                          {activeNotificationPreview.previewTypeLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <h4 className="mt-3 text-[15px] font-semibold leading-5 text-[#1E2A43] line-clamp-2 dark:text-[#F5F8FF]">
              {activeNotificationPreview.previewTitle}
            </h4>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#36559E] dark:bg-[#17233E] dark:text-[#D6E2FF]">
                {activeNotificationPreview.previewStatusLabel}
              </span>
              <span className="text-[11.5px] font-medium text-[#5E6D88] dark:text-[#A9B8D8]">
                {activeNotificationPreview.previewTypeLabel}
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-[12px] text-[#55647C] dark:text-[#C4D0EA]">
                <FileText className="h-3.5 w-3.5 text-[#8FA0BD] dark:text-[#7E92B9]" />
                <span className="line-clamp-1">{activeNotificationPreview.previewRequesterLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#55647C] dark:text-[#C4D0EA]">
                <User className="h-3.5 w-3.5 text-[#8FA0BD] dark:text-[#7E92B9]" />
                <span className="line-clamp-1">{activeNotificationPreview.previewAssigneeLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#55647C] dark:text-[#C4D0EA]">
                <Clock className="h-3.5 w-3.5 text-[#8FA0BD] dark:text-[#7E92B9]" />
                <span className="line-clamp-1">{activeNotificationPreview.previewDueLabel}</span>
              </div>
            </div>
            <p className="mt-3.5 text-[12.5px] leading-5 text-[#65748E] line-clamp-2 dark:text-[#A9B8D8]">
              {activeNotificationPreview.previewSummary}
            </p>
            <button
              type="button"
              onClick={() => openNotificationEntry(activeNotificationPreview)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1B3260] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#15274B] dark:bg-[#EAF0FF] dark:text-[#10203A] dark:hover:bg-white"
            >
              View Task
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={notificationsPanelRef}
        className="w-[23rem] overflow-hidden rounded-xl border border-[#D5DFF5] bg-white shadow-[0_8px_32px_-8px_rgba(15,23,42,0.18)] animate-dropdown origin-top-right dark:border-[#243654] dark:bg-[linear-gradient(180deg,rgba(15,24,42,0.985),rgba(10,17,31,0.985))] dark:shadow-[0_20px_48px_-28px_rgba(2,8,23,0.96)]"
      >
        <div className="flex items-center justify-between border-b border-[#EAF0FA] px-4 py-3 dark:border-[#243654]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2F3A56] dark:text-[#EAF0FF]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {useServerNotifications && unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="text-[11px] font-medium text-[#5C70A8] transition hover:text-[#274187] dark:text-[#9FB2DB] dark:hover:text-[#EAF0FF]"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#8898BB] transition hover:bg-[#F0F4FF] hover:text-[#2F3A56] dark:text-[#94A7CD] dark:hover:bg-[#17233E] dark:hover:text-[#EAF0FF]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="max-h-[440px] overflow-y-auto overflow-x-hidden scrollbar-thin">
          {uiNotifications.length > 0 ? (
            <div className="divide-y divide-[#EEF2FB] dark:divide-border">
              {uiNotifications.map((entry, idx) => {
                const isUnread = !entry.readAt;
                const isPreviewActive =
                  canUseNotificationHoverPreview && activeNotificationPreviewId === entry.id;
                const timeLabel = isNotificationNow(entry.createdAt)
                  ? 'Just now'
                  : format(new Date(entry.createdAt), 'MMM d, yyyy · h:mm a');
                const iconConfig = getNotificationIconConfig(entry.eventKind);

                return (
                  <button
                    key={entry.id || `notif-${idx}`}
                    type="button"
                    onClick={() => openNotificationEntry(entry)}
                    onMouseEnter={(event) =>
                      handleNotificationRowHoverStart(entry.id, event.currentTarget)
                    }
                    onMouseLeave={scheduleNotificationHoverPreviewClear}
                    className={cn(
                      'group relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-[background-color,box-shadow] duration-150',
                      isPreviewActive
                        ? 'bg-[#EEF4FF] shadow-[inset_0_0_0_1px_rgba(205,221,255,0.9)] dark:bg-[#16233F] dark:shadow-[inset_0_0_0_1px_rgba(71,104,187,0.42)]'
                        : isUnread
                          ? 'bg-[#F7FAFF] hover:bg-[#F1F6FF] dark:bg-[#101B31] dark:hover:bg-[#16233F]'
                          : 'bg-white hover:bg-[#F8FAFD] dark:bg-[rgba(12,19,36,0.92)] dark:hover:bg-[#15213B]'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
                        iconConfig.containerClassName
                      )}
                    >
                      <iconConfig.Icon className={cn('h-4 w-4', iconConfig.iconClassName)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-[12.5px] font-semibold leading-snug line-clamp-1',
                              isUnread
                                ? 'text-[#1B2E6E] dark:text-[#F5F8FF]'
                                : 'text-[#33415F] dark:text-[#D9E3F7]'
                            )}
                          >
                            {entry.title}
                          </p>
                          <p className="mt-0.5 text-[11.5px] leading-snug text-[#5E6E8D] line-clamp-1 dark:text-[#9EB0D3]">
                            {entry.rowPreview}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5 pl-2">
                          <span className="text-[10.5px] tabular-nums text-[#9BACC8] dark:text-[#7F91B5]">
                            {timeLabel}
                          </span>
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full transition-opacity',
                              isUnread ? 'bg-[#4C6FFF] opacity-100' : 'bg-transparent opacity-0'
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-[12.5px] font-medium text-[#8898BB] dark:text-slate-400">No notifications yet</p>
              <p className="mt-0.5 text-[11px] text-[#B0BFDA] dark:text-slate-500">You're all caught up.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const notificationAction = canShowNotifications ? (
    <div className="relative" ref={notificationsRef}>
      <button
        type="button"
        className="relative h-9 w-9 rounded-full border border-[#D9E6FF] bg-white/90 dark:bg-muted/80 dark:border-border text-muted-foreground shadow-none flex items-center justify-center transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 hover:text-muted-foreground dark:hover:text-muted-foreground"
        onClick={() => {
          const nextOpen = !notificationsOpen;
          setNotificationsOpen(nextOpen);
          if (nextOpen && useServerNotifications) {
            fetchNotifications(lastFetchedAtRef.current);
            fetchUnreadCount();
          }
          if (nextOpen && user && typeof window !== 'undefined') {
            const lastSeenKey = `designhub.notifications.lastSeen.${user.id}`;
            const latestCreatedAt = Math.max(
              ...uiNotifications.map((entry) =>
                new Date(entry.createdAt ?? 0).getTime()
              )
            );
            if (Number.isFinite(latestCreatedAt)) {
              window.localStorage.setItem(lastSeenKey, String(latestCreatedAt));
            }
          }
        }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {displayUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
          </span>
        )}
      </button>
      {notificationPopover}{false && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#D5DFF5] bg-white dark:bg-card dark:border-border shadow-[0_8px_32px_-8px_rgba(15,23,42,0.18)] z-50 animate-dropdown origin-top-right overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#EAF0FA] px-4 py-3 dark:border-border">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2F3A56] dark:text-slate-200">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {useServerNotifications && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[11px] font-medium text-[#5C70A8] transition hover:text-[#274187] dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#8898BB] transition hover:bg-[#F0F4FF] hover:text-[#2F3A56] dark:text-slate-400 dark:hover:bg-muted dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[440px] overflow-y-auto overflow-x-hidden scrollbar-thin">
            {uiNotifications.length > 0 ? (
              <div className="divide-y divide-[#EEF2FB] dark:divide-border">
                {uiNotifications.map((entry, idx) => {
                  const isUnread = !entry.readAt;
                  const titleClean = entry.title
                    .replace(/\s*:\s*now$/i, '')
                    .replace(/\s+now$/i, '');
                  const timeLabel = isNotificationNow(entry.createdAt)
                    ? 'Just now'
                    : format(new Date(entry.createdAt), 'MMM d, yyyy · h:mm a');

                  // Derive icon + color from type or title keywords
                  const typeKey = (entry.type || '').toLowerCase();
                  const titleKey = titleClean.toLowerCase();
                  type IconConfig = { Icon: React.ElementType; bg: string; color: string };
                  const iconConfig: IconConfig = (() => {
                    if (typeKey.includes('review') || titleKey.includes('review'))
                      return { Icon: Eye, bg: 'bg-violet-50 dark:bg-violet-950/40', color: 'text-violet-500' };
                    if (typeKey.includes('completed') || titleKey.includes('completed'))
                      return { Icon: BadgeCheck, bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-500' };
                    if (typeKey.includes('accepted') || titleKey.includes('accepted'))
                      return { Icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-500' };
                    if (typeKey.includes('clarification') || titleKey.includes('clarification'))
                      return { Icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-500' };
                    if (typeKey.includes('comment') || titleKey.includes('comment') || typeKey.includes('message'))
                      return { Icon: MessageSquare, bg: 'bg-sky-50 dark:bg-sky-950/40', color: 'text-sky-500' };
                    if (typeKey.includes('assign') || titleKey.includes('assign'))
                      return { Icon: UserPlus, bg: 'bg-indigo-50 dark:bg-indigo-950/40', color: 'text-indigo-500' };
                    if (typeKey.includes('submit') || titleKey.includes('submit') || titleKey.includes('request'))
                      return { Icon: Send, bg: 'bg-blue-50 dark:bg-blue-950/40', color: 'text-blue-500' };
                    return { Icon: FileText, bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-500' };
                  })();

                  return (
                    <button
                      key={entry.id || `notif-${idx}`}
                      type="button"
                      onClick={() => {
                        markNotificationRead(entry);
                        setNotificationsOpen(false);
                        const resolvedLink =
                          entry.link ||
                          (entry.taskId ? `/task/${entry.taskId}` : '');
                        if (resolvedLink) {
                          navigate(
                            resolvedLink,
                            entry.linkState ? { state: entry.linkState } : undefined
                          );
                        }
                      }}
                      className={cn(
                        'relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                        isUnread
                          ? 'bg-[#F5F8FF] hover:bg-[#EDF2FF] dark:bg-primary/5 dark:hover:bg-primary/10'
                          : 'bg-white hover:bg-[#F8FAFD] dark:bg-card dark:hover:bg-muted/40'
                      )}
                    >
                      {/* Icon */}
                      <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconConfig.bg)}>
                        <iconConfig.Icon className={cn('h-3.5 w-3.5', iconConfig.color)} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-[12px] font-semibold leading-snug line-clamp-1',
                            isUnread ? 'text-[#1B2E6E] dark:text-slate-100' : 'text-[#374569] dark:text-slate-200'
                          )}>
                            {titleClean}
                          </p>
                          {isUnread && (
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {entry.message && (
                          <p className="mt-0.5 text-[11.5px] leading-snug text-[#5C6E90] line-clamp-1 dark:text-slate-400">
                            {entry.message}
                          </p>
                        )}
                        <p className="mt-1.5 text-[10.5px] tabular-nums text-[#9BACC8] dark:text-slate-500">
                          {timeLabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-[12.5px] font-medium text-[#8898BB] dark:text-slate-400">No notifications yet</p>
                <p className="mt-0.5 text-[11px] text-[#B0BFDA] dark:text-slate-500">You're all caught up.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  if (!isAuthenticated) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  return (
    <UnreadTaskNotificationsContext.Provider value={{ ids: unreadTaskNotificationIds, markTaskRead }}>
      <>
        <DashboardShell
          userInitial={user?.name?.charAt(0) || 'U'}
          compactShell={isAdminRole(user)}
          background={background}
          contentScrollRef={contentScrollRef}
          keepHeaderPinned={keepHeaderPinned}
          hideGrid={hideGrid}
          allowContentOverflow={allowContentOverflow}
          fitContentHeight={fitContentHeight}
          onContentScroll={() => {
            if (previewTimeoutRef.current) {
              clearTimeout(previewTimeoutRef.current);
              previewTimeoutRef.current = null;
            }
            setNotificationsOpen(false);
          }}
          headerActions={
            <>
              <ThemeToggle className="mr-2" />
              {headerPresenceAction}
              {notificationAction}
              {headerActions}
            </>
          }
        >
          {children}
        </DashboardShell>
        {isGuidelinesOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close guidelines"
            onClick={closeGuidelines}
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-3xl rounded-[28px] border border-[#D9E6FF] bg-white dark:bg-card dark:border-border shadow-[0_22px_48px_-28px_rgba(15,23,42,0.25)]">
            <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(214,227,255,0.6),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(240,244,255,0.9),_transparent_60%)] dark:hidden" />
            <div className="relative overflow-hidden rounded-[26px] border border-[#D9E6FF] bg-white/90 dark:bg-card dark:border-border backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 px-8 py-8">
                <div className="max-w-xl">
                  <h3 className="text-lg font-extrabold text-[#1E2A5A] dark:text-foreground">
                    Submission Guidelines
                  </h3>
                  <p className="mt-1 text-xs text-[#6B7A99] dark:text-muted-foreground">
                    Please follow these before submitting.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[#6B7A99] hover:text-[#1E2A5A] rounded-full p-2 bg-[#EEF4FF] hover:bg-[#E5ECFF] dark:text-muted-foreground dark:bg-slate-800 dark:hover:bg-slate-700"
                  onClick={closeGuidelines}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-8 pb-10">
                <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr] items-center">
                  <div className="rounded-2xl border border-[#D9E6FF] bg-white/70 text-[12.5px] leading-6 text-[#5C6E95] divide-y divide-[#D9E6FF] dark:border-border dark:bg-slate-900/70 dark:text-slate-300 dark:divide-border">
                    <div className="flex items-start gap-3 px-5 py-5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-primary">
                        <Database className="h-[18px] w-[18px]" />
                      </span>
                      <span className="leading-6">
                        <span className="font-semibold text-[#2F3A56] dark:text-foreground">Data Requirements:</span>{' '}
                        Include all text content, images, logos, and associated files.
                      </span>
                    </div>
                    <div className="flex items-start gap-3 px-5 py-5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-primary">
                        <Clock className="h-[18px] w-[18px]" />
                      </span>
                      <span className="leading-6">
                        <span className="font-semibold text-[#2F3A56] dark:text-foreground">Timeline:</span>{' '}
                        Minimum 3 working days for standard requests. Urgent requests require justification.
                      </span>
                    </div>
                    <div className="flex items-start gap-3 px-5 py-5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-primary">
                        <FileText className="h-[18px] w-[18px]" />
                      </span>
                      <span className="leading-6">
                        <span className="font-semibold text-[#2F3A56] dark:text-foreground">Design Governance:</span>{' '}
                        {DESIGN_GOVERNANCE_NOTICE_COMPACT}
                      </span>
                    </div>
                  </div>
                  <div className="relative hidden md:block">
                    <div className="absolute -right-6 top-8 h-32 w-56 rounded-[28px] border border-white/70 bg-white/70 dark:hidden" />
                    <div className="guideline-preview-card relative rounded-[32px] bg-white p-6 dark:bg-slate-900 dark:border dark:border-slate-800/70">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-[#EEF4FF] flex items-center justify-center text-primary dark:bg-slate-800 dark:text-primary">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="guideline-shimmer h-3 w-24 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                          <div className="guideline-shimmer mt-2 h-2 w-32 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                        </div>
                        <span className="guideline-toggle-pulse ml-auto h-7 w-10 rounded-full bg-[#EAF1FF] dark:bg-slate-800" />
                      </div>
                      <div className="guideline-shimmer mt-4 h-2 w-28 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                    </div>
                    <div className="guideline-preview-card guideline-preview-card--delay relative mt-3 ml-6 rounded-[32px] bg-white p-6 dark:bg-slate-900 dark:border dark:border-slate-800/70">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-[#EEF4FF] flex items-center justify-center text-primary dark:bg-slate-800 dark:text-primary">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="guideline-shimmer h-3 w-24 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                          <div className="guideline-shimmer mt-2 h-2 w-32 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                        </div>
                        <span className="guideline-toggle-pulse ml-auto h-7 w-10 rounded-full bg-[#EAF1FF] dark:bg-slate-800" />
                      </div>
                      <div className="guideline-shimmer mt-4 h-2 w-24 rounded-full bg-[#EEF4FF] dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </>
    </UnreadTaskNotificationsContext.Provider>
  );
}

function DashboardShell({
  children,
  userInitial,
  compactShell = false,
  headerActions,
  onContentScroll,
  background,
  contentScrollRef,
  keepHeaderPinned = false,
  hideGrid = false,
  allowContentOverflow = false,
  fitContentHeight = false,
}: {
  children: ReactNode;
  userInitial: string;
  compactShell?: boolean;
  headerActions?: ReactNode;
  onContentScroll?: () => void;
  background?: ReactNode;
  contentScrollRef?: React.RefObject<HTMLDivElement>;
  keepHeaderPinned?: boolean;
  hideGrid?: boolean;
  allowContentOverflow?: boolean;
  fitContentHeight?: boolean;
}) {
  const { query, setQuery, items, scopeLabel } = useGlobalSearch();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [activeFilter, setActiveFilter] = useState<'all' | 'tasks' | 'people' | 'files' | 'categories' | 'more'>('all');
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchDismissed, setIsSearchDismissed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const shellCardRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [fixedHeaderStyle, setFixedHeaderStyle] = useState<CSSProperties | undefined>(undefined);
  const [headerSpacerHeight, setHeaderSpacerHeight] = useState(0);

  const searchValue = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!searchValue) return [];
    return items.filter((item) => {
      const haystack = [item.label, item.description, item.meta]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchValue
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => haystack.includes(token));
    });
  }, [items, searchValue]);

  const groupedResults = useMemo(() => {
    const groups = {
      tasks: [] as typeof items,
      people: [] as typeof items,
      files: [] as typeof items,
      categories: [] as typeof items,
      more: [] as typeof items,
    };
    filteredItems.forEach((item) => {
      switch (item.kind) {
        case 'person':
          groups.people.push(item);
          break;
        case 'file':
          groups.files.push(item);
          break;
        case 'category':
          groups.categories.push(item);
          break;
        case 'task':
          groups.tasks.push(item);
          break;
        default:
          groups.more.push(item);
          break;
      }
    });
    return groups;
  }, [filteredItems, items]);

  const totalCount = filteredItems.length;
  const showPanel = (isSearchOpen || query.trim().length > 0) && !isSearchDismissed;
  const showPlaceholder = query.length === 0;
  const visibleGroups = useMemo(() => {
    if (activeFilter === 'people') return { People: groupedResults.people };
    if (activeFilter === 'files') return { Files: groupedResults.files };
    if (activeFilter === 'tasks') return { Requests: groupedResults.tasks };
    if (activeFilter === 'categories') return { Categories: groupedResults.categories };
    if (activeFilter === 'more') return { More: groupedResults.more };
    return {
      Requests: groupedResults.tasks,
      People: groupedResults.people,
      Files: groupedResults.files,
      Categories: groupedResults.categories,
      ...(groupedResults.more.length ? { More: groupedResults.more } : {}),
    };
  }, [activeFilter, groupedResults]);

  useEffect(() => {
    if (!query.trim()) {
      setActiveFilter('all');
    }
  }, [query]);

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setIsSearchDismissed(false);
    setIsSearchOpen(true);
  };

  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      setIsSearchOpen(false);
    }, 160);
  };

  const handleContentScroll = () => {
    setIsSearchDismissed(true);
    setIsSearchOpen(false);
    onContentScroll?.();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') {
        return;
      }
      event.preventDefault();
      setIsSearchDismissed(false);
      setIsSearchOpen(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!showPanel) return;
      if (!searchContainerRef.current) return;
      if (searchContainerRef.current.contains(event.target as Node)) return;
      setIsSearchOpen(false);
      setIsSearchDismissed(true);
      setQuery('');
      setActiveFilter('all');
      searchInputRef.current?.blur();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [showPanel]);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsSearchDismissed(true);
    setQuery('');
    setActiveFilter('all');
  }, [location.pathname]);

  const syncPinnedHeaderLayout = useCallback(() => {
    if (!keepHeaderPinned || !shellCardRef.current || !headerRef.current) {
      setFixedHeaderStyle(undefined);
      setHeaderSpacerHeight(0);
      return;
    }

    const shellRect = shellCardRef.current.getBoundingClientRect();
    const headerRect = headerRef.current.getBoundingClientRect();

    setHeaderSpacerHeight(headerRect.height);
    setFixedHeaderStyle({
      top: `${Math.max(shellRect.top + 1, 0)}px`,
      left: `${Math.max(shellRect.left + 1, 0)}px`,
      width: `${Math.max(shellRect.width - 2, 0)}px`,
    });
  }, [keepHeaderPinned]);

  useEffect(() => {
    if (!keepHeaderPinned) {
      setFixedHeaderStyle(undefined);
      setHeaderSpacerHeight(0);
      return;
    }

    syncPinnedHeaderLayout();

    const handleLayoutChange = () => {
      syncPinnedHeaderLayout();
    };

    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && shellCardRef.current
        ? new ResizeObserver(() => syncPinnedHeaderLayout())
        : null;

    if (resizeObserver && shellCardRef.current) {
      resizeObserver.observe(shellCardRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
      resizeObserver?.disconnect();
    };
  }, [keepHeaderPinned, syncPinnedHeaderLayout]);

  useEffect(() => {
    const onOpenSearch = () => {
      setIsSearchDismissed(false);
      setIsSearchOpen(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('designhub:open-search', onOpenSearch as EventListener);
    return () =>
      window.removeEventListener('designhub:open-search', onOpenSearch as EventListener);
  }, []);

  const highlightText = (text: string) => {
    const rawQuery = query.trim();
    if (!rawQuery) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = rawQuery.toLowerCase();
    const parts: ReactNode[] = [];
    let index = 0;

    while (index < text.length) {
      const matchIndex = lowerText.indexOf(lowerQuery, index);
      if (matchIndex === -1) {
        parts.push(text.slice(index));
        break;
      }
      if (matchIndex > index) {
        parts.push(text.slice(index, matchIndex));
      }
      const matchText = text.slice(matchIndex, matchIndex + rawQuery.length);
      parts.push(
        <mark
          key={`${matchIndex}-${matchText}`}
          className="rounded bg-amber-200/70 text-slate-900 dark:bg-amber-300/30 dark:text-amber-100 px-0.5"
        >
          {matchText}
        </mark>
      );
      index = matchIndex + rawQuery.length;
    }

    return parts;
  };

  const renderItem = (item: (typeof items)[number]) => {
    const content = (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#EEF3FF] text-primary dark:bg-muted/70 dark:text-primary flex items-center justify-center">
          {item.kind === 'person' && <User className="h-4 w-4" />}
          {item.kind === 'file' && <FileText className="h-4 w-4" />}
          {item.kind === 'category' && <LayoutGrid className="h-4 w-4" />}
          {item.kind === 'task' && <ListTodo className="h-4 w-4" />}
          {(!item.kind || item.kind === 'activity' || item.kind === 'other') && (
            <ListTodo className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {highlightText(item.label)}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate">
              {highlightText(item.description)}
            </p>
          )}
          {item.meta && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.meta}</p>
          )}
        </div>
      </div>
    );

    if (!item.href) {
      return (
        <div
          key={item.id}
          className="px-3 py-2 border-t border-[#E4ECFF] dark:border-border hover:bg-[#EEF4FF]/80 dark:hover:bg-muted/60 transition"
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.href}
        className="block px-3 py-2 border-t border-[#E4ECFF] dark:border-border hover:bg-[#EEF4FF]/80 dark:hover:bg-muted/60 transition"
        onClick={() => setQuery('')}
      >
        {content}
      </Link>
    );
  };

  const filterOptions = [
    {
      key: 'all',
      label: 'All',
      icon: Search,
      count: totalCount,
    },
    {
      key: 'people',
      label: 'People',
      icon: Users,
      count: groupedResults.people.length,
    },
    {
      key: 'files',
      label: 'Files',
      icon: FileText,
      count: groupedResults.files.length,
    },
    {
      key: 'tasks',
      label: 'Requests',
      icon: ListTodo,
      count: groupedResults.tasks.length,
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: LayoutGrid,
      count: groupedResults.categories.length,
    },
  ];

  return (
    <GridSmallBackground
      hideGrid={hideGrid}
      className={cn(
        'min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(145,167,255,0.35),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,218,255,0.45),_transparent_60%)] dark:bg-background',
        compactShell ? 'p-3 md:p-4' : 'p-4 md:p-6'
      )}
    >
      <div
        className={cn(
          'relative z-10 flex',
          compactShell ? 'min-h-[calc(100vh-1.5rem)] gap-3 md:gap-4' : 'min-h-[calc(100vh-2rem)] gap-4 md:gap-6'
        )}
      >
        <div
          className="relative flex-shrink-0"
          style={{ width: compactShell ? 'var(--app-sidebar-width, 13.5rem)' : 'var(--app-sidebar-width, 18rem)' }}
        >
          <div
            aria-hidden="true"
            className="h-full w-full opacity-0 pointer-events-none"
          />
          <AppSidebar />
        </div>
        <main className={cn('flex-1 min-w-0 flex justify-center', fitContentHeight && 'items-start')}>
          <div
            ref={shellCardRef}
            className={cn(
              compactShell
                ? 'flex w-full max-w-[1240px] flex-col rounded-[28px] border border-[#D9E6FF] bg-white/85 shadow-none dark:border-border dark:bg-card/85'
                : 'w-full max-w-6xl rounded-[32px] border border-[#D9E6FF] bg-white/85 dark:bg-card/85 dark:border-border shadow-none flex flex-col',
              fitContentHeight ? 'h-auto self-start' : 'h-full',
              allowContentOverflow ? "overflow-visible" : "overflow-hidden"
            )}
          >
            <div
              ref={headerRef}
              className={cn(
                compactShell
                  ? 'relative z-30 shrink-0 border-b border-[#D9E6FF] bg-white/75 px-4 py-2.5 backdrop-blur-md dark:border-border dark:bg-card/80 md:px-5'
                  : 'relative z-30 shrink-0 border-b border-[#D9E6FF] bg-white/75 dark:bg-card/80 dark:border-border backdrop-blur-md px-4 md:px-6 py-3',
                keepHeaderPinned &&
                  (compactShell ? 'fixed z-[60] rounded-t-[27px] shadow-none' : 'fixed z-[60] rounded-t-[30px] shadow-none')
              )}
              style={keepHeaderPinned ? fixedHeaderStyle : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative min-w-[150px] flex-1 max-w-[220px] sm:max-w-[280px] md:max-w-md" ref={searchContainerRef}>
                  <div className="search-elastic group flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 dark:bg-card/80 dark:border-border px-3 py-2 shadow-none">
                    <Search className="search-elastic-icon h-4 w-4 text-muted-foreground" />
                    <div className="relative flex-1">
                      {showPlaceholder && (
                        <div className="search-placeholder">
                          <span className="search-placeholder-static">Search for</span>
                          <span className="search-placeholder-words">
                            <span className="search-placeholder-wordlist">
                              <span>tasks</span>
                              <span>files</span>
                            </span>
                          </span>
                        </div>
                      )}
                      <input
                        type="text"
                        aria-label="Search"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setIsSearchDismissed(false);
                        }}
                        ref={searchInputRef}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setQuery('');
                          }
                        }}
                        className="search-elastic-input w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                    <span className="hidden sm:flex items-center gap-1 rounded-full bg-[#EFF4FF] dark:bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      <kbd className="font-sans">Ctrl</kbd>
                      <kbd className="font-sans">F</kbd>
                    </span>
                  </div>
                  {showPanel && (
                    <GlassCard
                      className="absolute left-0 right-0 mt-2 z-50 backdrop-blur-2xl"
                      contentClassName={cn(
                        'rounded-2xl overflow-hidden border p-2 animate-dropdown border-[#D9E6FF]/75 bg-white/94 supports-[backdrop-filter]:bg-white/82 backdrop-blur-md dark:border-[#253D78]/90 dark:bg-[#081027]/96 dark:supports-[backdrop-filter]:bg-[#081027]/88'
                      )}
                      blur={isDark ? 14 : 12}
                      saturation={100}
                      backgroundColor={isDark ? '#081027' : '#ffffff'}
                      backgroundOpacity={isDark ? 0.88 : 0.82}
                      borderColor={isDark ? '#253D78' : '#D9E6FF'}
                      borderOpacity={0.95}
                      borderSize={1}
                      innerLightOpacity={0}
                    >
                      <div onMouseDown={(event) => event.preventDefault()}>
                        <div className="flex items-center justify-between px-3 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          <span>{scopeLabel}</span>
                          <span>{totalCount} results</span>
                        </div>
                        <div className="flex flex-wrap gap-2 px-3 pb-3">
                          {filterOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => setActiveFilter(option.key as typeof activeFilter)}
                                className="search-chip"
                                data-active={activeFilter === option.key}
                              >
                                <Icon className="h-4 w-4" />
                                <span>{option.label}</span>
                                <span className="search-chip-count">{option.count}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="max-h-72 overflow-auto scrollbar-none">
                          {Object.entries(visibleGroups).some(([, list]) => list.length > 0) ? (
                            Object.entries(visibleGroups).map(([title, list]) => {
                              if (list.length === 0) return null;
                              return (
                                <div key={title}>
                                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    {title}
                                  </div>
                                  {list.slice(0, 6).map(renderItem)}
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-3 py-4 text-sm text-muted-foreground border-t border-[#E4ECFF] dark:border-border">
                              No matches. Try a different term.
                            </div>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  {headerActions}
                </div>
              </div>
            </div>
            {keepHeaderPinned && headerSpacerHeight > 0 && (
              <div aria-hidden="true" className="shrink-0" style={{ height: `${headerSpacerHeight}px` }} />
            )}
            <div
              ref={contentScrollRef}
              data-app-scroll-container="true"
              className={cn(
                'relative scrollbar-thin',
                fitContentHeight ? 'flex-none overflow-visible' : 'flex-1 overflow-y-auto',
                allowContentOverflow ? "overflow-x-visible" : "overflow-x-hidden"
              )}
              onScroll={handleContentScroll}
            >
              {background}
              <div className="relative z-10">
                <div
                  className={cn(
                    compactShell
                      ? 'mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6'
                      : 'container py-6 px-4 md:px-8 max-w-6xl mx-auto'
                  )}
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

    </GridSmallBackground>
  );
}


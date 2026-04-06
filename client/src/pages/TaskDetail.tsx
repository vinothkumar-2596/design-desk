import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { SubmissionSuccessDialog } from '@/components/common/SubmissionSuccessDialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ClipboardCheck,
  User,
  Download,
  ShieldCheck,
  Tag,
  MessageSquare,
  Send,
  Edit3,
  Upload,
  Paperclip,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  History,
  Check,
  ChevronDown,
  Copy,
  Eye,
  PenTool,
  X,
  XCircle,
  ExternalLink,
  Folder,
  MoreHorizontal,
  Search,
  Archive,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import {
  Component,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { toast } from 'sonner';
import {
  ApprovalStatus,
  CollateralItem,
  CollateralPriority,
  CollateralStatus,
  DesignVersion,
  FinalDeliverableFile,
  FinalDeliverableReviewAnnotation,
  FinalDeliverableReviewStatus,
  FinalDeliverableVersion,
  Task,
  TaskCategory,
  TaskChange,
  TaskComment,
  TaskFile,
  TaskStatus,
  TaskUrgency,
  UserRole,
} from '@/types';
import { cn } from '@/lib/utils';
import { loadLocalTaskById, upsertLocalTask } from '@/lib/taskStorage';
import { createSocket } from '@/lib/socket';
import { pushScheduleNotification } from '@/lib/designerSchedule';
import { GridBackground } from '@/components/ui/background';
import {
  AttachmentPreviewDialog,
  isAttachmentPreviewable,
  type AttachmentPreviewFile,
} from '@/components/tasks/AttachmentPreviewDialog';
import { ImageAnnotationDialog } from '@/components/tasks/ImageAnnotationDialog';
import { getDesignerScopeLabel, isMainDesigner } from '@/lib/designerAccess';
import {
  DESIGN_GOVERNANCE_EDIT_TASK_MINIMAL,
  DESIGN_GOVERNANCE_EDIT_TASK_PREMIUM_LINES,
  DESIGN_GOVERNANCE_NOTICE_POLICY,
} from '@/lib/designGovernance';
import { UserAvatar } from '@/components/common/UserAvatar';
import {
  deriveTaskStatusFromCollaterals,
  formatCollateralStatusLabel,
  getCollateralDisplayName,
  getCollateralPreset,
  getCollateralSizeSummary,
} from '@/lib/campaignRequest';
import { mergeViewerReadAt } from '@/lib/taskHydration';

type DisplayTaskStatus = TaskStatus | 'assigned' | 'accepted';
const statusConfig: Record<DisplayTaskStatus, { label: string; variant: 'pending' | 'progress' | 'review' | 'completed' | 'clarification' }> = {
  pending: { label: 'Pending', variant: 'pending' },
  assigned: { label: 'Assigned', variant: 'pending' },
  accepted: { label: 'Accepted', variant: 'progress' },
  in_progress: { label: 'In Progress', variant: 'progress' },
  clarification_required: { label: 'Clarification Required', variant: 'clarification' },
  under_review: { label: 'Under Review', variant: 'review' },
  completed: { label: 'Completed', variant: 'completed' },
};

const statusDetails: Record<DisplayTaskStatus, string> = {
  pending: 'Request submitted',
  assigned: 'Task assigned to designer',
  accepted: 'Designer accepted the task',
  in_progress: 'Design work in motion',
  clarification_required: 'Waiting on clarifications',
  under_review: 'Review in progress',
  completed: 'Delivery complete',
};
const TASK_STATUS_STEPS: DisplayTaskStatus[] = [
  'pending',
  'assigned',
  'accepted',
  'in_progress',
  'clarification_required',
  'under_review',
  'completed',
];
type StaffTrackerStepId = 'submitted' | 'assigned' | 'in_design' | 'review' | 'completed';
const STAFF_TRACKER_STEPS: Array<{ id: StaffTrackerStepId; label: string }> = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_design', label: 'In Design' },
  { id: 'review', label: 'Review' },
  { id: 'completed', label: 'Delivered' },
];
const getStaffTrackerStepIndex = (status: DisplayTaskStatus) => {
  switch (status) {
    case 'assigned':
    case 'accepted':
      return 1;
    case 'in_progress':
    case 'clarification_required':
      return 2;
    case 'under_review':
      return 3;
    case 'completed':
      return 4;
    case 'pending':
    default:
      return 0;
  }
};
const staffTrackerHeadline: Record<DisplayTaskStatus, string> = {
  pending: 'Request Submitted',
  assigned: 'Assigned to designer',
  accepted: 'Designer accepted',
  in_progress: 'Design in progress',
  clarification_required: 'Clarification required',
  under_review: 'Under review',
  completed: 'Delivered',
};
const staffTrackerSummary: Record<DisplayTaskStatus, string> = {
  pending: 'Request submitted and waiting for assignment',
  assigned: 'Assigned and queued for design execution',
  accepted: 'Designer accepted and preparing the first output',
  in_progress: 'Design work is actively moving forward',
  clarification_required: 'Waiting for clarification before work continues',
  under_review: 'Submitted and waiting for review approval',
  completed: 'Final delivery shared and marked complete',
};
type StaffHealthTone = 'on_track' | 'at_risk' | 'overdue' | 'delivered';
type TaskDetailErrorBoundaryState = {
  error: Error | null;
};

class TaskDetailErrorBoundary extends Component<
  { children: React.ReactNode },
  TaskDetailErrorBoundaryState
> {
  state: TaskDetailErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): TaskDetailErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TaskDetail render failed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(111,145,255,0.14),transparent_28%),linear-gradient(180deg,#f6f8ff_0%,#eef3ff_100%)] px-6 py-16 text-slate-950">
          <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
            <div className="w-full rounded-[28px] border border-[#d7e2ff] bg-white/88 p-8 text-center shadow-[0_28px_90px_-42px_rgba(61,92,190,0.35)] backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5c74b4]">
                Task Detail
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#17305d]">
                Task page failed to render
              </h2>
              <p className="mt-2 text-sm text-[#5a6c8c]">
                {this.state.error.message || 'Unexpected task-page error.'}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button asChild>
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const resolveStaffHealthTone = (
  status: DisplayTaskStatus,
  deadline?: Date | null
): StaffHealthTone => {
  if (status === 'completed') return 'delivered';
  if (deadline && !Number.isNaN(deadline.getTime())) {
    if (isPast(deadline) && !isToday(deadline)) return 'overdue';
    const daysRemaining = (deadline.getTime() - Date.now()) / 86400000;
    if (daysRemaining <= 2) return 'at_risk';
  }
  return 'on_track';
};

const getCollateralStatusPillClass = (status?: string) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'completed':
      return 'border-[#D9E6FF] bg-[#F8FBFF] text-[#1E2A5A] dark:border-white/10 dark:bg-slate-900/70 dark:text-white';
    case 'rework':
      return 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/30 dark:text-amber-300';
    case 'submitted_for_review':
    case 'approved':
      return 'border-[#C9D7FF] bg-[#EEF4FF] text-[#2F4E96] dark:border-[#4D70B4]/70 dark:bg-[#1E3A73]/45 dark:text-[#C7D8FF]';
    case 'in_progress':
      return 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/30 dark:text-sky-300';
    default:
      return 'border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-600/40 dark:bg-slate-900/40 dark:text-slate-300';
  }
};
const isCollateralStepComplete = (status?: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'approved' || normalized === 'completed';
};
const createTaskBootstrapSeed = (taskId?: string): Task => {
  const seed = mockTasks[0];
  const now = new Date();

  return {
    ...seed,
    id: taskId || seed.id,
    _id: taskId || seed._id,
    title: 'Loading task...',
    description: '',
    requesterId: seed.requesterId || 'bootstrap-requester',
    requesterName: seed.requesterName || 'Loading',
    requesterEmail: seed.requesterEmail,
    requesterPhone: seed.requesterPhone,
    requesterDepartment: seed.requesterDepartment,
    assignedTo: undefined,
    assignedToId: undefined,
    assignedToName: '',
    assignedDesignerEmail: undefined,
    ccEmails: [],
    cc_emails: [],
    deadline: now,
    proposedDeadline: undefined,
    deadlineApprovalStatus: undefined,
    deadlineApprovedBy: undefined,
    deadlineApprovedAt: undefined,
    isModification: false,
    approvalStatus: undefined,
    approvedBy: undefined,
    approvalDate: undefined,
    changeCount: 0,
    changeHistory: [],
    files: [],
    designVersions: [],
    activeDesignVersionId: undefined,
    finalDeliverableVersions: [],
    finalDeliverableReviewStatus: undefined,
    finalDeliverableReviewedBy: undefined,
    finalDeliverableReviewedAt: undefined,
    finalDeliverableReviewNote: undefined,
    campaign: undefined,
    collaterals: [],
    viewerReadAt: undefined,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
};
const normalizeTaskStatus = (value?: string): DisplayTaskStatus => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'assigned') return 'assigned';
  if (normalized === 'accepted') return 'accepted';
  if (normalized === 'in_progress') return 'in_progress';
  if (normalized === 'clarification' || normalized === 'clarification_required') {
    return 'clarification_required';
  }
  if (normalized === 'under_review') return 'under_review';
  if (normalized === 'completed') return 'completed';
  return 'pending';
};
const getStatusSelectValue = (value?: string): TaskStatus | '' => {
  const normalized = normalizeTaskStatus(value);
  if (normalized === 'pending' || normalized === 'assigned' || normalized === 'accepted') return '';
  return normalized;
};
const getWorkflowSignalPillClass = (value?: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'approved' || normalized === 'completed') {
    return 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-300';
  }
  if (normalized === 'rejected') {
    return 'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-950/30 dark:text-rose-300';
  }
  if (normalized === 'pending' || normalized === 'under_review') {
    return 'border-[#C9D7FF] bg-[#EEF4FF] text-[#2F4E96] dark:border-[#4D70B4]/70 dark:bg-[#1E3A73]/45 dark:text-[#C7D8FF]';
  }
  return 'border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-600/40 dark:bg-slate-900/40 dark:text-slate-300';
};

const categoryLabels: Record<string, string> = {
  banner: 'Banner',
  campaign_or_others: 'Campaign or others',
  social_media_creative: 'Social Media Creative',
  website_assets: 'Website Assets',
  ui_ux: 'UI/UX',
  led_backdrop: 'LED Backdrop',
  brochure: 'Brochure',
  flyer: 'Flyer',
};

const quickDesignOverviewPresetByCategory: Partial<Record<TaskCategory, string>> = {
  social_media_creative: 'instagram-square',
  banner: 'banner-10x4',
  flyer: 'a4-flyer',
  brochure: 'brochure-trifold',
  led_backdrop: 'led-backdrop',
};

const resolveQuickDesignOverviewPresetKey = (
  task: Pick<Task, 'category' | 'title' | 'description'>
) => {
  const haystack = `${task.title} ${task.description}`.toLowerCase();
  if (haystack.includes('youtube')) return 'youtube-thumbnail';
  if (haystack.includes('facebook')) return 'facebook-post';
  if (haystack.includes('whatsapp') && haystack.includes('story')) return 'whatsapp-story';
  if (haystack.includes('whatsapp')) return 'whatsapp-creative-square';
  if (haystack.includes('instagram') && haystack.includes('story')) return 'instagram-story';
  if (haystack.includes('story')) return 'instagram-story';
  if (haystack.includes('instagram')) return 'instagram-square';
  return quickDesignOverviewPresetByCategory[task.category];
};

const mapTaskUrgencyToCollateralPriority = (urgency?: TaskUrgency): CollateralPriority => {
  if (urgency === 'urgent') return 'high';
  if (urgency === 'low') return 'low';
  return 'normal';
};

const mapTaskStatusToCollateralStatus = (status?: TaskStatus): CollateralStatus => {
  if (status === 'completed') return 'completed';
  if (status === 'under_review') return 'submitted_for_review';
  if (status === 'clarification_required') return 'rework';
  if (status === 'in_progress' || status === 'assigned' || status === 'accepted') {
    return 'in_progress';
  }
  return 'pending';
};

const buildQuickDesignOverviewCollateral = (task: Task): CollateralItem => {
  const presetKey = resolveQuickDesignOverviewPresetKey(task);
  const preset = getCollateralPreset(presetKey);

  return {
    id: `quick-design-overview-${task.id}`,
    title: task.title,
    collateralType: preset?.collateralType || categoryLabels[task.category] || 'Quick Design',
    presetCategory: preset?.group,
    presetKey: preset?.id,
    presetLabel: preset?.label,
    sizeMode: preset ? 'preset' : 'custom',
    width: preset?.width,
    height: preset?.height,
    unit: preset?.unit,
    sizeLabel: preset?.sizeLabel,
    ratioLabel: preset?.ratioLabel,
    orientation: preset?.orientation || 'custom',
    platform: preset?.platform,
    usageType: preset?.usageType,
    brief: task.description,
    deadline: task.deadline,
    priority: mapTaskUrgencyToCollateralPriority(task.urgency),
    status: mapTaskStatusToCollateralStatus(task.status),
    referenceFiles: task.files.filter((file) => file.type === 'input'),
    assignedToId: task.assignedToId,
    assignedToName: task.assignedToName,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

const changeFieldLabels: Record<string, string> = {
  staff_note: 'staff note',
  approval_status: 'approval status',
  deadline_request: 'deadline request',
  emergency_approval: 'emergency approval',
  design_version: 'design version',
};

const formatChangeField = (field: string) => changeFieldLabels[field] || field.replace(/_/g, ' ');
const roleLabels: Record<UserRole, string> = {
  staff: 'Staff',
  treasurer: 'Treasurer',
  designer: 'Designer',
};
const allRoles: UserRole[] = ['staff', 'treasurer', 'designer'];
const quickCommentReactions = [
  '\u{1F44D}',
  '\u{2764}\u{FE0F}',
  '\u{1F440}',
  '\u{1F527}',
] as const;
const getAttachmentThumbnailLabel = (name: string) => {
  const ext = name.split('.').pop()?.trim().toUpperCase() || '';
  if (ext) {
    return ext.slice(0, 4);
  }
  return 'FILE';
};
const normalizeUserRole = (role?: string) =>
  allRoles.includes(role as UserRole) ? (role as UserRole) : 'staff';
const formatCommentTimestampHover = (value: Date) => format(value, 'MMMM d, yyyy - h:mm a');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const toDateInputValue = (value?: Date | string | null) => {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'yyyy-MM-dd');
};
const toTimeInputValue = (value?: Date | string | null) => {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'HH:mm');
};
const DEADLINE_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const DEADLINE_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const DEADLINE_PERIODS = ['AM', 'PM'] as const;
const assignPanelClassName =
  'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border-0 ring-1 ring-black/5 shadow-none dark:from-slate-950/70 dark:via-slate-900/60 dark:to-slate-900/45 dark:supports-[backdrop-filter]:from-slate-950/60 dark:supports-[backdrop-filter]:via-slate-900/50 dark:supports-[backdrop-filter]:to-slate-900/40 dark:ring-white/5';
const assignFieldClassName =
  'bg-white/75 border border-[#D9E6FF] backdrop-blur-lg font-semibold text-foreground/90 placeholder:text-[#9CA3AF] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF] shadow-none dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-primary/40 dark:focus-visible:border-slate-500/60';
const assignSelectContentClassName =
  'border border-[#C9D7FF] bg-[#F2F6FF]/95 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-100 dark:supports-[backdrop-filter]:bg-slate-900/70';
const parseTimeParts = (value?: string | null) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return { hour: '06', minute: '00', period: 'PM' as const };
  }

  const rawHour = Number(match[1]);
  const minute = match[2];
  const period = rawHour >= 12 ? 'PM' : 'AM';
  const hour12 = rawHour % 12 || 12;

  return {
    hour: String(hour12).padStart(2, '0'),
    minute,
    period,
  };
};
const toTwentyFourHourTime = (
  hour: string,
  minute: string,
  period: (typeof DEADLINE_PERIODS)[number]
) => {
  const normalizedHour = Number(hour);
  if (!Number.isFinite(normalizedHour) || normalizedHour < 1 || normalizedHour > 12) {
    return '';
  }

  const safeMinute = /^\d{2}$/.test(minute) ? minute : '00';
  let hours24 = normalizedHour % 12;
  if (period === 'PM') hours24 += 12;
  return `${String(hours24).padStart(2, '0')}:${safeMinute}`;
};

type DesignerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  designerScope?: 'main' | 'junior';
  portalId?: string;
};

const isDebugOrDemoDesigner = (option?: Partial<DesignerOption> | null) => {
  const haystack = `${option?.name || ''} ${option?.email || ''}`.trim().toLowerCase();
  return haystack.includes('demo') || haystack.includes('debug');
};

const sanitizeDesignerOptions = (options: DesignerOption[]) => {
  const uniqueOptions = new Map<string, DesignerOption>();

  options.forEach((option) => {
    const id = String(option.id || '').trim();
    const name = String(option.name || '').trim();
    const email = String(option.email || '').trim().toLowerCase();
    if (!id || !name) return;
    if (isDebugOrDemoDesigner({ ...option, email, name })) return;

    const key = email || `${name.toLowerCase()}::${option.designerScope || 'junior'}`;
    if (uniqueOptions.has(key)) return;

    uniqueOptions.set(key, {
      ...option,
      id,
      name,
      email,
    });
  });

  return Array.from(uniqueOptions.values()).sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.email.localeCompare(right.email) ||
      left.id.localeCompare(right.id)
  );
};

const buildFallbackDesigners = (
  currentTask?: typeof mockTasks[number] | null,
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    designerScope?: 'main' | 'junior';
    portalId?: string;
  } | null
): DesignerOption[] => {
  const options: DesignerOption[] = [];
  const assignedId = resolveTaskAssignedId(currentTask);
  const assignedName = String(currentTask?.assignedToName || '').trim();
  if (assignedId && assignedName) {
    options.push({
      id: assignedId,
      name: assignedName,
      email: normalizeEmail(assignedId),
      role: 'designer',
      designerScope: 'junior',
      portalId: `JD-${assignedId.slice(-6).toUpperCase()}`,
    });
  }

  const currentRole = String(currentUser?.role || '').toLowerCase();
  const currentId = String(currentUser?.id || '').trim();
  if (currentRole === 'designer' && currentId) {
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
    const fallbackName =
      String(currentUser?.name || '').trim() ||
      (currentEmail ? currentEmail.split('@')[0] : 'Designer');
    options.unshift({
      id: currentId,
      name: fallbackName,
      email: currentEmail,
      role: 'designer',
      designerScope: currentUser?.designerScope === 'main' ? 'main' : 'junior',
      portalId: currentUser?.portalId || `JD-${currentId.slice(-6).toUpperCase()}`,
    });
  }

  return sanitizeDesignerOptions(options);
};

type TaskAccessMode = 'full' | 'view_only';
const normalizeTaskAccessMode = (value?: string): TaskAccessMode | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'full') return 'full';
  if (normalized === 'view_only') return 'view_only';
  return null;
};
const normalizeEmail = (value?: string) => String(value || '').trim().toLowerCase();
const emptyAssignmentValues = new Set([
  '',
  'null',
  'undefined',
  'none',
  'na',
  'n/a',
  'unassigned',
  'false',
]);
const looksLikeObjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value);
const looksLikeEmail = (value: string) => value.includes('@');
const normalizeAssignmentRef = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (emptyAssignmentValues.has(normalized.toLowerCase())) return '';
  return normalized;
};
const resolveTaskAssignedId = (task?: typeof mockTasks[number]) => {
  const assignedToId = normalizeAssignmentRef(
    (task as { assignedToId?: string } | undefined)?.assignedToId
  );
  if (assignedToId) return assignedToId;
  const legacyAssigned = normalizeAssignmentRef(
    (task as { assignedTo?: string } | undefined)?.assignedTo
  );
  if (!legacyAssigned) return '';
  if (looksLikeObjectId(legacyAssigned) || looksLikeEmail(legacyAssigned)) {
    return legacyAssigned;
  }
  return '';
};
const resolveTaskCcEmails = (task?: typeof mockTasks[number]) => {
  const raw =
    (task as { ccEmails?: string[]; cc_emails?: string[] } | undefined)?.ccEmails ||
    (task as { cc_emails?: string[] } | undefined)?.cc_emails ||
    [];
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((email) => normalizeEmail(email)).filter(Boolean)));
};

type ChangeInput = Pick<TaskChange, 'type' | 'field' | 'oldValue' | 'newValue' | 'note'>;
type UploadStatus = 'uploading' | 'done' | 'error';
type ApprovalDecision = 'approved' | 'rejected';
type TaskUploadChannel = 'attachment' | 'working';
type UploadItem = {
  id: string;
  name: string;
  status: UploadStatus;
  progress?: number;
  size?: number;
  url?: string;
  error?: string;
};
type WorkingUploadStatus = 'preparing' | 'uploading' | 'done' | 'error';
type WorkingUploadItem = {
  id: string;
  name: string;
  status: WorkingUploadStatus;
  loadedBytes: number;
  totalBytes: number;
  progress: number;
  speedBytesPerSecond: number;
  error?: string;
};
type FileUploadResponse = {
  id?: string;
  webViewLink?: string;
  webContentLink?: string;
  mimeType?: string;
  thumbnailLink?: string;
  error?: string;
};
type ComposerTarget = 'comment' | 'reply';
type MentionContext = {
  target: ComposerTarget;
  start: number;
  end: number;
  query: string;
};
type PendingFinalFile = {
  name: string;
  url: string;
  driveId?: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: number;
  mime?: string;
  thumbnailUrl?: string;
};
type OutputDisplayFile = {
  id: string;
  name: string;
  url: string;
  type: 'output';
  uploadedAt: Date;
  uploadedBy: string;
  size?: number;
  mime?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  webContentLink?: string;
  driveId?: string;
};
type FileActionTarget = (typeof mockTasks)[number]['files'][number] | OutputDisplayFile | TaskFile;
type FileLinkLike = {
  url?: string;
  webViewLink?: string;
  webContentLink?: string;
  driveId?: string;
};
const getFileListItemKey = (
  file: { id?: string; url?: string; name?: string },
  index: number
) =>
  [
    String(file.id || '').trim() || 'no-id',
    String(file.url || '').trim() || 'no-url',
    String(file.name || '').trim() || 'no-name',
    String(index),
  ].join('::');
const getReviewAnnotationFileKey = (value?: { fileId?: string; fileUrl?: string; id?: string; url?: string }) => {
  const byId = String(value?.fileId || value?.id || '').trim();
  if (byId) return byId;
  return String(value?.fileUrl || value?.url || '').trim();
};
const hasReviewAnnotationContent = (annotation?: FinalDeliverableReviewAnnotation | null) => {
  if (!annotation) return false;
  const comments = Array.isArray(annotation.comments) ? annotation.comments : [];
  const strokes = Array.isArray(annotation.strokes) ? annotation.strokes : [];
  const shapes = Array.isArray(annotation.shapes) ? annotation.shapes : [];
  return comments.length > 0 || strokes.length > 0 || shapes.length > 0;
};
const normalizeFinalDeliverableReviewStatus = (
  value?: string,
  fallback: FinalDeliverableReviewStatus = 'not_submitted'
): FinalDeliverableReviewStatus => {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'not_submitted' ||
    normalized === 'pending' ||
    normalized === 'approved' ||
    normalized === 'rejected'
  ) {
    return normalized;
  }
  return fallback;
};
const STAFF_EDIT_CHANGE_FIELDS = new Set(['description']);
const normalizeTaskChangeEntry = (entry: Partial<TaskChange> & { _id?: string }, index: number): TaskChange => ({
  id:
    String(entry.id || entry._id || '').trim() ||
    `change-${index}-${new Date(entry.createdAt ?? Date.now()).getTime()}`,
  type: (entry.type as TaskChange['type']) || 'update',
  field: String(entry.field || '').trim(),
  oldValue: entry.oldValue ?? '',
  newValue: entry.newValue ?? '',
  note: entry.note ?? '',
  userId: String(entry.userId || '').trim(),
  userName: String(entry.userName || '').trim() || 'Unknown',
  userRole: normalizeUserRole(entry.userRole),
  createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
});
const isEditTaskHistoryChange = (entry?: Partial<TaskChange>) => {
  if (!entry) return false;
  if (String(entry.userRole || '').trim().toLowerCase() !== 'staff') return false;
  const field = String(entry.field || '').trim().toLowerCase();
  if (field === 'description' || field === 'staff_note') return true;
  if (field === 'files') {
    const type = String(entry.type || '').trim().toLowerCase();
    return type === 'file_added' || type === 'file_removed';
  }
  return false;
};

const glassPanelClass =
  'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF]/35 ring-0 rounded-2xl shadow-none dark:border-border dark:bg-card/95 dark:bg-none dark:[background-image:none] dark:shadow-none';
const fileRowClass =
  'flex items-center justify-between rounded-lg border border-transparent bg-gradient-to-r from-[#F7FAFF]/90 via-[#EEF4FF]/60 to-[#EAF2FF]/80 px-3 py-1 supports-[backdrop-filter]:bg-[#EEF4FF]/55 backdrop-blur-xl dark:!border-sidebar-border/70 dark:!bg-sidebar/60 dark:supports-[backdrop-filter]:!bg-sidebar/60 dark:!bg-none dark:text-sidebar-foreground';
const fileListShellClass =
  'rounded-2xl border border-[#DCE6FF]/70 bg-white/35 p-1.5 dark:border-border dark:bg-card/78 dark:[background-image:none]';
const fileListScrollClass =
  'max-h-[30rem] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin';
const fileActionButtonClass =
  'icon-action-press inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-lg border border-[#E1E9FF] bg-[#F5F8FF] text-[#6B7A99] shadow-none transition-colors duration-150 ease-out hover:border-[#C8D7FF] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-100 disabled:border-[#DCE6FF] disabled:bg-[#F5F8FF] disabled:text-[#A8B5D1] dark:border-sidebar-border/70 dark:bg-sidebar-accent/80 dark:text-sidebar-foreground/85 dark:hover:border-sidebar-border dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground dark:focus-visible:ring-primary/35 dark:disabled:border-sidebar-border/70 dark:disabled:bg-sidebar-accent/80 dark:disabled:text-sidebar-foreground/55';
const fileGlassPillButtonClass =
  'h-8 rounded-lg border border-[#D3E1FF] bg-gradient-to-r from-white/85 via-[#EEF4FF]/78 to-[#E8F1FF]/88 px-2.5 text-[#223467] shadow-none transition-all duration-150 ease-out supports-[backdrop-filter]:bg-[#EEF4FF]/62 backdrop-blur-md hover:border-[#D3E1FF] hover:bg-[#EEF4FF]/62 hover:text-[#223467] hover:shadow-none active:translate-y-[1px] active:scale-[0.98] dark:border-slate-600/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600/70 dark:hover:bg-slate-900/70 dark:hover:text-slate-100';
const fileGlassIconButtonClass =
  'inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-lg border border-[#E1E9FF] bg-[#F5F8FF] text-[#6B7A99] shadow-none transition-colors duration-150 ease-out hover:border-[#C8D7FF] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] focus-visible:ring-2 focus-visible:ring-primary/25 active:translate-y-[1px] active:scale-[0.94] disabled:opacity-100 disabled:border-[#DCE6FF] disabled:bg-[#F5F8FF] disabled:text-[#A8B5D1] dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:border-border dark:hover:bg-muted/80 dark:hover:text-foreground dark:focus-visible:ring-primary/35 dark:disabled:border-border dark:disabled:bg-muted dark:disabled:text-muted-foreground/65';
const badgeGlassClass =
  'rounded-full border border-[#C9D7FF] bg-gradient-to-r from-white/80 via-[#E6F1FF]/85 to-[#D6E5FF]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1E2A5A] backdrop-blur-xl dark:border-border dark:bg-muted/70 dark:bg-none dark:text-foreground dark:shadow-none';
const changeHistoryCardClass = 'rounded-lg border border-border/60 bg-secondary/40';
const PSD_FILE_ICON_URL = '/icons/psd-file.svg';
const MAX_WORKING_FILE_BYTES = Math.floor(2.5 * 1024 * 1024 * 1024);
const WORKING_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;

import { API_URL, authFetch, getAuthToken, getFreshAuthToken, openDriveReconnectWindow } from '@/lib/api';

const shouldPromptDriveReconnect = (errorMessage?: string) => {
  const normalized = String(errorMessage || '').toLowerCase();
  return (
    normalized.includes('drive oauth not connected') ||
    normalized.includes('must be set for oauth') ||
    normalized.includes('missing oauth code')
  );
};

function AttachmentThumbnail({
  previewUrls,
  name,
}: {
  previewUrls?: string[];
  name: string;
}) {
  const normalizedPreviewUrls = useMemo(
    () =>
      Array.from(
        new Set(
          (previewUrls || [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      ),
    [previewUrls]
  );
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const activePreviewUrl =
    activePreviewIndex < normalizedPreviewUrls.length
      ? normalizedPreviewUrls[activePreviewIndex]
      : '';

  useEffect(() => {
    setActivePreviewIndex(0);
  }, [normalizedPreviewUrls]);

  if (!activePreviewUrl) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(191,214,255,0.5),_transparent_58%),linear-gradient(160deg,_rgba(245,248,255,0.95),_rgba(224,234,255,0.75))] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5B6E96] dark:bg-[linear-gradient(160deg,_rgba(30,41,59,0.95),_rgba(51,65,85,0.75))] dark:text-slate-200">
        {getAttachmentThumbnailLabel(name)}
      </span>
    );
  }

  return (
    <img
      src={activePreviewUrl}
      alt=""
      className="block h-full w-full object-cover"
      loading="lazy"
      onError={() =>
        setActivePreviewIndex((current) => {
          const nextIndex = current + 1;
          return nextIndex <= normalizedPreviewUrls.length ? nextIndex : current;
        })
      }
    />
  );
}

function TaskDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | {
        task?: typeof mockTasks[number];
        highlightChangeId?: string;
        focusSection?: 'change-history';
      }
    | null;
  const { user } = useAuth();
  const apiUrl = API_URL;
  const stateTask = locationState?.task;
  const highlightChangeId = locationState?.highlightChangeId;
  const focusSection = locationState?.focusSection;
  const localTask = useMemo(() => (id ? loadLocalTaskById(id) : undefined), [id]);
  const shouldAwaitFreshTaskOnEntry = Boolean(apiUrl && id && !stateTask);
  const resolvedInitialTask = useMemo(
    () => stateTask || localTask || mockTasks.find((t) => t.id === id),
    [id, localTask, stateTask]
  );
  const bootstrapTask = useMemo(() => createTaskBootstrapSeed(id), [id]);
  const hasInitialTask = Boolean(resolvedInitialTask);
  const initialTask = useMemo(
    () => resolvedInitialTask ?? bootstrapTask,
    [bootstrapTask, resolvedInitialTask]
  );
  const [taskState, setTaskState] = useState<Task | undefined>(initialTask);
  const [isLoading, setIsLoading] = useState(
    shouldAwaitFreshTaskOnEntry || (!hasInitialTask && Boolean(id))
  );
  const [taskRouteState, setTaskRouteState] = useState<'loading' | 'ready' | 'not_found'>(
    shouldAwaitFreshTaskOnEntry ? 'loading' : hasInitialTask ? 'ready' : id ? 'loading' : 'not_found'
  );
  const [isStaffStatusPanelExpanded, setIsStaffStatusPanelExpanded] = useState(true);
  const [staffStatusPanelPosition, setStaffStatusPanelPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningTask, setAssigningTask] = useState<typeof mockTasks[number] | null>(null);
  const [designerOptions, setDesignerOptions] = useState<DesignerOption[]>([]);
  const [designersLoaded, setDesignersLoaded] = useState(false);
  const [isLoadingDesigners, setIsLoadingDesigners] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignmentDeadline, setAssignmentDeadline] = useState('');
  const [assignmentDeadlineTime, setAssignmentDeadlineTime] = useState('18:00');
  const [deadlineCalendarOpen, setDeadlineCalendarOpen] = useState(false);
  const [isAssigningDesigner, setIsAssigningDesigner] = useState(false);
  const [assignSuccessInfo, setAssignSuccessInfo] = useState<{
    taskTitle: string;
    designerName: string;
    ccCount: number;
  } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [commentSearch, setCommentSearch] = useState('');
  const [isCommentSearchVisible, setIsCommentSearchVisible] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isChatComposerFocused, setIsChatComposerFocused] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState<TaskFile[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<TaskFile[]>([]);
  const [commentUpdateInFlightId, setCommentUpdateInFlightId] = useState<string | null>(null);
  const [commentDeleteInFlightId, setCommentDeleteInFlightId] = useState<string | null>(null);
  const [commentReactionInFlightKey, setCommentReactionInFlightKey] = useState<string | null>(null);
  const [isUploadingCommentAttachments, setIsUploadingCommentAttachments] = useState(false);
  const [commentAttachmentUploadProgress, setCommentAttachmentUploadProgress] = useState<number | null>(
    null
  );
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; role: UserRole }>>(
    {}
  );
  const [newStatus, setNewStatus] = useState<TaskStatus | ''>(
    getStatusSelectValue(initialTask?.status)
  );
  const [changeCount, setChangeCount] = useState(initialTask?.changeCount ?? 0);
  const lastMarkedViewedTaskRef = useRef('');
  const taskStateRef = useRef<typeof taskState>(initialTask);
  const staffStatusPanelRef = useRef<HTMLDivElement | null>(null);
  const staffStatusPanelDragOffsetRef = useRef({ x: 0, y: 0 });
  const staffStatusPanelDragActiveRef = useRef(false);
  const initialApprovalStatus: ApprovalStatus | undefined =
    initialTask?.approvalStatus ?? ((initialTask?.changeCount ?? 0) >= 3 ? 'pending' : undefined);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | undefined>(
    initialApprovalStatus
  );
  const [changeHistory, setChangeHistory] = useState<TaskChange[]>(
    () => (initialTask?.changeHistory ?? []).map((entry, index) => normalizeTaskChangeEntry(entry, index))
  );
  const [editedDescription, setEditedDescription] = useState(initialTask?.description ?? '');
  const [staffNote, setStaffNote] = useState('');
  const [editedDeadline, setEditedDeadline] = useState(
    initialTask ? format(initialTask.deadline, 'yyyy-MM-dd') : ''
  );
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [isGovernanceExpanded, setIsGovernanceExpanded] = useState(false);
  const editTaskGovernanceVariant: 'minimal' | 'premium' = 'premium';
  const [deadlineRequest, setDeadlineRequest] = useState(
    initialTask?.proposedDeadline ? format(initialTask.proposedDeadline, 'yyyy-MM-dd') : ''
  );
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<'reference' | 'others'>('reference');
  const [newFileDetails, setNewFileDetails] = useState('');
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<number | null>(null);
  const [expandedCollateralIds, setExpandedCollateralIds] = useState<Set<string>>(new Set());
  const [selectedCampaignCollateralId, setSelectedCampaignCollateralId] = useState('');
  const [isUploadingWorking, setIsUploadingWorking] = useState(false);
  const [workingUploadItems, setWorkingUploadItems] = useState<WorkingUploadItem[]>([]);
  const [isFinalUploadDragging, setIsFinalUploadDragging] = useState(false);
  const [finalUploadItems, setFinalUploadItems] = useState<UploadItem[]>([]);
  const [showFinalUploadList, setShowFinalUploadList] = useState(true);
  const [pendingFinalFiles, setPendingFinalFiles] = useState<PendingFinalFile[]>([]);
  const [replaceFinalTarget, setReplaceFinalTarget] = useState<{
    index: number;
    name: string;
    url: string;
  } | null>(null);
  const [isEmergencyUpdating, setIsEmergencyUpdating] = useState(false);
  const [finalLinkName, setFinalLinkName] = useState('');
  const [finalLinkUrl, setFinalLinkUrl] = useState('');
  const [finalLinkValidationError, setFinalLinkValidationError] = useState('');
  const [finalVersionNote, setFinalVersionNote] = useState('');
  const [selectedFinalVersionId, setSelectedFinalVersionId] = useState('');
  const [isAddingFinalLink, setIsAddingFinalLink] = useState(false);
  const [isUpdatingFinalVersionNote, setIsUpdatingFinalVersionNote] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [isAcceptingTask, setIsAcceptingTask] = useState(false);
  const [emergencyDecisionReason, setEmergencyDecisionReason] = useState('');
  const [showWorkingFileList, setShowWorkingFileList] = useState(true);
  const [showFinalDeliverableList, setShowFinalDeliverableList] = useState(true);
  const [selectedDeliverableIds, setSelectedDeliverableIds] = useState<Set<string>>(new Set());
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [zipDownloadState, setZipDownloadState] = useState<{
    mode: 'all' | 'selected';
    phase: 'preparing' | 'building' | 'downloading' | 'starting';
    fileCount: number;
    percent: number | null;
  } | null>(null);
  const [isEditAttachmentDragging, setIsEditAttachmentDragging] = useState(false);
  const [isWorkingUploadDragging, setIsWorkingUploadDragging] = useState(false);
  const [isCommentComposerDragging, setIsCommentComposerDragging] = useState(false);
  const [isReplyComposerDragging, setIsReplyComposerDragging] = useState(false);
  const [copiedFileKey, setCopiedFileKey] = useState('');
  const [approvalDecisionInFlight, setApprovalDecisionInFlight] = useState<ApprovalDecision | null>(null);
  const [approvalRequestInFlight, setApprovalRequestInFlight] = useState(false);
  const [finalReviewDecisionInFlight, setFinalReviewDecisionInFlight] =
    useState<ApprovalDecision | null>(null);
  const [finalReviewNote, setFinalReviewNote] = useState('');
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const [annotationDialogReadOnly, setAnnotationDialogReadOnly] = useState(false);
  const [annotationTargetFile, setAnnotationTargetFile] = useState<FileActionTarget | null>(null);
  const [attachmentPreviewFile, setAttachmentPreviewFile] = useState<AttachmentPreviewFile | null>(
    null
  );
  const [draftReviewAnnotationsByFile, setDraftReviewAnnotationsByFile] = useState<
    Record<string, FinalDeliverableReviewAnnotation>
  >({});
  const sizeFetchRef = useRef(new Set<string>());
  const addAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const commentAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const replyAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const workingUploadInputRef = useRef<HTMLInputElement | null>(null);
  const finalUploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFinalFileInputRef = useRef<HTMLInputElement | null>(null);
  const commentSearchInputRef = useRef<HTMLInputElement | null>(null);
  const commentComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const replyComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const copiedFileResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zipStatusTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isChatComposerFocusedRef = useRef(false);
  const clientIdRef = useRef<string>('');
  const finalUploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      zipStatusTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);
  const workingUploadDismissTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const changeHistoryListRef = useRef<HTMLDivElement | null>(null);
  const changeHistoryPanelRef = useRef<HTMLDivElement | null>(null);
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [focusedChangeId, setFocusedChangeId] = useState(highlightChangeId || '');
  const [highlightedChangeId, setHighlightedChangeId] = useState(highlightChangeId || '');
  const [isChangeHistoryPanelHighlighted, setIsChangeHistoryPanelHighlighted] = useState(
    focusSection === 'change-history'
  );
  const [designerHistoryJumpId, setDesignerHistoryJumpId] = useState('');
  useEffect(() => {
    setTaskRouteState(
      shouldAwaitFreshTaskOnEntry ? 'loading' : hasInitialTask ? 'ready' : id ? 'loading' : 'not_found'
    );
    setTaskState(initialTask);
    setIsLoading(shouldAwaitFreshTaskOnEntry || (!hasInitialTask && Boolean(id)));
    setNewStatus(getStatusSelectValue(initialTask?.status));
    setChangeCount(initialTask?.changeCount ?? 0);
    setApprovalStatus(
      initialTask?.approvalStatus ?? ((initialTask?.changeCount ?? 0) >= 3 ? 'pending' : undefined)
    );
    setChangeHistory(
      (initialTask?.changeHistory ?? []).map((entry, index) => normalizeTaskChangeEntry(entry, index))
    );
    setEditedDescription(initialTask?.description ?? '');
    setEditedDeadline(initialTask ? format(initialTask.deadline, 'yyyy-MM-dd') : '');
    setDeadlineRequest(
      initialTask?.proposedDeadline ? format(initialTask.proposedDeadline, 'yyyy-MM-dd') : ''
    );
  }, [hasInitialTask, id, initialTask, shouldAwaitFreshTaskOnEntry]);
  const storageKey = id ? `designhub.task.${id}` : '';
  const commentDraftKey = useMemo(() => {
    const taskIdForDraft = String(id || taskState?.id || '').trim();
    const userIdForDraft = String(user?.id || '').trim();
    if (!taskIdForDraft || !userIdForDraft) return '';
    return `designhub.task.${taskIdForDraft}.chat-draft.${userIdForDraft}`;
  }, [id, taskState?.id, user?.id]);
  const latestApprovalCheckpointAt = useMemo(
    () =>
      changeHistory.reduce((latest, entry) => {
        if (entry.field !== 'approval_status') return latest;
        const time = new Date(entry.createdAt ?? 0).getTime();
        return time > latest ? time : latest;
      }, 0),
    [changeHistory]
  );
  const staffChangeCount = useMemo(() => {
    return changeHistory.filter((entry) => {
      if (entry.userRole !== 'staff') return false;
      if (!STAFF_EDIT_CHANGE_FIELDS.has(String(entry.field || ''))) return false;
      const time = new Date(entry.createdAt ?? 0).getTime();
      return latestApprovalCheckpointAt ? time > latestApprovalCheckpointAt : true;
    }).length;
  }, [changeHistory, latestApprovalCheckpointAt]);
  useEffect(() => {
    return () => {
      if (copiedFileResetTimerRef.current) {
        clearTimeout(copiedFileResetTimerRef.current);
      }
      if (mentionBlurTimeoutRef.current) {
        clearTimeout(mentionBlurTimeoutRef.current);
      }
      workingUploadDismissTimersRef.current.forEach((timer) => clearTimeout(timer));
      workingUploadDismissTimersRef.current.clear();
    };
  }, []);
  const displayedChangeCount = user?.role === 'staff' ? staffChangeCount : changeCount;
  const approvalLockedForStaff =
    user?.role === 'staff' &&
    (approvalStatus === 'pending' || approvalStatus === 'rejected');
  const staffChangeLabel = staffChangeCount === 1 ? '1 change updated' : `${staffChangeCount} changes updated`;
  const canSendForApproval =
    user?.role === 'staff' && staffChangeCount >= 3;
  const staffChangeLimitReached = user?.role === 'staff' && staffChangeCount >= 3;
  const editsRemainingBeforeTreasurerApproval = Math.max(0, 3 - staffChangeCount);
  useEffect(() => {
    if (!approvalLockedForStaff) return;
    setIsEditingTask(false);
  }, [approvalLockedForStaff]);
  const chronologicalChangeHistory = useMemo(
    () =>
      [...changeHistory].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      ),
    [changeHistory]
  );
  const latestPendingApprovalAt = useMemo(() => {
    return chronologicalChangeHistory.reduce((latest, entry) => {
      if (entry.field !== 'approval_status') return latest;
      const status = String(entry.newValue || '').trim().toLowerCase();
      if (status !== 'pending') return latest;
      const time = new Date(entry.createdAt ?? 0).getTime();
      return time > latest ? time : latest;
    }, 0);
  }, [chronologicalChangeHistory]);
  const editTaskChangeHistory = useMemo(
    () => chronologicalChangeHistory.filter((entry) => isEditTaskHistoryChange(entry)),
    [chronologicalChangeHistory]
  );
  const treasurerApprovalCycleChanges = useMemo(() => {
    if (!latestPendingApprovalAt) return [];
    const previousApprovalCheckpointAt = chronologicalChangeHistory.reduce((latest, entry) => {
      if (entry.field !== 'approval_status') return latest;
      const time = new Date(entry.createdAt ?? 0).getTime();
      if (time >= latestPendingApprovalAt) return latest;
      return time > latest ? time : latest;
    }, 0);
    return editTaskChangeHistory.filter((entry) => {
      const time = new Date(entry.createdAt ?? 0).getTime();
      return time > previousApprovalCheckpointAt && time <= latestPendingApprovalAt;
    });
  }, [chronologicalChangeHistory, editTaskChangeHistory, latestPendingApprovalAt]);
  const currentStaffCycleChanges = useMemo(() => {
    if (approvalStatus === 'pending' && treasurerApprovalCycleChanges.length > 0) {
      return treasurerApprovalCycleChanges.filter((entry) =>
        STAFF_EDIT_CHANGE_FIELDS.has(String(entry.field || ''))
      );
    }
    const trackedStaffChanges = changeHistory.filter((entry) => {
      if (String(entry.userRole || '').trim().toLowerCase() !== 'staff') return false;
      return STAFF_EDIT_CHANGE_FIELDS.has(String(entry.field || ''));
    });
    if (!latestApprovalCheckpointAt) return trackedStaffChanges;
    return trackedStaffChanges.filter((entry) => {
      const time = new Date(entry.createdAt ?? 0).getTime();
      return time > latestApprovalCheckpointAt;
    });
  }, [
    approvalStatus,
    treasurerApprovalCycleChanges,
    latestApprovalCheckpointAt,
    changeHistory,
  ]);
  const changeHistoryForDisplay = useMemo(() => {
    if (currentStaffCycleChanges.length > 0) {
      return currentStaffCycleChanges;
    }
    if (
      user?.role === 'treasurer' &&
      approvalStatus === 'pending' &&
      treasurerApprovalCycleChanges.length > 0
    ) {
      return treasurerApprovalCycleChanges;
    }
    return editTaskChangeHistory;
  }, [
    currentStaffCycleChanges,
    user?.role,
    approvalStatus,
    treasurerApprovalCycleChanges,
    editTaskChangeHistory,
  ]);
  const isTreasurerReviewMode = user?.role === 'treasurer' && approvalStatus === 'pending';
  const changeHistorySelectOptions = useMemo(
    () =>
      changeHistoryForDisplay.map((entry, index) => ({
        id: entry.id,
        shortLabel: isTreasurerReviewMode
          ? `V${index + 1} - ${format(new Date(entry.createdAt), 'MMM d, h:mm a')}`
          : `V${index + 1} - ${format(new Date(entry.createdAt), 'MMM d, h:mm a')}`,
        longLabel: isTreasurerReviewMode ? `Change V${index + 1}` : `Update V${index + 1}`,
        timeLabel: format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a'),
      })),
    [changeHistoryForDisplay, isTreasurerReviewMode]
  );
  const selectedHistoryOption = useMemo(
    () => changeHistorySelectOptions.find((option) => option.id === designerHistoryJumpId) ?? null,
    [changeHistorySelectOptions, designerHistoryJumpId]
  );
  const designVersions = taskState?.designVersions ?? [];
  const activeDesignVersionId =
    taskState?.activeDesignVersionId || designVersions[designVersions.length - 1]?.id;
  const activeDesignVersion = designVersions.find((version) => version.id === activeDesignVersionId);
  const isDesignerRole = user?.role === 'designer';
  const isMainDesignerUser = isMainDesigner(user);
  const deadlineTimeParts = parseTimeParts(assignmentDeadlineTime);
  const compareLeft = designVersions.find((version) => version.id === compareLeftId);
  const compareRight = designVersions.find((version) => version.id === compareRightId);
  useEffect(() => {
    if (!apiUrl || !user?.id) return;
    const taskKey = taskState?.id || id;
    if (!taskKey || taskState?.viewerReadAt) return;

    const requestKey = `${user.id}:${taskKey}`;
    if (lastMarkedViewedTaskRef.current === requestKey) return;
    lastMarkedViewedTaskRef.current = requestKey;

    let isActive = true;
    authFetch(`${apiUrl}/api/tasks/${taskKey}/viewed`, {
      method: 'POST',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to update task read status.');
        }
        const data = await response.json();
        if (!isActive) return;
        const hydrated = hydrateTask(data);
        setTaskState((prev) => {
          if (!prev) return hydrated;
          const prevId = prev.id || prev._id;
          const nextId = hydrated?.id || hydrated?._id;
          if (!prevId || !nextId || prevId !== nextId) return prev;
          return { ...prev, viewerReadAt: hydrated?.viewerReadAt };
        });
        window.dispatchEvent(new CustomEvent('designhub:task:updated', { detail: hydrated }));
      })
      .catch((error) => {
        lastMarkedViewedTaskRef.current = '';
        console.error('Failed to persist task read state:', error);
      });

    return () => {
      isActive = false;
    };
  }, [apiUrl, id, taskState?.id, taskState?.viewerReadAt, user?.id]);

  useEffect(() => {
    if (highlightChangeId) {
      setFocusedChangeId(highlightChangeId);
      setHighlightedChangeId(highlightChangeId);
    }
  }, [highlightChangeId]);

  useEffect(() => {
    if (focusSection !== 'change-history') return;
    setIsChangeHistoryPanelHighlighted(true);

    let frameId = 0;
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
    frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        changeHistoryPanelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 80);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [focusSection, changeHistoryForDisplay.length]);

  useEffect(() => {
    if (!focusedChangeId || typeof document === 'undefined') return;
    let frameId = 0;
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
    const scrollToFocusedCard = () => {
      const target = document.getElementById(`change-${focusedChangeId}`);
      if (!target) return;
      const container = changeHistoryListRef.current;
      if (!container) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const topOffset = 12;
      const nextScrollTop =
        currentScrollTop +
        (targetRect.top - containerRect.top) -
        topOffset;
      container.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: 'smooth',
      });
    };
    frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(scrollToFocusedCard, 60);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [focusedChangeId, changeHistoryForDisplay.length]);

  useEffect(() => {
    if (!focusedChangeId) return;
    setHighlightedChangeId(focusedChangeId);
    const timeoutId = window.setTimeout(() => {
      setHighlightedChangeId((current) => (current === focusedChangeId ? '' : current));
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, [focusedChangeId]);

  useEffect(() => {
    if (!highlightedChangeId || typeof document === 'undefined') return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const panel = changeHistoryPanelRef.current;
      if (!panel) return;
      const target = event.target;
      if (target instanceof Node && panel.contains(target)) return;
      setHighlightedChangeId('');
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [highlightedChangeId]);

  useEffect(() => {
    if (!isChangeHistoryPanelHighlighted) return;
    const timeoutId = window.setTimeout(() => {
      setIsChangeHistoryPanelHighlighted(false);
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, [isChangeHistoryPanelHighlighted]);

  useEffect(() => {
    if (!designerHistoryJumpId) return;
    const exists = changeHistoryForDisplay.some((entry) => entry.id === designerHistoryJumpId);
    if (!exists) {
      setDesignerHistoryJumpId('');
    }
  }, [designerHistoryJumpId, changeHistoryForDisplay]);

  useEffect(() => {
    if (designVersions.length < 2) return;
    if (!compareLeftId && designVersions.length >= 2) {
      setCompareLeftId(designVersions[Math.max(0, designVersions.length - 2)].id);
    }
    if (!compareRightId) {
      setCompareRightId(designVersions[designVersions.length - 1].id);
    }
  }, [compareLeftId, compareRightId, designVersions]);

  useEffect(() => {
    const syncedStatus = getStatusSelectValue(taskState?.status);
    setNewStatus((current) => (current === syncedStatus ? current : syncedStatus));
  }, [taskState?.id, taskState?.status]);

  const hydrateTask = (raw: typeof taskState) => {
    if (!raw) return raw;
    const toDate = (value?: string | Date) => (value ? new Date(value) : undefined);
    return {
      ...raw,
      deadline: new Date(raw.deadline),
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      proposedDeadline: raw.proposedDeadline ? toDate(raw.proposedDeadline as unknown as string) : undefined,
      deadlineApprovedAt: raw.deadlineApprovedAt ? toDate(raw.deadlineApprovedAt as unknown as string) : undefined,
      emergencyApprovedAt: raw.emergencyApprovedAt ? toDate(raw.emergencyApprovedAt as unknown as string) : undefined,
      emergencyRequestedAt: raw.emergencyRequestedAt ? toDate(raw.emergencyRequestedAt as unknown as string) : undefined,
      viewerReadAt: Object.prototype.hasOwnProperty.call(raw, 'viewerReadAt')
        ? (raw.viewerReadAt ? toDate(raw.viewerReadAt as unknown as string) : undefined)
        : taskState?.viewerReadAt,
      finalDeliverableReviewedAt: raw.finalDeliverableReviewedAt
        ? toDate(raw.finalDeliverableReviewedAt as unknown as string)
        : undefined,
      files: raw.files?.map((file, index) => ({
        ...file,
        id: file.id ?? `file-${index}-${file.name || 'attachment'}`,
        uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
      })),
      comments: raw.comments?.map((comment, index) => ({
        ...comment,
        id:
          comment.id ||
          (comment as { _id?: string })._id ||
          `comment-${index}-${comment.userId || 'user'}`,
        parentId: comment.parentId || '',
        mentions: comment.mentions?.filter((role) => allRoles.includes(role as UserRole)) ?? [],
        userRole: normalizeUserRole(comment.userRole),
        editedAt: comment.editedAt ? new Date(comment.editedAt) : undefined,
        deletedAt: comment.deletedAt ? new Date(comment.deletedAt) : undefined,
        receiverRoles:
          comment.receiverRoles?.filter((role) => allRoles.includes(role)) ?? [],
        attachments:
          comment.attachments?.map((attachment, attachmentIndex) => ({
            ...attachment,
            id:
              attachment.id ||
              `comment-attachment-${index}-${attachmentIndex}-${attachment.name || 'file'}`,
            uploadedAt: attachment.uploadedAt ? new Date(attachment.uploadedAt) : new Date(),
          })) ?? [],
        seenBy: comment.seenBy?.map((entry) => ({
          ...entry,
          role: normalizeUserRole(entry.role),
          seenAt: new Date(entry.seenAt),
        })) ?? [],
        reactions: comment.reactions?.map((reaction) => ({
          ...reaction,
          userRole: normalizeUserRole(reaction.userRole),
          createdAt: new Date(reaction.createdAt),
        })) ?? [],
        createdAt: new Date(comment.createdAt),
      })),
      designVersions: (() => {
        const usedIds = new Map<string, number>();
        return (
          raw.designVersions?.map((version, index) => {
            const baseId =
              version.id ||
              (version as { _id?: string })._id ||
              `version-${index}-${version.name || 'design'}`;
            const duplicateCount = usedIds.get(baseId) ?? 0;
            usedIds.set(baseId, duplicateCount + 1);
            return {
              ...version,
              id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount}`,
              uploadedAt: new Date(version.uploadedAt),
            };
          }) ?? []
        );
      })(),
      finalDeliverableVersions: (() => {
        const usedIds = new Map<string, number>();
        return (
          raw.finalDeliverableVersions?.map((version, index) => {
            const baseId =
              version.id ||
              (version as { _id?: string })._id ||
              `final-version-${version.version || index + 1}-${index}`;
            const duplicateCount = usedIds.get(baseId) ?? 0;
            usedIds.set(baseId, duplicateCount + 1);
            return {
              ...version,
              id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount}`,
              uploadedAt: new Date(version.uploadedAt),
              reviewedAt: version.reviewedAt ? new Date(version.reviewedAt) : undefined,
              reviewAnnotations:
                version.reviewAnnotations?.map((annotation, annotationIndex) => ({
                  ...annotation,
                  id:
                    annotation.id ||
                    `annotation-${index}-${annotationIndex}`,
                  fileId:
                    String(annotation.fileId || '').trim() ||
                    String(annotation.fileUrl || '').trim(),
                  fileName: String(annotation.fileName || '').trim(),
                  fileUrl: String(annotation.fileUrl || '').trim(),
                  comments:
                    annotation.comments?.map((comment, commentIndex) => ({
                      ...comment,
                      id:
                        comment.id ||
                        `annotation-comment-${index}-${annotationIndex}-${commentIndex}`,
                      x: Number(comment.x ?? 0),
                      y: Number(comment.y ?? 0),
                      text: String(comment.text || ''),
                      thread:
                        comment.thread?.map((message, messageIndex) => ({
                          ...message,
                          id:
                            message.id ||
                            `annotation-thread-${index}-${annotationIndex}-${commentIndex}-${messageIndex}`,
                          text: String(message.text || ''),
                          author: String(message.author || ''),
                          createdAt: String(message.createdAt || ''),
                        })) ?? [],
                    })) ?? [],
                  shapes:
                    annotation.shapes?.map((shape, shapeIndex) => ({
                      ...shape,
                      id: shape.id || `annotation-shape-${index}-${annotationIndex}-${shapeIndex}`,
                      kind: String(shape.kind || 'pen') as
                        | 'pen'
                        | 'highlighter'
                        | 'arrow'
                        | 'rect'
                        | 'ellipse'
                        | 'text'
                        | 'blur_rect'
                        | 'highlight_rect',
                      color: String(shape.color || '#ef4444'),
                      width: Number(shape.width ?? 2),
                      opacity: Number(shape.opacity ?? 1),
                      points:
                        shape.points?.map((point) => ({
                          x: Number(point.x ?? 0),
                          y: Number(point.y ?? 0),
                        })) ?? [],
                      startX: Number(shape.startX ?? 0),
                      startY: Number(shape.startY ?? 0),
                      endX: Number(shape.endX ?? 0),
                      endY: Number(shape.endY ?? 0),
                      x: Number(shape.x ?? 0),
                      y: Number(shape.y ?? 0),
                      text: String(shape.text || ''),
                      fontSize: Number(shape.fontSize ?? 24),
                      fillColor: String(shape.fillColor || ''),
                    })) ?? [],
                  strokes:
                    annotation.strokes?.map((stroke, strokeIndex) => ({
                      ...stroke,
                      id:
                        stroke.id ||
                        `annotation-stroke-${index}-${annotationIndex}-${strokeIndex}`,
                      width: Number(stroke.width ?? 2),
                      points:
                        stroke.points?.map((point) => ({
                          x: Number(point.x ?? 0),
                          y: Number(point.y ?? 0),
                        })) ?? [],
                    })) ?? [],
                })) ?? [],
              files:
                version.files?.map((file, fileIndex) => ({
                  ...file,
                  id:
                    file.id ||
                    (file as { _id?: string })._id ||
                    `final-file-${index}-${fileIndex}-${file.name || 'file'}`,
                  uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
                })) ?? [],
            };
          }) ?? []
        );
      })(),
      campaign: raw.campaign
        ? {
            ...raw.campaign,
            commonDeadline: raw.campaign.commonDeadline
              ? new Date(raw.campaign.commonDeadline)
              : undefined,
          }
        : undefined,
      collaterals:
        raw.collaterals?.map((collateral, index) => ({
          ...collateral,
          id:
            collateral.id ||
            `collateral-${index}-${collateral.collateralType || collateral.presetLabel || 'item'}`,
          deadline: collateral.deadline ? new Date(collateral.deadline) : undefined,
          createdAt: collateral.createdAt ? new Date(collateral.createdAt) : undefined,
          updatedAt: collateral.updatedAt ? new Date(collateral.updatedAt) : undefined,
          referenceFiles:
            collateral.referenceFiles?.map((file, fileIndex) => ({
              ...file,
              id:
                file.id ||
                `collateral-file-${index}-${fileIndex}-${file.name || 'reference'}`,
              uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
            })) ?? [],
        })) ?? [],
      changeHistory: raw.changeHistory?.map((entry, index) => normalizeTaskChangeEntry(entry, index)),
    };
  };

  const withAccessMetadata = (
    nextTask: typeof taskState,
    currentTask: typeof taskState = taskState
  ) => {
    if (!nextTask) return nextTask;
    const nextRaw = nextTask as {
      accessMode?: string;
      viewOnly?: boolean;
      ccEmails?: string[];
      cc_emails?: string[];
    };
    const currentRaw = (currentTask || {}) as {
      accessMode?: string;
      viewOnly?: boolean;
      ccEmails?: string[];
      cc_emails?: string[];
    };
    const merged: typeof nextTask = { ...nextTask };
    if (!nextRaw.accessMode && currentRaw.accessMode) {
      (merged as { accessMode?: string }).accessMode = currentRaw.accessMode;
    }
    if (nextRaw.viewOnly === undefined && currentRaw.viewOnly !== undefined) {
      (merged as { viewOnly?: boolean }).viewOnly = currentRaw.viewOnly;
    }
    const nextCc = resolveTaskCcEmails(nextTask as typeof mockTasks[number]);
    if (nextCc.length === 0) {
      const currentCc = resolveTaskCcEmails(currentTask as typeof mockTasks[number]);
      if (currentCc.length > 0) {
        (merged as { ccEmails?: string[]; cc_emails?: string[] }).ccEmails = currentCc;
        (merged as { ccEmails?: string[]; cc_emails?: string[] }).cc_emails = currentCc;
      }
    }
    return merged;
  };

  const normalizeIncomingComment = (comment: any): TaskComment => ({
    ...comment,
    id:
      comment?.id ||
      comment?._id ||
      `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parentId: comment?.parentId || '',
    mentions: comment?.mentions?.filter((role: string) => allRoles.includes(role as UserRole)) ?? [],
    userRole: normalizeUserRole(comment?.userRole),
    editedAt: comment?.editedAt ? new Date(comment.editedAt) : undefined,
    deletedAt: comment?.deletedAt ? new Date(comment.deletedAt) : undefined,
    receiverRoles:
      comment?.receiverRoles?.filter((role: string) => allRoles.includes(role as UserRole)) ?? [],
    attachments:
      comment?.attachments?.map((attachment: any, index: number) => ({
        ...attachment,
        id:
          attachment?.id ||
          attachment?._id ||
          `comment-attachment-${index}-${attachment?.name || 'file'}`,
        uploadedAt: new Date(attachment?.uploadedAt ?? Date.now()),
      })) ?? [],
    seenBy:
      comment?.seenBy?.map((entry: any) => ({
        ...entry,
        role: normalizeUserRole(entry.role),
        seenAt: new Date(entry.seenAt),
      })) ?? [],
    reactions:
      comment?.reactions?.map((reaction: any) => ({
        ...reaction,
        userRole: normalizeUserRole(reaction?.userRole),
        createdAt: new Date(reaction?.createdAt ?? Date.now()),
      })) ?? [],
    createdAt: new Date(comment?.createdAt ?? Date.now()),
  });

  const mergeCommentIntoState = (incomingComment: any) => {
    const normalizedComment = normalizeIncomingComment(incomingComment);
    setTaskState((prev) => {
      if (!prev) return prev;
      const existingIndex = prev.comments.findIndex((comment) => comment.id === normalizedComment.id);
      const nextComments =
        existingIndex === -1
          ? [...prev.comments, normalizedComment]
          : prev.comments.map((comment, index) =>
              index === existingIndex ? normalizedComment : comment
            );
      const nextTask = {
        ...prev,
        comments: nextComments,
        updatedAt: new Date(),
      };
      persistTask(nextTask);
      return nextTask;
    });
  };

  const emitTyping = (isTyping: boolean) => {
    const roomId = taskState?.id || (taskState as { _id?: string } | undefined)?._id || id;
    if (typeof window !== 'undefined' && user?.id) {
      window.dispatchEvent(
        new CustomEvent('designhub:self-typing', {
          detail: {
            isTyping,
            userId: user.id,
            taskId: roomId || '',
          },
        })
      );
    }
    if (!socketRef.current || !roomId || !user) return;
    socketRef.current.emit('comment:typing', {
      taskId: roomId,
      clientId: clientIdRef.current,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userEmail: user.email,
      isTyping,
    });
  };

  const clearTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTyping(false);
  };

  const handleChatTypingInput = () => {
    if (!apiUrl) return;
    if (!isChatComposerFocusedRef.current) return;
    emitTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false);
    }, 1200);
  };

  const handleChatComposerFocus = () => {
    isChatComposerFocusedRef.current = true;
    setIsChatComposerFocused(true);
  };

  const handleChatComposerBlur = () => {
    isChatComposerFocusedRef.current = false;
    setIsChatComposerFocused(false);
    clearTyping();
  };

  useEffect(() => {
    taskStateRef.current = taskState;
  }, [taskState]);

  function applyTaskRealtimeSnapshot(rawTask: any, currentTask = taskStateRef.current) {
    if (!rawTask) return undefined;
    const resolvedId =
      rawTask?.id ||
      rawTask?._id ||
      currentTask?.id ||
      (currentTask as { _id?: string } | undefined)?._id ||
      id;
    if (!resolvedId) return undefined;
    const hydrated = withAccessMetadata(
      hydrateTask({
        ...rawTask,
        id: resolvedId,
        viewerReadAt: mergeViewerReadAt(rawTask, currentTask?.viewerReadAt),
      }),
      currentTask
    );
    taskStateRef.current = hydrated;
    setTaskState(hydrated);
    setTaskRouteState('ready');
    setChangeHistory(hydrated?.changeHistory ?? []);
    setChangeCount(hydrated?.changeCount ?? 0);
    setApprovalStatus(hydrated?.approvalStatus);
    persistTask(hydrated);
    return hydrated;
  }

  async function refreshTaskRealtimeSnapshot(taskId: string) {
    if (!apiUrl || !taskId) return;
    try {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}`);
      if (!response.ok) return;
      const data = await response.json();
      applyTaskRealtimeSnapshot(
        {
          ...data,
          id: data?.id || data?._id || taskId,
        },
        taskStateRef.current
      );
    } catch (error) {
      console.error('Failed to refresh realtime task state:', error);
    }
  }

  useEffect(() => {
    const roomId = taskState?.id || (taskState as { _id?: string } | undefined)?._id || id;
    if (!apiUrl || !roomId || !user) return;
    if (!clientIdRef.current && typeof window !== 'undefined') {
      const stored = window.sessionStorage.getItem('designhub.clientId');
      const nextId =
        stored || `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      clientIdRef.current = nextId;
      window.sessionStorage.setItem('designhub.clientId', nextId);
    }
    const socket = createSocket(apiUrl);
    socketRef.current = socket;
    socket.emit('task:join', { taskId: roomId, userId: user.id });
    socket.emit('join', { userId: user.id });
    if (user.email) {
      socket.emit('join', { userId: user.email });
    }

    socket.on('comment:typing', (payload: any) => {
      if (!payload || payload.taskId !== roomId) return;
      if (payload.clientId && payload.clientId === clientIdRef.current) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        const key = payload.clientId || payload.userId;
        if (payload.isTyping && key) {
          next[key] = {
            name: payload.userName || 'Someone',
            role: normalizeUserRole(payload.userRole),
          };
        } else {
          if (key) {
            delete next[key];
          }
        }
        return next;
      });
      const timeoutKey = payload.clientId || payload.userId;
      if (!timeoutKey) return;
      const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      if (payload.isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[timeoutKey];
            return next;
          });
          typingTimeoutsRef.current.delete(timeoutKey);
        }, 2000);
        typingTimeoutsRef.current.set(timeoutKey, timeout);
      } else {
        typingTimeoutsRef.current.delete(timeoutKey);
      }
    });

    socket.on('comment:new', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !payload.comment) return;
      mergeCommentIntoState(payload.comment);
    });

    socket.on('comment:updated', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !payload.comment) return;
      mergeCommentIntoState(payload.comment);
    });

    socket.on('comments:seen', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !Array.isArray(payload.comments)) return;
      payload.comments.forEach((comment: any) => {
        mergeCommentIntoState(comment);
      });
    });

    socket.on('task:updated', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !payload.task) return;
      applyTaskRealtimeSnapshot(payload.task, taskStateRef.current);
      void refreshTaskRealtimeSnapshot(String(payload.taskId));
    });


    return () => {
      clearTyping();
      socket.emit('task:leave', { taskId: roomId, userId: user.id });
      socket.disconnect();
      socketRef.current = null;
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
      setTypingUsers({});
    };
  }, [apiUrl, taskState?.id, taskState?._id, id, user?.id, user?.name, user?.role]);

  useEffect(() => {
    const handleTaskUpdated = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const payloadId = payload.id || payload._id;
      const currentId = taskState?.id || (taskState as { _id?: string } | undefined)?._id || id;
      if (!payloadId || !currentId || payloadId !== currentId) return;
      applyTaskRealtimeSnapshot({ ...payload, id: payloadId }, taskStateRef.current);
      void refreshTaskRealtimeSnapshot(String(payloadId));
    };
    window.addEventListener('designhub:task:updated', handleTaskUpdated);
    return () => window.removeEventListener('designhub:task:updated', handleTaskUpdated);
  }, [id, taskState?.id, taskState?._id]);

  const resetAssignDesignerModal = () => {
    setAssigningTask(null);
    setSelectedDesignerId('');
    setCcInput('');
    setCcEmails([]);
    setAssignmentMessage('');
    setAssignmentDeadline('');
    setAssignmentDeadlineTime('18:00');
    setDeadlineCalendarOpen(false);
    setIsAssigningDesigner(false);
    setAssignSuccessInfo(null);
  };

  const handleAssignModalChange = (open: boolean) => {
    setIsAssignModalOpen(open);
    if (!open) {
      resetAssignDesignerModal();
    }
  };

  const openAssignDesignerModal = (task: typeof mockTasks[number]) => {
    const assignedId = resolveTaskAssignedId(task);
    const normalizedTaskId = String(
      task?.id ||
        (task as { _id?: string } | null)?._id ||
        taskState?.id ||
        (taskState as { _id?: string } | undefined)?._id ||
        id ||
        ''
    ).trim();
    setAssigningTask(
      normalizedTaskId
        ? ({
            ...task,
            id: normalizedTaskId,
          } as typeof mockTasks[number])
        : task
    );
    setSelectedDesignerId(assignedId);
    setCcInput('');
    setCcEmails(resolveTaskCcEmails(task));
    setAssignmentMessage('');
    setAssignmentDeadline(toDateInputValue(task.deadline));
    setAssignmentDeadlineTime(toTimeInputValue(task.deadline) || '18:00');
    setDeadlineCalendarOpen(false);
    setAssignSuccessInfo(null);
    setIsAssignModalOpen(true);
  };

  const addCcEmail = (rawValue: string) => {
    const normalizedEmail = rawValue.trim().toLowerCase();
    if (!normalizedEmail) return;
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast.error('Enter a valid CC email address.');
      return;
    }
    setCcEmails((prev) => (prev.includes(normalizedEmail) ? prev : [...prev, normalizedEmail]));
    setCcInput('');
  };

  const removeCcEmail = (email: string) => {
    setCcEmails((prev) => prev.filter((value) => value !== email));
  };

  const handleCcInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    addCcEmail(ccInput);
  };

  const persistTask = (nextTask: typeof taskState, nextHistory?: TaskChange[]) => {
    if (!nextTask || !storageKey) return;
    const payload = {
      ...nextTask,
      changeHistory: nextHistory ?? nextTask.changeHistory,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  };

  useEffect(() => {
    if (!isAssignModalOpen || !isDesignerRole || !isMainDesignerUser || designersLoaded) return;

    const loadDesigners = async () => {
      if (!apiUrl) {
        const fallbackDesigners = buildFallbackDesigners(taskState, user);
        setDesignerOptions(sanitizeDesignerOptions(fallbackDesigners));
        setDesignersLoaded(true);
        return;
      }

      setIsLoadingDesigners(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/designers`);
        const payload = await response.json();
        if (!response.ok) {
          const errorMessage =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error.trim()
              : 'Failed to load designers';
          throw new Error(errorMessage);
        }

        const source = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.designers)
            ? payload.designers
            : [];
        const mapped = source
          .map((designer: any) => {
            const id = String(designer?.id || designer?._id || '').trim();
            const email = String(designer?.email || '').trim().toLowerCase();
            const name =
              String(designer?.name || '').trim() ||
              (email ? email.split('@')[0] : '');
            const designerScope =
              String(designer?.designerScope || '').trim().toLowerCase() === 'main'
                ? 'main'
                : 'junior';
            if (!id || !name) return null;
            return {
              id,
              name,
              email,
              role: String(designer?.role || 'designer').trim().toLowerCase(),
              designerScope,
              portalId:
                String(designer?.portalId || '').trim() ||
                `${designerScope === 'main' ? 'MD' : 'JD'}-${id.slice(-6).toUpperCase()}`,
            } as DesignerOption;
          })
          .filter(Boolean) as DesignerOption[];
        setDesignerOptions(sanitizeDesignerOptions(mapped));
        setDesignersLoaded(true);
      } catch (error) {
        const fallbackDesigners = buildFallbackDesigners(taskState, user);
        if (fallbackDesigners.length > 0) {
          setDesignerOptions(sanitizeDesignerOptions(fallbackDesigners));
          setDesignersLoaded(true);
        }
        const message =
          error instanceof Error && error.message ? error.message : 'Failed to load designers';
        toast.error(message);
      } finally {
        setIsLoadingDesigners(false);
      }
    };

    loadDesigners();
  }, [
    apiUrl,
    designersLoaded,
    isAssignModalOpen,
    isDesignerRole,
    isMainDesignerUser,
    taskState,
    user,
  ]);

  const submitAssignDesigner = async () => {
    const taskId = String(
      assigningTask?.id ||
        (assigningTask as { _id?: string } | null)?._id ||
        taskState?.id ||
        (taskState as { _id?: string } | undefined)?._id ||
        id ||
        ''
    ).trim();
    if (!taskId) {
      toast.error('Task not found.');
      return;
    }
    if (!selectedDesignerId) {
      toast.error('Select a designer to continue.');
      return;
    }
    if (!apiUrl) {
      toast.error('Assignment API is not configured.');
      return;
    }
    if (!assignmentDeadline) {
      toast.error('Select a deadline before assigning.');
      return;
    }
    if (!assignmentDeadlineTime) {
      toast.error('Select deadline time before assigning.');
      return;
    }

    const deadlinePayload = `${assignmentDeadline}T${assignmentDeadlineTime}:00`;
    const parsedDeadlinePayload = new Date(deadlinePayload);
    if (Number.isNaN(parsedDeadlinePayload.getTime())) {
      toast.error('Invalid deadline date and time.');
      return;
    }

    setIsAssigningDesigner(true);
    try {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/assign-designer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_designer_id: selectedDesignerId,
          cc_emails: ccEmails,
          message: assignmentMessage.trim(),
          deadline: deadlinePayload,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to assign designer.');
      }

      const updatedTaskRaw = (payload?.task || payload) as any;
      const updatedTaskId = updatedTaskRaw?.id || updatedTaskRaw?._id;
      const nextCc =
        resolveTaskCcEmails(updatedTaskRaw as typeof mockTasks[number]).length > 0
          ? resolveTaskCcEmails(updatedTaskRaw as typeof mockTasks[number])
          : ccEmails;
      const hydrated = withAccessMetadata(
        hydrateTask({
          ...updatedTaskRaw,
          id: updatedTaskId,
          viewerReadAt: mergeViewerReadAt(updatedTaskRaw, taskState?.viewerReadAt),
          ccEmails: nextCc,
          cc_emails: nextCc,
        } as typeof mockTasks[number]),
        taskState
      );

      setTaskState(hydrated);
      setChangeHistory(hydrated?.changeHistory ?? []);
      setChangeCount(hydrated?.changeCount ?? 0);
      setApprovalStatus(hydrated?.approvalStatus);
      persistTask(hydrated);
      window.dispatchEvent(new CustomEvent('designhub:task:updated', { detail: hydrated }));

      const selectedDesigner = designerOptions.find((designer) => designer.id === selectedDesignerId);
      setAssignSuccessInfo({
        taskTitle: updatedTaskRaw?.title || assigningTask?.title || 'Task',
        designerName: selectedDesigner?.name || updatedTaskRaw?.assignedToName || 'Designer',
        ccCount: ccEmails.length,
      });
      toast.success('Task assigned. Email notification is being sent.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to assign designer.';
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.includes('only designers can assign designers') ||
        normalizedMessage.includes('only designer or admin accounts can assign designers') ||
        normalizedMessage.includes('only designer, treasurer, or admin accounts can assign designers') ||
        normalizedMessage.includes('only the main designer can assign designers') ||
        normalizedMessage.includes('only the design lead can assign designers')
      ) {
        toast.error(
          'Your signed-in account is not authorized to assign designers. Demo role switch changes view only.'
        );
      } else {
        toast.error(message);
      }
    } finally {
      setIsAssigningDesigner(false);
    }
  };

  useEffect(() => {
    if (!apiUrl || !taskState) return;
    const mode = normalizeTaskAccessMode(
      (taskState as { accessMode?: string; viewOnly?: boolean }).accessMode
    );
    const explicitViewOnly =
      (taskState as { viewOnly?: boolean }).viewOnly === true;
    const assignedId = resolveTaskAssignedId(taskState);
    const assignedEmail = normalizeEmail(assignedId);
    const isAssignedToUser = Boolean(
      assignedId &&
      ((user?.id && assignedId === user.id) ||
        (looksLikeEmail(assignedId) && assignedEmail === normalizeEmail(user?.email)))
    );
    const ccMatch = resolveTaskCcEmails(taskState).includes(normalizeEmail(user?.email));
    const isViewOnlyMode = mode
      ? mode === 'view_only' || explicitViewOnly
      : ccMatch && !isAssignedToUser;
    if (isViewOnlyMode) return;
    const missingSizes = taskState.files.filter(
      (file) => !file.size && file.url && getDriveFileId(file.url)
    );
    if (missingSizes.length === 0) return;
    let isActive = true;

    const loadSizes = async () => {
      const updates = new Map<string, { size?: number; thumbnailUrl?: string }>();
      await Promise.all(
        missingSizes.map(async (file) => {
          const driveId = getDriveFileId(file.url);
          if (!driveId) return;
          if (sizeFetchRef.current.has(driveId)) return;
          sizeFetchRef.current.add(driveId);
          try {
            const response = await authFetch(`${apiUrl}/api/files/metadata`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: driveId }),
            });
            if (!response.ok) return;
            const data = await response.json();
            const sizeValue =
              typeof data.size === 'string' ? Number(data.size) : data.size;
            const thumbnailLink = data.thumbnailLink;
            if (Number.isFinite(sizeValue)) {
              updates.set(file.url, { size: sizeValue });
            }
            if (thumbnailLink) {
              const existing = updates.get(file.url) || {};
              updates.set(file.url, { ...existing, thumbnailUrl: thumbnailLink });
            }
          } catch {
            // no-op
          }
        })
      );

      if (!isActive || updates.size === 0) return;
      const updatedFiles = taskState.files.map((file) => {
        const nextMeta = updates.get(file.url);
        if (!nextMeta) return file;
        return {
          ...file,
          ...(nextMeta.size ? { size: nextMeta.size } : null),
          ...(nextMeta.thumbnailUrl ? { thumbnailUrl: nextMeta.thumbnailUrl } : null),
        };
      });
      setTaskState((prev) => {
        if (!prev) return prev;
        const nextTask = { ...prev, files: updatedFiles };
        persistTask(nextTask);
        return nextTask;
      });
      authFetch(`${apiUrl}/api/tasks/${taskState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: updatedFiles }),
      }).catch(() => { });
    };

    loadSizes();
    return () => {
      isActive = false;
    };
  }, [apiUrl, taskState, user?.email, user?.id]);

  const getReceiverRoles = (senderRole?: UserRole) =>
    senderRole ? allRoles.filter((role) => role !== senderRole) : allRoles;

  const resolveCommentReceivers = (comment: (typeof taskState)['comments'][number]) => {
    if (comment.receiverRoles && comment.receiverRoles.length > 0) {
      return comment.receiverRoles;
    }
    if (comment.mentions && comment.mentions.length > 0) {
      return comment.mentions;
    }
    if (comment.userRole) {
      return allRoles.filter((role) => role !== comment.userRole);
    }
    return allRoles;
  };

  const hasUnseenForRole = (task: typeof taskState, role?: UserRole, userId?: string) => {
    if (!task || !role) return false;
    const normalizedUserId = String(userId || '').trim();
    return task.comments?.some((comment) => {
      const receivers = resolveCommentReceivers(comment);
      if (!receivers.includes(role)) return false;
      const seenBy = comment.seenBy ?? [];
      return normalizedUserId
        ? !seenBy.some((entry) => String(entry.userId || '').trim() === normalizedUserId)
        : !seenBy.some((entry) => entry.role === role);
    });
  };

  const hasUnseenComments = useMemo(
    () => hasUnseenForRole(taskState, user?.role, user?.id),
    [taskState?.comments, user?.id, user?.role]
  );
  const unseenFingerprint = useMemo(() => {
    if (!taskState || !user?.role) return '';
    const normalizedUserId = String(user.id || '').trim();
    const relevant = taskState.comments
      .filter((comment) => resolveCommentReceivers(comment).includes(user.role))
      .map((comment) => {
        const id = (comment as { id?: string; _id?: string }).id || (comment as { _id?: string })._id;
        const seenBy = comment.seenBy ?? [];
        const isSeen = normalizedUserId
          ? seenBy.some((entry) => String(entry.userId || '').trim() === normalizedUserId)
          : seenBy.some((entry) => entry.role === user.role);
        return `${id || comment.createdAt?.toString() || 'comment'}:${isSeen ? 'seen' : 'unseen'}:${seenBy.length}`;
      })
      .join('|');
    return `${taskState.id}:${user.role}:${normalizedUserId}:${relevant}`;
  }, [taskState?.comments, taskState?.id, user?.id, user?.role]);
  const seenRequestRef = useRef(false);
  const lastSeenAttemptAtRef = useRef(0);
  const lastSeenFingerprintRef = useRef('');

  const mentionRoleMap: Record<string, UserRole> = {
    staff: 'staff',
    treasurer: 'treasurer',
    designer: 'designer',
  };

  const mentionTargetsByRole: Record<UserRole, string[]> = {
    staff: ['Designer', 'Treasurer'],
    designer: ['Staff', 'Treasurer'],
    treasurer: ['Designer', 'Staff'],
  };

  const getMentionList = (role?: UserRole) => {
    if (!role) return ['Designer', 'Treasurer', 'Staff'];
    return mentionTargetsByRole[role] ?? ['Designer', 'Treasurer', 'Staff'];
  };

  const getMentionPlaceholder = (role?: UserRole, prefix = 'Message') =>
    `${prefix} @${getMentionList(role).join(', @')}...`;

  const formatMentionList = (role?: UserRole) => {
    const list = getMentionList(role);
    if (list.length === 0) return '';
    if (list.length === 1) return `@${list[0]}`;
    if (list.length === 2) return `@${list[0]} or @${list[1]}`;
    return list
      .map((item, index) => {
        if (index === list.length - 1) return `or @${item}`;
        return `@${item}`;
      })
      .join(', ');
  };

  const chatComposerHintLines = useMemo(() => {
    const mentionTargets = getMentionList(user?.role);
    const primaryTarget = mentionTargets[0];
    const secondaryTarget = mentionTargets[1];
    return [
      primaryTarget ? `@${primaryTarget} for review` : 'your team for review',
      secondaryTarget ? `@${secondaryTarget} for approval` : 'stakeholders for approval',
      'paste screenshots directly here',
    ];
  }, [user?.role]);

  const normalizeCommentAttachment = (attachment: any, index: number): TaskFile => ({
    ...attachment,
    id:
      attachment?.id ||
      attachment?._id ||
      `comment-attachment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name:
      String(attachment?.name || `Attachment ${index + 1}`).trim() || `Attachment ${index + 1}`,
    url: String(attachment?.url || attachment?.webViewLink || attachment?.webContentLink || '').trim(),
    driveId: String(attachment?.driveId || '').trim(),
    webViewLink: String(attachment?.webViewLink || '').trim(),
    webContentLink: String(attachment?.webContentLink || '').trim(),
    type: 'input',
    uploadedAt: new Date(attachment?.uploadedAt ?? Date.now()),
    uploadedBy: String(attachment?.uploadedBy || user?.id || user?.name || '').trim(),
    size:
      typeof attachment?.size === 'number'
        ? attachment.size
        : Number.isFinite(Number(attachment?.size))
          ? Number(attachment.size)
          : undefined,
    mime: String(attachment?.mime || '').trim(),
    thumbnailUrl: String(attachment?.thumbnailUrl || attachment?.thumbnailLink || '').trim(),
  });

  const mentionSuggestions = useMemo(() => {
    if (!mentionContext) return [];
    const normalizedQuery = mentionContext.query.trim().toLowerCase();
    return getMentionList(user?.role).filter((item) =>
      normalizedQuery ? item.toLowerCase().startsWith(normalizedQuery) : true
    );
  }, [mentionContext, user?.role]);

  useEffect(() => {
    setActiveMentionIndex((current) => {
      if (mentionSuggestions.length === 0) return 0;
      return Math.min(current, mentionSuggestions.length - 1);
    });
  }, [mentionSuggestions]);

  const clearMentionContext = (target?: ComposerTarget) => {
    setMentionContext((current) => {
      if (!current) return null;
      if (target && current.target !== target) return current;
      return null;
    });
    setActiveMentionIndex(0);
  };

  const syncMentionContext = (
    value: string,
    target: ComposerTarget,
    selectionStart?: number | null
  ) => {
    const caret = typeof selectionStart === 'number' ? selectionStart : value.length;
    const uptoCaret = value.slice(0, caret);
    const match = uptoCaret.match(/(^|\s)@([a-z]*)$/i);
    if (!match) {
      clearMentionContext(target);
      return;
    }
    const atIndex = uptoCaret.lastIndexOf('@');
    if (atIndex < 0) {
      clearMentionContext(target);
      return;
    }
    setMentionContext({
      target,
      start: atIndex,
      end: caret,
      query: match[2] || '',
    });
  };

  const applyMentionSuggestion = (label: string) => {
    if (!mentionContext) return;
    const currentValue = mentionContext.target === 'reply' ? replyText : newComment;
    const nextValue = `${currentValue.slice(0, mentionContext.start)}@${label} ${currentValue.slice(
      mentionContext.end
    )}`;
    const nextCaret = mentionContext.start + label.length + 2;
    const targetRef = mentionContext.target === 'reply' ? replyComposerRef : commentComposerRef;
    if (mentionContext.target === 'reply') {
      setReplyText(nextValue);
    } else {
      setNewComment(nextValue);
    }
    clearMentionContext(mentionContext.target);
    window.requestAnimationFrame(() => {
      targetRef.current?.focus();
      targetRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const scheduleMentionContextClose = (target: ComposerTarget) => {
    if (mentionBlurTimeoutRef.current) {
      clearTimeout(mentionBlurTimeoutRef.current);
    }
    mentionBlurTimeoutRef.current = setTimeout(() => {
      clearMentionContext(target);
      mentionBlurTimeoutRef.current = null;
    }, 120);
  };

  const extractMentions = (content: string) => {
    const matches = content.match(/@(?:Designer|Treasurer|Staff)/gi) ?? [];
    const roles = matches
      .map((match) => mentionRoleMap[match.replace('@', '').toLowerCase()])
      .filter(Boolean) as UserRole[];
    return Array.from(new Set(roles));
  };

  const buildReceiverRoles = (content: string) => {
    const mentions = extractMentions(content);
    return mentions.length > 0 ? mentions : getReceiverRoles(user?.role);
  };

  const renderCommentContent = (content: string) => {
    const parts = content.split(/(@(?:Designer|Treasurer|Staff))/gi);
    return parts.map((part, index) => {
      const key = part.replace('@', '').toLowerCase();
      if (mentionRoleMap[key as keyof typeof mentionRoleMap]) {
        return (
          <span
            key={`${part}-${index}`}
            className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
          >
            {part}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  const renderMentionSuggestions = (target: ComposerTarget) => {
    if (mentionContext?.target !== target || mentionSuggestions.length === 0) return null;
    return (
      <div className="absolute bottom-full left-0 right-0 z-40 mb-2 max-h-56 overflow-y-auto overflow-x-hidden rounded-xl border border-[#D9E6FF] bg-white/95 shadow-lg backdrop-blur-xl dark:border-border dark:bg-card/95">
        {mentionSuggestions.map((item, index) => {
          const isActive = index === activeMentionIndex;
          const mentionRole = mentionRoleMap[item.toLowerCase()];
          return (
            <button
              key={`${target}-${item}`}
              type="button"
              className={cn(
                'flex w-full flex-col items-start px-3 py-2 text-left transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-secondary/60 text-foreground'
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                applyMentionSuggestion(item);
              }}
            >
              <span className="text-sm font-medium">@{item}</span>
              <span className="text-[11px] text-muted-foreground">
                Notify {mentionRole ? roleLabels[mentionRole] ?? item : item}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderComposerAttachments = (attachments: TaskFile[], target: ComposerTarget) => {
    if (attachments.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const previewUrls = getAttachmentThumbnailPreviewUrls(attachment);
          const sizeLabel = formatFileSize(attachment.size) || 'Attachment';
          return (
            <div
              key={attachment.id}
              className="flex min-w-[12rem] max-w-full items-center gap-3 rounded-xl border border-[#D9E6FF] bg-white/80 px-3 py-2 backdrop-blur-md dark:border-border dark:bg-card/85"
            >
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-[#E1E9FF] bg-[#F5F8FF] dark:border-border dark:bg-muted"
                onClick={() => {
                  if (canPreviewFile(attachment)) {
                    openFilePreviewDialog(attachment);
                    return;
                  }
                  void handleFileAction(attachment);
                }}
              >
                <AttachmentThumbnail previewUrls={previewUrls} name={attachment.name} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                <p className="text-[11px] text-muted-foreground">{sizeLabel}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => removeComposerAttachment(target, attachment.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCommentAttachments = (attachments?: TaskFile[]) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        {attachments.map((attachment) => {
          const previewUrls = getAttachmentThumbnailPreviewUrls(attachment);
          const sizeLabel = formatFileSize(attachment.size) || 'Attachment';
          return (
            <div
              key={attachment.id}
              className="flex items-center gap-3 rounded-xl border border-[#D9E6FF] bg-white/70 px-3 py-2 backdrop-blur-md dark:border-border dark:bg-card/75"
            >
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-[#E1E9FF] bg-[#F5F8FF] dark:border-border dark:bg-muted"
                onClick={() => {
                  if (canPreviewFile(attachment)) {
                    openFilePreviewDialog(attachment);
                    return;
                  }
                  void handleFileAction(attachment);
                }}
              >
                <AttachmentThumbnail previewUrls={previewUrls} name={attachment.name} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                <p className="text-[11px] text-muted-foreground">{sizeLabel}</p>
              </div>
              <div className="flex items-center gap-1">
                {canPreviewFile(attachment) && (
                  <button
                    type="button"
                    className={fileGlassIconButtonClass}
                    onClick={() => openFilePreviewDialog(attachment)}
                    aria-label={`Preview ${attachment.name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  className={fileGlassIconButtonClass}
                  onClick={() => void handleFileAction(attachment)}
                  aria-label={`Open ${attachment.name}`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  const { topLevelComments, repliesByParent } = useMemo(() => {
    if (!taskState) {
      return { topLevelComments: [], repliesByParent: new Map<string, TaskComment[]>() };
    }
    const sorted = [...(taskState.comments ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const replyMap = new Map<string, TaskComment[]>();
    sorted.forEach((comment) => {
      if (!comment.parentId) return;
      const existing = replyMap.get(comment.parentId) ?? [];
      existing.push(comment);
      replyMap.set(comment.parentId, existing);
    });
    const roots = sorted.filter((comment) => !comment.parentId);
    return { topLevelComments: roots, repliesByParent: replyMap };
  }, [taskState]);

  const normalizedCommentSearch = commentSearch.trim().toLowerCase();
  const currentUserId = String(user?.id || '').trim();
  const canViewCommentReceipts = user?.role !== 'staff';
  const currentUserEmail = normalizeEmail(user?.email);
  const normalizedCurrentUserName = String(user?.name || '').trim().toLowerCase();
  const commentAssignedToId = taskState ? resolveTaskAssignedId(taskState) : '';
  const assignedDesignerName = String(taskState?.assignedToName || '').trim().toLowerCase();
  const assignedDesignerEmail = normalizeEmail(
    taskState?.assignedDesignerEmail ||
      (looksLikeEmail(commentAssignedToId) ? commentAssignedToId : '')
  );
  const assignedDesignerIsMain = isMainDesigner({
    role: 'designer',
    email: assignedDesignerEmail || undefined,
  });

  const isCommentFromMainDesigner = (
    comment: Pick<TaskComment, 'userRole' | 'userId' | 'userName'>
  ) => {
    if (comment.userRole !== 'designer') return false;

    const commentUserId = String(comment.userId || '').trim();
    const commentUserEmail = normalizeEmail(looksLikeEmail(commentUserId) ? commentUserId : '');
    const commentUserName = String(comment.userName || '').trim().toLowerCase();

    if (
      isMainDesignerUser &&
      (
        (commentUserId && currentUserId && commentUserId === currentUserId) ||
        (commentUserEmail && currentUserEmail && commentUserEmail === currentUserEmail) ||
        (commentUserName && normalizedCurrentUserName && commentUserName === normalizedCurrentUserName)
      )
    ) {
      return true;
    }

    if (!assignedDesignerIsMain) return false;

    return Boolean(
      (commentUserId && commentAssignedToId && commentUserId === commentAssignedToId) ||
      (commentUserEmail && assignedDesignerEmail && commentUserEmail === assignedDesignerEmail) ||
      (commentUserName && assignedDesignerName && commentUserName === assignedDesignerName)
    );
  };

  const getCommentRoleLabel = (
    comment: Pick<TaskComment, 'userRole' | 'userId' | 'userName'>
  ) => {
    if (!comment.userRole) return '';
    if (comment.userRole === 'designer' && isCommentFromMainDesigner(comment)) {
      return 'Design Lead';
    }
    return roleLabels[comment.userRole] ?? comment.userRole;
  };

  useEffect(() => {
    if (!isCommentSearchVisible) return;
    window.requestAnimationFrame(() => {
      commentSearchInputRef.current?.focus();
    });
  }, [isCommentSearchVisible]);

  const doesCommentMatchSearch = (comment: TaskComment) => {
    if (!normalizedCommentSearch) return true;
    const searchableText = [
      comment.userName,
      getCommentRoleLabel(comment),
      comment.content,
      ...(comment.attachments ?? []).map((attachment) => attachment.name),
    ]
      .join(' ')
      .toLowerCase();
    return searchableText.includes(normalizedCommentSearch);
  };

  const threadMatchesSearch = (comment: TaskComment): boolean => {
    if (doesCommentMatchSearch(comment)) return true;
    return (repliesByParent.get(comment.id) ?? []).some((reply) => threadMatchesSearch(reply));
  };

  const visibleTopLevelComments = useMemo(
    () =>
      normalizedCommentSearch
        ? topLevelComments.filter((comment) => threadMatchesSearch(comment))
        : topLevelComments,
    [normalizedCommentSearch, repliesByParent, topLevelComments]
  );

  const matchingCommentCount = useMemo(
    () =>
      normalizedCommentSearch
        ? (taskState?.comments ?? []).filter((comment) => doesCommentMatchSearch(comment)).length
        : taskState?.comments.length ?? 0,
    [normalizedCommentSearch, taskState?.comments]
  );

  const getCommentSeenEntries = (comment: TaskComment) => {
    const uniqueSeenEntries = new Map<string, NonNullable<TaskComment['seenBy']>[number]>();
    (comment.seenBy ?? []).forEach((entry) => {
      const key =
        String(entry.userId || '').trim() ||
        `${entry.role}:${String(entry.userName || roleLabels[entry.role] || entry.role).trim()}`;
      const existing = uniqueSeenEntries.get(key);
      if (!existing || new Date(entry.seenAt).getTime() > new Date(existing.seenAt).getTime()) {
        uniqueSeenEntries.set(key, entry);
      }
    });
    return Array.from(uniqueSeenEntries.values()).sort(
      (left, right) => new Date(right.seenAt).getTime() - new Date(left.seenAt).getTime()
    );
  };

  const getGroupedCommentReactions = (comment: TaskComment) => {
    const grouped = new Map<
      string,
      {
        emoji: string;
        count: number;
        reactedByCurrentUser: boolean;
        users: { id: string; name: string; role?: UserRole }[];
      }
    >();

    (comment.reactions ?? []).forEach((reaction) => {
      const emoji = String(reaction.emoji || '').trim();
      if (!emoji) return;
      const existing = grouped.get(emoji);
      const reactionUserId = String(reaction.userId || '').trim();
      if (existing) {
        if (!existing.users.some((userEntry) => userEntry.id === reactionUserId && reactionUserId)) {
          existing.users.push({
            id: reactionUserId,
            name: reaction.userName || 'User',
            role: reaction.userRole,
          });
          existing.count += 1;
        }
        if (reactionUserId && reactionUserId === currentUserId) {
          existing.reactedByCurrentUser = true;
        }
        return;
      }

      grouped.set(emoji, {
        emoji,
        count: 1,
        reactedByCurrentUser: reactionUserId === currentUserId,
        users: [
          {
            id: reactionUserId,
            name: reaction.userName || 'User',
            role: reaction.userRole,
          },
        ],
      });
    });

    return Array.from(grouped.values()).sort((left, right) => {
      const leftIndex = quickCommentReactions.indexOf(left.emoji as (typeof quickCommentReactions)[number]);
      const rightIndex = quickCommentReactions.indexOf(right.emoji as (typeof quickCommentReactions)[number]);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return left.emoji.localeCompare(right.emoji);
    });
  };

  const formatSeenEntryLabel = (entry: NonNullable<TaskComment['seenBy']>[number]) =>
    String(entry.userName || (entry.role ? roleLabels[entry.role] : 'User')).trim() || 'User';

  const getCommentReceiptSummary = (comment: TaskComment, seenEntries: NonNullable<TaskComment['seenBy']>) => {
    const receivers = resolveCommentReceivers(comment);
    if (receivers.length === 0) return null;
    if (seenEntries.length === 0) return 'Sent';

    const seenText =
      seenEntries.length <= 2
        ? `Seen by ${seenEntries.map((entry) => formatSeenEntryLabel(entry)).join(', ')}`
        : `Seen by ${seenEntries.length} users`;
    const pendingRoles = receivers.filter(
      (role) => !seenEntries.some((entry) => entry.role === role)
    );

    if (pendingRoles.length === 0) {
      return seenText;
    }

    return `${seenText} - Pending ${pendingRoles
      .map((role) => roleLabels[role] ?? role)
      .join(', ')}`;
  };

  const renderFinalFileStatusCard = (audience: 'staff' | 'junior') => {
    const isPendingStatus = finalDeliverableReviewStatus === 'pending';
    const normalizedReviewNote = finalDeliverableReviewNote.toLowerCase();
    const hasUrgentWorkloadReason =
      /urgent|deadline|committed|commitment|busy|occupied|other work|workload|priority/.test(
        normalizedReviewNote
      );
    const hasCorrectionReason =
      /correction|correct|revision|revise|fix|feedback|change requested|changes requested/.test(
        normalizedReviewNote
      );
    const hasSatisfactionReason =
      /not satisf|not satisfied|expectation|quality|refine|refinement|improve|polish/.test(
        normalizedReviewNote
      );

    const scenario = (() => {
      if (isPendingStatus) {
        return {
          breadcrumbItems: ['Files Uploaded', 'Design Lead Review', 'Pending'],
          statusPillLabel: 'In Review',
          description:
            audience === 'staff'
              ? 'Final deliverables are submitted and waiting for Design Lead approval.'
              : 'Waiting for Design Lead approval.',
        };
      }

      if (hasUrgentWorkloadReason) {
        return audience === 'staff'
          ? {
              breadcrumbItems: ['Files Uploaded', 'Designer Workload', 'Deadline Updated'],
              statusPillLabel: 'Timeline Shifted',
              description: `The junior designer is currently committed to urgent deadline work. Updated final files will be shared once that priority is cleared${taskState.deadline ? `, with the next working target around ${format(taskState.deadline, 'MMM d, yyyy')}.` : '.'}`,
            }
          : {
              breadcrumbItems: ['Files Uploaded', 'Urgent Workload', 'Resubmit Later'],
              statusPillLabel: 'Deadline Conflict',
              description: 'You are currently committed to urgent deadline work. Align the revised delivery timeline, complete the pending updates, and resubmit the final files once ready.',
            };
      }

      if (hasCorrectionReason) {
        return audience === 'staff'
          ? {
              breadcrumbItems: ['Files Uploaded', 'Corrections Shared', 'With Designer'],
              statusPillLabel: 'Correction in Progress',
              description: 'Requested corrections have been shared with the designer. Updated final files are being prepared before the next share.',
            }
          : {
              breadcrumbItems: ['Files Uploaded', 'Feedback Received', 'Apply Corrections'],
              statusPillLabel: 'Changes Required',
              description: 'Specific corrections were shared on this submission. Apply the requested changes and upload the updated final files again.',
            };
      }

      if (hasSatisfactionReason) {
        return audience === 'staff'
          ? {
              breadcrumbItems: ['Files Uploaded', 'Internal Review', 'Design Refinement'],
              statusPillLabel: 'Refining Design',
              description: 'The latest version did not fully satisfy the internal review. The designer is refining the final files before sharing them again.',
            }
          : {
              breadcrumbItems: ['Files Uploaded', 'Review Feedback', 'Refine Submission'],
              statusPillLabel: 'Refinement Needed',
              description: 'The current final file needs a stronger refinement pass before resubmission. Rework the output and upload the next version.',
            };
      }

      return audience === 'staff'
        ? {
            breadcrumbItems: ['Files Uploaded', 'Internal Review', 'With Designer'],
            statusPillLabel: 'Update in Progress',
            description: 'Design updates are being made based on internal review.',
          }
        : {
            breadcrumbItems: ['Files Uploaded', 'Feedback Received', 'Resubmit'],
            statusPillLabel: 'Update Needed',
            description: `Design Lead marked this submission as update needed.${finalDeliverableReviewNote ? ` Reason: ${finalDeliverableReviewNote}` : ''} Upload updates and submit again.`,
          };
    })();

    return (
      <div className="mb-4 rounded-xl border border-[#D9E6FF]/75 bg-[#F7FBFF]/88 px-4 py-3.5 dark:border-border/70 dark:bg-card/80">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Final File Status
            </p>
            <Breadcrumb className="mt-1">
              <BreadcrumbList className="gap-1 text-[11px] text-[#7282A3] dark:text-slate-400">
                {scenario.breadcrumbItems.map((item, index) => {
                  const isLast = index === scenario.breadcrumbItems.length - 1;
                  return (
                    <Fragment key={`${audience}-${item}`}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="font-medium text-[#1E2A5A] dark:text-slate-100">
                            {item}
                          </BreadcrumbPage>
                        ) : (
                          <span>{item}</span>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator className="text-[#9BAACC] dark:text-slate-500" />}
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#D3E1FF] bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#35508A] dark:border-border dark:bg-muted/70 dark:text-slate-200">
            {scenario.statusPillLabel}
          </span>
        </div>
        <p className="mt-2 text-sm text-[#1E2A5A] dark:text-slate-200">{scenario.description}</p>
      </div>
    );
  };

  const addWorkingDays = (start: Date, days: number) => {
    const result = new Date(start);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0) {
        added += 1;
      }
    }
    return result;
  };
  const normalizedTaskStatus = normalizeTaskStatus(taskState.status);
  const currentStatusSelection = getStatusSelectValue(taskState.status);
  const status = statusConfig[normalizedTaskStatus];
  const isOverdue = isPast(taskState.deadline) && normalizedTaskStatus !== 'completed';
  const backendAccessMode = normalizeTaskAccessMode(
    (taskState as { accessMode?: string; viewOnly?: boolean }).accessMode
  );
  const explicitViewOnlyFlag =
    (taskState as { viewOnly?: boolean }).viewOnly === true;
  const normalizedUserEmail = normalizeEmail(user?.email);
  const userId = String(user?.id || '');
  const assignedToId = resolveTaskAssignedId(taskState);
  const assignedToEmail = normalizeEmail(assignedToId);
  const isAssignedToCurrentUser = Boolean(
    assignedToId &&
    ((userId && assignedToId === userId) ||
      (looksLikeEmail(assignedToId) && assignedToEmail === normalizedUserEmail))
  );
  const taskCcEmails = resolveTaskCcEmails(taskState);
  const isCcViewer = Boolean(
    normalizedUserEmail && taskCcEmails.includes(normalizedUserEmail)
  );
  const hasExplicitAccessMode = Boolean(backendAccessMode) || explicitViewOnlyFlag;
  const isViewOnlyTask = hasExplicitAccessMode
    ? backendAccessMode === 'view_only' || explicitViewOnlyFlag
    : isCcViewer && !isAssignedToCurrentUser;
  const hasFullTaskAccess = hasExplicitAccessMode
    ? backendAccessMode === 'full' && !explicitViewOnlyFlag
    : !isViewOnlyTask;
  const canAssignDesigner = isDesignerRole && isMainDesignerUser && hasFullTaskAccess && !isViewOnlyTask;
  const canDesignerActions = isDesignerRole && hasFullTaskAccess && !isViewOnlyTask;
  const canFinalizeTaskActions = canDesignerActions || (isDesignerRole && isMainDesignerUser);
  const isStaffRole = user?.role === 'staff';
  const canEditTask = user?.role === 'staff' && !isViewOnlyTask;
  const editTaskActionTooltip = approvalLockedForStaff
    ? approvalStatus === 'rejected'
      ? 'Editing is locked. Treasurer approval is required to re-open this request.'
      : 'Editing is temporarily locked while this request is under approval.'
    : staffChangeLimitReached
      ? 'You have reached 3 edits. Treasurer approval is required before further updates.'
    : isEditingTask
      ? `Close edit mode after reviewing your updates. Treasurer approval is required after 3 edits (${editsRemainingBeforeTreasurerApproval} remaining).`
      : `Open edit mode to update task details. Treasurer approval is required after 3 edits (${editsRemainingBeforeTreasurerApproval} remaining).`;
  const canApproveDeadline = isDesignerRole && hasFullTaskAccess && !isViewOnlyTask;
  const canManageVersions = isDesignerRole && hasFullTaskAccess && !isViewOnlyTask;
  const canComment = true;
  const canRemoveFiles = canDesignerActions;
  const canViewWorkingFiles = user?.role === 'designer' || user?.role === 'treasurer';
  const canManageWorkingFiles = canDesignerActions || (isDesignerRole && isMainDesignerUser);
  const rawCollateralItems = Array.isArray(taskState.collaterals) ? taskState.collaterals : [];
  const isCampaignRequest =
    taskState.requestType === 'campaign_request' || rawCollateralItems.length > 0;
  const quickDesignOverviewCollaterals = useMemo<CollateralItem[]>(
    () =>
      !isCampaignRequest && taskState.requestType === 'single_task'
        ? [buildQuickDesignOverviewCollateral(taskState)]
        : [],
    [isCampaignRequest, taskState]
  );
  const collateralItems = isCampaignRequest ? rawCollateralItems : quickDesignOverviewCollaterals;
  const usesCampaignOverviewLayout = collateralItems.length > 0;
  const campaignDeadlineMode =
    taskState.campaign?.deadlineMode || (usesCampaignOverviewLayout ? 'itemized' : 'common');
  const overviewCampaignCommonDeadline = taskState.campaign?.commonDeadline;
  const selectedCampaignCollateral =
    collateralItems.find((item) => item.id === selectedCampaignCollateralId) ?? collateralItems[0];
  const selectedCampaignCollateralIndex = selectedCampaignCollateral
    ? Math.max(
        0,
        collateralItems.findIndex((item) => item.id === selectedCampaignCollateral.id)
      )
    : -1;
  const selectedCampaignCollateralDeadline = selectedCampaignCollateral
    ? campaignDeadlineMode === 'common'
      ? overviewCampaignCommonDeadline ?? taskState.deadline
      : selectedCampaignCollateral.deadline
    : undefined;
  const campaignCompletedCollaterals = collateralItems.filter((item) =>
    isCollateralStepComplete(item.status)
  ).length;
  const collateralCompletionPercent =
    collateralItems.length > 0
      ? Math.round((campaignCompletedCollaterals / collateralItems.length) * 100)
      : 0;
  const campaignPrimaryDeadline =
    campaignDeadlineMode === 'common'
      ? overviewCampaignCommonDeadline ?? taskState.deadline
      : taskState.deadline;
  const campaignBriefText = useMemo(() => {
    const directBrief = String(taskState.campaign?.brief || '').trim();
    if (directBrief) return directBrief;
    const description = String(taskState.description || '').trim();
    const [briefSection] = description.split(/\n\s*Collateral Scope\s*\n/i);
    return briefSection.trim();
  }, [taskState.campaign?.brief, taskState.description]);
  const campaignOverallBrief = String(taskState.campaign?.brief || '').trim() || campaignBriefText;
  const campaignScopeLines = useMemo(() => {
    if (collateralItems.length > 0) {
      return collateralItems.map((collateral, index) => {
        const parts = [
          getCollateralDisplayName(collateral),
          collateral.platform || collateral.usageType || collateral.collateralType,
          getCollateralSizeSummary(collateral),
          collateral.brief,
        ].filter(Boolean);
        return `${index + 1}. ${parts.join(' | ')}`;
      });
    }

    const description = String(taskState.description || '').trim();
    const match = description.match(/Collateral Scope\s*\n([\s\S]+)/i);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }, [collateralItems, taskState.description]);
  const campaignStatusTextClass =
    status.variant === 'completed'
      ? 'text-emerald-600 dark:text-emerald-300'
      : status.variant === 'clarification'
        ? 'text-amber-600 dark:text-amber-300'
        : status.variant === 'review'
          ? 'text-sky-600 dark:text-sky-300'
          : status.variant === 'progress'
            ? 'text-[#3152BE] dark:text-[#B8CBFF]'
            : 'text-[#A46B1A] dark:text-[#F4C66B]';
  const canUpdateCollateralStatus =
    (isDesignerRole || user?.role === 'treasurer') && hasFullTaskAccess && !isViewOnlyTask;
  const minDeadlineDate = addWorkingDays(new Date(), 3);
  useEffect(() => {
    setSelectedCampaignCollateralId((previous) => {
      if (collateralItems.length === 0) return '';
      if (previous && collateralItems.some((item) => item.id === previous)) return previous;
      return collateralItems[0].id;
    });
  }, [collateralItems]);
  const emergencyStatus =
    taskState.isEmergency || taskState.emergencyApprovalStatus
      ? taskState.emergencyApprovalStatus ?? 'pending'
      : undefined;
  const emergencyVariant =
    emergencyStatus === 'approved'
      ? 'completed'
      : emergencyStatus === 'rejected'
        ? 'destructive'
        : 'urgent';
  const emergencyLabel =
    emergencyStatus === 'approved'
      ? 'Emergency Approved'
      : emergencyStatus === 'rejected'
        ? 'Emergency Rejected'
        : 'Emergency Pending';
  const latestEmergencyDecisionNote = useMemo(() => {
    const history = Array.isArray(taskState?.changeHistory) ? taskState.changeHistory : [];
    for (let index = 0; index < history.length; index += 1) {
      const entry = history[index];
      if (entry?.field !== 'emergency_approval') continue;
      const note = String(entry?.note || '').trim();
      if (note) return note;
    }
    return '';
  }, [taskState?.changeHistory]);
  const workingFiles = taskState.files.filter((f) => f.type === 'working');
  const outputFiles = taskState.files.filter((f) => f.type === 'output');
  const finalDeliverableVersions = useMemo<FinalDeliverableVersion[]>(() => {
    const normalizeNameKey = (value?: string) =>
      String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    const toSizeValue = (value?: number | string) => {
      const numeric = typeof value === 'string' ? Number(value) : value;
      return Number.isFinite(numeric) ? numeric : undefined;
    };
    const findMatchingOutputFile = (target?: {
      name?: string;
      url?: string;
      driveId?: string;
      size?: number | string;
    }) => {
      const targetNameKey = normalizeNameKey(target?.name);
      const targetUrl = String(target?.url || '').trim();
      const targetDriveId = String(target?.driveId || '').trim();
      const targetSize = toSizeValue(target?.size);
      let bestMatch: (typeof outputFiles)[number] | undefined;
      let bestScore = 0;

      for (const outputFile of outputFiles) {
        let score = 0;
        const outputNameKey = normalizeNameKey(outputFile.name);
        const outputDriveId = String(outputFile.driveId || '').trim();
        const outputUrl = String(outputFile.url || '').trim();
        const outputSize = toSizeValue(outputFile.size);

        if (targetDriveId && outputDriveId && targetDriveId === outputDriveId) {
          score += 10;
        }
        if (targetNameKey && outputNameKey && targetNameKey === outputNameKey) {
          score += 5;
        }
        if (targetSize !== undefined && outputSize === targetSize) {
          score += 3;
        }
        if (targetUrl && outputUrl && targetUrl === outputUrl) {
          score += 1;
        }

        if (score > bestScore) {
          bestMatch = outputFile;
          bestScore = score;
        }
      }

      return bestScore > 0 ? bestMatch : undefined;
    };

    const raw = taskState?.finalDeliverableVersions ?? [];
    if (raw.length > 0) {
      return raw.map((version) => ({
        ...version,
        files:
          version.files?.map((file) => {
            const matchedOutput = findMatchingOutputFile(file);
            if (!matchedOutput) return file;
            return {
              ...matchedOutput,
              ...file,
              url: file.url || matchedOutput.url || '',
              driveId: file.driveId || matchedOutput.driveId,
              webViewLink: file.webViewLink || matchedOutput.webViewLink,
              webContentLink: file.webContentLink || matchedOutput.webContentLink,
              size: file.size ?? matchedOutput.size,
              mime: file.mime || matchedOutput.mime,
              thumbnailUrl: file.thumbnailUrl || matchedOutput.thumbnailUrl,
              uploadedAt: file.uploadedAt || matchedOutput.uploadedAt || new Date(),
              uploadedBy: file.uploadedBy || matchedOutput.uploadedBy || '',
            };
          }) ?? [],
      }));
    }
    if (outputFiles.length === 0) return [];
    const fallbackUploadedAt = outputFiles[0]?.uploadedAt || taskState.updatedAt;
    const fallbackUploadedBy =
      outputFiles[0]?.uploadedBy || taskState.assignedToId || '';
    return [
      {
        id: `final-v1-${taskState.id}`,
        version: 1,
        uploadedAt: fallbackUploadedAt || new Date(),
        uploadedBy: fallbackUploadedBy,
        note: '',
        files: outputFiles.map((file, index) => ({
          id: file.id || `final-file-${index}`,
          name: file.name,
          url: file.url,
          driveId: file.driveId,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink,
          size: file.size,
          mime: file.mime,
          thumbnailUrl: file.thumbnailUrl,
          uploadedAt: file.uploadedAt || new Date(),
          uploadedBy: file.uploadedBy || fallbackUploadedBy,
        })),
      },
    ];
  }, [outputFiles, taskState?.finalDeliverableVersions, taskState?.id, taskState?.assignedToId, taskState.updatedAt]);

  const sortedFinalDeliverableVersions = useMemo(
    () =>
      [...finalDeliverableVersions].sort(
        (a, b) => (b.version || 0) - (a.version || 0)
      ),
    [finalDeliverableVersions]
  );

  useEffect(() => {
    if (sortedFinalDeliverableVersions.length === 0) {
      setSelectedFinalVersionId('');
      return;
    }
    const latestId = sortedFinalDeliverableVersions[0]?.id || '';
    if (!selectedFinalVersionId) {
      setSelectedFinalVersionId(latestId);
      return;
    }
    if (!sortedFinalDeliverableVersions.some((version) => version.id === selectedFinalVersionId)) {
      setSelectedFinalVersionId(latestId);
    }
  }, [sortedFinalDeliverableVersions, selectedFinalVersionId]);

  const activeFinalVersion =
    sortedFinalDeliverableVersions.find((version) => version.id === selectedFinalVersionId) ||
    sortedFinalDeliverableVersions[0];
  useEffect(() => {
    if (!activeFinalVersion) return;
    setFinalVersionNote(String(activeFinalVersion.note || ''));
  }, [activeFinalVersion?.id]);
  useEffect(() => {
    setFinalReviewNote(String(taskState?.finalDeliverableReviewNote || ''));
  }, [taskState?.id, taskState?.finalDeliverableReviewNote, taskState?.finalDeliverableReviewStatus]);
  const activeFinalVersionNote = String(activeFinalVersion?.note || '').trim();
  const finalDeliverableFiles = activeFinalVersion?.files ?? [];
  const zipSelectionLabel = zipDownloadState
    ? zipDownloadState.mode === 'selected'
      ? `${zipDownloadState.fileCount} selected file${zipDownloadState.fileCount === 1 ? '' : 's'}`
      : `${zipDownloadState.fileCount} file${zipDownloadState.fileCount === 1 ? '' : 's'}`
    : '';
  const zipPhaseLabel =
    zipDownloadState?.phase === 'preparing'
      ? `Preparing ${zipSelectionLabel} for ZIP...`
      : zipDownloadState?.phase === 'building'
        ? `Building ZIP archive for ${zipSelectionLabel}...`
        : zipDownloadState?.phase === 'downloading'
          ? zipDownloadState.percent !== null
            ? `Downloading ZIP archive (${zipDownloadState.percent}%)`
            : `Downloading ZIP archive for ${zipSelectionLabel}...`
          : zipDownloadState?.phase === 'starting'
            ? 'Saving ZIP to your browser...'
            : '';
  const zipButtonLabel =
    zipDownloadState?.phase === 'preparing'
      ? 'Preparing...'
      : zipDownloadState?.phase === 'building'
        ? 'Building...'
        : zipDownloadState?.phase === 'downloading'
          ? zipDownloadState.percent !== null
            ? `${zipDownloadState.percent}%`
            : 'Downloading...'
          : zipDownloadState?.phase === 'starting'
            ? 'Saving...'
            : 'ZIP';
  const isZipDownloadInProgress = Boolean(zipDownloadState);
  const isSelectedZipDownloadInProgress = zipDownloadState?.mode === 'selected';
  const isAllZipDownloadInProgress = zipDownloadState?.mode === 'all';
  const hasFinalDeliverables = sortedFinalDeliverableVersions.length > 0;
  const finalDeliverableReviewStatus = normalizeFinalDeliverableReviewStatus(
    taskState?.finalDeliverableReviewStatus,
    hasFinalDeliverables ? 'approved' : 'not_submitted'
  );
  const finalDeliverableReviewNote = String(taskState?.finalDeliverableReviewNote || '').trim();
  const finalDeliverableReviewedBy = String(taskState?.finalDeliverableReviewedBy || '').trim();
  const secondaryWorkflowSignals = useMemo(() => {
    const items: Array<{ key: string; label: string; value: string; className: string }> = [];

    if (approvalStatus) {
      items.push({
        key: 'approval',
        label: 'Approval',
        value:
          approvalStatus === 'approved'
            ? 'Approved'
            : approvalStatus === 'rejected'
              ? 'Rejected'
              : 'Pending',
        className: getWorkflowSignalPillClass(approvalStatus),
      });
    }

    if (taskState.deadlineApprovalStatus) {
      items.push({
        key: 'deadline',
        label: 'Deadline',
        value:
          taskState.deadlineApprovalStatus === 'approved'
            ? 'Approved'
            : taskState.deadlineApprovalStatus === 'rejected'
              ? 'Rejected'
              : 'Pending',
        className: getWorkflowSignalPillClass(taskState.deadlineApprovalStatus),
      });
    }

    if (emergencyStatus) {
      items.push({
        key: 'emergency',
        label: 'Emergency',
        value:
          emergencyStatus === 'approved'
            ? 'Approved'
            : emergencyStatus === 'rejected'
              ? 'Rejected'
              : 'Pending',
        className: getWorkflowSignalPillClass(emergencyStatus),
      });
    }

    if (finalDeliverableReviewStatus !== 'not_submitted') {
      items.push({
        key: 'final-review',
        label: 'Final Review',
        value:
          finalDeliverableReviewStatus === 'approved'
            ? 'Approved'
            : finalDeliverableReviewStatus === 'rejected'
              ? 'Changes Requested'
              : 'Pending',
        className: getWorkflowSignalPillClass(
          finalDeliverableReviewStatus === 'pending' ? 'under_review' : finalDeliverableReviewStatus
        ),
      });
    }

    return items;
  }, [
    approvalStatus,
    emergencyStatus,
    finalDeliverableReviewStatus,
    taskState.deadlineApprovalStatus,
  ]);
  const deliveryStepIndex = Math.max(0, TASK_STATUS_STEPS.indexOf(normalizedTaskStatus));
  const deliveryProgressPercent =
    TASK_STATUS_STEPS.length > 0
      ? Math.round(((deliveryStepIndex + 1) / TASK_STATUS_STEPS.length) * 100)
      : 0;
  const baseStaffTrackerStepIndex = getStaffTrackerStepIndex(normalizedTaskStatus);
  const baseStaffTrackerProgressPercent =
    STAFF_TRACKER_STEPS.length > 0
      ? Math.round(((baseStaffTrackerStepIndex + 1) / STAFF_TRACKER_STEPS.length) * 100)
      : 0;
  const workflowAssigneeLabel =
    String(taskState.assignedToName || taskState.assignedTo || '').trim() || 'Unassigned';
  const hasWorkflowAssignee =
    Boolean(resolveTaskAssignedId(taskState)) || Boolean(String(taskState.assignedToName || '').trim());
  const workflowUpdatedLabel = taskState.updatedAt
    ? formatDistanceToNow(new Date(taskState.updatedAt), { addSuffix: true })
    : 'Recently updated';
  const taskDeadlineSnapshot = taskState.deadline ? new Date(taskState.deadline) : null;
  const hasValidTaskDeadline =
    Boolean(taskDeadlineSnapshot) && !Number.isNaN(taskDeadlineSnapshot?.getTime?.() ?? Number.NaN);
  const compactDeadlineLabel = hasValidTaskDeadline
    ? isPast(taskDeadlineSnapshot as Date) && normalizedTaskStatus !== 'completed'
      ? `${formatDistanceToNow(taskDeadlineSnapshot as Date)} overdue`
      : `Due ${formatDistanceToNow(taskDeadlineSnapshot as Date, { addSuffix: true })}`
    : 'Deadline not set';
  const trackerViewModel = useMemo(() => {
    const defaultSupportItems = [
      compactDeadlineLabel,
      `${baseStaffTrackerProgressPercent}% complete`,
      hasWorkflowAssignee ? `Assigned to ${workflowAssigneeLabel}` : 'Unassigned',
    ];

    if (user?.role === 'treasurer' && approvalStatus === 'pending') {
      return {
        stepIndex: 3,
        headline: 'Approval required',
        summary: 'Latest staff updates are waiting for your approval decision.',
        supportItems: [
          compactDeadlineLabel,
          `${displayedChangeCount} changes submitted`,
          hasWorkflowAssignee ? `Assigned to ${workflowAssigneeLabel}` : 'Unassigned',
        ],
      };
    }

    if (isDesignerRole && isMainDesignerUser) {
      if (!hasWorkflowAssignee || normalizedTaskStatus === 'pending') {
        return {
          stepIndex: 1,
          headline: 'Assignment required',
          summary: 'Pick a designer and set the delivery path to start execution.',
          supportItems: [compactDeadlineLabel, 'Awaiting assignment', 'Main designer action'],
        };
      }

      if (taskState.deadlineApprovalStatus === 'pending') {
        return {
          stepIndex: 1,
          headline: 'Deadline approval needed',
          summary: 'A deadline change was requested and needs your review.',
          supportItems: [
            compactDeadlineLabel,
            'Deadline approval pending',
            `Assigned to ${workflowAssigneeLabel}`,
          ],
        };
      }

      if (finalDeliverableReviewStatus === 'pending') {
        return {
          stepIndex: 3,
          headline: 'Review required',
          summary: 'Final deliverables are ready for your approval or revision feedback.',
          supportItems: [
            compactDeadlineLabel,
            `${Math.max(baseStaffTrackerProgressPercent, 80)}% complete`,
            `Assigned to ${workflowAssigneeLabel}`,
          ],
        };
      }

      if (finalDeliverableReviewStatus === 'rejected') {
        return {
          stepIndex: 2,
          headline: 'Revision in progress',
          summary: 'Feedback was shared. Waiting for the next designer submission.',
          supportItems: [
            compactDeadlineLabel,
            `${Math.max(baseStaffTrackerProgressPercent, 60)}% complete`,
            `Assigned to ${workflowAssigneeLabel}`,
          ],
        };
      }
    }

    if (isDesignerRole && !isMainDesignerUser) {
      if (finalDeliverableReviewStatus === 'rejected') {
        return {
          stepIndex: 2,
          headline: 'Revision required',
          summary: 'Main designer requested changes to the submitted deliverables.',
          supportItems: [compactDeadlineLabel, 'Resubmission needed', `Assigned to ${workflowAssigneeLabel}`],
        };
      }

      if (finalDeliverableReviewStatus === 'pending') {
        return {
          stepIndex: 3,
          headline: 'Awaiting review',
          summary: 'Submitted work is with the main designer for final review.',
          supportItems: [
            compactDeadlineLabel,
            `${Math.max(baseStaffTrackerProgressPercent, 80)}% complete`,
            `Assigned to ${workflowAssigneeLabel}`,
          ],
        };
      }
    }

    return {
      stepIndex: baseStaffTrackerStepIndex,
      headline: staffTrackerHeadline[normalizedTaskStatus],
      summary: staffTrackerSummary[normalizedTaskStatus],
      supportItems: defaultSupportItems,
    };
  }, [
    approvalStatus,
    baseStaffTrackerProgressPercent,
    baseStaffTrackerStepIndex,
    compactDeadlineLabel,
    displayedChangeCount,
    finalDeliverableReviewStatus,
    hasWorkflowAssignee,
    isDesignerRole,
    isMainDesignerUser,
    normalizedTaskStatus,
    taskState.deadlineApprovalStatus,
    user?.role,
    workflowAssigneeLabel,
  ]);
  const staffTrackerStepIndex = trackerViewModel.stepIndex;
  const staffTrackerProgressPercent =
    STAFF_TRACKER_STEPS.length > 0
      ? Math.round(((staffTrackerStepIndex + 1) / STAFF_TRACKER_STEPS.length) * 100)
      : 0;
  const staffWorkflowConnectorPercent =
    STAFF_TRACKER_STEPS.length > 1
      ? Math.round((staffTrackerStepIndex / (STAFF_TRACKER_STEPS.length - 1)) * 100)
      : 0;
  const staffHealthTone = resolveStaffHealthTone(
    normalizedTaskStatus,
    hasValidTaskDeadline ? (taskDeadlineSnapshot as Date) : null
  );
  const staffHealthConfig: Record<
    StaffHealthTone,
    { label: string; className: string }
  > = {
    on_track: {
      label: 'On Track',
      className: 'bg-emerald-400/10 text-emerald-100 ring-emerald-200/16',
    },
    at_risk: {
      label: 'At Risk',
      className: 'bg-amber-400/10 text-amber-100 ring-amber-200/16',
    },
    overdue: {
      label: 'Overdue',
      className: 'bg-rose-400/10 text-rose-100 ring-rose-200/16',
    },
    delivered: {
      label: 'Delivered',
      className: 'bg-sky-400/10 text-sky-100 ring-sky-200/16',
    },
  };
  const staffStatusDotClass =
    status.variant === 'completed'
      ? 'bg-emerald-500'
      : status.variant === 'clarification'
        ? 'bg-amber-400'
        : status.variant === 'review'
          ? 'bg-[#4F6EE0]'
          : status.variant === 'progress'
            ? 'bg-[#3B82F6]'
            : 'bg-slate-400';
  const shouldAnimateStaffStatusDot =
    status.variant === 'review' || status.variant === 'progress';
  const staffStatusDot = (
    <span className="relative inline-flex h-3 w-3 shrink-0 self-center">
      {shouldAnimateStaffStatusDot ? (
        <>
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-[#4E84FF]/18 motion-safe:animate-[staffStatusDotAura_1.9s_ease-in-out_infinite]" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 rounded-full border border-[#9CB2FF]/55 motion-safe:animate-[staffStatusDotHalo_1.9s_ease-out_infinite]" />
        </>
      ) : null}
      <span
        className={cn(
          'absolute left-1/2 top-1/2 z-[1] block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
          staffStatusDotClass,
          shouldAnimateStaffStatusDot &&
            'motion-safe:animate-[staffStatusDotCore_1.9s_ease-in-out_infinite]'
        )}
      />
    </span>
  );
  const staffWorkflowStageLabel = `${STAFF_TRACKER_STEPS[staffTrackerStepIndex]?.label || 'Submitted'} stage`;
  const staffTrackerSupportItems = trackerViewModel.supportItems;
  const shouldShowStaffStatusTracker = Boolean(taskState?.id);
  const showWorkflowInsights = secondaryWorkflowSignals.length > 0 || usesCampaignOverviewLayout;
  const activeFinalVersionReviewAnnotations = useMemo(
    () =>
      Array.isArray(activeFinalVersion?.reviewAnnotations)
        ? activeFinalVersion.reviewAnnotations.filter((annotation) => hasReviewAnnotationContent(annotation))
        : [],
    [activeFinalVersion?.id, activeFinalVersion?.reviewAnnotations]
  );
  const canMainDesignerReviewFinalDeliverables =
    isDesignerRole &&
    isMainDesignerUser &&
    finalDeliverableReviewStatus === 'pending';
  const shouldShowStaffFinalReviewState =
    isStaffRole &&
    (finalDeliverableReviewStatus === 'pending' || finalDeliverableReviewStatus === 'rejected');
  const shouldShowJuniorFinalReviewState =
    isDesignerRole &&
    !isMainDesignerUser &&
    (finalDeliverableReviewStatus === 'pending' || finalDeliverableReviewStatus === 'rejected');
  const shouldAllowViewingRejectedAnnotations =
    finalDeliverableReviewStatus === 'rejected' &&
    (isMainDesignerUser || isDesignerRole);
  const latestFinalVersionId = sortedFinalDeliverableVersions[0]?.id || '';
  const canReplaceRejectedFinalFile =
    canDesignerActions &&
    !isMainDesignerUser &&
    finalDeliverableReviewStatus === 'rejected' &&
    Boolean(latestFinalVersionId) &&
    activeFinalVersion?.id === latestFinalVersionId;
  const clampStaffStatusPanelPosition = (left: number, top: number) => {
    if (typeof window === 'undefined') return { left, top };

    const panelWidth = staffStatusPanelRef.current?.offsetWidth ?? 352;
    const panelHeight = staffStatusPanelRef.current?.offsetHeight ?? 268;
    const horizontalPadding = 16;
    const minTop = 88;
    const maxLeft = Math.max(horizontalPadding, window.innerWidth - panelWidth - horizontalPadding);
    const maxTop = Math.max(minTop, window.innerHeight - panelHeight - horizontalPadding);

    return {
      left: Math.min(Math.max(horizontalPadding, left), maxLeft),
      top: Math.min(Math.max(minTop, top), maxTop),
    };
  };
  const handleStaffStatusPanelDragStart = (event: MouseEvent<HTMLElement>) => {
    if (!staffStatusPanelRef.current) return;
    if (event.button !== 0) return;

    const rect = staffStatusPanelRef.current.getBoundingClientRect();
    staffStatusPanelDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    staffStatusPanelDragActiveRef.current = true;
    setStaffStatusPanelPosition(clampStaffStatusPanelPosition(rect.left, rect.top));
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    event.preventDefault();
  };
  useEffect(() => {
    setIsStaffStatusPanelExpanded(true);
    setStaffStatusPanelPosition(null);
  }, [taskState?.id]);
  useEffect(() => {
    if (!staffStatusPanelPosition) return;

    setStaffStatusPanelPosition(
      clampStaffStatusPanelPosition(staffStatusPanelPosition.left, staffStatusPanelPosition.top)
    );
  }, [isStaffStatusPanelExpanded]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!staffStatusPanelDragActiveRef.current) return;
      const nextLeft = event.clientX - staffStatusPanelDragOffsetRef.current.x;
      const nextTop = event.clientY - staffStatusPanelDragOffsetRef.current.y;
      setStaffStatusPanelPosition(clampStaffStatusPanelPosition(nextLeft, nextTop));
    };

    const stopDragging = () => {
      if (!staffStatusPanelDragActiveRef.current) return;
      staffStatusPanelDragActiveRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);
  useEffect(() => {
    const nextDrafts: Record<string, FinalDeliverableReviewAnnotation> = {};
    activeFinalVersionReviewAnnotations.forEach((annotation, index) => {
      const key = getReviewAnnotationFileKey(annotation);
      if (!key) return;
      nextDrafts[key] = {
        ...annotation,
        id: annotation.id || `annotation-${index}`,
      };
    });
    setDraftReviewAnnotationsByFile(nextDrafts);
  }, [activeFinalVersion?.id, activeFinalVersionReviewAnnotations]);
  const draftReviewAnnotationList = useMemo(
    () =>
      Object.values(draftReviewAnnotationsByFile).filter((annotation) =>
        hasReviewAnnotationContent(annotation)
      ),
    [draftReviewAnnotationsByFile]
  );
  const hasPendingFinalFiles = pendingFinalFiles.length > 0;
  const latestFinalUploadAt = useMemo(() => {
    if (sortedFinalDeliverableVersions.length === 0) return 0;
    const latest = sortedFinalDeliverableVersions[0];
    return latest?.uploadedAt ? new Date(latest.uploadedAt).getTime() : 0;
  }, [sortedFinalDeliverableVersions]);
  const isTaskCompleted = normalizedTaskStatus === 'completed';
  const canHandover =
    canFinalizeTaskActions &&
    hasPendingFinalFiles &&
    !isUploadingFinal;
  const submitActionLabel =
    finalDeliverableReviewStatus === 'rejected' || isTaskCompleted
      ? 'Submit Revision'
      : 'Submit for Review';
  const submitActionHint =
    'Submit creates the next version (V1, V2, ...) and moves the task into review.';
  const shouldShowFileManagementPanel =
    hasFinalDeliverables ||
    canFinalizeTaskActions ||
    canManageWorkingFiles ||
    (canViewWorkingFiles && workingFiles.length > 0);
  const currentSelectedVersionNote = activeFinalVersionNote;
  const isFinalVersionNoteDirty = finalVersionNote.trim() !== currentSelectedVersionNote;
  const canAcceptTask =
    canDesignerActions &&
    isAssignedToCurrentUser &&
    emergencyStatus !== 'approved' &&
    (normalizedTaskStatus === 'assigned' || normalizedTaskStatus === 'pending');
  const finalUploadTotals = finalUploadItems.reduce(
    (acc, item) => {
      if (item.status === 'uploading') acc.uploading += 1;
      if (item.status === 'done') acc.done += 1;
      if (item.status === 'error') acc.error += 1;
      return acc;
    },
    { uploading: 0, done: 0, error: 0 }
  );
  const finalUploadProgress = useMemo(() => {
    if (finalUploadItems.length === 0) return 0;
    const totalProgress = finalUploadItems.reduce((sum, item) => {
      if (item.status === 'done') return sum + 100;
      const raw = Number(item.progress);
      const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(99, Math.round(raw))) : 0;
      return sum + normalized;
    }, 0);
    return Math.max(0, Math.min(100, Math.round(totalProgress / finalUploadItems.length)));
  }, [finalUploadItems]);
  const hasPendingFinalUploads =
    finalUploadTotals.uploading > 0;
  const finalUploadLabel =
    hasPendingFinalUploads
      ? `Uploading ${finalUploadItems.length} item${finalUploadItems.length === 1 ? '' : 's'} (${finalUploadProgress}%)`
      : finalUploadTotals.error > 0
        ? `${finalUploadTotals.done} completed, ${finalUploadTotals.error} issue${finalUploadTotals.error === 1 ? '' : 's'}`
        : `${finalUploadTotals.done} item${finalUploadTotals.done === 1 ? '' : 's'} completed`;
  const hasFinalUploadQueueIssues = finalUploadTotals.error > 0;
  const isFinalUploadQueueComplete =
    finalUploadItems.length > 0 &&
    finalUploadTotals.uploading === 0 &&
    finalUploadTotals.error === 0 &&
    finalUploadTotals.done === finalUploadItems.length;
  const finalUploadStatusText = isFinalUploadQueueComplete
    ? `${finalUploadTotals.done} completed, ready to submit`
    : hasPendingFinalUploads
      ? `${finalUploadTotals.uploading} uploading, ${finalUploadTotals.done} ready, ${finalUploadTotals.error} issues`
      : hasFinalUploadQueueIssues
        ? `${finalUploadTotals.done} completed, ${finalUploadTotals.error} issue${finalUploadTotals.error === 1 ? '' : 's'}`
        : `${finalUploadTotals.done} completed, ready to submit`;
  const finalUploadFooterText =
    hasPendingFinalUploads
      ? `Upload in progress: ${finalUploadProgress}%`
      : hasFinalUploadQueueIssues
        ? `${finalUploadTotals.error} item${finalUploadTotals.error === 1 ? '' : 's'} need attention before submit.`
        : `${finalUploadTotals.done} completed, ready to submit`;
  const shouldCompactFinalUploadQueue = finalUploadItems.length > 6;

  const getVersionLabel = (version: DesignVersion) => `V${version.version}`;
  const formatVersionTimestamp = (value?: Date | string) => {
    if (!value) return 'Unknown time';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return format(parsed, 'MMM d, yyyy · hh:mm:ss a');
  };
  const finalVersionTooltip =
    activeFinalVersion
      ? `V${activeFinalVersion.version} was uploaded on ${formatVersionTimestamp(activeFinalVersion.uploadedAt)}. Use this selector to review files from each submission.`
      : 'Each version (V1, V2, ...) is a final deliverable submission. Use this selector to review previous submissions.';
  const getFinalVersionLabel = (version: FinalDeliverableVersion) =>
    `V${version.version} · ${formatVersionTimestamp(version.uploadedAt)}`;
  const isImageVersion = (version?: DesignVersion) => {
    if (!version?.name) return false;
    const ext = version.name.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };
  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };
  const getFileExtension = (fileName: string) => {
    const segments = fileName.split('.');
    if (segments.length < 2) return 'LINK';
    const ext = segments.pop();
    return ext ? ext.toUpperCase() : 'FILE';
  };
  const getDriveLinkMeta = (url: string) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isGoogleDriveHost =
        host === 'drive.google.com' ||
        host.endsWith('.drive.google.com') ||
        host === 'docs.google.com' ||
        host.endsWith('.docs.google.com');
      if (!isGoogleDriveHost) {
        return { isGoogleDrive: false as const, itemType: 'external' as const, itemId: '' };
      }

      const path = parsed.pathname;
      const queryId = parsed.searchParams.get('id');
      if (queryId) {
        return { isGoogleDrive: true as const, itemType: 'file' as const, itemId: queryId };
      }
      const folderMatch = path.match(/\/(?:drive\/(?:u\/\d+\/)?folders|folders)\/([^/?#]+)/);
      if (folderMatch?.[1]) {
        return { isGoogleDrive: true as const, itemType: 'folder' as const, itemId: folderMatch[1] };
      }
      const fileMatch = path.match(/\/file(?:\/u\/\d+)?\/d\/([^/?#]+)/);
      if (fileMatch?.[1]) {
        return { isGoogleDrive: true as const, itemType: 'file' as const, itemId: fileMatch[1] };
      }
      const docMatch = path.match(/\/document(?:\/u\/\d+)?\/d\/([^/?#]+)/);
      if (docMatch?.[1]) {
        return { isGoogleDrive: true as const, itemType: 'doc' as const, itemId: docMatch[1] };
      }
      const sheetMatch = path.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([^/?#]+)/);
      if (sheetMatch?.[1]) {
        return { isGoogleDrive: true as const, itemType: 'sheet' as const, itemId: sheetMatch[1] };
      }
      const slideMatch = path.match(/\/presentation(?:\/u\/\d+)?\/d\/([^/?#]+)/);
      if (slideMatch?.[1]) {
        return { isGoogleDrive: true as const, itemType: 'slide' as const, itemId: slideMatch[1] };
      }
      const formMatch = path.match(/\/forms(?:\/u\/\d+)?\/d\/([^/?#]+)/);
      if (formMatch?.[1]) {
        return { isGoogleDrive: true as const, itemType: 'form' as const, itemId: formMatch[1] };
      }
      return { isGoogleDrive: true as const, itemType: 'drive' as const, itemId: '' };
    } catch {
      return { isGoogleDrive: false as const, itemType: 'external' as const, itemId: '' };
    }
  };
  const validateFinalGoogleDriveLink = (url: string) => {
    const trimmedUrl = String(url || '').trim();
    if (!trimmedUrl) {
      return {
        valid: false as const,
        message: 'Paste a Google Drive link to continue.',
      };
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      return {
        valid: false as const,
        message: 'Invalid link format. Use a Google Drive URL.',
      };
    }
    if (parsed.protocol !== 'https:') {
      return {
        valid: false as const,
        message: 'Use an https Google Drive URL.',
      };
    }
    const driveMeta = getDriveLinkMeta(trimmedUrl);
    if (!driveMeta.isGoogleDrive) {
      return {
        valid: false as const,
        message: 'Please provide a Google Drive link (drive.google.com or docs.google.com).',
      };
    }
    return { valid: true as const, message: '' };
  };
  const inferDriveItemNameFromUrl = (url: string) => {
    const meta = getDriveLinkMeta(url);
    if (!meta.isGoogleDrive) return 'Shared link';
    if (meta.itemType === 'folder') return 'Google Drive folder';
    if (meta.itemType === 'doc') return 'Google Doc';
    if (meta.itemType === 'sheet') return 'Google Sheet';
    if (meta.itemType === 'slide') return 'Google Slides';
    if (meta.itemType === 'form') return 'Google Form';
    if (meta.itemType === 'file') return 'Google Drive file';
    return 'Google Drive item';
  };
  const sanitizeLinkDisplayName = (name: string, url: string) => {
    const raw = String(name || '').trim();
    if (!raw) return inferDriveItemNameFromUrl(url);
    // Avoid showing id-like placeholders such as "1" as the visible title.
    if (/^[0-9]{1,4}$/.test(raw)) return inferDriveItemNameFromUrl(url);
    if (/^[A-Za-z0-9_-]{16,}$/.test(raw)) return inferDriveItemNameFromUrl(url);
    return raw;
  };
  const getLinkSubLabel = (url: string) => {
    const meta = getDriveLinkMeta(url);
    if (!meta.isGoogleDrive) return 'External link';
    if (meta.itemType === 'folder') return 'Google Drive Folder';
    if (meta.itemType === 'doc') return 'Google Docs';
    if (meta.itemType === 'sheet') return 'Google Sheets';
    if (meta.itemType === 'slide') return 'Google Slides';
    if (meta.itemType === 'form') return 'Google Forms';
    return 'Google Drive';
  };
  const formatFileSize = (bytes?: number | string) => {
    if (bytes === undefined) return '';
    const numeric = typeof bytes === 'string' ? Number(bytes) : bytes;
    if (!Number.isFinite(numeric)) return '';
    if (numeric < 1024) return `${numeric} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = numeric / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  };
  const formatTransferAmount = (bytes?: number) => {
    const formatted = formatFileSize(bytes);
    return formatted || '0 B';
  };
  const formatTransferSpeed = (bytesPerSecond?: number) => {
    const numeric = Number(bytesPerSecond);
    if (!Number.isFinite(numeric) || numeric <= 0) return '0 B/s';
    return `${formatTransferAmount(numeric)}/s`;
  };
  const toTitleCaseFileName = (name: string) => {
    const lastDot = name.lastIndexOf('.');
    const base = lastDot > 0 ? name.slice(0, lastDot) : name;
    const ext = lastDot > 0 ? name.slice(lastDot + 1) : '';
    const titledBase = base.replace(/[A-Za-z][A-Za-z0-9']*/g, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    if (!ext) return titledBase;
    return `${titledBase}.${ext.toLowerCase()}`;
  };
  const getDriveFileId = (value?: string) => {
    const source = String(value || '').trim();
    if (!source) return '';
    if (/^[A-Za-z0-9_-]{10,}$/.test(source)) return source;

    const driveMeta = getDriveLinkMeta(source);
    if (driveMeta.isGoogleDrive && driveMeta.itemId) {
      return driveMeta.itemId;
    }

    try {
      const parsed = new URL(
        source,
        typeof window !== 'undefined' ? window.location.origin : 'https://drive.google.com'
      );
      const idFromQuery = String(parsed.searchParams.get('id') || '').trim();
      if (idFromQuery) return idFromQuery;

      const decodedPath = decodeURIComponent(parsed.pathname || '');
      const pathPatterns = [
        /\/api\/files\/download\/([^/?#]+)/i,
        /\/file(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
        /\/document(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
        /\/spreadsheets(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
        /\/presentation(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
        /\/forms(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
      ];
      for (const pattern of pathPatterns) {
        const match = decodedPath.match(pattern);
        if (match?.[1]) return match[1];
      }
    } catch {
      // Fall back to raw regex extraction below.
    }

    const rawPatterns = [
      /[?&]id=([A-Za-z0-9_-]{10,})/i,
      /\/api\/files\/download\/([A-Za-z0-9_-]{10,})/i,
      /\/file(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
      /\/document(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
      /\/spreadsheets(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
      /\/presentation(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
      /\/forms(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
    ];
    for (const pattern of rawPatterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }

    return '';
  };
  const getResolvedDriveId = (file?: FileLinkLike | null) =>
    String(file?.driveId || '').trim() ||
    getDriveFileId(file?.webViewLink) ||
    getDriveFileId(file?.webContentLink) ||
    getDriveFileId(file?.url);
  const getResolvedDriveMeta = (file?: FileLinkLike | null) => {
    const candidates = [file?.url, file?.webViewLink, file?.webContentLink]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    for (const candidate of candidates) {
      const meta = getDriveLinkMeta(candidate);
      if (meta.isGoogleDrive) {
        return meta;
      }
    }

    const driveId = getResolvedDriveId(file);
    if (driveId) {
      return { isGoogleDrive: true as const, itemType: 'file' as const, itemId: driveId };
    }

    return { isGoogleDrive: false as const, itemType: 'external' as const, itemId: '' };
  };
  const buildDriveViewUrl = (driveId?: string) => {
    const normalizedId = String(driveId || '').trim();
    if (!normalizedId) return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(normalizedId)}/view?usp=drivesdk`;
  };
  const buildDriveDirectDownloadUrl = (driveId?: string) => {
    const normalizedId = String(driveId || '').trim();
    if (!normalizedId) return '';
    return `https://drive.google.com/uc?id=${encodeURIComponent(normalizedId)}&export=download`;
  };
  const resolveStoredFileUrl = (file?: FileLinkLike | null) => {
    const rawUrl = String(file?.url || '').trim();
    if (rawUrl) return rawUrl;
    const webViewLink = String(file?.webViewLink || '').trim();
    if (webViewLink) return webViewLink;
    const webContentLink = String(file?.webContentLink || '').trim();
    if (webContentLink) return webContentLink;
    const driveId = String(file?.driveId || '').trim();
    if (driveId) return buildDriveViewUrl(driveId);
    return '';
  };
  const resolveUploadedDriveUrl = (payload?: {
    webViewLink?: string;
    webContentLink?: string;
    id?: string;
  }) => {
    const webViewLink = String(payload?.webViewLink || '').trim();
    if (webViewLink) return webViewLink;
    const webContentLink = String(payload?.webContentLink || '').trim();
    if (webContentLink) return webContentLink;
    return buildDriveViewUrl(payload?.id);
  };
  const getPreviewUrl = (file: FileActionTarget) => {
    if (file.thumbnailUrl) return file.thumbnailUrl;
    const resolvedUrl = resolveStoredFileUrl(file);
    if (!resolvedUrl) return '';
    const driveId = getResolvedDriveId(file);
    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
    }
    if (isImageFile(file.name)) return resolvedUrl;
    return '';
  };
  const getAttachmentThumbnailPreviewUrls = (file: FileActionTarget) => {
    const driveId = getResolvedDriveId(file);
    const driveMeta = getResolvedDriveMeta(file);
    const thumbnailUrl = String(file.thumbnailUrl || '').trim();
    const webContentLink = String(file.webContentLink || '').trim();
    const rawUrl = String(file.url || '').trim();
    const resolvedUrl = resolveStoredFileUrl(file);
    const generatedDriveThumbnail = driveId
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w400`
      : '';

    if (isImageFile(file.name)) {
      return Array.from(
        new Set(
          [
            webContentLink,
            !driveMeta.isGoogleDrive ? rawUrl : '',
            thumbnailUrl,
            generatedDriveThumbnail,
            !driveMeta.isGoogleDrive ? resolvedUrl : '',
          ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      );
    }

    return Array.from(
      new Set(
        [thumbnailUrl, generatedDriveThumbnail]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
  };
  const isDownloadableExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (!ext) return false;
    return ['jpg', 'jpeg', 'png', 'pdf', 'psd'].includes(ext);
  };
  const isLinkOnlyFile = (file: FileActionTarget) => {
    return String(file.mime || '').toLowerCase() === 'link';
  };
  const isGoogleDriveLinkFile = (file: FileActionTarget) => getResolvedDriveMeta(file).isGoogleDrive;
  const shouldUseLinkIcon = (file: FileActionTarget) => {
    const resolvedUrl = resolveStoredFileUrl(file);
    if (!resolvedUrl) return false;
    if (isLinkOnlyFile(file)) return true;
    return !isDownloadableExtension(file.name);
  };
  const getFileActionUrl = (file: FileActionTarget) => {
    const resolvedUrl = resolveStoredFileUrl(file);
    if (!resolvedUrl) return '';
    const driveId = getResolvedDriveId(file);
    const driveMeta = getResolvedDriveMeta(file);
    if (shouldUseLinkIcon(file)) {
      if (driveId && (!driveMeta.isGoogleDrive || driveMeta.itemType === 'file')) {
        return buildDriveViewUrl(driveId);
      }
      return resolvedUrl;
    }
    if (driveId) {
      return apiUrl
        ? `${apiUrl}/api/files/download/${encodeURIComponent(driveId)}`
        : `/api/files/download/${encodeURIComponent(driveId)}`;
    }
    return resolvedUrl;
  };
  const getDownloadFileNameFromHeaders = (response: Response, fallbackName: string) => {
    const contentDisposition = response.headers.get('content-disposition') || '';
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (plainMatch?.[1]) {
      return plainMatch[1];
    }
    return fallbackName;
  };
  const sanitizeDownloadErrorMessage = (value: string, fallback: string) => {
    const detail = String(value || '').trim();
    if (!detail) return fallback;
    const normalized = detail.toLowerCase();
    if (
      normalized.startsWith('<!doctype html') ||
      normalized.startsWith('<html') ||
      normalized.includes('<head') ||
      normalized.includes('<body') ||
      normalized.includes('<pre>cannot get ')
    ) {
      return fallback;
    }
    return detail;
  };
  const openFileUrl = (url: string) => {
    if (!url || typeof document === 'undefined') return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  const getDirectDownloadUrl = (file: FileActionTarget) => {
    const resolvedUrl = resolveStoredFileUrl(file);
    const driveId = getResolvedDriveId(file);
    if (driveId) {
      return buildDriveDirectDownloadUrl(driveId);
    }
    return resolvedUrl;
  };
  const copyToClipboard = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      if (typeof document === 'undefined') return;
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };
  const getFileShareUrl = (file: FileActionTarget) => {
    const rawUrl = resolveStoredFileUrl(file);
    if (!rawUrl) return '';
    const driveId = getResolvedDriveId(file);
    const driveMeta = getResolvedDriveMeta(file);
    if (driveId && (!driveMeta.isGoogleDrive || driveMeta.itemType === 'file')) {
      return buildDriveViewUrl(driveId);
    }
    return getFileActionUrl(file) || rawUrl;
  };
  const getFileCopyFeedbackKey = (file: FileActionTarget) => {
    const type = String(file.type || '').trim() || 'file';
    const fileId = String(file.id || '').trim();
    if (fileId) return `${type}:${fileId}`;
    const rawUrl = String(file.url || '').trim();
    if (rawUrl) return `${type}:${rawUrl}`;
    return `${type}:${String(file.name || '').trim()}`;
  };
  const handleCopyFileLink = async (file: FileActionTarget) => {
    const shareUrl = getFileShareUrl(file);
    if (!shareUrl) {
      toast.error('Share link is missing for this file.');
      return;
    }
    await copyToClipboard(shareUrl);
    const nextCopiedKey = getFileCopyFeedbackKey(file);
    setCopiedFileKey(nextCopiedKey);
    if (copiedFileResetTimerRef.current) {
      clearTimeout(copiedFileResetTimerRef.current);
    }
    copiedFileResetTimerRef.current = setTimeout(() => {
      setCopiedFileKey((current) => (current === nextCopiedKey ? '' : current));
    }, 1200);
    toast.success('File link copied.');
  };
  const downloadFileViaApi = async (file: FileActionTarget) => {
    const fileLinkUrl = getFileActionUrl(file);
    if (!fileLinkUrl || fileLinkUrl === '#') return;

    const response = await authFetch(fileLinkUrl);
    if (!response.ok) {
      let message = 'Download failed';
      try {
        const payload = await response.clone().json();
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          message = sanitizeDownloadErrorMessage(payload.error, message);
        }
      } catch {
        const detail = await response.text().catch(() => '');
        if (detail.trim()) {
          message = sanitizeDownloadErrorMessage(detail, message);
        }
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename = getDownloadFileNameFromHeaders(response, file.name || 'download');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };
  const handleFileAction = async (file: FileActionTarget) => {
    const fileLinkUrl = getFileActionUrl(file);
    if (!fileLinkUrl || fileLinkUrl === '#') {
      toast.error('File link is missing. Refresh the task or re-upload the attachment.');
      return;
    }

    if (shouldUseLinkIcon(file)) {
      window.open(fileLinkUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const driveId = getResolvedDriveId(file);
    if (driveId) {
      try {
        await downloadFileViaApi(file);
      } catch {
        const directDownloadUrl = getDirectDownloadUrl(file);
        if (directDownloadUrl) {
          openFileUrl(directDownloadUrl);
          return;
        }
        toast.error('Unable to download file right now. Please try again.');
      }
      return;
    }

    window.open(fileLinkUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadAll = async () => {
    const files = (activeFinalVersion?.files ?? [])
      .map((f, i) => toOutputFile(f, i))
      .filter((f) => !isLinkOnlyFile(f));
    if (files.length === 0) return;
    setIsDownloadingAll(true);
    for (let i = 0; i < files.length; i++) {
      if (i > 0) await new Promise<void>((res) => setTimeout(res, 650));
      await handleFileAction(files[i]).catch(() => {});
    }
    setIsDownloadingAll(false);
  };

  const getFinalDeliverableSelectionId = (file: FinalDeliverableFile, index: number) => {
    const persistedId = String(file.id || (file as FinalDeliverableFile & { _id?: string })._id || '').trim();
    if (persistedId) return persistedId;
    const driveId = String(file.driveId || '').trim();
    if (driveId) return driveId;
    const resolvedUrl = resolveStoredFileUrl(file as FinalDeliverableFile & FileLinkLike);
    if (resolvedUrl) return resolvedUrl;
    return `final-file-${index}`;
  };

  const getFinalDeliverableZipRequestIds = (selectionIds?: string[]) => {
    const selectedIds = Array.isArray(selectionIds)
      ? selectionIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    return (activeFinalVersion?.files ?? [])
      .map((file, index) => {
        const displayFile = toOutputFile(file, index);
        const requestId =
          String(file.id || (file as FinalDeliverableFile & { _id?: string })._id || '').trim() ||
          String(file.driveId || '').trim() ||
          String(resolveStoredFileUrl(file as FinalDeliverableFile & FileLinkLike) || '').trim();
        return {
          displayFile,
          requestId,
          selectionId: displayFile.id,
        };
      })
      .filter(({ displayFile, requestId, selectionId }) => {
        if (isLinkOnlyFile(displayFile) || !requestId) return false;
        if (selectedIds.length === 0) return true;
        return selectedIds.includes(selectionId);
      })
      .map(({ requestId }) => requestId);
  };

  const clearZipStatusTimers = () => {
    zipStatusTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    zipStatusTimeoutsRef.current = [];
  };

  const queueZipStatusClear = (delay = 4200) => {
    clearZipStatusTimers();
    zipStatusTimeoutsRef.current.push(
      setTimeout(() => {
        setZipDownloadState(null);
      }, delay)
    );
  };

  const beginZipDownloadStatus = (mode: 'all' | 'selected', fileCount: number) => {
    clearZipStatusTimers();
    setZipDownloadState({ mode, phase: 'preparing', fileCount, percent: null });
    zipStatusTimeoutsRef.current.push(
      setTimeout(() => {
        setZipDownloadState((current) =>
          current && current.mode === mode && current.phase === 'preparing'
            ? { ...current, phase: 'building' }
            : current
        );
      }, 500)
    );
  };

  const completeZipDownloadStatus = (mode: 'all' | 'selected') => {
    setZipDownloadState((current) =>
      current && current.mode === mode ? { ...current, phase: 'starting', percent: 100 } : current
    );
    queueZipStatusClear(3200);
  };

  const updateZipDownloadStatus = (
    mode: 'all' | 'selected',
    phase: 'building' | 'downloading',
    percent: number | null = null
  ) => {
    clearZipStatusTimers();
    setZipDownloadState((current) =>
      current && current.mode === mode
        ? {
            ...current,
            phase,
            percent,
          }
        : current
    );
  };

  const resetZipDownloadStatus = () => {
    clearZipStatusTimers();
    setZipDownloadState(null);
  };

  const handleDownloadZip = async (fileIds?: string[]) => {
    const downloadMode: 'all' | 'selected' = fileIds && fileIds.length > 0 ? 'selected' : 'all';
    const versionId = activeFinalVersion?.id;
    const taskId = String(taskState?.id || (taskState as { _id?: string } | undefined)?._id || id || '').trim();
    if (!versionId || !taskId || !apiUrl) {
      toast.error('Cannot download ZIP — missing task or version info.');
      return;
    }
    const requestedIds = getFinalDeliverableZipRequestIds(fileIds);
    if ((fileIds?.length ?? 0) > 0 && requestedIds.length === 0) {
      toast.error('Selected files are not available for ZIP download.');
      return;
    }
    try {
      beginZipDownloadStatus(downloadMode, requestedIds.length);
      const authToken = await getFreshAuthToken();
      if (!authToken) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const downloadUrl = new URL(`${apiUrl}/api/tasks/${taskId}/deliverables/${versionId}/zip`);
      requestedIds.forEach((requestedId) => {
        downloadUrl.searchParams.append('fileIds', requestedId);
      });

      const { blob, fileName } = await new Promise<{ blob: Blob; fileName: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', downloadUrl.toString(), true);
        xhr.responseType = 'blob';
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
            updateZipDownloadStatus(downloadMode, 'building');
          }
        };

        xhr.onprogress = (event) => {
          const nextPercent =
            event.lengthComputable && event.total > 0
              ? Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)))
              : null;
          updateZipDownloadStatus(downloadMode, 'downloading', nextPercent);
        };

        xhr.onerror = () => reject(new Error('ZIP download failed.'));
        xhr.onabort = () => reject(new Error('ZIP download was cancelled.'));
        xhr.onload = () => {
          const finalize = async () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              let message = 'Failed to generate ZIP archive.';
              const errorBlob = xhr.response;
              if (errorBlob instanceof Blob) {
                const detail = await errorBlob.text().catch(() => '');
                if (detail.trim()) {
                  try {
                    const payload = JSON.parse(detail);
                    if (payload && typeof payload.error === 'string' && payload.error.trim()) {
                      message = sanitizeDownloadErrorMessage(payload.error, message);
                    } else {
                      message = sanitizeDownloadErrorMessage(detail, message);
                    }
                  } catch {
                    message = sanitizeDownloadErrorMessage(detail, message);
                  }
                }
              }
              reject(new Error(message));
              return;
            }

            const contentDisposition = xhr.getResponseHeader('Content-Disposition') || '';
            const fileNameMatch =
              contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i) || null;
            resolve({
              blob: xhr.response,
              fileName: decodeURIComponent(
                fileNameMatch?.[1] || fileNameMatch?.[2] || `deliverables-v${versionId}.zip`
              ),
            });
          };
          void finalize();
        };

        xhr.send();
      });

      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      completeZipDownloadStatus(downloadMode);
    } catch (error) {
      resetZipDownloadStatus();
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Failed to generate ZIP.';
      toast.error(`${message} Downloading files individually.`);
      const allFiles = (activeFinalVersion?.files ?? []).map((f, i) => toOutputFile(f, i));
      const targets = fileIds && fileIds.length > 0
        ? allFiles.filter((f) => fileIds.includes(f.id) && !isLinkOnlyFile(f))
        : allFiles.filter((f) => !isLinkOnlyFile(f));
      for (let i = 0; i < targets.length; i++) {
        if (i > 0) await new Promise<void>((res) => setTimeout(res, 650));
        await handleFileAction(targets[i]).catch(() => {});
      }
    }
  };

  const toOutputFile = (file: FinalDeliverableFile, index: number): OutputDisplayFile => ({
    id: getFinalDeliverableSelectionId(file, index),
    name: file.name || inferDriveItemNameFromUrl(file.url || ''),
    url: resolveStoredFileUrl(file as FinalDeliverableFile & FileLinkLike),
    type: 'output' as const,
    uploadedAt: file.uploadedAt,
    uploadedBy: file.uploadedBy,
    size: file.size,
    mime: file.mime,
    thumbnailUrl: file.thumbnailUrl,
    webViewLink: (file as FinalDeliverableFile & FileLinkLike).webViewLink,
    webContentLink: (file as FinalDeliverableFile & FileLinkLike).webContentLink,
    driveId: (file as FinalDeliverableFile & FileLinkLike).driveId,
  });
  const toPendingFinalFileFromVersionFile = (file: FinalDeliverableFile): PendingFinalFile => ({
    name: file.name || inferDriveItemNameFromUrl(file.url || ''),
    url: file.url || '',
    driveId: file.driveId,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    size: file.size,
    mime: file.mime,
    thumbnailUrl: file.thumbnailUrl,
  });
  const isAnnotatableImageOutputFile = (file: OutputDisplayFile) => {
    const mime = String(file.mime || '').trim().toLowerCase();
    return Boolean(file.url) && (mime.startsWith('image/') || isImageFile(file.name));
  };
  const toAttachmentPreviewFile = (file: FileActionTarget): AttachmentPreviewFile => ({
    id: String(file.id || '').trim() || undefined,
    name: file.name,
    url: resolveStoredFileUrl(file),
    driveId: getResolvedDriveId(file),
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    thumbnailUrl: file.thumbnailUrl,
  });
  const canPreviewFile = (file: FileActionTarget) => {
    return isAttachmentPreviewable(toAttachmentPreviewFile(file));
  };
  const openFilePreviewDialog = (file: FileActionTarget) => {
    if (!canPreviewFile(file)) return;
    setAttachmentPreviewFile(toAttachmentPreviewFile(file));
  };
  const handleFileRowPreviewClick = (event: MouseEvent<HTMLElement>, file: FileActionTarget) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;
    openFilePreviewDialog(file);
  };
  const openReviewAnnotationDialog = (file: FileActionTarget, readOnly = false) => {
    setAnnotationTargetFile(file);
    setAnnotationDialogReadOnly(readOnly);
    setAnnotationDialogOpen(true);
  };
  const handleSaveReviewAnnotation = (annotation: FinalDeliverableReviewAnnotation) => {
    const key = getReviewAnnotationFileKey(annotation);
    if (!key) {
      toast.error('Unable to save annotation for this file.');
      return;
    }
    setDraftReviewAnnotationsByFile((prev) => ({
      ...prev,
      [key]: annotation,
    }));
    toast.success('Feedback saved for this file.');
  };
  const getDesignSourcePreviewVariant = (fileName: string) => {
    const extension = getFileExtension(fileName).toLowerCase();
    if (extension === 'psd') {
      return {
        kind: 'image' as const,
        iconSrc: PSD_FILE_ICON_URL,
        iconAlt: 'PSD file icon',
      };
    }
    if (extension === 'ai') {
      return {
        kind: 'brand' as const,
        topLabel: 'Ai',
        bottomLabel: 'AI',
        cardClass:
          'border-[#4B2800] bg-[linear-gradient(180deg,_#1F1304_0%,_#472603_55%,_#8F4A02_100%)] text-[#FFB347] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        foldClass: 'border-t-[14px] border-t-[#FF9A00] border-l-[14px] border-l-transparent',
        topLabelClass: 'text-[16px] font-semibold tracking-[-0.04em]',
        bottomLabelClass: 'text-[9px] font-semibold tracking-[0.22em] text-white/92',
      };
    }
    if (extension === 'eps') {
      return {
        kind: 'paper' as const,
        topLabel: 'EPS',
        bottomLabel: 'EPS',
        cardClass:
          'border-[#CBD5E1] bg-[linear-gradient(180deg,_#FFFFFF_0%,_#F5F7FA_100%)] text-[#3F3F46] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
        foldClass: 'border-t-[14px] border-t-[#E5E7EB] border-l-[14px] border-l-transparent',
        topLabelClass: 'text-[9px] font-semibold tracking-[0.22em]',
        bottomLabelClass: 'text-[10px] font-semibold tracking-[0.16em] text-[#3F3F46]',
      };
    }
    return null;
  };
  const renderFilePreview = (file: FileActionTarget) => {
    const extLabel = getFileExtension(file.name);
    const previewUrl = getPreviewUrl(file);
    const designSourceVariant = getDesignSourcePreviewVariant(file.name);
    if (designSourceVariant) {
      if (designSourceVariant.kind === 'image') {
        return (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[8px]">
            <img
              src={designSourceVariant.iconSrc}
              alt={designSourceVariant.iconAlt}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
        );
      }
      return (
        <div
          className={cn(
            'relative flex h-10 w-10 shrink-0 flex-col items-center justify-between overflow-hidden rounded-[9px] border px-1.5 py-1.5',
            designSourceVariant.cardClass
          )}
        >
          <span
            className={cn(
              'absolute right-0 top-0 h-0 w-0',
              designSourceVariant.foldClass
            )}
          />
          {designSourceVariant.kind === 'paper' ? (
            <>
              <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#D4D4D8] bg-white/80">
                <PenTool className="h-2.5 w-2.5 text-[#52525B]" strokeWidth={2.2} />
              </div>
              <span className={cn('mt-1', designSourceVariant.bottomLabelClass)}>
                {designSourceVariant.bottomLabel}
              </span>
            </>
          ) : (
            <>
              <span className={cn('mt-0.5', designSourceVariant.topLabelClass)}>
                {designSourceVariant.topLabel}
              </span>
              <span className={cn('mb-0.5', designSourceVariant.bottomLabelClass)}>
                {designSourceVariant.bottomLabel}
              </span>
            </>
          )}
        </div>
      );
    }
    return (
      <div className="relative h-8 w-10 overflow-hidden rounded-[6px] border border-transparent bg-[radial-gradient(circle_at_top_left,_rgba(191,214,255,0.6),_transparent_55%),linear-gradient(160deg,_rgba(236,244,255,0.85),_rgba(198,220,255,0.45))] backdrop-blur-xl dark:border-slate-700/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(100,116,139,0.35),_transparent_55%),linear-gradient(160deg,_rgba(30,41,59,0.95),_rgba(51,65,85,0.75))] dark:shadow-none">
        <div className="absolute inset-0 rounded-[6px] border border-transparent bg-gradient-to-br from-white/85 via-[#EEF4FF]/75 to-[#D5E5FF]/65 backdrop-blur-sm dark:bg-gradient-to-br dark:from-slate-800/95 dark:via-slate-700/90 dark:to-slate-700/70 dark:border-slate-700/60">
          <div className="absolute left-2 top-1.5 h-1 w-5 rounded-full bg-[#D6E2FA]/70 dark:bg-slate-400/55" />
          <div className="absolute left-2 top-3.5 h-1 w-6 rounded-full bg-[#DDE8FB]/70 dark:bg-slate-400/45" />
          <div className="absolute left-2 top-5 h-1 w-4 rounded-full bg-[#DDE8FB]/70 dark:bg-slate-400/45" />
        </div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt={toTitleCaseFileName(file.name)}
            className="relative z-10 h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className="absolute bottom-0.5 left-0.5 z-20 rounded-[4px] border border-white/70 bg-white/55 px-1.5 py-0.5 text-[8px] font-semibold text-[#2C4A83] backdrop-blur-md dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-200 dark:shadow-none">
          {extLabel}
        </span>
        <span className="absolute bottom-0 right-0 z-20 h-0 w-0 border-b-[10px] border-b-[#D8E4FF] border-l-[10px] border-l-transparent dark:border-b-slate-500/70" />
      </div>
    );
  };

  const ensureWritableTask = (options?: { allowManagerApproval?: boolean; allowMainDesignerFinalize?: boolean }) => {
    if (options?.allowManagerApproval) {
      const isManagerApprovalActor = user?.role === 'treasurer' || user?.role === 'admin';
      if (isManagerApprovalActor) {
        return true;
      }
    }
    const canBypassRestrictedAccess =
      options?.allowMainDesignerFinalize && isDesignerRole && isMainDesignerUser;
    if ((isViewOnlyTask || !hasFullTaskAccess) && !canBypassRestrictedAccess) {
      toast.error('Action unavailable for this task.');
      return false;
    }
    return true;
  };

  const recordChanges = async (
    changes: ChangeInput[],
    updates: Partial<typeof taskState> = {},
    options?: {
      allowManagerApproval?: boolean;
      allowMainDesignerFinalize?: boolean;
      skipSuccessToast?: boolean;
    }
  ) => {
    if (changes.length === 0) return false;
    if (
      !ensureWritableTask({
        allowManagerApproval: options?.allowManagerApproval,
        allowMainDesignerFinalize: options?.allowMainDesignerFinalize,
      })
    ) {
      return false;
    }

    const isStaffUser = user?.role === 'staff';
    const now = new Date();
    const entries: TaskChange[] = changes.map((change, index) => ({
      id: `ch-${Date.now()}-${index}`,
      type: change.type,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      note: change.note,
      userId: user?.id || '',
      userName: user?.name || 'Unknown',
      userRole: user?.role || 'staff',
      createdAt: now,
    }));
    const updatesWithMeta = { ...updates, updatedAt: now };

    const nextCount = changeCount + entries.length;
    const overrideApproval = updates.approvalStatus as ApprovalStatus | undefined;
    const nextApproval = overrideApproval ?? (isStaffUser ? approvalStatus : nextCount >= 3 ? 'pending' : approvalStatus);

    const nextHistory = [...entries, ...changeHistory];
    setChangeCount(nextCount);
    setApprovalStatus(nextApproval);
    setChangeHistory(nextHistory);
    setTaskState((prev) => {
      if (!prev) return prev;
      const nextTask = {
        ...prev,
        ...updatesWithMeta,
        changeHistory: nextHistory,
        changeCount: nextCount,
        approvalStatus: nextApproval,
      };
      persistTask(nextTask, nextHistory);
      return nextTask;
    });

    const apiUrl = API_URL;
    if (apiUrl) {
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/changes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            updates: updatesWithMeta,
            changes: entries.map((entry) => ({
              type: entry.type,
              field: entry.field,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
              note: entry.note,
            })),
            userId: user?.id || '',
            userName: user?.name || '',
            userRole: user?.role || '',
          }),
        });
        if (!response.ok) {
          let errorMessage = 'Backend update failed.';
          try {
            const errData = await response.json();
            if (errData?.error) {
              errorMessage = errData.error;
            }
          } catch {
            // ignore parse errors
          }
          throw new Error(errorMessage);
        }
        const updated = await response.json();
        const hydrated = withAccessMetadata(hydrateTask(updated));
        setTaskState(hydrated);
        setChangeHistory(hydrated?.changeHistory ?? []);
        setApprovalStatus(hydrated?.approvalStatus);
        persistTask(hydrated);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend update failed.';
        if (message.toLowerCase().includes('forbidden')) {
          setTaskState((prev) =>
            prev
              ? ({
                  ...prev,
                  accessMode: 'view_only',
                  viewOnly: true,
                } as typeof prev)
              : prev
          );
          toast.error('Only the assigned designer can update this task.');
          return false;
        }
        toast.error('Backend update failed.', { description: message });
        return false;
      }
    }

    const hasStaffTrackedChange = entries.some((entry) =>
      STAFF_EDIT_CHANGE_FIELDS.has(String(entry.field || ''))
    );
    const nextStaffTrackedCount =
      staffChangeCount +
      entries.filter((entry) => STAFF_EDIT_CHANGE_FIELDS.has(String(entry.field || ''))).length;
    if (
      !overrideApproval &&
      isStaffUser &&
      hasStaffTrackedChange &&
      nextStaffTrackedCount >= 3
    ) {
      toast.message('Treasurer approval required after 3+ changes.');
      return true;
    }

    if (!options?.skipSuccessToast) {
      toast.success('Changes recorded.');
    }
    return true;
  };

  useEffect(() => {
    if (!apiUrl || !id) return;
    const loadTask = async () => {
      setIsLoading(true);
      if (shouldAwaitFreshTaskOnEntry || !hasInitialTask) {
        setTaskRouteState('loading');
      }
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/${id}`);
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Session expired. Please sign in again.');
          }
          if (response.status === 403 || response.status === 404) {
            try {
              const listResponse = await authFetch(`${apiUrl}/api/tasks`);
              if (listResponse.ok) {
                const listData = await listResponse.json();
                const match = listData.find(
                  (item: any) => (item?.id || item?._id) === id
                );
                if (match) {
                  const isAccessDenied = response.status === 403;
                  const hydrated = withAccessMetadata(
                    hydrateTask({
                      ...match,
                      id: match.id || match._id,
                      ...(isAccessDenied
                        ? {
                          accessMode: 'view_only',
                          viewOnly: true,
                        }
                        : {}),
                    })
                  );
                  setTaskState(hydrated);
                  setChangeHistory(hydrated?.changeHistory ?? []);
                  setChangeCount(hydrated?.changeCount ?? 0);
                  setApprovalStatus(hydrated?.approvalStatus);
                  setEditedDescription(hydrated?.description ?? '');
                  setEditedDeadline(hydrated ? format(hydrated.deadline, 'yyyy-MM-dd') : '');
                  setDeadlineRequest(
                    hydrated?.proposedDeadline
                      ? format(hydrated.proposedDeadline, 'yyyy-MM-dd')
                      : ''
                  );
                  persistTask(hydrated);
                  setTaskRouteState('ready');
                  return;
                }
              }
            } catch {
              // ignore fallback errors
            }
          }
          throw new Error('Task not found');
        }
        const data = await response.json();
        const hydrated = withAccessMetadata(
          hydrateTask({
            ...data,
            id: data.id || data._id,
          })
        );
        setTaskState(hydrated);
        setTaskRouteState('ready');
        setChangeHistory(hydrated?.changeHistory ?? []);
        setChangeCount(hydrated?.changeCount ?? 0);
        setApprovalStatus(hydrated?.approvalStatus);
        setEditedDescription(hydrated?.description ?? '');
        setEditedDeadline(hydrated ? format(hydrated.deadline, 'yyyy-MM-dd') : '');
        setDeadlineRequest(
          hydrated?.proposedDeadline ? format(hydrated.proposedDeadline, 'yyyy-MM-dd') : ''
        );
        persistTask(hydrated);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Task not found';
        if (message.toLowerCase().includes('session expired')) {
          toast.error(message);
        }
        if (!hasInitialTask) {
          setTaskRouteState('not_found');
        } else if (shouldAwaitFreshTaskOnEntry) {
          setTaskRouteState('ready');
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadTask();
  }, [apiUrl, hasInitialTask, id, shouldAwaitFreshTaskOnEntry]);

  useEffect(() => {
    if (apiUrl || !id) return;
    const local = loadLocalTaskById(id);
    if (!local) return;
    const hydrated = withAccessMetadata(hydrateTask(local));
    setTaskState(hydrated);
    setTaskRouteState('ready');
    setChangeHistory(hydrated?.changeHistory ?? []);
    setChangeCount(hydrated?.changeCount ?? 0);
    setApprovalStatus(hydrated?.approvalStatus);
    setEditedDescription(hydrated?.description ?? '');
    setEditedDeadline(hydrated ? format(hydrated.deadline, 'yyyy-MM-dd') : '');
    setDeadlineRequest(
      hydrated?.proposedDeadline ? format(hydrated.proposedDeadline, 'yyyy-MM-dd') : ''
    );
  }, [apiUrl, id]);

  useEffect(() => {
    if (!user || !taskState || !user.role) return;
    const accessMode = normalizeTaskAccessMode(
      (taskState as { accessMode?: string; viewOnly?: boolean }).accessMode
    );
    const explicitViewOnly =
      (taskState as { viewOnly?: boolean }).viewOnly === true;
    if (accessMode === 'view_only' || explicitViewOnly) return;
    if (!hasUnseenComments) return;
    const now = Date.now();
    if (
      seenRequestRef.current ||
      (lastSeenFingerprintRef.current === unseenFingerprint && now - lastSeenAttemptAtRef.current < 10000)
    ) {
      return;
    }
    const markSeen = async () => {
      seenRequestRef.current = true;
      lastSeenAttemptAtRef.current = now;
      lastSeenFingerprintRef.current = unseenFingerprint;
      if (apiUrl) {
        try {
          const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/comments/seen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: user.role }),
          });
          if (response.ok) {
            const updated = await response.json();
            const hydrated = withAccessMetadata(hydrateTask(updated));
            setTaskState(hydrated);
          }
        } catch {
          // no-op
        } finally {
          seenRequestRef.current = false;
        }
        return;
      }

      const nextTask = {
        ...taskState,
        comments: taskState.comments.map((comment) => {
          const receivers = resolveCommentReceivers(comment);
          if (!receivers.includes(user.role)) return comment;
          const seenBy = comment.seenBy ?? [];
          if (
            seenBy.some((entry) =>
              user.id
                ? String(entry.userId || '').trim() === String(user.id).trim()
                : entry.role === user.role
            )
          ) {
            return comment;
          }
          return {
            ...comment,
            seenBy: [
              ...seenBy,
              {
                role: user.role,
                userId: user.id,
                userName: user.name,
                seenAt: new Date(),
              },
            ],
          };
        }),
      };
      setTaskState(nextTask);
      persistTask(nextTask);
      seenRequestRef.current = false;
    };
    markSeen();
  }, [apiUrl, taskState?.id, hasUnseenComments, unseenFingerprint, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !commentDraftKey) return;
    const savedDraft = window.localStorage.getItem(commentDraftKey);
    setNewComment(savedDraft ?? '');
  }, [commentDraftKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !commentDraftKey) return;
    if (newComment.length > 0) {
      window.localStorage.setItem(commentDraftKey, newComment);
      return;
    }
    window.localStorage.removeItem(commentDraftKey);
  }, [commentDraftKey, newComment]);

  const submitComment = async (
    content: string,
    parentId?: string,
    onSuccess?: () => void,
    attachments: TaskFile[] = []
  ) => {
    if (!taskState) return;
    if (!canComment) {
      toast.error('Comments are disabled for this task.');
      return;
    }
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    const mentions = extractMentions(trimmed);
    const receiverRoles = buildReceiverRoles(trimmed);

    if (apiUrl) {
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || '',
            userName: user?.name || 'User',
            userRole: user?.role || 'staff',
            content: trimmed,
            receiverRoles,
            parentId,
            mentions,
            attachments,
          }),
        });
        if (!response.ok) {
          let errorMessage = 'Failed to add comment.';
          if (response.status === 401) {
            errorMessage = 'Session expired. Please sign in again.';
          } else {
            try {
              const errData = await response.json();
              if (errData?.error) {
                errorMessage = errData.error;
              }
            } catch {
              // ignore parse errors
            }
          }
          throw new Error(errorMessage);
        }
        const updated = await response.json();
        const hydrated = withAccessMetadata(hydrateTask(updated));
        setTaskState(hydrated);
        onSuccess?.();
        clearTyping();
        toast.success('Comment added');
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add comment.';
        toast.error('Failed to add comment', { description: message });
        return;
      }
    }

    const nextComment = {
      id: `comment-${Date.now()}`,
      taskId: taskState.id,
      userId: user?.id || '',
      userName: user?.name || 'User',
      userRole: user?.role || 'staff',
      content: trimmed,
      parentId: parentId || '',
      mentions,
      createdAt: new Date(),
      receiverRoles,
      attachments,
      seenBy: [],
      reactions: [],
    };
    const nextTask = {
      ...taskState,
      comments: [...taskState.comments, nextComment],
      updatedAt: new Date(),
    };
    setTaskState(nextTask);
    persistTask(nextTask);
    onSuccess?.();
    clearTyping();
    toast.success('Comment added');
  };

  const handleAddComment = () => {
    submitComment(newComment, undefined, () => {
      setNewComment('');
      clearComposerAttachments('comment');
      clearMentionContext('comment');
    }, commentAttachments);
  };

  const handleReplySubmit = (parentId: string) => {
    submitComment(replyText, parentId, () => {
      setReplyText('');
      setReplyToId(null);
      clearComposerAttachments('reply');
      clearMentionContext('reply');
    }, replyAttachments);
  };

  const startReplyToComment = (commentId: string) => {
    setEditingCommentId(null);
    setEditingCommentText('');
    setReplyToId(commentId);
    setReplyText('');
    setReplyAttachments([]);
    clearMentionContext('reply');
  };

  const cancelReplyComposer = () => {
    setReplyToId(null);
    setReplyText('');
    setReplyAttachments([]);
    clearMentionContext('reply');
  };

  const startCommentEdit = (comment: TaskComment) => {
    setReplyToId(null);
    setReplyText('');
    setReplyAttachments([]);
    clearMentionContext('reply');
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleCommentEditSave = async (comment: TaskComment) => {
    if (!taskState || commentUpdateInFlightId) return;
    const trimmed = editingCommentText.trim();
    if (!trimmed && (comment.attachments?.length ?? 0) === 0) {
      toast.error('Message text or an attachment is required.');
      return;
    }

    const mentions = extractMentions(trimmed);
    const receiverRoles = buildReceiverRoles(trimmed);
    setCommentUpdateInFlightId(comment.id);

    if (apiUrl) {
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/comments/${comment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: trimmed,
            mentions,
            receiverRoles,
          }),
        });
        if (!response.ok) {
          let message = 'Failed to update message.';
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              message = errorData.error;
            }
          } catch {
            // ignore parse errors
          }
          throw new Error(message);
        }
        const updated = await response.json();
        if (updated?.comment) {
          mergeCommentIntoState(updated.comment);
        }
        cancelCommentEdit();
        toast.success('Message updated');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update message.';
        toast.error('Failed to update message', { description: message });
      } finally {
        setCommentUpdateInFlightId(null);
      }
      return;
    }

    mergeCommentIntoState({
      ...comment,
      content: trimmed,
      mentions,
      receiverRoles,
      editedAt: new Date(),
    });
    cancelCommentEdit();
    setCommentUpdateInFlightId(null);
    toast.success('Message updated');
  };

  const handleCommentDelete = async (comment: TaskComment) => {
    if (!taskState || commentDeleteInFlightId) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Delete this message?');
      if (!confirmed) return;
    }

    setCommentDeleteInFlightId(comment.id);

    if (apiUrl) {
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/comments/${comment.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          let message = 'Failed to delete message.';
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              message = errorData.error;
            }
          } catch {
            // ignore parse errors
          }
          throw new Error(message);
        }
        const updated = await response.json();
        if (updated?.comment) {
          mergeCommentIntoState(updated.comment);
        }
        if (editingCommentId === comment.id) {
          cancelCommentEdit();
        }
        if (replyToId === comment.id) {
          cancelReplyComposer();
        }
        toast.success('Message deleted');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete message.';
        toast.error('Failed to delete message', { description: message });
      } finally {
        setCommentDeleteInFlightId(null);
      }
      return;
    }

    mergeCommentIntoState({
      ...comment,
      content: '',
      attachments: [],
      mentions: [],
      reactions: [],
      deletedAt: new Date(),
      deletedByName: user?.name || '',
      editedAt: undefined,
    });
    if (editingCommentId === comment.id) {
      cancelCommentEdit();
    }
    if (replyToId === comment.id) {
      cancelReplyComposer();
    }
    setCommentDeleteInFlightId(null);
    toast.success('Message deleted');
  };

  const handleCommentReactionToggle = async (comment: TaskComment, emoji: string) => {
    if (!taskState || commentReactionInFlightKey) return;
    const reactionKey = `${comment.id}:${emoji}`;
    setCommentReactionInFlightKey(reactionKey);

    if (apiUrl) {
      try {
        const response = await authFetch(
          `${apiUrl}/api/tasks/${taskState.id}/comments/${comment.id}/reactions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji }),
          }
        );
        if (!response.ok) {
          let message = 'Failed to update reaction.';
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              message = errorData.error;
            }
          } catch {
            // ignore parse errors
          }
          throw new Error(message);
        }
        const updated = await response.json();
        if (updated?.comment) {
          mergeCommentIntoState(updated.comment);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update reaction.';
        toast.error('Failed to update reaction', { description: message });
      } finally {
        setCommentReactionInFlightKey(null);
      }
      return;
    }

    const existingReactions = comment.reactions ?? [];
    const nextReactions = existingReactions.some(
      (reaction) => reaction.emoji === emoji && reaction.userId === user?.id
    )
      ? existingReactions.filter(
          (reaction) => !(reaction.emoji === emoji && reaction.userId === user?.id)
        )
      : [
          ...existingReactions,
          {
            emoji,
            userId: user?.id || 'local-user',
            userName: user?.name || 'User',
            userRole: user?.role || 'staff',
            createdAt: new Date(),
          },
        ];

    mergeCommentIntoState({
      ...comment,
      reactions: nextReactions,
    });
    setCommentReactionInFlightKey(null);
  };

  const handleComposerChange = (
    target: ComposerTarget,
    value: string,
    selectionStart?: number | null
  ) => {
    if (target === 'reply') {
      setReplyText(value);
    } else {
      setNewComment(value);
    }
    syncMentionContext(value, target, selectionStart);
    handleChatTypingInput();
  };

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    target: ComposerTarget,
    content: string,
    attachments: TaskFile[],
    parentId?: string
  ) => {
    if (mentionContext?.target === target && mentionSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveMentionIndex((current) => (current + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveMentionIndex((current) =>
          current === 0 ? mentionSuggestions.length - 1 : current - 1
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        applyMentionSuggestion(mentionSuggestions[activeMentionIndex] || mentionSuggestions[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        clearMentionContext(target);
        return;
      }
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (target === 'reply') {
        if (content.trim() || attachments.length > 0) {
          handleReplySubmit(parentId || '');
        }
      } else if (content.trim() || attachments.length > 0) {
        handleAddComment();
      }
    }
  };

  const handleChatAttachmentSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: ComposerTarget
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    await uploadCommentFiles(files, target);
  };

  const setChatComposerDragging = (target: ComposerTarget, isDragging: boolean) => {
    if (target === 'reply') {
      setIsReplyComposerDragging(isDragging);
      return;
    }
    setIsCommentComposerDragging(isDragging);
  };

  const handleChatComposerDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    target: ComposerTarget
  ) => {
    event.preventDefault();
    if (isUploadingCommentAttachments) return;
    event.dataTransfer.dropEffect = 'copy';
    setChatComposerDragging(target, true);
  };

  const handleChatComposerDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    target: ComposerTarget
  ) => {
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget as Node)) {
      return;
    }
    setChatComposerDragging(target, false);
  };

  const handleChatComposerDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    target: ComposerTarget
  ) => {
    event.preventDefault();
    setChatComposerDragging(target, false);
    if (isUploadingCommentAttachments) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    await uploadCommentFiles(files, target);
  };

  const handleStatusChange = (status: TaskStatus) => {
    if (status === getStatusSelectValue(taskState?.status)) return;
    if (status === 'assigned' || status === 'accepted' || status === 'completed') {
      toast.message('This status is set by assignment or final review actions.');
      return;
    }
    recordChanges(
      [
        {
          type: 'status',
          field: 'status',
          oldValue: statusConfig[normalizedTaskStatus].label,
          newValue: statusConfig[status].label,
        },
      ],
      { status }
    );
    setNewStatus(status);
  };

  const handleCollateralStatusChange = async (
    collateralId: string,
    nextStatus: CollateralStatus
  ) => {
    if (!taskState) return;
    if (!ensureWritableTask()) return;
    const currentCollateral = collateralItems.find((item) => item.id === collateralId);
    if (!currentCollateral || currentCollateral.status === nextStatus) return;

    const taskId = taskState.id || (taskState as { _id?: string })._id || '';
    if (!taskId) {
      toast.error('Task not found.');
      return;
    }

    try {
      if (apiUrl) {
        const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/collaterals/${collateralId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to update collateral status.');
        }
        const hydrated = withAccessMetadata(hydrateTask(payload));
        setTaskState(hydrated);
        window.dispatchEvent(new CustomEvent('designhub:task:updated', { detail: hydrated }));
      } else {
        const updatedCollaterals = collateralItems.map((item) =>
          item.id === collateralId
            ? {
                ...item,
                status: nextStatus,
                assignedToId: item.assignedToId || user?.id || '',
                assignedToName: item.assignedToName || user?.name || '',
                updatedAt: new Date(),
              }
            : item
        );
        const nextTask = {
          ...taskState,
          collaterals: updatedCollaterals,
          status: deriveTaskStatusFromCollaterals(updatedCollaterals, taskState.status),
          updatedAt: new Date(),
        };
        setTaskState(nextTask);
        upsertLocalTask(nextTask);
        window.dispatchEvent(new CustomEvent('designhub:task:updated', { detail: nextTask }));
      }

      toast.success(
        `${getCollateralDisplayName(currentCollateral)} updated to ${formatCollateralStatusLabel(nextStatus)}.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update collateral status.');
    }
  };

  const handleAcceptTask = async () => {
    if (!taskState) return;
    if (!ensureWritableTask()) return;
    if (!apiUrl) {
      toast.error('Task acceptance API is not configured.');
      return;
    }
    const taskId = taskState.id || (taskState as { _id?: string })._id || '';
    if (!taskId) {
      toast.error('Task not found.');
      return;
    }

    setIsAcceptingTask(true);
    try {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/accept`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to accept task.');
      }

      const updatedTaskRaw = (payload?.task || payload) as any;
      const hydrated = withAccessMetadata(
        hydrateTask({
          ...updatedTaskRaw,
          id: updatedTaskRaw?.id || updatedTaskRaw?._id || taskId,
        } as typeof mockTasks[number]),
        taskState
      );
      if (hydrated) {
        setTaskState(hydrated);
        setChangeHistory(hydrated.changeHistory ?? []);
        setChangeCount(hydrated.changeCount ?? 0);
        setApprovalStatus(hydrated.approvalStatus);
        persistTask(hydrated);
      }
      toast.success('Task accepted.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to accept task.';
      toast.error(message);
    } finally {
      setIsAcceptingTask(false);
    }
  };

  const getLatestFinalVersionIdFromTask = (task?: typeof taskState) => {
    const versions = Array.isArray(task?.finalDeliverableVersions)
      ? task.finalDeliverableVersions
      : [];
    if (versions.length === 0) return '';
    const latest = versions.reduce((best, current) => {
      const bestVersion = Number(best?.version ?? 0);
      const currentVersion = Number(current?.version ?? 0);
      if (currentVersion > bestVersion) return current;
      return best;
    }, versions[0]);
    return String(latest?.id || '').trim();
  };

  const submitFinalDeliverableVersion = async ({
    files,
    note,
  }: {
    files: PendingFinalFile[];
    note?: string;
  }) => {
    if (!taskState || !apiUrl) {
      throw new Error('Submit requires backend connection.');
    }
    const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/final-deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files,
        note: String(note || '').trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to create final deliverable version.');
    }
    const hydrated = withAccessMetadata(hydrateTask(data));
    setTaskState(hydrated);
    const latestVersionId = getLatestFinalVersionIdFromTask(hydrated);
    if (latestVersionId) {
      setSelectedFinalVersionId(latestVersionId);
    }
    setPendingFinalFiles([]);
    setFinalUploadItems([]);
    setFinalVersionNote('');
    return hydrated;
  };

  const handleHandoverTask = async () => {
    if (!taskState) return;
    if (!ensureWritableTask({ allowMainDesignerFinalize: true })) return;
    if (!hasPendingFinalFiles) {
      if (finalDeliverableReviewStatus === 'pending') {
        toast.message('The latest final submission is already under review.');
        return;
      }
      if (finalDeliverableReviewStatus === 'approved') {
        toast.message('The latest final submission is already approved.');
        return;
      }
      if (finalDeliverableReviewStatus === 'rejected') {
        toast.message('Upload updated files or links before submitting the next revision.');
        return;
      }
      toast.message('Upload final files before handing over the task.');
      return;
    }
    if (!apiUrl) {
      toast.error('Submit requires backend connection.');
      return;
    }
    try {
      const updatedTask = await submitFinalDeliverableVersion({
        files: pendingFinalFiles,
        note: finalVersionNote.trim(),
      });
      if (normalizeTaskStatus(updatedTask?.status) === 'under_review') {
        setShowHandoverModal(true);
        return;
      }
      toast.success('Final submission created.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to create final deliverable version.';
      if (message.toLowerCase().includes('forbidden')) {
        setTaskState((prev) =>
          prev
            ? ({
                ...prev,
                accessMode: 'view_only',
                viewOnly: true,
              } as typeof prev)
            : prev
        );
        toast.error('Only the assigned designer or Design Lead can submit this task.');
        return;
      }
      toast.error(message);
    }
  };

  const handleHandoverClose = () => {
    setShowHandoverModal(false);
  };

  const handleEmergencyDecision = async (decision: 'approved' | 'rejected') => {
    if (!taskState) return;
    if (!user) return;
    if (!ensureWritableTask()) return;
    const reason = emergencyDecisionReason.trim();
    if (!reason) {
      toast.error('Add a reason before submitting emergency decision.');
      return;
    }
    setIsEmergencyUpdating(true);
    const now = new Date();
    const prevStatus = emergencyStatus ?? 'pending';
    const decisionLabel = decision === 'approved' ? 'Approved' : 'Rejected';
    const note = `Emergency ${decisionLabel.toLowerCase()} by ${user.name || 'Designer'}: ${reason}`;
    const entry: TaskChange = {
      id: `ch-${Date.now()}-0`,
      type: 'status',
      field: 'emergency_approval',
      oldValue: prevStatus,
      newValue: decisionLabel,
      note,
      userId: user.id,
      userName: user.name || 'Designer',
      userRole: user.role || 'designer',
      createdAt: now,
    };
    const nextTask = {
      ...taskState,
      isEmergency: true,
      emergencyApprovalStatus: decision,
      emergencyApprovedBy: user.name || 'Designer',
      emergencyApprovedAt: now,
      updatedAt: now,
      changeHistory: [entry, ...(taskState.changeHistory || [])],
    };
    const apiUpdates = {
      isEmergency: true,
      emergencyApprovalStatus: decision,
      emergencyApprovedBy: user.name || 'Designer',
      emergencyApprovedAt: now,
      updatedAt: now,
    };

    try {
      if (apiUrl) {
        const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/changes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: apiUpdates,
            changes: [
              {
                type: entry.type,
                field: entry.field,
                oldValue: entry.oldValue,
                newValue: entry.newValue,
                note: entry.note,
              },
            ],
            userId: user.id,
            userName: user.name || '',
            userRole: user.role || '',
          }),
        });
        if (!response.ok) {
          let errorMessage = 'Failed to update emergency status';
          try {
            const errData = await response.json();
            if (errData?.error) {
              errorMessage = errData.error;
            }
          } catch {
            // ignore parse errors
          }
          throw new Error(errorMessage);
        }
        const updated = await response.json();
        const hydrated = withAccessMetadata(hydrateTask(updated));
        setTaskState(hydrated);
        setChangeHistory(hydrated?.changeHistory ?? []);
        setChangeCount(hydrated?.changeCount ?? changeCount + 1);
        setApprovalStatus(hydrated?.approvalStatus);
        persistTask(hydrated);
      } else {
        setTaskState(nextTask);
        setChangeHistory(nextTask.changeHistory);
        setChangeCount((prev) => prev + 1);
        persistTask(nextTask);
        if (taskState.requesterId) {
          pushScheduleNotification(
            taskState.requesterId,
            taskState.id,
            `Emergency request ${decision} for "${taskState.title}". Reason: ${reason}`
          );
        }
      }

      toast.success(
        decision === 'approved'
          ? 'Emergency request approved.'
          : 'Emergency request rejected.'
      );
      setEmergencyDecisionReason('');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to update emergency status.';
      toast.error(message);
    } finally {
      setIsEmergencyUpdating(false);
    }
  };

  const handleRequestApproval = async () => {
    if (approvalRequestInFlight) return;
    if (user?.role !== 'staff' || staffChangeCount < 3) {
      toast.message('Send for approval after 3 staff changes.');
      return;
    }
    setApprovalRequestInFlight(true);
    try {
      const applied = await recordChanges(
        [
          {
            type: 'status',
            field: 'approval_status',
            oldValue: approvalStatus ?? 'pending',
            newValue: 'Pending',
            note: `Approval requested - ${user?.name || 'Staff'}`,
          },
        ],
        { approvalStatus: 'pending' },
        { skipSuccessToast: true }
      );
      if (!applied) return;
      setIsEditingTask(false);
      toast.message('Approval request sent to treasurer.');
    } finally {
      setApprovalRequestInFlight(false);
    }
  };

  const handleApprovalDecision = async (decision: ApprovalDecision) => {
    if (approvalDecisionInFlight) return;
    const oldValue = approvalStatus ?? 'pending';
    setApprovalDecisionInFlight(decision);
    try {
      const applied = await recordChanges(
        [
          {
            type: 'status',
            field: 'approval_status',
            oldValue,
            newValue: decision === 'approved' ? 'Approved' : 'Rejected',
            note: `Approval ${decision} by ${user?.name || 'Treasurer'}`,
          },
        ],
        {
          approvalStatus: decision,
          approvedBy: user?.name || '',
          approvalDate: new Date(),
        },
        {
          allowManagerApproval: true,
          skipSuccessToast: true,
        }
      );
      if (!applied) return;
      toast.success(decision === 'approved' ? 'Request approved.' : 'Request rejected.');
    } finally {
      setApprovalDecisionInFlight(null);
    }
  };

  const handleFinalDeliverableReviewDecision = async (decision: ApprovalDecision) => {
    if (!taskState || !apiUrl) return;
    if (finalReviewDecisionInFlight) return;
    if (!canMainDesignerReviewFinalDeliverables) return;

    const reviewNoteValue = finalReviewNote.trim();
    const reviewAnnotations =
      decision === 'rejected'
        ? draftReviewAnnotationList
            .filter((annotation) => hasReviewAnnotationContent(annotation))
            .map((annotation, index) => ({
              ...annotation,
              id: annotation.id || `annotation-${index}`,
              fileId:
                String(annotation.fileId || '').trim() ||
                String(annotation.fileUrl || '').trim(),
              fileName: String(annotation.fileName || '').trim(),
              fileUrl: String(annotation.fileUrl || '').trim(),
              comments:
                annotation.comments?.map((comment, commentIndex) => ({
                  ...comment,
                  id: comment.id || `comment-${index}-${commentIndex}`,
                  x: Number(comment.x ?? 0),
                  y: Number(comment.y ?? 0),
                  text: String(comment.text || '').trim(),
                  thread:
                    comment.thread?.map((message, messageIndex) => ({
                      ...message,
                      id: message.id || `thread-${index}-${commentIndex}-${messageIndex}`,
                      text: String(message.text || '').trim(),
                      author: String(message.author || '').trim(),
                      createdAt: String(message.createdAt || ''),
                    })) ?? [],
                })) ?? [],
              shapes:
                annotation.shapes?.map((shape, shapeIndex) => ({
                  ...shape,
                  id: shape.id || `shape-${index}-${shapeIndex}`,
                  kind: (String(shape.kind || 'pen').trim().toLowerCase() ||
                    'pen') as
                    | 'pen'
                    | 'highlighter'
                    | 'arrow'
                    | 'rect'
                    | 'ellipse'
                    | 'text'
                    | 'blur_rect'
                    | 'highlight_rect',
                  color: String(shape.color || '#ef4444').trim(),
                  width: Number(shape.width ?? 2),
                  opacity: Number(shape.opacity ?? 1),
                  points:
                    shape.points?.map((point) => ({
                      x: Number(point.x ?? 0),
                      y: Number(point.y ?? 0),
                    })) ?? [],
                  startX: Number(shape.startX ?? 0),
                  startY: Number(shape.startY ?? 0),
                  endX: Number(shape.endX ?? 0),
                  endY: Number(shape.endY ?? 0),
                  x: Number(shape.x ?? 0),
                  y: Number(shape.y ?? 0),
                  text: String(shape.text || '').trim(),
                  fontSize: Number(shape.fontSize ?? 24),
                  fillColor: String(shape.fillColor || '').trim(),
                })) ?? [],
              strokes:
                annotation.strokes?.map((stroke, strokeIndex) => ({
                  ...stroke,
                  id: stroke.id || `stroke-${index}-${strokeIndex}`,
                  width: Number(stroke.width ?? 2),
                  points:
                    stroke.points?.map((point) => ({
                      x: Number(point.x ?? 0),
                      y: Number(point.y ?? 0),
                    })) ?? [],
                })) ?? [],
            }))
        : [];

    if (decision === 'rejected' && !reviewNoteValue && reviewAnnotations.length === 0) {
      toast.error('Add review note or image annotations before marking update needed.');
      return;
    }

    setFinalReviewDecisionInFlight(decision);
    try {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskState.id}/final-deliverables/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          note: reviewNoteValue,
          annotations: reviewAnnotations,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to review final deliverables.');
      }
      const hydrated = withAccessMetadata(hydrateTask(data));
      setTaskState(hydrated);
      setChangeHistory(hydrated?.changeHistory ?? []);
      setChangeCount(hydrated?.changeCount ?? 0);
      setApprovalStatus(hydrated?.approvalStatus);
      persistTask(hydrated);
      toast.success(
        decision === 'approved'
          ? 'Final deliverables approved.'
          : 'Update requested. Junior designer can re-submit after updates.'
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to review final deliverables.';
      toast.error(message);
    } finally {
      setFinalReviewDecisionInFlight(null);
    }
  };

  const handleSaveUpdates = () => {
    if (approvalLockedForStaff) {
      toast.message('Changes are locked until Treasurer approval.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    const updates: Partial<typeof taskState> = {};
    const changes: ChangeInput[] = [];
    const isStaffUpdate = user?.role === 'staff';
    const staffNoteValue = staffNote.trim();

    if (editedDescription.trim() && editedDescription !== taskState.description) {
      changes.push({
        type: 'update',
        field: 'description',
        oldValue: taskState.description,
        newValue: editedDescription,
        note: isStaffUpdate ? staffNoteValue || 'Staff requested changes' : undefined,
      });
      updates.description = editedDescription;
    }

    if (!editedDescription.trim() || editedDescription === taskState.description) {
      if (isStaffUpdate && staffNoteValue) {
        changes.push({
          type: 'update',
          field: 'staff_note',
          oldValue: '',
          newValue: staffNoteValue,
          note: staffNoteValue,
        });
      }
    }

    if (changes.length === 0) {
      toast.message('No updates to save.');
      return;
    }

    recordChanges(changes, updates);
    if (isStaffUpdate) {
      setStaffNote('');
    }
  };

  const handleAddFile = () => {
    if (!ensureWritableTask()) return;
    if (isUploadingAttachment) return;
    addAttachmentInputRef.current?.click();
  };

  const handleRemoveFile = (
    fileId: string,
    fileName: string,
    fileType: (typeof taskState.files)[number]['type'] = 'input'
  ) => {
    const canRemoveThisFile = fileType === 'working' ? canManageWorkingFiles : canRemoveFiles;
    if (!canRemoveThisFile) {
      toast.error('Only designers can remove files.');
      return;
    }
    if (!ensureWritableTask(fileType === 'working' ? { allowMainDesignerFinalize: true } : undefined)) {
      return;
    }
    if (approvalLockedForStaff) {
      toast.message('Changes are locked until Treasurer approval.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    const updates = {
      files: taskState.files.filter((file) => file.id !== fileId),
    };

    recordChanges(
      [
        {
          type: 'file_removed',
          field: 'files',
          oldValue: fileName,
          newValue: '',
        },
      ],
      updates
    );
  };

  const setTaskUploadState = (
    channel: TaskUploadChannel,
    uploading: boolean,
    progress: number | null
  ) => {
    if (channel === 'working') {
      setIsUploadingWorking(uploading);
      return;
    }
    setIsUploadingAttachment(uploading);
    setAttachmentUploadProgress(progress);
  };

  const uploadFinalFileWithProgress = ({
    file,
    taskTitle,
    taskId,
    uploadId,
    signal,
  }: {
    file: File;
    taskTitle: string;
    taskId: string;
    uploadId: string;
    signal: AbortSignal;
  }) =>
    new Promise<FileUploadResponse>((resolve, reject) => {
      if (!apiUrl) {
        reject(new Error('File upload requires the backend.'));
        return;
      }

      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskTitle', taskTitle);
      formData.append('taskId', taskId);

      const handleAbort = () => xhr.abort();
      signal.addEventListener('abort', handleAbort, { once: true });

      const cleanup = () => {
        signal.removeEventListener('abort', handleAbort);
      };

      xhr.open('POST', `${apiUrl}/api/files/upload`);
      const authToken = getAuthToken();
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const nextProgress = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
        setFinalUploadItems((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? { ...item, status: 'uploading', progress: nextProgress, error: undefined }
              : item
          )
        );
      };

      xhr.onload = () => {
        cleanup();
        let payload: FileUploadResponse = {};
        try {
          payload = JSON.parse(xhr.responseText || '{}') as FileUploadResponse;
        } catch {
          payload = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload);
          return;
        }
        const errorMessage =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : 'Upload failed';
        reject(new Error(errorMessage));
      };

      xhr.onerror = () => {
        cleanup();
        reject(new Error('Upload failed'));
      };

      xhr.onabort = () => {
        cleanup();
        reject(new DOMException('Upload cancelled.', 'AbortError'));
      };

      xhr.send(formData);
    });

  const uploadFinalFiles = async (uploads: File[]) => {
    if (uploads.length === 0) return;
    if (!taskState) return;
    if (!ensureWritableTask({ allowMainDesignerFinalize: true })) {
      return;
    }
    const taskId = (taskState as { id?: string; _id?: string })?.id || (taskState as { _id?: string })?._id;
    if (!taskId) {
      toast.error('Task id missing. Please refresh and try again.');
      return;
    }
    if (!apiUrl) {
      toast.error('File upload requires the backend.');
      return;
    }

    setIsFinalUploadDragging(false);
    const batchId = Date.now();
    const uploadItems = uploads.map((file, index) => ({
      id: `final-${batchId}-${index}`,
      name: file.name,
      status: 'uploading' as const,
      progress: 0,
      size: file.size,
    }));
    setFinalUploadItems((prev) => [...prev, ...uploadItems]);
    setShowFinalUploadList(true);

    if (finalUploadAbortRef.current) {
      finalUploadAbortRef.current.abort();
    }
    const controller = new AbortController();
    finalUploadAbortRef.current = controller;

    setIsUploadingFinal(true);
    const uploadedFiles: Array<{
      name: string;
      url: string;
      driveId?: string;
      webViewLink?: string;
      webContentLink?: string;
      size?: number;
      mime?: string;
      thumbnailUrl?: string;
    }> = [];
    let hasFailure = false;
    let needsDriveAuth = false;
    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const file = uploads[index];
        const uploadId = uploadItems[index]?.id;
        try {
          const data = await uploadFinalFileWithProgress({
            file,
            taskTitle: taskState.title,
            taskId,
            uploadId,
            signal: controller.signal,
          });
          const uploadedUrl = resolveUploadedDriveUrl(data);
          if (!uploadedUrl) {
            throw new Error('Upload succeeded but file link is missing. Please retry.');
          }
          uploadedFiles.push({
            name: file.name,
            url: uploadedUrl,
            driveId: data.id,
            webViewLink: data.webViewLink,
            webContentLink: data.webContentLink,
            size: file.size,
            mime: file.type || data.mimeType || '',
            thumbnailUrl: data.thumbnailLink,
          });
          if (uploadId) {
            setFinalUploadItems((prev) =>
              prev.map((item) =>
                item.id === uploadId
                  ? {
                      ...item,
                      status: 'done',
                      progress: 100,
                      size: file.size,
                      url: uploadedUrl,
                      error: undefined,
                    }
                  : item
              )
            );
          }
        } catch (error) {
          const maybeAbortError = error as { name?: string; message?: string };
          if (maybeAbortError?.name === 'AbortError') {
            throw error;
          }
          const errorMsg = maybeAbortError?.message || 'Upload failed';
          if (uploadId) {
            setFinalUploadItems((prev) =>
              prev.map((item) =>
                item.id === uploadId
                  ? { ...item, status: 'error', progress: item.progress ?? 0, error: errorMsg }
                  : item
              )
            );
          }
          hasFailure = true;
          if (shouldPromptDriveReconnect(errorMsg)) {
            needsDriveAuth = true;
          }
        }
      }
      if (!controller.signal.aborted) {
        if (uploadedFiles.length > 0) {
          setPendingFinalFiles((prev) => [...prev, ...uploadedFiles]);
        }
        if (needsDriveAuth) {
          toast.error('Google Drive Disconnected', {
            description: 'Reconnect Drive access and try uploading again.',
            action: {
              label: 'Connect',
              onClick: async () => {
                try {
                  await openDriveReconnectWindow();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to get auth URL';
                  toast.error('Drive reconnect failed', { description: message });
                }
              }
            },
            duration: 10000,
          });
        } else if (hasFailure) {
          toast.error('Some files need attention', {
            description:
              uploadedFiles.length > 0
                ? `${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} staged. Review failed uploads before submit.`
                : 'One or more files could not be uploaded. Please retry.',
          });
        } else if (uploadedFiles.length > 0) {
          toast.success('Files staged. Click Submit to create the next version.');
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        toast.message('Upload cancelled.');
      } else {
        const errorMsg = error.message || 'Upload failed';
        if (shouldPromptDriveReconnect(errorMsg)) {
          toast.error('Google Drive Disconnected', {
            description: 'Reconnect Drive access and try uploading again.',
            action: {
              label: 'Connect',
              onClick: async () => {
                try {
                  await openDriveReconnectWindow();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to get auth URL';
                  toast.error('Drive reconnect failed', { description: message });
                }
              }
            },
            duration: 10000,
          });
        } else {
          toast.error('File upload failed', { description: errorMsg });
        }
      }
    } finally {
      setIsUploadingFinal(false);
      finalUploadAbortRef.current = null;
    }
  };

  const triggerReplaceFinalFile = (file: OutputDisplayFile, index: number) => {
    if (!canReplaceRejectedFinalFile) return;
    if (!file.url) {
      toast.error('Cannot replace this file right now.');
      return;
    }
    setReplaceFinalTarget({
      index,
      name: file.name,
      url: file.url,
    });
    replaceFinalFileInputRef.current?.click();
  };

  const handleReplaceFinalFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;
    if (!taskState) return;
    if (!replaceFinalTarget) {
      toast.error('Pick a file to replace first.');
      return;
    }
    if (!canReplaceRejectedFinalFile) {
      toast.error('Replace is available only for junior designers on update-needed submissions.');
      return;
    }
    if (!ensureWritableTask({ allowMainDesignerFinalize: true })) return;
    const taskId = String(
      (taskState as { id?: string; _id?: string })?.id ||
      (taskState as { _id?: string })?._id ||
      ''
    ).trim();
    if (!taskId) {
      toast.error('Task id missing. Please refresh and try again.');
      return;
    }

    const stagedBase =
      pendingFinalFiles.length > 0
        ? [...pendingFinalFiles]
        : finalDeliverableFiles.map((file) => toPendingFinalFileFromVersionFile(file));
    if (stagedBase.length === 0) {
      toast.error('No final deliverable files found to replace.');
      return;
    }

    let replaceIndex = -1;
    if (replaceFinalTarget.index >= 0 && replaceFinalTarget.index < stagedBase.length) {
      replaceIndex = replaceFinalTarget.index;
    }
    if (replaceIndex === -1 && replaceFinalTarget.url) {
      replaceIndex = stagedBase.findIndex(
        (entry) => String(entry.url || '').trim() === String(replaceFinalTarget.url || '').trim()
      );
    }
    if (replaceIndex === -1 && replaceFinalTarget.name) {
      replaceIndex = stagedBase.findIndex(
        (entry) => String(entry.name || '').trim().toLowerCase() ===
          String(replaceFinalTarget.name || '').trim().toLowerCase()
      );
    }
    if (replaceIndex === -1) {
      toast.error('Unable to match the selected file for replacement.');
      return;
    }

    if (!apiUrl) {
      toast.error('File upload requires the backend.');
      return;
    }

    if (finalUploadAbortRef.current) {
      finalUploadAbortRef.current.abort();
    }
    const controller = new AbortController();
    finalUploadAbortRef.current = controller;

    const uploadId = `replace-${Date.now()}`;
    setFinalUploadItems([
      {
        id: uploadId,
        name: selectedFile.name,
        status: 'uploading',
        progress: 0,
        size: selectedFile.size,
      },
    ]);
    setShowFinalUploadList(true);
    setIsUploadingFinal(true);

    try {
      const data = await uploadFinalFileWithProgress({
        file: selectedFile,
        taskTitle: taskState.title,
        taskId,
        uploadId,
        signal: controller.signal,
      });
      const uploadedUrl = resolveUploadedDriveUrl(data);
      if (!uploadedUrl) {
        throw new Error('Upload succeeded but file link is missing. Please retry.');
      }
      const replacement: PendingFinalFile = {
        name: selectedFile.name,
        url: uploadedUrl,
        driveId: data.id,
        webViewLink: data.webViewLink,
        webContentLink: data.webContentLink,
        size: selectedFile.size,
        mime: selectedFile.type || data.mimeType || '',
        thumbnailUrl: data.thumbnailLink,
      };
      const nextPending = [...stagedBase];
      nextPending[replaceIndex] = replacement;
      setPendingFinalFiles(nextPending);
      setFinalUploadItems((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                status: 'done',
                progress: 100,
                size: selectedFile.size,
                url: uploadedUrl,
                error: undefined,
              }
            : item
        )
      );
      try {
        await submitFinalDeliverableVersion({
          files: nextPending,
          note: '',
        });
        toast.success(`"${replaceFinalTarget.name}" replaced and submitted.`);
      } catch (submitError) {
        const submitMessage =
          submitError instanceof Error && submitError.message
            ? submitError.message
            : 'Replacement uploaded but submit failed.';
        toast.error(`${submitMessage} You can retry from Submit Revision.`);
      }
    } catch (error: any) {
      const message =
        error?.name === 'AbortError'
          ? 'Replacement upload cancelled.'
          : error?.message || 'File replacement failed.';
      setFinalUploadItems((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? { ...item, status: 'error', progress: item.progress ?? 0, error: message }
            : item
        )
      );
      toast.error(message);
    } finally {
      setIsUploadingFinal(false);
      finalUploadAbortRef.current = null;
      setReplaceFinalTarget(null);
    }
  };

  const handleFinalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    try {
      await uploadFinalFiles(selectedFiles);
    } finally {
      e.target.value = '';
    }
  };

  const openFinalFilePicker = () => {
    if (isUploadingFinal) return;
    finalUploadInputRef.current?.click();
  };

  const handleFinalUploadDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isUploadingFinal) return;
    event.dataTransfer.dropEffect = 'copy';
    setIsFinalUploadDragging(true);
  };

  const handleFinalUploadDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget as Node)) {
      return;
    }
    setIsFinalUploadDragging(false);
  };

  const handleFinalUploadDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsFinalUploadDragging(false);
    if (isUploadingFinal) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    await uploadFinalFiles(files);
  };

  const handleCancelFinalUpload = () => {
    if (finalUploadAbortRef.current) {
      finalUploadAbortRef.current.abort();
    }
    setFinalUploadItems((prev) =>
      prev.filter((item) => item.status === 'done' || item.status === 'error')
    );
    setIsUploadingFinal(false);
  };

  const handleRemoveFinalUploadItem = (uploadId: string) => {
    const target = finalUploadItems.find((item) => item.id === uploadId);
    if (!target) return;

    setFinalUploadItems((prev) => prev.filter((item) => item.id !== uploadId));

    if (target.url) {
      let removed = false;
      setPendingFinalFiles((prev) =>
        prev.filter((file) => {
          if (removed) return true;
          const matchesUrl =
            String(file.url || '').trim() !== '' &&
            String(file.url || '').trim() === String(target.url || '').trim();
          const matchesName =
            String(file.name || '').trim().toLowerCase() ===
            String(target.name || '').trim().toLowerCase();
          if (matchesUrl || (!String(target.url || '').trim() && matchesName)) {
            removed = true;
            return false;
          }
          return true;
        })
      );
    }
  };

  const clearFinalUploadItems = () => {
    setFinalUploadItems([]);
    setPendingFinalFiles([]);
    setShowFinalUploadList(true);
  };

  const handleUpdateFinalVersionNote = async () => {
    if (!ensureWritableTask({ allowMainDesignerFinalize: true })) return;
    if (!taskState || !apiUrl) return;
    const versionId = String(activeFinalVersion?.id || '');
    if (!versionId) {
      toast.error('No final version selected.');
      return;
    }
    const nextNote = finalVersionNote.trim();
    if (nextNote === currentSelectedVersionNote) {
      toast.message('No note changes to update.');
      return;
    }
    setIsUpdatingFinalVersionNote(true);
    try {
      const response = await authFetch(
        `${apiUrl}/api/tasks/${taskState.id}/final-deliverables/${versionId}/note`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: nextNote }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update version note');
      }
      const hydrated = withAccessMetadata(hydrateTask(data));
      setTaskState(hydrated);
      toast.success('Version note updated.');
    } catch (error) {
      toast.error('Failed to update version note.');
    } finally {
      setIsUpdatingFinalVersionNote(false);
    }
  };

  const handleAddFinalLink = async () => {
    if (!ensureWritableTask({ allowMainDesignerFinalize: true })) return;
    const trimmedUrl = finalLinkUrl.trim();
    const linkValidation = validateFinalGoogleDriveLink(trimmedUrl);
    if (!linkValidation.valid) {
      setFinalLinkValidationError(linkValidation.message);
      toast.error(linkValidation.message);
      return;
    }
    setFinalLinkValidationError('');
    let inferredName = finalLinkName.trim();
    if (!inferredName) {
      inferredName = inferDriveItemNameFromUrl(trimmedUrl);
      const driveMeta = getDriveLinkMeta(trimmedUrl);
      if (driveMeta.itemId && apiUrl) {
        try {
          const metaResponse = await authFetch(`${apiUrl}/api/files/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: driveMeta.itemId }),
          });
          if (metaResponse.ok) {
            const metaData = await metaResponse.json();
            if (typeof metaData?.name === 'string' && metaData.name.trim()) {
              inferredName = metaData.name.trim();
            }
          }
        } catch {
          // keep inferred fallback when metadata cannot be resolved
        }
      }
    }

    setIsAddingFinalLink(true);
    try {
      const driveLinkMeta = getDriveLinkMeta(trimmedUrl);
      const driveId = driveLinkMeta.itemType === 'file' ? driveLinkMeta.itemId : '';
      setPendingFinalFiles((prev) => [
        ...prev,
        {
          name: inferredName,
          url: trimmedUrl,
          driveId,
          webViewLink: driveId ? buildDriveViewUrl(driveId) : '',
          webContentLink: driveId ? buildDriveDirectDownloadUrl(driveId) : '',
          mime: 'link',
        },
      ]);
      setFinalUploadItems((prev) => [
        ...prev,
        {
          id: `final-link-${Date.now()}`,
          name: inferredName,
          status: 'done',
          progress: 100,
        },
      ]);
      setShowFinalUploadList(true);
      setFinalLinkName('');
      setFinalLinkUrl('');
      setFinalLinkValidationError('');
      toast.success('Link staged. Click Submit to create the next version.');
    } catch (error) {
      toast.error('Failed to stage final deliverable link.');
    } finally {
      setIsAddingFinalLink(false);
    }
  };

  const handleRollbackVersion = (versionId: string) => {
    if (!canManageVersions) return;
    const selected = designVersions.find((version) => version.id === versionId);
    if (!selected) return;
    const current = activeDesignVersion ?? designVersions[designVersions.length - 1];
    recordChanges(
      [
        {
          type: 'update',
          field: 'design_version',
          oldValue: current ? `${getVersionLabel(current)} - ${current.name}` : '',
          newValue: `${getVersionLabel(selected)} - ${selected.name}`,
          note: `Rolled back to ${getVersionLabel(selected)}`,
        },
      ],
      { activeDesignVersionId: selected.id }
    );
    toast.message('Design version restored.');
  };

  const uploadTaskAttachments = async (
    selectedFiles: File[],
    options?: {
      type?: 'input' | 'output' | 'working';
      category?: 'reference' | 'others';
      details?: string;
      nameOverride?: string;
      successMessage?: string;
      changeNote?: string;
      taskSection?: string;
      channel?: TaskUploadChannel;
      allowMainDesigner?: boolean;
    }
  ) => {
    if (!selectedFiles || selectedFiles.length === 0) return 0;
    if (!taskState) return 0;
    if (
      !ensureWritableTask(
        options?.allowMainDesigner ? { allowMainDesignerFinalize: true } : undefined
      )
    ) {
      return 0;
    }
    if (!apiUrl) {
      toast.error('File upload requires the backend.');
      return 0;
    }

    const uploadChannel = options?.channel ?? 'attachment';
    const taskId = String(
      (taskState as { id?: string; _id?: string })?.id ||
      (taskState as { _id?: string })?._id ||
      ''
    ).trim();
    setTaskUploadState(uploadChannel, true, 0);
    const uploads = Array.from(selectedFiles);
    const selectedType = options?.type ?? 'input';
    const selectedCategory = options?.category ?? 'reference';
    const trimmedDetails = options?.details?.trim() || '';
    const trimmedNameOverride = options?.nameOverride?.trim() || '';
    const uploadedTaskFiles: typeof taskState.files = [];
    const changeEntries: ChangeInput[] = [];
    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const file = uploads[index];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskTitle', taskState.title);
        if (taskId) {
          formData.append('taskId', taskId);
        }
        if (options?.taskSection) {
          formData.append('taskSection', options.taskSection);
        }
        const response = await authFetch(`${apiUrl}/api/files/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Upload failed');
        }
        const uploadedUrl = resolveUploadedDriveUrl(data);
        if (!uploadedUrl) {
          throw new Error('Upload succeeded but file link is missing. Please retry.');
        }
        const baseName =
          uploads.length === 1 && trimmedNameOverride ? trimmedNameOverride : file.name;
        const resolvedName =
          selectedCategory === 'others' && trimmedDetails
            ? `${baseName} - ${trimmedDetails}`
            : baseName;
        const newFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: resolvedName,
          url: uploadedUrl,
          driveId: data.id,
          webViewLink: data.webViewLink,
          webContentLink: data.webContentLink,
          type: selectedType,
          size: file.size,
          thumbnailUrl: data.thumbnailLink,
          uploadedAt: new Date(),
          uploadedBy: user?.id || '',
        };
        uploadedTaskFiles.push(newFile);
        setTaskUploadState(
          uploadChannel,
          true,
          Math.min(99, Math.round(((index + 1) / uploads.length) * 100))
        );
        changeEntries.push({
          type: 'file_added',
          field: 'files',
          oldValue: '',
          newValue: resolvedName,
          note: options?.changeNote || 'Attachment uploaded',
        });
      }
      if (uploadedTaskFiles.length > 0) {
        await recordChanges(changeEntries, { files: [...taskState.files, ...uploadedTaskFiles] });
      }
      setTaskUploadState(uploadChannel, true, 100);
      if (uploadedTaskFiles.length > 0) {
        toast.success(
          options?.successMessage ||
            (uploadedTaskFiles.length === 1 ? 'File uploaded.' : 'Attachments uploaded.')
        );
      }
      return uploadedTaskFiles.length;
    } catch (error: any) {
      const errorMsg = error.message || "Upload failed";
      if (shouldPromptDriveReconnect(errorMsg)) {
          toast.error('Google Drive Disconnected', {
            description: 'Reconnect Drive access and try uploading again.',
            action: {
              label: 'Connect',
              onClick: async () => {
                try {
                  await openDriveReconnectWindow();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to get auth URL';
                  toast.error('Drive reconnect failed', { description: message });
                }
              }
            },
          duration: 10000,
        });
      } else {
        toast.error('File upload failed', { description: errorMsg });
      }
      return 0;
    } finally {
      setTaskUploadState(uploadChannel, false, null);
    }
  };

  const appendComposerAttachments = (target: ComposerTarget, attachments: TaskFile[]) => {
    if (attachments.length === 0) return;
    if (target === 'reply') {
      setReplyAttachments((current) => [...current, ...attachments]);
      return;
    }
    setCommentAttachments((current) => [...current, ...attachments]);
  };

  const removeComposerAttachment = (target: ComposerTarget, attachmentId: string) => {
    if (target === 'reply') {
      setReplyAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      return;
    }
    setCommentAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const clearComposerAttachments = (target: ComposerTarget) => {
    if (target === 'reply') {
      setReplyAttachments([]);
      return;
    }
    setCommentAttachments([]);
  };

  const uploadCommentFiles = async (selectedFiles: File[], target: ComposerTarget) => {
    if (!selectedFiles || selectedFiles.length === 0) return 0;
    if (!taskState || !apiUrl) {
      toast.error('Comment attachment upload requires the backend.');
      return 0;
    }
    if (!canComment) {
      toast.error('Comments are disabled for this task.');
      return 0;
    }

    const taskId = String(
      (taskState as { id?: string; _id?: string })?.id ||
      (taskState as { _id?: string })?._id ||
      ''
    ).trim();
    const uploads = Array.from(selectedFiles);
    const uploadedAttachments: TaskFile[] = [];
    setIsUploadingCommentAttachments(true);
    setCommentAttachmentUploadProgress(0);

    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const file = uploads[index];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskTitle', taskState.title);
        formData.append('taskSection', 'Internal Chat');
        if (taskId) {
          formData.append('taskId', taskId);
        }

        const response = await authFetch(`${apiUrl}/api/files/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Upload failed');
        }
        const uploadedUrl = resolveUploadedDriveUrl(data);
        if (!uploadedUrl) {
          throw new Error('Upload succeeded but file link is missing. Please retry.');
        }
        uploadedAttachments.push(
          normalizeCommentAttachment(
            {
              id: data?.id,
              name: file.name,
              url: uploadedUrl,
              driveId: data?.id,
              webViewLink: data?.webViewLink,
              webContentLink: data?.webContentLink,
              size: file.size,
              mime: file.type,
              thumbnailUrl: data?.thumbnailLink,
              uploadedAt: new Date(),
              uploadedBy: user?.id || user?.name || '',
            },
            index
          )
        );
        setCommentAttachmentUploadProgress(
          Math.min(99, Math.round(((index + 1) / uploads.length) * 100))
        );
      }

      appendComposerAttachments(target, uploadedAttachments);
      setCommentAttachmentUploadProgress(100);
      toast.success(
        uploadedAttachments.length === 1
          ? 'Attachment uploaded.'
          : `${uploadedAttachments.length} attachments uploaded.`
      );
      return uploadedAttachments.length;
    } catch (error: any) {
      const errorMsg = error?.message || 'Upload failed';
      if (shouldPromptDriveReconnect(errorMsg)) {
        toast.error('Google Drive Disconnected', {
          description: 'Reconnect Drive access and try uploading again.',
          action: {
            label: 'Connect',
            onClick: async () => {
              try {
                await openDriveReconnectWindow();
              } catch (reconnectError) {
                const message =
                  reconnectError instanceof Error ? reconnectError.message : 'Failed to get auth URL';
                toast.error('Drive reconnect failed', { description: message });
              }
            },
          },
          duration: 10000,
        });
      } else {
        toast.error('Comment attachment upload failed', { description: errorMsg });
      }
      return 0;
    } finally {
      setIsUploadingCommentAttachments(false);
      setCommentAttachmentUploadProgress(null);
    }
  };

  const extractClipboardFiles = (items?: DataTransferItemList | null) =>
    Array.from(items ?? [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

  const handleChatComposerPaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
    target: ComposerTarget
  ) => {
    const files = extractClipboardFiles(event.clipboardData?.items);
    if (files.length === 0) return;
    event.preventDefault();
    await uploadCommentFiles(files, target);
  };

  const handleEditAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;
    await uploadTaskAttachments(selectedFiles, { type: 'input', category: 'reference' });
    e.target.value = '';
  };

  const clearWorkingUploadDismissTimer = (uploadId: string) => {
    const timer = workingUploadDismissTimersRef.current.get(uploadId);
    if (!timer) return;
    clearTimeout(timer);
    workingUploadDismissTimersRef.current.delete(uploadId);
  };

  const scheduleWorkingUploadDismiss = (uploadId: string) => {
    clearWorkingUploadDismissTimer(uploadId);
    const timer = setTimeout(() => {
      setWorkingUploadItems((prev) => prev.filter((item) => item.id !== uploadId));
      workingUploadDismissTimersRef.current.delete(uploadId);
    }, 2200);
    workingUploadDismissTimersRef.current.set(uploadId, timer);
  };

  const updateWorkingUploadItem = (
    uploadId: string,
    updates: Partial<WorkingUploadItem>
  ) => {
    if (updates.status === 'done') {
      scheduleWorkingUploadDismiss(uploadId);
    } else if (updates.status) {
      clearWorkingUploadDismissTimer(uploadId);
    }
    setWorkingUploadItems((prev) =>
      prev.map((item) => (item.id === uploadId ? { ...item, ...updates } : item))
    );
  };

  const uploadWorkingChunk = ({
    chunk,
    sessionUri,
    mimeType,
    contentRange,
    uploadId,
    loadedBase,
    totalBytes,
    startedAt,
  }: {
    chunk: Blob;
    sessionUri: string;
    mimeType: string;
    contentRange: string;
    uploadId: string;
    loadedBase: number;
    totalBytes: number;
    startedAt: number;
  }) =>
    new Promise<{ complete: boolean; uploadedBytes: number; file?: FileUploadResponse }>(
      (resolve, reject) => {
        if (!apiUrl) {
          reject(new Error('Chunk upload requires the backend.'));
          return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `${apiUrl}/api/files/resumable/chunk`);
        xhr.responseType = 'json';
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('X-Upload-Session-Uri', sessionUri);
        xhr.setRequestHeader('X-Upload-Content-Range', contentRange);
        xhr.setRequestHeader('X-Upload-Content-Type', mimeType || 'application/octet-stream');
        const authToken = getAuthToken();
        if (authToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        }

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const nextLoaded = Math.min(totalBytes, loadedBase + event.loaded);
          const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
          updateWorkingUploadItem(uploadId, {
            status: 'uploading',
            loadedBytes: nextLoaded,
            totalBytes,
            progress: Math.min(100, (nextLoaded / totalBytes) * 100),
            speedBytesPerSecond: nextLoaded / elapsedSeconds,
          });
        };

        xhr.onload = () => {
          const payload =
            xhr.response && typeof xhr.response === 'object'
              ? (xhr.response as {
                  complete?: boolean;
                  uploadedBytes?: number;
                  file?: FileUploadResponse;
                  error?: string;
                  detail?: string;
                })
              : null;
          if (xhr.status >= 200 && xhr.status < 300 && payload) {
            resolve({
              complete: Boolean(payload.complete),
              uploadedBytes: Number(payload.uploadedBytes || 0),
              file: payload.file,
            });
            return;
          }
          const message =
            payload?.detail ||
            payload?.error ||
            (typeof xhr.responseText === 'string' && xhr.responseText.trim()) ||
            'Chunk upload failed.';
          reject(new Error(message));
        };

        xhr.onerror = () => {
          reject(new Error('Network error while uploading chunk.'));
        };

        xhr.send(chunk);
      }
    );

  const uploadWorkingFilesResumable = async (selectedFiles: File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return 0;
    if (!taskState) return 0;
    if (!apiUrl) {
      toast.error('Working file upload requires the backend.');
      return 0;
    }
    if (!ensureWritableTask({ allowMainDesignerFinalize: true })) {
      return 0;
    }

    setIsWorkingUploadDragging(false);
    const taskId = String(
      (taskState as { id?: string; _id?: string })?.id ||
      (taskState as { _id?: string })?._id ||
      ''
    ).trim();
    if (!taskId) {
      toast.error('Task id missing. Please refresh and try again.');
      return 0;
    }

    const validFiles = selectedFiles.filter((file) => file.size <= MAX_WORKING_FILE_BYTES);
    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_WORKING_FILE_BYTES);
    oversizedFiles.forEach((file) => {
      toast.error(`${file.name} exceeds the 2.5 GB working-file limit.`);
    });
    if (validFiles.length === 0) return 0;

    const batchId = Date.now();
    const uploadItems = validFiles.map((file, index) => ({
      id: `working-${batchId}-${index}`,
      name: file.name,
      status: 'preparing' as const,
      loadedBytes: 0,
      totalBytes: file.size,
      progress: 0,
      speedBytesPerSecond: 0,
    }));
    setWorkingUploadItems((prev) => [...prev, ...uploadItems]);
    setIsUploadingWorking(true);

    const uploadedTaskFiles: typeof taskState.files = [];
    const changeEntries: ChangeInput[] = [];
    let completedCount = 0;

    try {
      for (let index = 0; index < validFiles.length; index += 1) {
        const file = validFiles[index];
        const uploadId = uploadItems[index]?.id;
        if (!uploadId) continue;

        try {
          const initResponse = await authFetch(`${apiUrl}/api/files/resumable/init`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              taskId,
              taskTitle: taskState.title,
              taskSection: 'PSD Working Files',
            }),
          });
          const initPayload = await initResponse.json().catch(() => ({}));
          if (!initResponse.ok) {
            throw new Error(initPayload?.error || 'Failed to initialize resumable upload.');
          }

          const sessionUri = String(initPayload?.sessionUri || '').trim();
          if (!sessionUri) {
            throw new Error('Drive upload session is missing.');
          }
          const chunkSize = Math.max(
            1024 * 1024,
            Math.min(
              WORKING_UPLOAD_CHUNK_BYTES,
              Number(initPayload?.chunkSize || WORKING_UPLOAD_CHUNK_BYTES)
            )
          );

          const startedAt = performance.now();
          let uploadedBytes = 0;
          let filePayload: FileUploadResponse | undefined;
          updateWorkingUploadItem(uploadId, {
            status: 'uploading',
            loadedBytes: 0,
            totalBytes: file.size,
            progress: 0,
            speedBytesPerSecond: 0,
            error: undefined,
          });

          while (uploadedBytes < file.size) {
            const nextEndExclusive = Math.min(uploadedBytes + chunkSize, file.size);
            const contentRange = `bytes ${uploadedBytes}-${nextEndExclusive - 1}/${file.size}`;
            const result = await uploadWorkingChunk({
              chunk: file.slice(uploadedBytes, nextEndExclusive),
              sessionUri,
              mimeType: file.type || 'application/octet-stream',
              contentRange,
              uploadId,
              loadedBase: uploadedBytes,
              totalBytes: file.size,
              startedAt,
            });
            uploadedBytes = Math.max(uploadedBytes, Number(result.uploadedBytes || nextEndExclusive));
            const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
            updateWorkingUploadItem(uploadId, {
              status: result.complete ? 'done' : 'uploading',
              loadedBytes: uploadedBytes,
              totalBytes: file.size,
              progress: Math.min(100, (uploadedBytes / file.size) * 100),
              speedBytesPerSecond: uploadedBytes / elapsedSeconds,
            });
            if (result.complete) {
              filePayload = result.file;
              break;
            }
          }

          const uploadedUrl = resolveUploadedDriveUrl(filePayload);
          if (!uploadedUrl) {
            throw new Error('Upload finished but the Drive link is missing.');
          }

          const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
          uploadedTaskFiles.push({
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            url: uploadedUrl,
            driveId: filePayload?.id,
            webViewLink: filePayload?.webViewLink,
            webContentLink: filePayload?.webContentLink,
            type: 'working',
            size: file.size,
            mime: file.type || filePayload?.mimeType || '',
            thumbnailUrl: filePayload?.thumbnailLink,
            uploadedAt: new Date(),
            uploadedBy: user?.id || '',
          });
          changeEntries.push({
            type: 'file_added',
            field: 'files',
            oldValue: '',
            newValue: file.name,
            note: 'Working file uploaded',
          });
          updateWorkingUploadItem(uploadId, {
            status: 'done',
            loadedBytes: file.size,
            totalBytes: file.size,
            progress: 100,
            speedBytesPerSecond: file.size / elapsedSeconds,
            error: undefined,
          });
          completedCount += 1;
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Working file upload failed.';
          updateWorkingUploadItem(uploadId, {
            status: 'error',
            error: message,
          });
          toast.error('Working file upload failed', {
            description: `${file.name}\n${message}`,
          });
        }
      }

      if (uploadedTaskFiles.length > 0) {
        const saved = await recordChanges(
          changeEntries,
          { files: [...taskState.files, ...uploadedTaskFiles] },
          {
            allowMainDesignerFinalize: true,
            skipSuccessToast: true,
          }
        );
        if (!saved) {
          toast.error('Working files uploaded to Drive, but task update failed.');
          return completedCount;
        }
        toast.success(
          uploadedTaskFiles.length === 1
            ? 'Working file uploaded.'
            : 'Working files uploaded.'
        );
      }

      return completedCount;
    } finally {
      setIsUploadingWorking(false);
    }
  };

  const openWorkingFilePicker = () => {
    if (isUploadingWorking) return;
    workingUploadInputRef.current?.click();
  };

  const handleWorkingFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length === 0) return;
    await uploadWorkingFilesResumable(selectedFiles);
    event.target.value = '';
  };

  const handleWorkingUploadDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isUploadingWorking) return;
    event.dataTransfer.dropEffect = 'copy';
    setIsWorkingUploadDragging(true);
  };

  const handleWorkingUploadDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget as Node)) {
      return;
    }
    setIsWorkingUploadDragging(false);
  };

  const handleWorkingUploadDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsWorkingUploadDragging(false);
    if (isUploadingWorking) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    await uploadWorkingFilesResumable(files);
  };

  const handleAddFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;
    const uploadedCount = await uploadTaskAttachments(selectedFiles, {
      type: 'input',
      category: newFileCategory,
      details: newFileCategory === 'others' ? newFileDetails : '',
      nameOverride: newFileName,
      successMessage: 'File uploaded.',
    });
    if (uploadedCount > 0) {
      setNewFileName('');
      setNewFileDetails('');
    }
    e.target.value = '';
  };

  const handleEditAttachmentDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isUploadingAttachment) return;
    event.dataTransfer.dropEffect = 'copy';
    setIsEditAttachmentDragging(true);
  };

  const handleEditAttachmentDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsEditAttachmentDragging(false);
  };

  const handleEditAttachmentDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsEditAttachmentDragging(false);
    if (isUploadingAttachment) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    await uploadTaskAttachments(files, { type: 'input', category: 'reference' });
  };

  const handleRequestDeadline = () => {
    if (approvalLockedForStaff) {
      toast.message('Changes are locked until Treasurer approval.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    if (!deadlineRequest) return;
    const minDate = minDeadlineDate;
    const requested = new Date(deadlineRequest);
    if (requested < minDate) {
      toast.error('Deadline must be at least 3 days from today.');
      return;
    }

    recordChanges(
      [
        {
          type: 'update',
          field: 'deadline_request',
          oldValue: taskState.proposedDeadline
            ? format(taskState.proposedDeadline, 'MMM d, yyyy')
            : '',
          newValue: format(requested, 'MMM d, yyyy'),
        },
      ],
      {
        proposedDeadline: requested,
        deadlineApprovalStatus: 'pending',
      }
    );
    toast.message('Deadline request sent to designer.');
  };

  const handleApproveDeadline = (decision: 'approved' | 'rejected') => {
    if (!taskState.proposedDeadline) return;
    if (decision === 'approved') {
      recordChanges(
        [
          {
            type: 'update',
            field: 'deadline',
            oldValue: format(taskState.deadline, 'MMM d, yyyy'),
            newValue: format(taskState.proposedDeadline, 'MMM d, yyyy'),
            note: `Approved by ${user?.name || 'Designer'}`,
          },
          {
            type: 'update',
            field: 'deadline_request',
            oldValue: '',
            newValue: 'Approved',
          },
        ],
        {
          deadline: taskState.proposedDeadline,
          proposedDeadline: undefined,
          deadlineApprovalStatus: 'approved',
          deadlineApprovedBy: user?.name || '',
          deadlineApprovedAt: new Date(),
        }
      );
      toast.success('Deadline approved.');
    } else {
      recordChanges(
        [
          {
            type: 'update',
            field: 'deadline_request',
            oldValue: taskState.proposedDeadline
              ? format(taskState.proposedDeadline, 'MMM d, yyyy')
              : '',
            newValue: 'Rejected',
            note: `Rejected by ${user?.name || 'Designer'}`,
          },
        ],
        {
          proposedDeadline: undefined,
          deadlineApprovalStatus: 'rejected',
          deadlineApprovedBy: user?.name || '',
          deadlineApprovedAt: new Date(),
        }
      );
      toast.message('Deadline request rejected.');
    }
  };

  const renderCommentThread = (comment: TaskComment, depth = 0) => {
    const allReplies = repliesByParent.get(comment.id) ?? [];
    const replies = normalizedCommentSearch
      ? allReplies.filter((reply) => threadMatchesSearch(reply))
      : allReplies;
    const isReply = depth > 0;
    const isDeleted = Boolean(comment.deletedAt);
    const isEditing = editingCommentId === comment.id;
    const isOwnComment = comment.userId === user?.id;
    const matchesSearch = doesCommentMatchSearch(comment);
    const seenEntries = getCommentSeenEntries(comment);
    const groupedReactions = getGroupedCommentReactions(comment);
    const currentUserReactions = new Set(
      groupedReactions.filter((reaction) => reaction.reactedByCurrentUser).map((reaction) => reaction.emoji)
    );
    const receiptSummary =
      isOwnComment && canViewCommentReceipts ? getCommentReceiptSummary(comment, seenEntries) : null;

    if (normalizedCommentSearch && !matchesSearch && replies.length === 0) {
      return null;
    }

    return (
      <div
        key={comment.id}
        className={cn('group/comment flex gap-3', isReply && 'border-l border-[#DCE5F8] pl-5')}
      >
        <UserAvatar
          name={comment.userName}
          className={cn(
            'ring-1 ring-white/90 shadow-sm dark:ring-slate-900/80',
            isReply ? 'h-7 w-7' : 'h-8 w-8'
          )}
          fallbackClassName={cn(isReply ? 'text-[10px]' : 'text-xs')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-medium text-sm text-foreground">{comment.userName}</span>
              {comment.userRole && (
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {getCommentRoleLabel(comment)}
                </span>
              )}
              {normalizedCommentSearch && !matchesSearch && replies.length > 0 && (
                <span className="text-[11px] text-[#7A89A8] dark:text-muted-foreground">
                  Match in thread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/comment:opacity-100 group-focus-within/comment:opacity-100">
              {!isDeleted &&
                quickCommentReactions.map((emoji) => (
                  <button
                    key={`${comment.id}-${emoji}`}
                    type="button"
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-colors',
                      currentUserReactions.has(emoji)
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-[#D9E6FF] bg-white/85 text-[#51627E] hover:border-[#BFD3FF] hover:bg-[#F3F7FF] dark:border-border dark:bg-muted/80 dark:text-muted-foreground dark:hover:bg-muted'
                    )}
                    onClick={() => void handleCommentReactionToggle(comment, emoji)}
                    disabled={commentReactionInFlightKey === `${comment.id}:${emoji}`}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}

              {isOwnComment && !isDeleted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#D9E6FF] bg-white/85 text-[#51627E] transition-colors hover:border-[#BFD3FF] hover:bg-[#F3F7FF] dark:border-border dark:bg-muted/80 dark:text-muted-foreground dark:hover:bg-muted"
                      aria-label="Message actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={() => startCommentEdit(comment)}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit message
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => void handleCommentDelete(comment)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete message
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="mt-1.5 space-y-2">
            {isEditing ? (
              <div className="rounded-2xl border border-[#D9E6FF] bg-white/85 px-3 py-3 dark:border-border dark:bg-card/85">
                <Textarea
                  value={editingCommentText}
                  onChange={(event) => setEditingCommentText(event.target.value)}
                  rows={3}
                  className="min-h-[100px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {(comment.attachments?.length ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Attachments stay on the message while you edit the text.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleCommentEditSave(comment)}
                    disabled={commentUpdateInFlightId === comment.id}
                  >
                    {commentUpdateInFlightId === comment.id ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelCommentEdit}
                    disabled={commentUpdateInFlightId === comment.id}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : isDeleted ? (
              <div className="text-sm italic text-muted-foreground">
                This message was deleted.
              </div>
            ) : (
              <>
                {comment.content ? (
                  <div className="flex flex-wrap gap-1 text-sm text-[#5E6D8A] dark:text-slate-100">
                    {renderCommentContent(comment.content)}
                  </div>
                ) : null}
                {renderCommentAttachments(comment.attachments)}
              </>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="transition-colors hover:text-foreground">
                  {isToday(comment.createdAt)
                    ? format(comment.createdAt, 'h:mm a')
                    : format(comment.createdAt, 'MMM d, yyyy - h:mm a')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{formatCommentTimestampHover(comment.createdAt)}</TooltipContent>
            </Tooltip>
            {comment.editedAt && !isDeleted && <span>Edited</span>}
            {canComment && !isDeleted && (
              <button
                type="button"
                className="font-medium text-primary/80 transition-colors hover:text-primary"
                onClick={() => startReplyToComment(comment.id)}
              >
                Reply
              </button>
            )}
            {receiptSummary &&
              (seenEntries.length > 0 ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <button type="button" className="transition-colors hover:text-foreground">
                      {receiptSummary}
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-72 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Read receipts
                    </p>
                    <div className="mt-2 space-y-2">
                      {seenEntries.map((entry) => (
                        <div
                          key={`${comment.id}-${entry.userId || entry.role}-${entry.seenAt.toString()}`}
                          className="flex items-center gap-2"
                        >
                          <UserAvatar
                            name={formatSeenEntryLabel(entry)}
                            className="h-7 w-7 ring-1 ring-[#D9E6FF] dark:ring-border"
                            fallbackClassName="text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{formatSeenEntryLabel(entry)}</p>
                            <p className="text-xs text-muted-foreground">
                              {(entry.role && roleLabels[entry.role]) || 'Viewer'} -{' '}
                              {formatCommentTimestampHover(entry.seenAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <span>{receiptSummary}</span>
              ))}
          </div>

          {groupedReactions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {groupedReactions.map((reaction) => (
                <HoverCard key={`${comment.id}-${reaction.emoji}`}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                        reaction.reactedByCurrentUser
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-[#D9E6FF] bg-white/85 text-[#51627E] hover:border-[#BFD3FF] hover:bg-[#F3F7FF] dark:border-border dark:bg-muted/80 dark:text-muted-foreground dark:hover:bg-muted'
                      )}
                      onClick={() => void handleCommentReactionToggle(comment, reaction.emoji)}
                    >
                      <span>{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-56 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Reactions
                    </p>
                    <div className="mt-2 space-y-2">
                      {reaction.users.map((userEntry) => (
                        <div
                          key={`${reaction.emoji}-${userEntry.id || userEntry.name}`}
                          className="flex items-center gap-2"
                        >
                          <UserAvatar
                            name={userEntry.name}
                            className="h-7 w-7 ring-1 ring-[#D9E6FF] dark:ring-border"
                            fallbackClassName="text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{userEntry.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {userEntry.role ? roleLabels[userEntry.role] : 'Viewer'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
          )}

          {canComment && replyToId === comment.id && !isDeleted && (
            <div className="mt-2.5 flex gap-2">
              <div className="relative flex-1">
                <div
                  className={cn(
                    'rounded-2xl border border-[#D9E6FF] bg-white/85 px-3 py-2.5 backdrop-blur-md transition-colors focus-within:border-primary/45 focus-within:ring-1 focus-within:ring-primary/20 dark:border-border dark:bg-card/85',
                    isReplyComposerDragging &&
                      'border-primary/75 bg-[#F4F8FF] ring-1 ring-primary/25 dark:bg-card/95',
                    isUploadingCommentAttachments && 'opacity-70'
                  )}
                  onDragOver={(event) => handleChatComposerDragOver(event, 'reply')}
                  onDragLeave={(event) => handleChatComposerDragLeave(event, 'reply')}
                  onDrop={(event) => void handleChatComposerDrop(event, 'reply')}
                >
                  {replyAttachments.length > 0 && (
                    <div className="mb-2.5">{renderComposerAttachments(replyAttachments, 'reply')}</div>
                  )}
                  <Textarea
                    ref={replyComposerRef}
                    placeholder={getMentionPlaceholder(user?.role, 'Reply with')}
                    value={replyText}
                    onChange={(e) =>
                      handleComposerChange('reply', e.target.value, e.target.selectionStart)
                    }
                    onPaste={(event) => void handleChatComposerPaste(event, 'reply')}
                    onFocus={() => {
                      if (mentionBlurTimeoutRef.current) {
                        clearTimeout(mentionBlurTimeoutRef.current);
                        mentionBlurTimeoutRef.current = null;
                      }
                      handleChatComposerFocus();
                      syncMentionContext(
                        replyText,
                        'reply',
                        replyComposerRef.current?.selectionStart
                      );
                    }}
                    onBlur={() => {
                      handleChatComposerBlur();
                      scheduleMentionContextClose('reply');
                    }}
                    onKeyDown={(event) =>
                      handleComposerKeyDown(event, 'reply', replyText, replyAttachments, comment.id)
                    }
                    rows={2}
                    className="min-h-[72px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {isUploadingCommentAttachments && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Uploading attachment
                      {commentAttachmentUploadProgress ? ` (${commentAttachmentUploadProgress}%)` : ''}...
                    </p>
                  )}
                  {isReplyComposerDragging && !isUploadingCommentAttachments && (
                    <p className="mt-2 text-xs font-medium text-primary/80">Drop files to attach</p>
                  )}
                </div>
                {renderMentionSuggestions('reply')}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={replyAttachmentInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => void handleChatAttachmentSelection(event, 'reply')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => replyAttachmentInputRef.current?.click()}
                  disabled={isUploadingCommentAttachments}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={
                    isUploadingCommentAttachments ||
                    (!replyText.trim() && replyAttachments.length === 0)
                  }
                  size="sm"
                >
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelReplyComposer}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-2.5 space-y-3">
              {replies.map((reply) => renderCommentThread(reply, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChangeHistoryPanel = () => (
    <div
      ref={changeHistoryPanelRef}
      className={cn(
        glassPanelClass,
        'p-5 animate-slide-up',
        isChangeHistoryPanelHighlighted &&
          'change-history-highlight border-transparent bg-white/90 dark:bg-[#101C39]/90'
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-foreground">Change History</h2>
          {isTreasurerReviewMode && (
            <p className="mt-1 text-xs text-muted-foreground">
              Review sequence for this approval request
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs border-[#C9D7FF] bg-white/85 text-[#1E2A5A] dark:border-border dark:bg-secondary dark:text-foreground"
          >
            {changeHistoryForDisplay.length} item{changeHistoryForDisplay.length === 1 ? '' : 's'}
          </Badge>
          <History className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {(user?.role === 'designer' || isTreasurerReviewMode) && changeHistorySelectOptions.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isTreasurerReviewMode ? 'Jump to change' : 'Jump to update version'}
          </p>
          <Select
            value={designerHistoryJumpId || undefined}
            onValueChange={(value) => {
              setDesignerHistoryJumpId(value);
              setFocusedChangeId(value);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-[#D9E6FF] bg-white/85 text-left text-sm text-foreground shadow-none dark:border-border dark:bg-card/90">
              <span className="block truncate font-medium">
                {selectedHistoryOption?.shortLabel || (isTreasurerReviewMode ? 'Version history details' : 'Select update version')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {changeHistorySelectOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{option.longLabel}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {option.timeLabel}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {changeHistoryForDisplay.length > 0 ? (
        <div
          ref={changeHistoryListRef}
          className="max-h-[460px] overflow-y-auto overflow-x-hidden pr-1 pt-2 pb-1 scrollbar-thin"
        >
          {changeHistoryForDisplay.map((entry, index) => {
            const oldValueText = String(entry.oldValue || '').trim();
            const newValueText = String(entry.newValue || '').trim();
            const noteText = String(entry.note || '').trim();
            const changeLabel =
              isTreasurerReviewMode && entry.userRole === 'staff'
                ? `Change ${index + 1}`
                : `Update ${index + 1}`;
            return (
              <div
                key={entry.id}
                id={`change-${entry.id}`}
                className="grid scroll-mt-4 grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0"
              >
                <div className="relative flex justify-center">
                  {index !== changeHistoryForDisplay.length - 1 && (
                    <span className="absolute top-8 h-[calc(100%-0.35rem)] w-px bg-[#C9D7FF]/70 dark:bg-gradient-to-b dark:from-[#3A60A8]/75 dark:to-[#24457F]/55" />
                  )}
                  <span className="relative z-[1] mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#BFD1F4] bg-gradient-to-br from-white/95 via-[#F2F7FF]/90 to-[#E5EEFF]/85 text-[11px] font-semibold text-[#1E2A5A] dark:border-[#4D70B4]/70 dark:bg-gradient-to-br dark:from-[#1E3D79]/95 dark:via-[#1A3468]/92 dark:to-[#132951]/92 dark:text-[#E6EEFF] dark:shadow-none">
                    {index + 1}
                  </span>
                </div>
                <div
                  className={cn(
                    changeHistoryCardClass,
                    'rounded-xl border border-[#BFD1F4]/82 bg-gradient-to-br from-white/88 via-[#F4F8FF]/78 to-[#E8F1FF]/70 supports-[backdrop-filter]:bg-[#F4F8FF]/60 backdrop-blur-xl p-3 transition-colors dark:border-border/70 dark:bg-slate-900/55 dark:backdrop-blur-none',
                    entry.id === highlightedChangeId &&
                      'change-history-highlight border-transparent bg-white/90 ring-0 dark:bg-[#101C39]/90'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{changeLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.userName} updated {formatChangeField(entry.field)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {(oldValueText || newValueText) && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-[#D5E2FB]/80 bg-white/80 supports-[backdrop-filter]:bg-white/55 backdrop-blur-md p-2 dark:border-border/60 dark:bg-background/70 dark:backdrop-blur-none">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Before
                        </p>
                        <p className="mt-1 text-xs text-foreground/90 break-words">
                          {oldValueText || 'Not provided'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#D5E2FB]/80 bg-white/80 supports-[backdrop-filter]:bg-white/55 backdrop-blur-md p-2 dark:border-border/60 dark:bg-background/70 dark:backdrop-blur-none">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          After
                        </p>
                        <p className="mt-1 text-xs text-foreground/90 break-words">
                          {newValueText || 'Not provided'}
                        </p>
                      </div>
                    </div>
                  )}

                  {noteText && (
                    <div className="mt-3 rounded-lg border border-dashed border-[#BFD1F4]/75 bg-[#ECF3FF]/70 supports-[backdrop-filter]:bg-[#ECF3FF]/50 backdrop-blur-md p-2 dark:border-border/70 dark:bg-background/60 dark:backdrop-blur-none">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Note
                      </p>
                      <p className="mt-1 text-xs text-foreground/90 break-words">{noteText}</p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {entry.userRole}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {entry.type.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No updates recorded yet.</p>
      )}
    </div>
  );

  const annotationTargetKey = getReviewAnnotationFileKey(annotationTargetFile || undefined);
  const annotationForDialog = annotationTargetKey
    ? draftReviewAnnotationsByFile[annotationTargetKey]
    : undefined;
  const annotationPreviewUrl = annotationTargetFile
    ? getFileActionUrl(annotationTargetFile) ||
      getPreviewUrl(annotationTargetFile) ||
      annotationTargetFile.url
    : '';
  const floatingStaffStatusPanelStyle = staffStatusPanelPosition
    ? {
        left: `${staffStatusPanelPosition.left}px`,
        top: `${staffStatusPanelPosition.top}px`,
        right: 'auto' as const,
      }
    : undefined;
  const floatingStaffStatusPanel =
    taskRouteState === 'ready' && shouldShowStaffStatusTracker ? (
      <div
        className="pointer-events-none fixed right-5 top-24 z-[110] hidden lg:block 2xl:right-8"
        style={floatingStaffStatusPanelStyle}
      >
        <div
          ref={staffStatusPanelRef}
          className={cn(
            'status-panel-gradient-border pointer-events-auto relative w-[23rem] select-none overflow-hidden rounded-[32px] border text-white backdrop-blur-xl transition-[max-height,padding,box-shadow,background] duration-300 dark:border-transparent',
            isStaffStatusPanelExpanded
              ? 'border-[#243660]/88 bg-[linear-gradient(180deg,#4a62b1_0%,#122045_50%,#00103b_100%)] px-6 pb-6 pt-5 shadow-[0_28px_60px_-34px_rgba(35,68,170,0.62)] hover:shadow-[0_30px_68px_-32px_rgba(35,68,170,0.72)] max-h-[38rem] dark:shadow-none dark:hover:shadow-none'
              : 'border-[#243660]/88 bg-[linear-gradient(180deg,#4a62b1_0%,#122045_50%,#00103b_100%)] px-5 pb-5 pt-4 shadow-[0_24px_52px_-30px_rgba(35,68,170,0.62)] hover:shadow-[0_26px_56px_-28px_rgba(35,68,170,0.72)] max-h-[12.5rem] dark:shadow-none dark:hover:shadow-none'
          )}
        >
          <div
            className={cn(
              'pointer-events-none absolute inset-0',
              isStaffStatusPanelExpanded
                ? 'bg-[radial-gradient(circle_at_top,rgba(98,132,255,0.2),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]'
                : 'bg-[radial-gradient(circle_at_top,rgba(98,132,255,0.2),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]'
            )}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="pointer-events-none absolute left-1/2 top-8 h-36 w-36 -translate-x-1/2 rounded-full bg-[#5C7BFF]/20 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-24 h-28 w-28 -translate-x-1/2 rounded-full bg-[#1C2E68]/75 blur-3xl" />

          <div className="relative">
          {isStaffStatusPanelExpanded ? (
          <>
          <div
            onMouseDown={handleStaffStatusPanelDragStart}
            className="flex cursor-grab items-start justify-between gap-3 active:cursor-grabbing"
          >
            <div className="min-w-0">
              <div className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B7C7EC] shadow-[0_18px_42px_-32px_rgba(3,7,18,0.92)] backdrop-blur-xl">
                <span>Task Status</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsStaffStatusPanelExpanded((current) => !current)}
                onMouseDown={(event) => event.stopPropagation()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/82 transition-colors hover:bg-white/16 hover:text-white"
                aria-label={isStaffStatusPanelExpanded ? 'Collapse task status sidebar' : 'Expand task status sidebar'}
                title={isStaffStatusPanelExpanded ? 'Collapse' : 'Expand'}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', isStaffStatusPanelExpanded && 'rotate-180')} />
              </button>
            </div>
          </div>

          <div className="mt-4">
              <div className="flex items-center gap-2">
                {staffStatusDot}
                <h2 className="bg-[linear-gradient(90deg,#F2F5FF_0%,#DCE7FF_56%,#BECEFF_100%)] bg-clip-text text-[1.4rem] font-semibold leading-tight text-transparent">
                  {trackerViewModel.headline}
                </h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-[#A7B6D6]">
              {trackerViewModel.summary}
              </p>
            </div>
          </>
          ) : (
          <>
          <div
            onMouseDown={handleStaffStatusPanelDragStart}
            className="flex cursor-grab items-start justify-between gap-3 active:cursor-grabbing"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9AA6C7]">
                {staffWorkflowStageLabel}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {staffStatusDot}
                <h2 className="truncate text-[1.25rem] font-semibold leading-tight text-white">
                  {trackerViewModel.headline}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsStaffStatusPanelExpanded((current) => !current)}
                onMouseDown={(event) => event.stopPropagation()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/82 transition-colors hover:bg-white/12 hover:text-white"
                aria-label="Expand task status sidebar"
                title="Expand"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#AAB4CF]">
            {trackerViewModel.summary}
          </p>
          <div className="mt-4">
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="relative h-full rounded-full bg-[linear-gradient(90deg,#3B5EFF_0%,#4E84FF_54%,#90EAFF_100%)] shadow-[0_0_24px_rgba(120,169,255,0.42)]"
                style={{ width: `${staffTrackerProgressPercent}%` }}
              >
                <span className="pointer-events-none absolute inset-y-[-3px] right-0 w-8 rounded-full bg-[radial-gradient(circle_at_left_center,rgba(255,255,255,0.96)_0%,rgba(214,245,255,0.84)_36%,rgba(144,234,255,0.22)_58%,rgba(144,234,255,0)_78%)] blur-[5px] motion-safe:animate-[progressEndPulse_1.75s_ease-in-out_infinite]" />
                <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.24)_26%,rgba(255,255,255,0.88)_56%,rgba(208,245,255,0.76)_76%,transparent_100%)] opacity-80 blur-[2px] motion-safe:animate-[progressEndShimmer_1.75s_ease-in-out_infinite]" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[#C6D0EA]">
              <span>{compactDeadlineLabel}</span>
              <span>{staffTrackerProgressPercent}% complete</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-[#8F9BB8]">
              <span>Updated {workflowUpdatedLabel}</span>
              <span>{staffWorkflowStageLabel}</span>
            </div>
          </div>
          </>
          )}

          {isStaffStatusPanelExpanded ? (
          <>
          <div className="relative mt-5 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_18px_42px_-32px_rgba(3,7,18,0.92)] backdrop-blur-xl dark:shadow-none">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(156,186,255,0.18),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
            <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8EA5D8]">
                Delivery Health
              </p>
              <span
                className={cn(
                  'inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold leading-none ring-1 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
                  staffHealthConfig[staffHealthTone].className
                )}
              >
                {staffHealthConfig[staffHealthTone].label}
              </span>
            </div>
            <p className="mt-2 text-[12px] font-medium leading-6 text-[#E5ECFF]">
              {staffTrackerSupportItems.join(' • ')}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#9FB0D4]">
              Updated {workflowUpdatedLabel}
            </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8EA5D8]">
              <span>Workflow</span>
              <span className="text-[#DCE7FF]">{staffWorkflowStageLabel}</span>
            </div>
            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="relative h-full rounded-full bg-[linear-gradient(90deg,#3B5EFF_0%,#4E84FF_54%,#90EAFF_100%)] shadow-[0_0_24px_rgba(120,169,255,0.42),inset_0_1px_0_rgba(255,255,255,0.26)] transition-all duration-300 ease-out"
                style={{ width: `${staffTrackerProgressPercent}%` }}
              >
                <span className="pointer-events-none absolute right-[-3px] top-1/2 h-4 w-6 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(248,253,255,0.98)_0%,rgba(206,243,255,0.94)_40%,rgba(144,234,255,0.48)_66%,rgba(144,234,255,0)_84%)] blur-[5px] motion-safe:animate-[progressEndPulse_1.45s_ease-in-out_infinite]" />
                <span className="pointer-events-none absolute inset-y-[-1px] right-[-1px] w-12 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.12)_22%,rgba(255,255,255,0.85)_52%,rgba(201,244,255,0.94)_72%,rgba(201,244,255,0)_100%)] opacity-95 blur-[1.5px] motion-safe:animate-[progressEndShimmer_1.45s_ease-in-out_infinite]" />
                <span className="pointer-events-none absolute right-[2px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.92),0_0_18px_rgba(144,234,255,0.82)] motion-safe:animate-[progressEndPulse_1.45s_ease-in-out_infinite]" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {STAFF_TRACKER_STEPS.map((step, index) => {
                const isComplete = index < staffTrackerStepIndex;
                const isCurrent = index === staffTrackerStepIndex;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'relative flex flex-col items-center gap-2 text-center',
                      isCurrent ? '' : ''
                    )}
                  >
                    {index !== STAFF_TRACKER_STEPS.length - 1 ? (
                      <span
                        className={cn(
                          'pointer-events-none absolute top-[0.95rem] h-px',
                          isComplete
                            ? 'bg-[linear-gradient(90deg,rgba(110,255,203,0.78)_0%,rgba(118,186,255,0.72)_100%)]'
                            : 'bg-white/12'
                        )}
                        style={{
                          left: 'calc(50% + 1rem)',
                          right: 'calc(-50% + 1rem)',
                        }}
                      />
                    ) : null}
                    <span
                      className={cn(
                        'relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300',
                        isComplete
                          ? 'border-[#A9E2C8] bg-[#E8FFF3] text-[#169B58] shadow-[0_0_12px_rgba(71,214,154,0.12)]'
                          : isCurrent
                            ? 'border-[#E2ECFF] bg-[linear-gradient(135deg,#FFFFFF_0%,#F4F9FF_46%,#DDEBFF_100%)] text-[#335BB6] shadow-[0_0_0_4px_rgba(191,214,255,0.2),0_10px_24px_-14px_rgba(120,149,255,0.46)]'
                            : 'border-white/16 bg-[#20397E]/60 text-white/72'
                      )}
                    >
                      {isCurrent ? (
                        <span className="pointer-events-none absolute inset-[-4px] rounded-full border border-[#C6DBFF]/55" />
                      ) : null}
                      {isComplete ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-semibold">{index + 1}</span>}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-medium leading-[1.25]',
                        isCurrent ? 'text-[#EEF4FF]' : isComplete ? 'text-[#DDF7EC]' : 'text-[#B8C7E4]'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          </>
          ) : null}
          </div>
        </div>
      </div>
    ) : null;

  if (taskRouteState !== 'ready') {
    const fallbackHref = user?.role === 'designer' ? '/tasks' : '/dashboard';
    const fallbackLabel = user?.role === 'designer' ? 'Go to Task Portal' : 'Back to Dashboard';

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(111,145,255,0.14),transparent_28%),linear-gradient(180deg,#f6f8ff_0%,#eef3ff_100%)] px-6 py-16 text-slate-950">
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[28px] border border-[#d7e2ff] bg-white/88 p-8 text-center shadow-[0_28px_90px_-42px_rgba(61,92,190,0.35)] backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5c74b4]">
              Task Detail
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#17305d]">
              {taskRouteState === 'loading' ? 'Loading task...' : 'Task not found'}
            </h2>
            <p className="mt-2 text-sm text-[#5a6c8c]">
              {taskRouteState === 'loading'
                ? 'Preparing the task workspace for this direct link.'
                : 'This task could not be loaded from the current session.'}
            </p>
            <Button asChild className="mt-6">
              <Link to={fallbackHref}>{fallbackLabel}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {floatingStaffStatusPanel}
      <DashboardLayout hideGrid>
      <div className="relative z-10 mx-auto w-[96%] max-w-none select-none space-y-5">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 animate-fade-in text-foreground hover:text-foreground hover:bg-primary/10 dark:text-slate-100 dark:hover:text-white dark:hover:bg-slate-800/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="animate-slide-up border-b border-[#D9E6FF] pb-2 pt-4 dark:border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <Badge variant={status.variant} className={badgeGlassClass}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                    <ClipboardCheck className="h-3 w-3" />
                  </span>
                  {status.label}
                </Badge>
                {taskState.urgency === 'urgent' && (
                  <Badge variant="urgent" className={badgeGlassClass}>
                    <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                    Urgent
                  </Badge>
                )}
                <Badge variant="secondary" className={badgeGlassClass}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                    <Edit3 className="h-3 w-3" />
                  </span>
                  Changes: {displayedChangeCount}
                </Badge>
                {approvalStatus && (
                  <Badge
                    variant={
                      approvalStatus === 'approved'
                        ? 'completed'
                        : approvalStatus === 'rejected'
                          ? 'urgent'
                          : 'pending'
                    }
                    className={badgeGlassClass}
                  >
                    <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                    {approvalStatus === 'approved'
                      ? 'Approved'
                      : approvalStatus === 'rejected'
                        ? 'Rejected'
                        : 'Awaiting Approval'}
                  </Badge>
                )}
                <span className={badgeGlassClass}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                    <Tag className="h-3 w-3" />
                  </span>
                  {categoryLabels[taskState.category]}
                </span>
              </div>
              <h1 className="mt-3 text-[1.65rem] font-semibold leading-tight text-foreground premium-headline">
                {taskState.title}
              </h1>
            </div>

            {canAssignDesigner ? (
              <div className="flex w-full sm:w-auto lg:shrink-0 lg:justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={hasWorkflowAssignee ? 'outline' : 'default'}
                  onClick={() => openAssignDesignerModal(taskState)}
                  className={cn(
                    'h-10 w-full rounded-full px-5 text-sm font-semibold shadow-none sm:w-auto',
                    hasWorkflowAssignee
                      ? 'border-[#D9E6FF] bg-[#F8FBFF] text-[#1E2A5A] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:hover:bg-slate-900/80 dark:hover:text-white'
                      : 'bg-[#3657C9] text-white hover:bg-[#2F4EBA] dark:bg-[#4E6FE0] dark:text-white dark:hover:bg-[#6080F0]'
                  )}
                >
                  <User className="mr-2 h-4 w-4" />
                  {hasWorkflowAssignee ? 'Reassign Designer' : 'Assign Designer'}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Main Content Grid */}
        <div
          className={cn(
            'grid grid-cols-1 gap-5 pt-1',
            usesCampaignOverviewLayout
              ? 'xl:grid-cols-1'
              : 'xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.95fr)] 2xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.9fr)]'
          )}
        >
          {/* Left Column - Details */}
          <div className="space-y-5">
            {/* Description — standalone for non-campaign tasks */}
            {!usesCampaignOverviewLayout && (
              <div className={`${glassPanelClass} p-5 animate-slide-up`}>
                <h2 className="font-semibold text-foreground mb-3">Description</h2>
                <p className="max-h-[600px] overflow-y-auto whitespace-pre-wrap text-[14px] leading-7 text-muted-foreground">
                  {taskState.description}
                </p>
              </div>
            )}

            {usesCampaignOverviewLayout && (
              <div className={`${glassPanelClass} overflow-hidden animate-slide-up`}>
                <div className="border-b border-[#E7EDF8] px-5 py-4 dark:border-border">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7E8DAB] dark:text-slate-400">
                        Campaign Overview
                      </p>
                      <h2 className="mt-1 truncate text-[1.35rem] font-semibold leading-tight text-[#215ABB] dark:text-slate-100">
                        {taskState.title}
                      </h2>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border border-[#E4EBF8] bg-white px-3 py-1 text-[11px] font-semibold dark:border-border dark:bg-card/80',
                        campaignStatusTextClass
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB] dark:text-slate-400">
                      <span>Collateral Progress</span>
                      <span>
                        {campaignCompletedCollaterals} / {collateralItems.length || 0} completed
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#E6EBF2] dark:bg-slate-800">
                      <div
                        className="relative h-full rounded-full bg-gradient-to-r from-[#3657C9] via-[#4F6EE0] to-[#7FA3FF] shadow-[0_0_18px_-8px_rgba(79,110,224,0.85)] transition-all duration-300 ease-out"
                        style={{ width: `${collateralCompletionPercent}%` }}
                      >
                        <span className="pointer-events-none absolute inset-y-[-3px] right-0 w-7 rounded-full bg-[radial-gradient(circle_at_left_center,rgba(255,255,255,0.96)_0%,rgba(214,245,255,0.84)_36%,rgba(144,234,255,0.22)_58%,rgba(144,234,255,0)_78%)] blur-[5px] motion-safe:animate-[progressEndPulse_1.75s_ease-in-out_infinite]" />
                        <span className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.24)_26%,rgba(255,255,255,0.88)_56%,rgba(208,245,255,0.76)_76%,transparent_100%)] opacity-80 blur-[2px] motion-safe:animate-[progressEndShimmer_1.75s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid border-b border-[#E7EDF8] dark:border-border md:grid-cols-4">
                  <div className="px-5 py-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-slate-500">
                      Request Structure
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1F2F4B] dark:text-slate-100">
                      {campaignDeadlineMode === 'common' ? 'Common deadline' : 'Item-wise deadlines'}
                    </p>
                  </div>
                  <div className="border-t border-[#E7EDF8] px-5 py-3.5 dark:border-border md:border-l md:border-t-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-slate-500">
                      Collaterals
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1F2F4B] dark:text-slate-100">
                      {collateralItems.length} {collateralItems.length === 1 ? 'Item' : 'Items'}
                    </p>
                  </div>
                  <div className="border-t border-[#E7EDF8] px-5 py-3.5 dark:border-border md:border-l md:border-t-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-slate-500">
                      Delivery Target
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1F2F4B] dark:text-slate-100">
                      {campaignPrimaryDeadline ? format(campaignPrimaryDeadline, 'dd MMM yyyy') : 'Not set'}
                    </p>
                  </div>
                  <div className="border-t border-[#E7EDF8] px-5 py-3.5 dark:border-border md:border-l md:border-t-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF] dark:text-slate-500">
                      Requested On
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1F2F4B] dark:text-slate-100">
                      {format(taskState.createdAt, 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB] dark:text-slate-400">
                      Description
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">
                      {campaignBriefText || 'No campaign description added yet.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB] dark:text-slate-400">
                      Collateral Scope
                    </p>
                    {campaignScopeLines.length > 0 ? (
                      <ol className="mt-2 space-y-1.5 text-[13px] leading-6 text-muted-foreground">
                        {campaignScopeLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                        No collateral scope has been added yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E7EDF8] px-5 py-4 dark:border-border">
                  <h2 className="font-semibold text-foreground">Deliverables</h2>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                      {collateralItems.length} {collateralItems.length === 1 ? 'collateral' : 'collaterals'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                      {campaignDeadlineMode === 'common' ? 'Common deadline' : 'Item-wise deadlines'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4 px-5 pb-5 xl:hidden">
                  <div className="overflow-hidden rounded-[24px] border border-[#D7E4FF]/90 bg-white/75 dark:border-border dark:bg-card/70">
                    <div className="border-b border-[#E5EEFF] px-5 py-4 dark:border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6C7EA6] dark:text-slate-400">
                        Collateral Flow
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pick a collateral to review its brief and references.
                      </p>
                    </div>

                    <div className="space-y-2 p-3">
                      {collateralItems.map((collateral, index) => {
                        const effectiveDeadline =
                          campaignDeadlineMode === 'common'
                            ? overviewCampaignCommonDeadline ?? taskState.deadline
                            : collateral.deadline;
                        const isSelected = selectedCampaignCollateral?.id === collateral.id;

                        return (
                          <button
                            key={`campaign-mobile-${collateral.id}`}
                            type="button"
                            onClick={() => setSelectedCampaignCollateralId(collateral.id)}
                            className={cn(
                              'w-full rounded-2xl border px-3.5 py-3 text-left transition-colors',
                              isSelected
                                ? 'border-[#8FB0FF] bg-[#EEF4FF] dark:border-[#5477C2] dark:bg-[#172746]'
                                : 'border-[#E1E9FF] bg-white/80 dark:border-border dark:bg-card/70'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {index + 1}. {getCollateralDisplayName(collateral)}
                                </p>
                                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                  {[
                                    collateral.collateralType,
                                    collateral.platform,
                                    getCollateralSizeSummary(collateral as never),
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                  getCollateralStatusPillClass(collateral.status)
                                )}
                              >
                                {formatCollateralStatusLabel(collateral.status)}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                              {effectiveDeadline ? <span>{format(effectiveDeadline, 'dd MMM yyyy')}</span> : null}
                              <span>
                                {collateral.referenceFiles?.length || 0} ref
                                {(collateral.referenceFiles?.length || 0) === 1 ? '' : 's'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedCampaignCollateral ? (
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-[#D7E4FF]/90 bg-white/80 px-4 py-4 dark:border-border dark:bg-card/70">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6C7EA6] dark:text-slate-400">
                          Collateral {selectedCampaignCollateralIndex + 1} of {collateralItems.length}
                        </p>
                        <h3 className="mt-2 text-[1.4rem] font-semibold leading-tight text-[#1A2E62] dark:text-white">
                          {getCollateralDisplayName(selectedCampaignCollateral)}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {[
                            selectedCampaignCollateral.collateralType,
                            selectedCampaignCollateral.platform,
                            selectedCampaignCollateral.usageType,
                            getCollateralSizeSummary(selectedCampaignCollateral as never),
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No delivery spec summary available yet.'}
                        </p>

                        <div className="mt-4 grid gap-3">
                          <div className="rounded-2xl border border-[#DCE7FF] bg-white/82 px-4 py-3 dark:border-border dark:bg-card/70">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Deadline
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {selectedCampaignCollateralDeadline
                                ? format(selectedCampaignCollateralDeadline, 'EEE, dd MMM yyyy')
                                : 'Not set'}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[#DCE7FF] bg-white/82 px-4 py-3 dark:border-border dark:bg-card/70">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Progress
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {selectedCampaignCollateral.assignedToName || 'Awaiting assignment'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {campaignOverallBrief ? (
                        <div className="rounded-2xl border border-[#D9E6FF]/75 bg-[#F8FBFF]/82 px-4 py-4 dark:border-border dark:bg-card/70">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Overall Brief
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {campaignOverallBrief}
                          </p>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-[#D9E6FF]/75 bg-white/82 px-4 py-4 dark:border-border dark:bg-card/70">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Content Brief
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                          {selectedCampaignCollateral.brief || (
                            <span className="italic text-muted-foreground/60">No brief added yet.</span>
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#D9E6FF]/75 bg-white/82 px-4 py-4 dark:border-border dark:bg-card/70">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Delivery Specs
                        </p>
                        <dl className="mt-4 space-y-3">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <dt className="text-[11px] font-medium text-muted-foreground">Platform</dt>
                            <dd className="text-sm font-medium text-foreground sm:text-right">
                              {selectedCampaignCollateral.platform || 'Not specified'}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <dt className="text-[11px] font-medium text-muted-foreground">Usage</dt>
                            <dd className="text-sm font-medium text-foreground sm:text-right">
                              {selectedCampaignCollateral.usageType || 'Not specified'}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <dt className="text-[11px] font-medium text-muted-foreground">Size</dt>
                            <dd className="text-sm font-medium text-foreground sm:text-right">
                              {getCollateralSizeSummary(selectedCampaignCollateral as never) || 'Not specified'}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <dt className="text-[11px] font-medium text-muted-foreground">Orientation</dt>
                            <dd className="text-sm font-medium capitalize text-foreground sm:text-right">
                              {selectedCampaignCollateral.orientation || 'Custom'}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <dt className="text-[11px] font-medium text-muted-foreground">Priority</dt>
                            <dd className="text-sm font-medium capitalize text-foreground sm:text-right">
                              {String(selectedCampaignCollateral.priority || 'normal').replace(/_/g, ' ')}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <dt className="text-[11px] font-medium text-muted-foreground">Owner</dt>
                            <dd className="text-sm font-medium text-foreground sm:text-right">
                              {selectedCampaignCollateral.assignedToName || 'Unassigned'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-[#D9E6FF]/75 bg-white/82 px-4 py-4 dark:border-border dark:bg-card/70">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Reference Files
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Preview or open the files linked to this collateral.
                            </p>
                          </div>
                          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                            {selectedCampaignCollateral.referenceFiles?.length || 0} file
                            {(selectedCampaignCollateral.referenceFiles?.length || 0) === 1 ? '' : 's'}
                          </Badge>
                        </div>

                        {(selectedCampaignCollateral.referenceFiles?.length || 0) > 0 ? (
                          <div className="mt-4 space-y-2">
                            {selectedCampaignCollateral.referenceFiles.map((file, index) => {
                              const fileLinkUrl = getFileActionUrl(file);
                              const sizeLabel =
                                formatFileSize(file.size) ||
                                getLinkSubLabel(resolveStoredFileUrl(file) || file.url || '');

                              return (
                                <div
                                  key={`campaign-mobile-ref-${file.id || index}`}
                                  className={cn(
                                    fileRowClass,
                                    'flex-col items-start gap-3 px-3 py-2.5 sm:flex-row sm:items-center'
                                  )}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {file.name}
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {sizeLabel || 'Reference file'}
                                    </p>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                                    {canPreviewFile(file) ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className={fileActionButtonClass}
                                        onClick={() => openFilePreviewDialog(file)}
                                        aria-label={`Preview ${file.name}`}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    ) : null}

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={!fileLinkUrl || fileLinkUrl === '#'}
                                      className={fileActionButtonClass}
                                      onClick={() => void handleFileAction(file)}
                                      aria-label={`Open ${file.name}`}
                                    >
                                      {shouldUseLinkIcon(file) ? (
                                        <ExternalLink className="h-4 w-4" />
                                      ) : (
                                        <Download className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-[#D9E6FF]/80 bg-[#F8FBFF]/75 px-4 py-4 text-sm text-muted-foreground dark:border-border/70 dark:bg-card/70">
                            No reference files attached to this collateral yet.
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[#D9E6FF]/75 bg-white/82 px-4 py-4 dark:border-border dark:bg-card/70">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Status Control
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Update the delivery state for this collateral.
                        </p>

                        {isCampaignRequest && canUpdateCollateralStatus ? (
                          <div className="mt-4">
                            <Select
                              value={selectedCampaignCollateral.status}
                              onValueChange={(value) =>
                                handleCollateralStatusChange(
                                  selectedCampaignCollateral.id,
                                  value as CollateralStatus
                                )
                              }
                            >
                              <SelectTrigger className="h-11 rounded-xl border-[#D7E4FF] bg-white px-3 text-sm shadow-none dark:border-border dark:bg-sidebar/60">
                                <SelectValue placeholder="Select collateral status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="submitted_for_review">Submitted for Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rework">Rework</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-[#D9E6FF] bg-[#F8FBFF]/80 px-3 py-3 dark:border-border dark:bg-card/70">
                            <p className="text-sm font-medium text-foreground">
                              {formatCollateralStatusLabel(selectedCampaignCollateral.status)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Status updates are available to assigned designers and reviewers.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="hidden px-5 pb-5 xl:block">
                  <div className="mt-5 overflow-hidden rounded-[24px] border border-[#D7E4FF]/90 bg-white/45 supports-[backdrop-filter]:bg-white/28 backdrop-blur-xl dark:border-border dark:bg-card/95 dark:bg-none dark:[background-image:none] xl:grid xl:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="border-b border-[#E5EEFF] bg-[linear-gradient(180deg,rgba(248,251,255,0.9),rgba(240,246,255,0.7))] dark:border-border dark:bg-card/78 dark:[background-image:none] xl:border-b-0 xl:border-r">
                    <div className="border-b border-[#E5EEFF] px-5 py-4 dark:border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6C7EA6] dark:text-slate-400">
                        Collateral Flow
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select an item to review its brief, references, and delivery specs.
                      </p>
                    </div>

                    {collateralItems.length > 0 ? (
                      <div className="space-y-1.5 p-3">
                        {collateralItems.map((collateral, index) => {
                          const effectiveDeadline =
                            campaignDeadlineMode === 'common'
                              ? overviewCampaignCommonDeadline ?? taskState.deadline
                              : collateral.deadline;
                          const isSelected = selectedCampaignCollateral?.id === collateral.id;
                          const isComplete = isCollateralStepComplete(collateral.status);
                          const sizeLabel = getCollateralSizeSummary(collateral as never);
                          const typeLabel = [collateral.platform, collateral.usageType]
                            .filter(Boolean)
                            .join(' · ');

                          return (
                            <button
                              key={`campaign-collateral-${collateral.id}`}
                              type="button"
                              onClick={() => setSelectedCampaignCollateralId(collateral.id)}
                              className={cn(
                                'w-full rounded-[18px] border px-3.5 py-3 text-left transition-all duration-200',
                                isSelected
                                  ? 'border-[#8FB0FF] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(235,243,255,0.94))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)] dark:border-border dark:bg-card/90 dark:[background-image:none] dark:shadow-none'
                                  : 'border-transparent bg-white/45 hover:border-[#D4E2FF] hover:bg-white/75 dark:bg-transparent dark:hover:border-border dark:hover:bg-card/78 dark:hover:[background-image:none] dark:hover:shadow-none'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold',
                                    isSelected &&
                                      'border-[#5F86E8] bg-[#2F67E8] text-white shadow-[0_8px_20px_-12px_rgba(47,103,232,0.9)] dark:border-sidebar-ring/40 dark:bg-sidebar-primary',
                                    !isSelected &&
                                      isComplete &&
                                      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300',
                                    !isSelected &&
                                      !isComplete &&
                                      'border-[#C7D8FF] bg-white text-[#36559F] dark:border-border dark:bg-card/85 dark:text-foreground'
                                  )}
                                >
                                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p
                                        className={cn(
                                          'truncate text-[13px] font-semibold',
                                          isSelected ? 'text-[#183265] dark:text-white' : 'text-foreground'
                                        )}
                                      >
                                        {getCollateralDisplayName(collateral)}
                                      </p>
                                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                                        {[collateral.collateralType, typeLabel, sizeLabel]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </p>
                                    </div>
                                    <span
                                      className={cn(
                                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                        getCollateralStatusPillClass(collateral.status)
                                      )}
                                    >
                                      {formatCollateralStatusLabel(collateral.status)}
                                    </span>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground/85">
                                    {effectiveDeadline ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(effectiveDeadline, 'dd MMM yyyy')}
                                      </span>
                                    ) : null}
                                    <span className="inline-flex items-center gap-1">
                                      <Paperclip className="h-3.5 w-3.5" />
                                      {collateral.referenceFiles?.length || 0} ref
                                      {(collateral.referenceFiles?.length || 0) === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-sm text-muted-foreground">
                        No collateral items available for this campaign yet.
                      </div>
                    )}
                    </aside>

                    <div className="overflow-y-auto p-5 dark:bg-card/78 sm:p-6">
                      {selectedCampaignCollateral ? (
                        <>
                        {/* Header — condensed, no boxed tiles */}
                        <div className="border-b border-[#EEF2FF] pb-5 dark:border-border">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[1.25rem] font-semibold leading-tight text-[#1A2E62] dark:text-white">
                              {getCollateralDisplayName(selectedCampaignCollateral)}
                            </h3>
                            <span
                              className={cn(
                                'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                                getCollateralStatusPillClass(selectedCampaignCollateral.status)
                              )}
                            >
                              {formatCollateralStatusLabel(selectedCampaignCollateral.status)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[13px] text-muted-foreground">
                            {[
                              selectedCampaignCollateral.collateralType,
                              selectedCampaignCollateral.platform,
                              selectedCampaignCollateral.usageType,
                              getCollateralSizeSummary(selectedCampaignCollateral as never),
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'No specs added yet.'}
                          </p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground/70">Deadline:</span>{' '}
                              {selectedCampaignCollateralDeadline
                                ? format(selectedCampaignCollateralDeadline, 'dd MMM yyyy')
                                : 'Not set'}
                            </span>
                            <span className="text-muted-foreground/30">·</span>
                            <span>
                              <span className="font-medium text-foreground/70">Progress:</span>{' '}
                              {selectedCampaignCollateral.assignedToName || 'Awaiting assignment'}
                            </span>
                          </p>
                        </div>

                        {/* Body — 2 columns: Brief (left) + Specs/Status (right) */}
                        <div className="mt-5 grid gap-x-8 gap-y-6 xl:grid-cols-[1fr_220px]">
                          {/* Left: Brief + References */}
                          <div className="min-w-0 space-y-5">
                            {campaignOverallBrief ? (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Overall Brief
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                  {campaignOverallBrief}
                                </p>
                              </div>
                            ) : null}

                            <div className={campaignOverallBrief ? 'border-t border-[#EEF2FF] pt-5 dark:border-border' : ''}>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Content Brief
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                                {selectedCampaignCollateral.brief || (
                                  <span className="italic text-muted-foreground/50">No brief added yet.</span>
                                )}
                              </p>
                            </div>

                            <div className="border-t border-[#EEF2FF] pt-5 dark:border-border">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  References
                                </p>
                                <span className="text-[11px] text-muted-foreground">
                                  {selectedCampaignCollateral.referenceFiles?.length || 0} file
                                  {(selectedCampaignCollateral.referenceFiles?.length || 0) !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {(selectedCampaignCollateral.referenceFiles?.length || 0) > 0 ? (
                                <div className="mt-3 min-w-0 space-y-1.5">
                                  {selectedCampaignCollateral.referenceFiles.map((file, index) => {
                                    const fileLinkUrl = getFileActionUrl(file);
                                    const sizeLabel =
                                      formatFileSize(file.size) ||
                                      getLinkSubLabel(resolveStoredFileUrl(file) || file.url || '');
                                    return (
                                      <div
                                        key={file.id || `${selectedCampaignCollateral.id}-reference-${index}`}
                                        className={cn(fileRowClass, 'min-w-0 gap-3 px-3 py-2')}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="line-clamp-2 pr-2 text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]">
                                            {file.name}
                                          </p>
                                          {sizeLabel ? (
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">{sizeLabel}</p>
                                          ) : null}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                          {canPreviewFile(file) ? (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon-sm"
                                              className={fileActionButtonClass}
                                              onClick={() => openFilePreviewDialog(file)}
                                              aria-label={`Preview ${file.name}`}
                                            >
                                              <Eye className="h-4 w-4" />
                                            </Button>
                                          ) : null}
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            disabled={!fileLinkUrl || fileLinkUrl === '#'}
                                            className={fileActionButtonClass}
                                            onClick={() => void handleFileAction(file)}
                                            aria-label={`Open ${file.name}`}
                                          >
                                            {shouldUseLinkIcon(file) ? (
                                              <ExternalLink className="h-4 w-4" />
                                            ) : (
                                              <Download className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="mt-2 text-sm italic text-muted-foreground/60">
                                  No reference files attached yet.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Specifications + Delivery + Status */}
                          <div className="space-y-5">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Specifications
                              </p>
                              <dl className="mt-3 space-y-2.5">
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Platform</dt>
                                  <dd className="text-right text-[12px] font-medium text-foreground">
                                    {selectedCampaignCollateral.platform || '—'}
                                  </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Usage</dt>
                                  <dd className="text-right text-[12px] font-medium text-foreground">
                                    {selectedCampaignCollateral.usageType || '—'}
                                  </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Size</dt>
                                  <dd className="text-right text-[12px] font-medium text-foreground">
                                    {getCollateralSizeSummary(selectedCampaignCollateral as never) || '—'}
                                  </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Orientation</dt>
                                  <dd className="text-right text-[12px] font-medium capitalize text-foreground">
                                    {selectedCampaignCollateral.orientation || 'Custom'}
                                  </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Priority</dt>
                                  <dd className="text-right text-[12px] font-medium capitalize text-foreground">
                                    {String(selectedCampaignCollateral.priority || 'normal').replace(/_/g, ' ')}
                                  </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Owner</dt>
                                  <dd className="text-right text-[12px] font-medium text-foreground">
                                    {selectedCampaignCollateral.assignedToName || 'Unassigned'}
                                  </dd>
                                </div>
                              </dl>
                            </div>

                            <div className="border-t border-[#EEF2FF] pt-4 dark:border-border">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Delivery
                              </p>
                              <dl className="mt-3 space-y-2.5">
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">Deadline</dt>
                                  <dd className="text-right text-[12px] font-medium text-foreground">
                                    {selectedCampaignCollateralDeadline
                                      ? format(selectedCampaignCollateralDeadline, 'dd MMM yyyy')
                                      : 'Not set'}
                                  </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <dt className="text-[11px] text-muted-foreground">References</dt>
                                  <dd className="text-right text-[12px] font-medium text-foreground">
                                    {selectedCampaignCollateral.referenceFiles?.length || 0} file
                                    {(selectedCampaignCollateral.referenceFiles?.length || 0) !== 1 ? 's' : ''}
                                  </dd>
                                </div>
                              </dl>
                            </div>

                            <div className="border-t border-[#EEF2FF] pt-4 dark:border-border">
                              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Status
                              </p>
                              {isCampaignRequest && canUpdateCollateralStatus ? (
                                <Select
                                  value={selectedCampaignCollateral.status}
                                  onValueChange={(value) =>
                                    handleCollateralStatusChange(
                                      selectedCampaignCollateral.id,
                                      value as CollateralStatus
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-9 w-full rounded-lg border-[#D7E4FF] bg-white px-3 text-sm shadow-none dark:border-border dark:bg-sidebar/60">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="submitted_for_review">Submitted for Review</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rework">Rework</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span
                                  className={cn(
                                    'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                                    getCollateralStatusPillClass(selectedCampaignCollateral.status)
                                  )}
                                >
                                  {formatCollateralStatusLabel(selectedCampaignCollateral.status)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        </>
                      ) : (
                        <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
                          No collateral is selected for this campaign.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {campaignOverallBrief ? (
                  <div className="hidden mt-4 rounded-2xl border border-[#D9E6FF]/60 bg-[#F8FBFF]/70 px-4 py-4 dark:border-border dark:bg-slate-900/50">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Overall Brief
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {campaignOverallBrief}
                    </p>
                  </div>
                ) : null}

                <div className="hidden mt-4 overflow-hidden rounded-[16px] border border-[#D7E4FF] dark:border-border">
                  {collateralItems.map((collateral) => {
                    const effectiveDeadline =
                      campaignDeadlineMode === 'common'
                        ? overviewCampaignCommonDeadline ?? taskState.deadline
                        : collateral.deadline;
                    const isExpanded = expandedCollateralIds.has(collateral.id);
                    const sizeLabel = getCollateralSizeSummary(collateral as never);
                    const typeLabel = [collateral.collateralType, collateral.platform, collateral.usageType]
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <div
                        key={collateral.id}
                        className="border-b border-[#EEF2FF] last:border-0 dark:border-border"
                      >
                        {/* Compact row */}
                        <div
                          className={cn(
                            'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F5F8FF] dark:hover:bg-sidebar-accent/40',
                            isExpanded && 'bg-[#F8FAFF] dark:bg-sidebar-accent/30'
                          )}
                          onClick={() =>
                            setExpandedCollateralIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(collateral.id)) next.delete(collateral.id);
                              else next.add(collateral.id);
                              return next;
                            })
                          }
                        >
                          {/* Name + meta — flex-1 */}
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-[13px] font-semibold text-foreground">
                                {getCollateralDisplayName(collateral)}
                              </span>
                              <span className={cn('shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', getCollateralStatusPillClass(collateral.status))}>
                                {formatCollateralStatusLabel(collateral.status)}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                              {[typeLabel, sizeLabel].filter(Boolean).join(' · ')}
                            </p>
                          </div>

                          {/* Right-side pills */}
                          <div className="flex shrink-0 items-center gap-2">
                            {effectiveDeadline && (
                              <span className="hidden text-[11px] text-muted-foreground sm:block">
                                {format(effectiveDeadline, 'dd MMM yy')}
                              </span>
                            )}
                            {(collateral.referenceFiles?.length || 0) > 0 && (
                              <span className="hidden rounded-full border border-[#D7E4FF] bg-white px-2 py-0.5 text-[10px] text-muted-foreground dark:border-border dark:bg-sidebar/60 sm:inline-flex">
                                {collateral.referenceFiles?.length} refs
                              </span>
                            )}
                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={collateral.status}
                                onValueChange={(value) =>
                                  handleCollateralStatusChange(collateral.id, value as CollateralStatus)
                                }
                                disabled={!isCampaignRequest || !canUpdateCollateralStatus}
                              >
                                <SelectTrigger className="h-7 w-[136px] rounded-lg border-[#D7E4FF] bg-white px-2.5 text-[12px] shadow-none dark:border-border dark:bg-sidebar/60">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="submitted_for_review">Submitted for Review</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="rework">Rework</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform', isExpanded && 'rotate-180')} />
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="border-t border-[#EEF2FF] bg-white/60 px-4 py-4 dark:border-border dark:bg-sidebar/30">
                            <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                              {/* Brief */}
                              <div className="min-w-0 flex-1">
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Brief</p>
                                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/75">
                                  {collateral.brief || <span className="italic text-muted-foreground/50">No brief added.</span>}
                                </p>
                              </div>

                              {/* Specs — compact key/value list */}
                              <div className="shrink-0 space-y-2.5 sm:w-48">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Size</span>
                                  <span className="text-right text-xs font-medium text-foreground/80">{sizeLabel || '—'}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Orientation</span>
                                  <span className="text-right text-xs font-medium capitalize text-foreground/80">{collateral.orientation || 'Custom'}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Priority</span>
                                  <span className="text-right text-xs font-medium capitalize text-foreground/80">{String(collateral.priority || 'normal').replace(/_/g, ' ')}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Deadline</span>
                                  <span className="text-right text-xs font-medium text-foreground/80">
                                    {effectiveDeadline ? format(effectiveDeadline, 'EEE, dd MMM yyyy') : 'Not set'}
                                  </span>
                                </div>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">References</span>
                                  <span className="text-right text-xs font-medium text-foreground/80">{collateral.referenceFiles?.length || 0} file{(collateral.referenceFiles?.length || 0) !== 1 ? 's' : ''}</span>
                                </div>
                                {collateral.assignedToName ? (
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Owner</span>
                                    <span className="text-right text-xs font-medium text-foreground/80">{collateral.assignedToName}</span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {canEditTask && !isCampaignRequest && (
              <div className={`${glassPanelClass} p-4 animate-slide-up`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Edit Task</h2>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditingTask((prev) => !prev)}
                          disabled={approvalLockedForStaff}
                        >
                          {isEditingTask ? 'Close' : 'Edit'}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="end"
                      sideOffset={8}
                      className="max-w-[420px] text-xs leading-relaxed dark:text-white shadow-none dark:shadow-none"
                    >
                      {editTaskActionTooltip}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mb-2.5 border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80">
                  {editTaskGovernanceVariant === 'minimal' ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 sm:pr-4">
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2.5">
                          <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Design Governance
                          </p>
                          <span className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600 sm:inline-block" />
                          <p className="truncate text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                            {DESIGN_GOVERNANCE_EDIT_TASK_MINIMAL}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsGovernanceExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                      >
                        Policy
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            isGovernanceExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 sm:pr-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Design Governance
                        </p>
                        <div className="mt-1 space-y-0.5">
                          <p className="text-[12.5px] font-medium leading-5 text-slate-700 dark:text-slate-200">
                            {DESIGN_GOVERNANCE_EDIT_TASK_PREMIUM_LINES[0]}
                          </p>
                          <p className="text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                            {DESIGN_GOVERNANCE_EDIT_TASK_PREMIUM_LINES[1]}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsGovernanceExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                      >
                        Policy
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            isGovernanceExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                    </div>
                  )}
                  {isGovernanceExpanded && (
                    <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-800/80">
                      <p className="max-w-3xl text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">
                        {DESIGN_GOVERNANCE_NOTICE_POLICY}
                      </p>
                    </div>
                  )}
                </div>
                {isEditingTask ? (
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Description
                      </p>
                      <Textarea
                        value={editedDescription}
                        onChange={(event) => setEditedDescription(event.target.value)}
                        rows={4}
                        className="mt-1 select-text text-[14px] leading-7"
                        disabled={approvalLockedForStaff}
                      />
                    </div>
                    {user?.role === 'staff' && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Staff message to designer
                        </p>
                        <Textarea
                          value={staffNote}
                          onChange={(event) => setStaffNote(event.target.value)}
                          rows={3}
                          className="mt-1.5 select-text"
                          placeholder="Describe the change request for the designer and treasurer review."
                          disabled={approvalLockedForStaff}
                        />
                      </div>
                    )}
                    {user?.role !== 'staff' && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Deadline
                        </p>
                        <Input
                          type="date"
                          value={editedDeadline}
                          onChange={(event) => setEditedDeadline(event.target.value)}
                          className="mt-2 max-w-xs select-text"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Attachments (optional)
                      </p>
                      <div
                        className={cn(
                          'mt-2 rounded-lg border border-dashed px-3 py-3 transition-colors',
                          isEditAttachmentDragging
                            ? 'border-primary/75 bg-primary/8'
                            : 'border-[#BFD1F4] bg-[#F6FAFF]/75 dark:border-slate-600/85 dark:bg-slate-900/45',
                          isUploadingAttachment && 'opacity-70'
                        )}
                        onDragOver={handleEditAttachmentDragOver}
                        onDragLeave={handleEditAttachmentDragLeave}
                        onDrop={handleEditAttachmentDrop}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          multiple
                          onChange={handleEditAttachmentUpload}
                          className="hidden"
                          id="edit-attachment-upload"
                          disabled={isUploadingAttachment}
                        />
                        <label
                          htmlFor="edit-attachment-upload"
                          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground"
                        >
                          {isUploadingAttachment
                            ? `Uploading... ${attachmentUploadProgress ?? 0}%`
                            : 'Select files'}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          Add associated files if needed, or drag and drop here.
                        </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {user?.role === 'staff' && (
                        <span className="text-sm font-semibold text-primary/80">{staffChangeLabel}</span>
                      )}
                      {!canSendForApproval && (
                        <Button
                          onClick={handleSaveUpdates}
                          disabled={
                            approvalLockedForStaff ||
                            (user?.role === 'staff' && staffChangeLimitReached) ||
                            isUploadingAttachment
                          }
                        >
                          {isUploadingAttachment && staffChangeCount < 3 ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {`Saving... ${attachmentUploadProgress ?? 0}%`}
                            </span>
                          ) : (
                           `${staffChangeCount < 2 ? 'save updates':'send to treasurer'}`
                          )}
                        </Button>
                      )}
                      {canSendForApproval && (
                        <Button
                          variant="outline"
                          onClick={handleRequestApproval}
                          disabled={
                            isUploadingAttachment ||
                            approvalLockedForStaff ||
                            approvalRequestInFlight
                          }
                        >
                          {approvalRequestInFlight ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending...
                            </span>
                          ) : isUploadingAttachment ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {`Sending... ${attachmentUploadProgress ?? 0}%`}
                            </span>
                          ) : (
                            'Send to Treasurer'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="whitespace-pre-line text-[14px] leading-7 text-[#5B6E8E] dark:text-slate-300">
                      {taskState.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {canAcceptTask && (
              <div className={`${glassPanelClass} p-5 animate-slide-up`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Task Acceptance</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Confirm this assignment before starting task updates.
                    </p>
                  </div>
                  <Button onClick={handleAcceptTask} disabled={isAcceptingTask}>
                    {isAcceptingTask ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Accepting...
                      </span>
                    ) : (
                      'Accept Task'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Status Update (Designer/Admin only) */}
            {canDesignerActions && !isCampaignRequest && normalizedTaskStatus !== 'completed' && (
              <div className={`${glassPanelClass} p-5 animate-slide-up`}>
                <h2 className="font-semibold text-foreground mb-3">Update Status</h2>
                <div className="flex gap-3">
                  <Select
                    value={newStatus}
                    onValueChange={(v) => setNewStatus(v as TaskStatus)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="clarification_required">
                        Clarification Required
                      </SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => newStatus && handleStatusChange(newStatus)}
                    disabled={!newStatus || newStatus === currentStatusSelection}
                  >
                    Update
                  </Button>
                </div>
              </div>
            )}

            {/* <div className="bg-card border border-border rounded-xl p-6 animate-slide-up space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Deadline Request</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff must request deadlines at least 3 working days from today. Designer approval required.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Input
                    type="date"
                    value={deadlineRequest}
                    onChange={(event) => setDeadlineRequest(event.target.value)}
                    className="h-9 max-w-xs"
                    min={format(minDeadlineDate, 'yyyy-MM-dd')}
                    disabled={!canEditTask || approvalLockedForStaff || staffChangeLimitReached}
                  />
                  <Button
                    onClick={handleRequestDeadline}
                    disabled={
                      !canEditTask || !deadlineRequest || approvalLockedForStaff || staffChangeLimitReached
                    }
                  >
                    Request Deadline
                  </Button>
                  {taskState.deadlineApprovalStatus === 'pending' && canApproveDeadline && (
                    <>
                      <Button onClick={() => handleApproveDeadline('approved')}>Approve Deadline</Button>
                      <Button variant="destructive" onClick={() => handleApproveDeadline('rejected')}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
                {taskState.deadlineApprovalStatus && (
                  <Badge variant="secondary" className="mt-3">
                    Deadline {taskState.deadlineApprovalStatus}
                  </Badge>
                )}
              </div>
            </div> */}

            {/* 60/40 split: Job+Chat (60%) + Progress (40%) */}
            <div className="grid gap-5 items-start xl:grid-cols-[3fr_2fr]">
            <div className="min-w-0 space-y-5">
            {shouldShowFileManagementPanel ? (
            <div className={`${glassPanelClass} p-5 animate-slide-up`}>
              {canViewWorkingFiles && (workingFiles.length > 0 || canManageWorkingFiles) && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-[#1B3260] dark:text-slate-100">
                        Designer Working Files
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Upload PSD, AI, ZIP, or source files for designer handoff. These are saved
                        inside the task Drive folder under `PSD Working Files`.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWorkingFileList((prev) => !prev)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#D9E6FF] bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-[#F3F7FF] dark:border-border dark:bg-card/85 dark:hover:bg-muted/80"
                      aria-expanded={showWorkingFileList}
                      aria-label="Toggle designer working files list"
                    >
                      <span>{workingFiles.length}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          showWorkingFileList ? 'rotate-180' : ''
                        )}
                      />
                    </button>
                  </div>
                  {showWorkingFileList && (
                    <>
                      {workingFiles.length > 0 ? (
                        <div className={cn('min-w-0', workingFiles.length > 8 && fileListShellClass)}>
                          <div className={cn('min-w-0 space-y-1.5', workingFiles.length > 8 && fileListScrollClass)}>
                          {workingFiles.map((file, index) => {
                            const isCopied = copiedFileKey === getFileCopyFeedbackKey(file);
                            const isPreviewable = canPreviewFile(file);
                            return (
                            <div
                              key={getFileListItemKey(file, index)}
                              className={cn(
                                fileRowClass,
                                'min-w-0 items-start',
                                isPreviewable &&
                                  'cursor-pointer transition-colors hover:bg-white/55 dark:hover:bg-slate-800/85'
                              )}
                              onClick={(event) => handleFileRowPreviewClick(event, file)}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
                                {renderFilePreview(file)}
                                <div className="min-w-0 flex-1">
                                  <span className="block pr-2 text-[13px] font-medium leading-5 text-foreground line-clamp-2 [overflow-wrap:anywhere]">
                                    {toTitleCaseFileName(file.name)}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                    {formatFileSize(file.size) || 'Working file'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {canManageWorkingFiles && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className={fileActionButtonClass}
                                    onClick={() => handleRemoveFile(file.id, file.name, file.type)}
                                  >
                                    <Trash2 className="h-4 w-4 text-status-urgent" />
                                  </Button>
                                )}
                                {isPreviewable && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className={fileActionButtonClass}
                                    onClick={() => openFilePreviewDialog(file)}
                                    title="View"
                                    aria-label="View file"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={!getFileShareUrl(file)}
                                  data-success={isCopied}
                                  className={cn(
                                    fileActionButtonClass,
                                    isCopied &&
                                      'border-primary/50 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/20 dark:text-primary'
                                  )}
                                  onClick={() => void handleCopyFileLink(file)}
                                  title={isCopied ? 'Copied' : 'Copy link'}
                                  aria-label={isCopied ? 'File link copied' : 'Copy file link'}
                                >
                                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                                {(() => {
                                  const fileLinkUrl = getFileActionUrl(file);
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={!fileLinkUrl || fileLinkUrl === '#'}
                                      className={fileActionButtonClass}
                                      onClick={() => handleFileAction(file)}
                                    >
                                      {shouldUseLinkIcon(file) ? (
                                        <ExternalLink className="h-4 w-4" />
                                      ) : (
                                        <Download className="h-4 w-4" />
                                      )}
                                    </Button>
                                  );
                                })()}
                              </div>
                            </div>
                          )})}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#D9E6FF]/80 bg-[#F8FBFF]/75 px-4 py-3 text-sm text-muted-foreground dark:border-border/70 dark:bg-card/70">
                          No working files uploaded yet.
                        </div>
                      )}
                    </>
                  )}

                  {canManageWorkingFiles && (
                    <div
                      className={cn(
                        'mt-4 rounded-2xl border border-dashed border-[#D9E6FF] bg-white/85 p-4 transition-colors dark:border-border dark:bg-card/85',
                        isWorkingUploadDragging &&
                          'border-primary/45 bg-[#F4F8FF] ring-2 ring-primary/20 dark:bg-card'
                      )}
                      onDragOver={handleWorkingUploadDragOver}
                      onDragLeave={handleWorkingUploadDragLeave}
                      onDrop={handleWorkingUploadDrop}
                    >
                      <input
                        ref={workingUploadInputRef}
                        type="file"
                        multiple
                        onChange={handleWorkingFileUpload}
                        className="hidden"
                        disabled={isUploadingWorking}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Upload PSD / source files
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            DesignLead source files can be shared here for another designer to continue work. Max 2.5 GB per file.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={openWorkingFilePicker}
                          disabled={isUploadingWorking}
                          className="rounded-full px-5"
                        >
                          {isUploadingWorking ? 'Uploading...' : 'Select files'}
                        </Button>
                      </div>
                      {workingUploadItems.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-[#E1E9FF] pt-4 dark:border-border">
                          {workingUploadItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-[#E1E9FF] bg-white/95 px-3 py-3 dark:border-border dark:bg-card/95"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="line-clamp-2 pr-2 text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]">
                                    {item.name}
                                  </p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {item.status === 'done' ? (
                                      `${formatTransferAmount(item.totalBytes)} uploaded successfully`
                                    ) : (
                                      <>
                                        {formatTransferAmount(item.loadedBytes)} / {formatTransferAmount(item.totalBytes)}
                                        {' '}({item.progress.toFixed(item.progress >= 10 ? 0 : 1)}%)
                                        {item.status === 'uploading' && (
                                          <> • {formatTransferSpeed(item.speedBytesPerSecond)}</>
                                        )}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right text-[11px] font-semibold">
                                  {item.status === 'preparing' && (
                                    <span className="text-muted-foreground">Preparing...</span>
                                  )}
                                  {item.status === 'uploading' && (
                                    <span className="text-primary">Uploading</span>
                                  )}
                                  {item.status === 'done' && (
                                    <span className="text-emerald-600 dark:text-emerald-400">Done</span>
                                  )}
                                  {item.status === 'error' && (
                                    <span className="text-red-500">Failed</span>
                                  )}
                                </div>
                              </div>
                              {item.status !== 'done' && (
                                <div className="mt-2.5">
                                  <Progress
                                    value={Math.max(0, Math.min(100, item.progress))}
                                    className="h-1.5 rounded-full bg-[#E7EEFF] dark:bg-[#1A2748]"
                                  />
                                </div>
                              )}
                              {item.error && (
                                <p className="mt-2 text-[11px] text-red-500 dark:text-red-300">
                                  {item.error}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {shouldShowStaffFinalReviewState && (
                renderFinalFileStatusCard('staff')
              )}

              {shouldShowJuniorFinalReviewState && (
                renderFinalFileStatusCard('junior')
              )}

              {canMainDesignerReviewFinalDeliverables && (
                <div className="mb-4 rounded-xl border border-[#D9E6FF]/75 bg-[#F7FBFF]/88 px-4 py-3.5 dark:border-border/70 dark:bg-card/80">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Final File Status
                    </p>
                    <span className="inline-flex items-center rounded-full border border-[#D3E1FF] bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#35508A] dark:border-border dark:bg-muted/70 dark:text-slate-200">
                      Pending Your Review
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-[#1E2A5A] dark:text-slate-200">
                    Junior designer has submitted the final files. Review the files below and approve or request updates.
                  </p>
                </div>
              )}

              {/* Output Files */}
              {sortedFinalDeliverableVersions.length > 0 && (
                <div className="mb-6 deliverables-highlight">
                  {/* ── Panel header ── */}
                  <div className="overflow-hidden rounded-xl border border-[#D9E6FF] bg-white dark:border-border dark:bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAF0FA] px-4 py-3 dark:border-border">
                      {/* Left: title + file count */}
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-completed" />
                        <span className="text-[13px] font-semibold text-[#1B3260] dark:text-slate-100">
                          Final Deliverables
                        </span>
                        {finalDeliverableFiles.length > 0 && (
                          <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[10.5px] font-medium text-[#4B6BAE] dark:bg-muted dark:text-slate-400">
                            {finalDeliverableFiles.length} {finalDeliverableFiles.length === 1 ? 'file' : 'files'}
                          </span>
                        )}
                      </div>

                      {/* Right: version selector + bulk actions + collapse */}
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={selectedFinalVersionId || activeFinalVersion?.id || ''}
                          onValueChange={setSelectedFinalVersionId}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectTrigger
                                className="h-7 w-[170px] rounded-lg border-[#D9E6FF] bg-[#F8FBFF] text-xs dark:border-border dark:bg-muted"
                                aria-label="Final deliverable version selector"
                              >
                                <SelectValue placeholder="Select version" />
                              </SelectTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" sideOffset={8} className="max-w-[320px] text-xs leading-relaxed">
                              {finalVersionTooltip}
                            </TooltipContent>
                          </Tooltip>
                          <SelectContent>
                            {sortedFinalDeliverableVersions.map((version, index) => (
                              <SelectItem key={`${version.id}-${index}`} value={version.id}>
                                {getFinalVersionLabel(version)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDownloadAll()}
                          disabled={isDownloadingAll || finalDeliverableFiles.filter(f => !isLinkOnlyFile(toOutputFile(f, 0))).length === 0}
                          className="h-7 gap-1.5 rounded-lg border-[#D0DCFF] px-2.5 text-[11.5px] text-[#3D5A9E] hover:bg-[#EEF2FF] dark:border-border dark:text-slate-300 dark:hover:bg-muted/60"
                        >
                          {isDownloadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {isDownloadingAll ? 'Downloading…' : 'Download All'}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDownloadZip()}
                          disabled={
                            isZipDownloadInProgress ||
                            finalDeliverableFiles.filter(f => !isLinkOnlyFile(toOutputFile(f, 0))).length === 0
                          }
                          className="h-7 gap-1.5 rounded-lg border-[#D0DCFF] px-2.5 text-[11.5px] text-[#3D5A9E] hover:bg-[#EEF2FF] dark:border-border dark:text-slate-300 dark:hover:bg-muted/60"
                        >
                          {isAllZipDownloadInProgress ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                          {isAllZipDownloadInProgress ? zipButtonLabel : 'ZIP'}
                        </Button>

                        <button
                          type="button"
                          onClick={() => setShowFinalDeliverableList((prev) => !prev)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#D9E6FF] bg-transparent text-muted-foreground transition hover:bg-[#F3F7FF] dark:border-border dark:hover:bg-muted/80"
                          aria-expanded={showFinalDeliverableList}
                          aria-label="Toggle final deliverables list"
                        >
                          <ChevronDown className={cn('h-4 w-4 transition-transform', showFinalDeliverableList ? 'rotate-180' : '')} />
                        </button>
                      </div>
                    </div>

                    {showFinalDeliverableList && (
                      <>
                        {zipDownloadState && (
                          <div className="border-b border-[#EAF0FA] bg-[#F8FBFF]/70 px-4 py-2.5 dark:border-border dark:bg-muted/20">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4B6BAE] dark:text-slate-300" />
                                <span className="truncate text-[11.5px] font-medium text-[#3D5A9E] dark:text-slate-300">
                                  {zipDownloadState.mode === 'selected' ? 'ZIP Selected' : 'ZIP Download'}: {zipPhaseLabel}
                                </span>
                              </div>
                              {zipDownloadState.percent !== null && (
                                <span className="shrink-0 text-[11px] font-semibold text-[#4B6BAE] dark:text-slate-300">
                                  {zipDownloadState.percent}%
                                </span>
                              )}
                            </div>
                            {zipDownloadState.percent !== null && (
                              <Progress
                                value={zipDownloadState.percent}
                                className="mt-2 h-1.5 rounded-full bg-[#E7EEFF] dark:bg-[#1A2748]"
                              />
                            )}
                          </div>
                        )}

                        {/* Version note */}
                        {activeFinalVersionNote && (
                          <div className="border-b border-[#EAF0FA] bg-[#F8FBFF]/60 px-4 py-2.5 dark:border-border dark:bg-muted/20">
                            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Version note </span>
                            <span className="text-[12.5px] text-foreground/90 dark:text-slate-200">{activeFinalVersionNote}</span>
                          </div>
                        )}

                        {/* Selection toolbar — visible when files are checked */}
                        {selectedDeliverableIds.size > 0 && (
                          <div className="flex items-center justify-between border-b border-[#E0EAFF] bg-primary/5 px-4 py-2 dark:border-border dark:bg-primary/10">
                            <span className="text-[12px] font-medium text-primary dark:text-slate-300">
                              {selectedDeliverableIds.size} selected
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const files = (activeFinalVersion?.files ?? [])
                                    .map((f, i) => toOutputFile(f, i))
                                    .filter((f) => selectedDeliverableIds.has(f.id) && !isLinkOnlyFile(f));
                                  void (async () => {
                                    for (let i = 0; i < files.length; i++) {
                                      if (i > 0) await new Promise<void>((res) => setTimeout(res, 650));
                                      await handleFileAction(files[i]).catch(() => {});
                                    }
                                  })();
                                }}
                                className="h-7 gap-1.5 rounded-lg border-[#D0DCFF] px-2.5 text-[11.5px] text-[#3D5A9E] hover:bg-white dark:border-border dark:text-slate-300"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download Selected
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleDownloadZip(Array.from(selectedDeliverableIds))}
                                disabled={isZipDownloadInProgress}
                                className="h-7 gap-1.5 rounded-lg border-[#D0DCFF] px-2.5 text-[11.5px] text-[#3D5A9E] hover:bg-white dark:border-border dark:text-slate-300"
                              >
                                {isSelectedZipDownloadInProgress ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Archive className="h-3.5 w-3.5" />
                                )}
                                {isSelectedZipDownloadInProgress ? zipButtonLabel : 'ZIP Selected'}
                              </Button>
                              <button
                                type="button"
                                onClick={() => setSelectedDeliverableIds(new Set())}
                                className="ml-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Column header row with Select All */}
                        {finalDeliverableFiles.length > 0 && (
                          <div className="flex items-center gap-3 border-b border-[#EAF0FA] px-4 py-2 dark:border-border">
                            <Checkbox
                              id="select-all-deliverables"
                              checked={
                                finalDeliverableFiles.length > 0 &&
                                finalDeliverableFiles
                                  .map((f, i) => toOutputFile(f, i))
                                  .filter((f) => !isLinkOnlyFile(f))
                                  .every((f) => selectedDeliverableIds.has(f.id))
                              }
                              onCheckedChange={(checked) => {
                                const downloadable = finalDeliverableFiles
                                  .map((f, i) => toOutputFile(f, i))
                                  .filter((f) => !isLinkOnlyFile(f));
                                setSelectedDeliverableIds(
                                  checked ? new Set(downloadable.map((f) => f.id)) : new Set()
                                );
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              File
                            </span>
                            <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Actions
                            </span>
                          </div>
                        )}

                        {/* File rows */}
                        <div className={cn(finalDeliverableFiles.length > 8 && 'max-h-[30rem] overflow-y-auto overflow-x-hidden scrollbar-thin')}>
                          <div className="divide-y divide-[#EEF2FB] dark:divide-border">
                          {finalDeliverableFiles.map((file, index) => {
                            const displayFile = toOutputFile(file, index);
                            const isLinkCard = isLinkOnlyFile(displayFile) && isGoogleDriveLinkFile(displayFile);
                            const isSelected = selectedDeliverableIds.has(displayFile.id);
                            const displayName = isLinkCard
                              ? sanitizeLinkDisplayName(displayFile.name, displayFile.url || '')
                              : toTitleCaseFileName(displayFile.name);
                            const isCopied = copiedFileKey === getFileCopyFeedbackKey(displayFile);
                            const annotationKey = getReviewAnnotationFileKey(displayFile);
                            const fileAnnotation = annotationKey
                              ? draftReviewAnnotationsByFile[annotationKey]
                              : undefined;
                            const fileHasReviewFeedback = hasReviewAnnotationContent(fileAnnotation);
                            const fileCommentCount = Array.isArray(fileAnnotation?.comments)
                              ? fileAnnotation.comments.length
                              : 0;
                            const fileShapeCount = Array.isArray(fileAnnotation?.shapes)
                              ? fileAnnotation.shapes.length
                              : Array.isArray(fileAnnotation?.strokes)
                                ? fileAnnotation.strokes.length
                                : 0;
                            const canAnnotateFile =
                              canMainDesignerReviewFinalDeliverables &&
                              isAnnotatableImageOutputFile(displayFile);
                            const canViewFeedbackFile =
                              fileHasReviewFeedback &&
                              (canAnnotateFile || shouldAllowViewingRejectedAnnotations);
                            const canReplaceThisFile = canReplaceRejectedFinalFile && !isLinkCard;
                            const isPreviewable = canPreviewFile(displayFile);
                            return (
                              <div
                                key={getFileListItemKey(displayFile, index)}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-2.5 transition-colors',
                                  isSelected ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-[#F8FBFF] dark:hover:bg-muted/30',
                                  isPreviewable && 'cursor-pointer'
                                )}
                                onClick={(event) => handleFileRowPreviewClick(event, displayFile)}
                              >
                                {/* Checkbox */}
                                {!isLinkCard && (
                                  <Checkbox
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={(checked) => {
                                      setSelectedDeliverableIds((prev) => {
                                        const next = new Set(prev);
                                        if (checked) next.add(displayFile.id);
                                        else next.delete(displayFile.id);
                                        return next;
                                      });
                                    }}
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                )}
                                {isLinkCard && <span className="h-3.5 w-3.5 shrink-0" />}

                                {/* File icon / preview thumbnail */}
                                {isLinkCard ? (
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#CFDBF8]/65 bg-[#EEF4FF]/90 dark:border-slate-700/70 dark:bg-slate-800/70">
                                    <Folder className="h-4 w-4 text-[#4A5EA1] dark:text-slate-300" />
                                  </div>
                                ) : (
                                  <div className="shrink-0">{renderFilePreview(displayFile)}</div>
                                )}

                                {/* Name + meta */}
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-[12.5px] font-medium text-foreground dark:text-slate-200">
                                    {displayName}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                    {isLinkCard
                                      ? getLinkSubLabel(displayFile.url || '')
                                      : formatFileSize(displayFile.size) || ''}
                                  </span>
                                  {fileHasReviewFeedback && (
                                    <span className="mt-0.5 block text-[11px] text-[#475FB9] dark:text-[#B8C7FF]">
                                      {fileCommentCount} comment(s), {fileShapeCount} mark(s)
                                    </span>
                                  )}
                                </div>

                                {/* Row actions */}
                                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  {canAnnotateFile && (
                                    <Button variant="ghost" size="icon-sm" className={fileGlassIconButtonClass}
                                      aria-label={fileHasReviewFeedback ? 'Edit feedback' : 'Annotate file'}
                                      title={fileHasReviewFeedback ? 'Edit Feedback' : 'Annotate'}
                                      onClick={() => openReviewAnnotationDialog(displayFile)}
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canViewFeedbackFile && !canAnnotateFile && (
                                    <Button variant="ghost" size="icon-sm" className={fileGlassIconButtonClass}
                                      aria-label="View feedback" title="View Feedback"
                                      onClick={() => openReviewAnnotationDialog(displayFile, true)}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canReplaceThisFile && (
                                    <Button variant="ghost" size="icon-sm" className={fileGlassIconButtonClass}
                                      disabled={isUploadingFinal} aria-label="Replace file" title="Replace"
                                      onClick={() => triggerReplaceFinalFile(displayFile, index)}
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canRemoveFiles && (
                                    <Button variant="ghost" size="icon-sm"
                                      disabled={approvalLockedForStaff || staffChangeLimitReached}
                                      className={fileActionButtonClass}
                                      onClick={() => handleRemoveFile(displayFile.id, displayFile.name, displayFile.type)}
                                    >
                                      <Trash2 className="h-4 w-4 text-status-urgent" />
                                    </Button>
                                  )}
                                  {isPreviewable && (
                                    <Button variant="ghost" size="icon-sm" className={fileActionButtonClass}
                                      onClick={() => openFilePreviewDialog(displayFile)}
                                      title="Preview" aria-label="Preview file"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost" size="icon-sm"
                                    disabled={!getFileShareUrl(displayFile)}
                                    data-success={isCopied}
                                    className={cn(fileActionButtonClass, isCopied && 'border-primary/50 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/20 dark:text-primary')}
                                    onClick={() => void handleCopyFileLink(displayFile)}
                                    title={isCopied ? 'Copied' : 'Copy link'}
                                    aria-label={isCopied ? 'File link copied' : 'Copy file link'}
                                  >
                                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                  </Button>
                                  {(() => {
                                    const fileLinkUrl = getFileActionUrl(displayFile);
                                    return (
                                      <Button variant="ghost" size="icon-sm"
                                        disabled={!fileLinkUrl || fileLinkUrl === '#'}
                                        className={fileActionButtonClass}
                                        onClick={() => handleFileAction(displayFile)}
                                        title={shouldUseLinkIcon(displayFile) ? 'Open link' : 'Download'}
                                        aria-label={shouldUseLinkIcon(displayFile) ? 'Open link' : 'Download file'}
                                      >
                                        {shouldUseLinkIcon(displayFile) ? (
                                          <ExternalLink className="h-4 w-4" />
                                        ) : (
                                          <Download className="h-4 w-4" />
                                        )}
                                      </Button>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>{/* end panel card */}

                  {(() => {
                    const reviewStatusLabel =
                      finalDeliverableReviewStatus === 'pending'
                        ? 'Pending Approval'
                        : finalDeliverableReviewStatus === 'rejected'
                          ? 'Update Needed'
                          : finalDeliverableReviewStatus === 'approved'
                            ? 'Approved'
                            : 'Not Submitted';
                    const reviewStatusPillClass =
                      finalDeliverableReviewStatus === 'approved'
                        ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : finalDeliverableReviewStatus === 'rejected'
                          ? 'border-[#C9D7FF] bg-[#EEF4FF] text-[#2F4E96] dark:border-[#4D70B4]/70 dark:bg-[#1E3A73]/45 dark:text-[#C7D8FF]'
                          : finalDeliverableReviewStatus === 'pending'
                            ? 'border-[#C9D7FF] bg-[#EEF4FF] text-[#2F4E96] dark:border-[#4D70B4]/70 dark:bg-[#1E3A73]/45 dark:text-[#C7D8FF]'
                            : 'border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-600/40 dark:bg-slate-900/40 dark:text-slate-300';
                    return (
                      <div className="mt-3 rounded-xl border border-[#D9E6FF]/65 bg-gradient-to-r from-[#F8FBFF]/85 via-[#F3F8FF]/75 to-[#ECF3FF]/85 px-3 py-2.5 supports-[backdrop-filter]:bg-[#F4F8FF]/65 backdrop-blur-md dark:border-slate-700/60 dark:bg-none dark:bg-slate-900/60">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Review Status
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                              reviewStatusPillClass
                            )}
                          >
                            {reviewStatusLabel}
                          </span>
                          {finalDeliverableReviewedBy && finalDeliverableReviewStatus !== 'pending' && (
                            <span className="text-xs text-muted-foreground">
                              Reviewed by{' '}
                              <span className="font-medium text-foreground/90 dark:text-slate-100">
                                {finalDeliverableReviewedBy}
                              </span>
                            </span>
                          )}
                        </div>
                        {finalDeliverableReviewNote && (
                          <div className="mt-2 rounded-md border border-[#D9E6FF]/70 bg-white/80 px-2.5 py-2 text-xs leading-5 text-[#4E5F84] dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
                            {finalDeliverableReviewNote}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {canMainDesignerReviewFinalDeliverables && (
                    <div className="mt-4 rounded-xl border border-[#D9E6FF]/75 bg-[#F7FBFF]/88 px-4 py-3.5 dark:border-border/70 dark:bg-card/80">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Design Lead Review
                        </p>
                        {draftReviewAnnotationList.length > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            Annotated files: {draftReviewAnnotationList.length}
                          </span>
                        )}
                      </div>
                      <Textarea
                        value={finalReviewNote}
                        onChange={(event) => setFinalReviewNote(event.target.value)}
                        rows={2}
                        placeholder="Add review note (or use image annotations) for Update Needed."
                        className="mt-2.5 bg-white/90 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        <Button
                          onClick={() => handleFinalDeliverableReviewDecision('approved')}
                          disabled={finalReviewDecisionInFlight !== null}
                          className="h-9 gap-2 rounded-full px-4"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {finalReviewDecisionInFlight === 'approved' ? 'Approving…' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleFinalDeliverableReviewDecision('rejected')}
                          disabled={finalReviewDecisionInFlight !== null}
                          className="h-9 rounded-full px-4 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-900/70"
                        >
                          {finalReviewDecisionInFlight === 'rejected' ? 'Marking…' : 'Update Needed'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canEditTask && (
                !hasFinalDeliverables && (
                  <div className="rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm font-medium text-foreground mb-3">Add Attachment</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={addAttachmentInputRef}
                        type="file"
                        multiple
                        onChange={handleAddFileUpload}
                        className="hidden"
                        disabled={isUploadingAttachment}
                      />
                      <Input
                        placeholder="file_name.pdf"
                        value={newFileName}
                        onChange={(event) => setNewFileName(event.target.value)}
                        className="flex-1 min-w-[180px] select-text"
                        disabled={isUploadingAttachment}
                      />
                      <Select
                        value={newFileCategory}
                        onValueChange={(v) => {
                          const nextCategory = v as 'reference' | 'others';
                          setNewFileCategory(nextCategory);
                          if (nextCategory !== 'others') {
                            setNewFileDetails('');
                          }
                        }}
                        disabled={isUploadingAttachment}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reference">Reference</SelectItem>
                          <SelectItem value="others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                      {newFileCategory === 'others' && (
                        <Input
                          placeholder="Type file details"
                          value={newFileDetails}
                          onChange={(event) => setNewFileDetails(event.target.value)}
                          className="min-w-[180px] select-text"
                          disabled={isUploadingAttachment}
                        />
                      )}
                      <Button
                        onClick={handleAddFile}
                        disabled={isUploadingAttachment}
                      >
                        {isUploadingAttachment
                          ? `Uploading... ${attachmentUploadProgress ?? 0}%`
                          : 'Add File'}
                      </Button>
                    </div>
                  </div>
                )
              )}

              {/* Final Delivery Panel (Designer only) */}
              {canFinalizeTaskActions && (
                <>
                  {/* Hidden file inputs */}
                  <input
                    type="file"
                    multiple
                    onChange={handleFinalUpload}
                    ref={finalUploadInputRef}
                    className="hidden"
                    id="final-file-upload"
                    disabled={isUploadingFinal}
                  />
                  <input
                    type="file"
                    onChange={handleReplaceFinalFileUpload}
                    ref={replaceFinalFileInputRef}
                    className="hidden"
                    id="replace-final-file-upload"
                    disabled={isUploadingFinal}
                  />

                  <div
                    className={cn(
                      'mt-6 overflow-hidden rounded-xl border border-[#D9E6FF] bg-white dark:border-border dark:bg-card',
                      isFinalUploadDragging && 'border-primary/40 ring-2 ring-primary/10'
                    )}
                    onDragOver={handleFinalUploadDragOver}
                    onDragLeave={handleFinalUploadDragLeave}
                    onDrop={handleFinalUploadDrop}
                  >
                    {/* Panel header */}
                    <div className="border-b border-[#E8EEFB] px-4 py-3.5 dark:border-border">
                      <p className="text-[13px] font-semibold text-[#1B3260] dark:text-slate-100">
                        Final Delivery
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {finalDeliverableReviewStatus === 'rejected'
                          ? 'Revision requested — upload updated files and resubmit.'
                          : 'Attach files or a Drive link, add a version note, then submit for review.'}
                      </p>
                    </div>

                    {/* Section: Files */}
                    <div className="px-4 pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Files
                        </p>
                        <button
                          type="button"
                          onClick={openFinalFilePicker}
                          disabled={isUploadingFinal}
                          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#D0DCFF] bg-[#F5F8FF] px-3 text-[11.5px] font-medium text-[#3D5A9E] transition hover:bg-[#EBF1FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-muted dark:text-slate-300 dark:hover:bg-muted/80"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {isFinalUploadDragging ? 'Drop here' : 'Add files'}
                        </button>
                      </div>

                      {finalUploadItems.length > 0 ? (
                        <div className="relative mt-3 overflow-hidden rounded-[22px] border border-[#CBD9FF]/60 bg-gradient-to-br from-white/92 via-[#F8FBFF]/84 to-[#E8F1FF]/86 supports-[backdrop-filter]:from-white/72 supports-[backdrop-filter]:via-[#F8FBFF]/62 supports-[backdrop-filter]:to-[#E8F1FF]/64 backdrop-blur-2xl shadow-none ring-1 ring-white/60 dark:border-border dark:bg-card/78 dark:bg-none dark:ring-0">
                          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/70 dark:bg-white/5" />
                          <div className="pointer-events-none absolute -left-8 top-1 h-24 w-24 rounded-full bg-white/55 blur-3xl dark:hidden" />
                          <div className="pointer-events-none absolute -right-6 bottom-[-24px] h-28 w-28 rounded-full bg-[#DDE9FF]/80 blur-3xl dark:hidden" />

                          <div className="relative px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">{finalUploadLabel}</p>
                                <p
                                  className={cn(
                                    'mt-1 text-xs',
                                    hasFinalUploadQueueIssues
                                      ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {finalUploadStatusText}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {hasPendingFinalUploads ? (
                                  <button
                                    type="button"
                                    onClick={handleCancelFinalUpload}
                                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-primary/80 hover:text-primary dark:text-slate-300 dark:hover:text-slate-100"
                                  >
                                    Cancel
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => setShowFinalUploadList((prev) => !prev)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-[#D9E6FF] hover:bg-white dark:hover:border-border dark:hover:bg-muted"
                                  aria-label={showFinalUploadList ? 'Hide final uploads' : 'Show final uploads'}
                                >
                                  <ChevronDown
                                    className={cn(
                                      'h-4 w-4 transition-transform',
                                      showFinalUploadList ? 'rotate-180' : ''
                                    )}
                                  />
                                </button>

                                {!hasPendingFinalUploads ? (
                                  <button
                                    type="button"
                                    onClick={clearFinalUploadItems}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-[#D9E6FF] hover:bg-white dark:hover:border-border dark:hover:bg-muted"
                                    aria-label="Clear final uploads"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {hasPendingFinalUploads ? (
                              <div className="mt-3 rounded-2xl border border-white/50 bg-white/45 px-3.5 py-3 supports-[backdrop-filter]:bg-white/28 backdrop-blur-xl dark:border-border dark:bg-card/80">
                                <div className="text-[11px] font-medium text-[#6D7FA8] dark:text-slate-400">
                                  <span>Overall progress</span>
                                </div>
                                <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                                  <Progress
                                    value={finalUploadProgress}
                                    className="h-1.5 rounded-full bg-[#E7EEFF] dark:bg-muted"
                                  />
                                  <span className="min-w-[3rem] text-right text-[11px] font-semibold tabular-nums text-foreground/90 dark:text-slate-100">
                                    {finalUploadProgress}%
                                  </span>
                                </div>
                              </div>
                            ) : null}

                            {showFinalUploadList ? (
                              <div className="mt-3 space-y-2 border-t border-[#E1E9FF] pt-3 dark:border-border">
                                <div
                                  className={cn(
                                    'space-y-2',
                                    shouldCompactFinalUploadQueue && 'max-h-[30rem] overflow-y-auto pr-1 scrollbar-thin'
                                  )}
                                >
                                  {finalUploadItems.map((item) => {
                                    const extension = getFileExtension(item.name);
                                    const isUploading = item.status === 'uploading';
                                    const hasUploadError = item.status === 'error';
                                    const uploadProgress = isUploading
                                      ? Math.max(0, Math.min(100, Number(item.progress ?? 0)))
                                      : item.status === 'done'
                                        ? 100
                                        : Math.max(0, Math.min(99, Number(item.progress ?? 0)));

                                    return (
                                      <div
                                        key={item.id}
                                        className="rounded-xl border border-[#CFE0FF] bg-white/95 px-3 py-2.5 shadow-none dark:border-border dark:bg-slate-900/70"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF3FF] text-[10px] font-semibold text-[#4B57A6] dark:border dark:border-border dark:bg-muted dark:text-foreground">
                                              {extension}
                                            </div>

                                            <div className="min-w-0">
                                              <span className="block truncate text-xs font-medium text-foreground">
                                                {item.name}
                                              </span>
                                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                                                <span className={hasUploadError ? 'text-destructive' : 'text-muted-foreground'}>
                                                  {isUploading
                                                    ? 'Uploading'
                                                    : hasUploadError
                                                      ? 'Needs attention'
                                                      : 'Completed'}
                                                </span>
                                                {item.size ? (
                                                  <span className="text-muted-foreground">
                                                    {formatFileSize(item.size)}
                                                  </span>
                                                ) : null}
                                                {isUploading ? (
                                                  <span className="font-medium tabular-nums text-muted-foreground">
                                                    {uploadProgress}%
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex shrink-0 items-center gap-2">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              {hasUploadError ? (
                                                <>
                                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                                  <span className="font-semibold text-red-500">Failed</span>
                                                </>
                                              ) : null}
                                              {isUploading ? (
                                                <>
                                                  <Loader2 className="h-4 w-4 animate-spin text-[#7D8FB8] dark:text-slate-300" />
                                                  <span className="font-semibold uppercase tracking-[0.08em] text-[#7D8FB8] dark:text-slate-300">
                                                    Uploading
                                                  </span>
                                                </>
                                              ) : null}
                                              {!isUploading && !hasUploadError ? (
                                                <>
                                                  <Check className="h-4 w-4 text-primary" />
                                                  <span className="font-semibold tabular-nums text-primary">100%</span>
                                                </>
                                              ) : null}
                                            </div>

                                            {!isUploading ? (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveFinalUploadItem(item.id)}
                                                className="inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-lg border border-[#E1E9FF] bg-[#F5F8FF] text-[#6B7A99] shadow-none transition-colors duration-150 ease-out hover:border-[#C8D7FF] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] focus-visible:ring-2 focus-visible:ring-primary/25 active:translate-y-[1px] active:scale-[0.94] dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:border-border dark:hover:bg-muted/80 dark:hover:text-foreground dark:focus-visible:ring-primary/35"
                                                aria-label={`Remove ${item.name}`}
                                              >
                                                <X className="h-4 w-4" />
                                              </button>
                                            ) : null}
                                          </div>
                                        </div>

                                        {hasUploadError && item.error ? (
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <p className="text-xs text-destructive">{item.error}</p>
                                            {shouldPromptDriveReconnect(item.error) ? (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-6 border-destructive px-2 text-xs text-destructive hover:bg-destructive hover:text-white"
                                                onClick={async (event) => {
                                                  event.preventDefault();
                                                  try {
                                                    await openDriveReconnectWindow();
                                                  } catch (error) {
                                                    const message =
                                                      error instanceof Error
                                                        ? error.message
                                                        : 'Failed to get auth URL';
                                                    toast.error('Drive reconnect failed', {
                                                      description: message,
                                                    });
                                                  }
                                                }}
                                              >
                                                Connect
                                              </Button>
                                            ) : null}
                                          </div>
                                        ) : null}

                                        {isUploading ? (
                                          <div className="mt-2 flex items-center gap-2">
                                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#D7E3FF]/90 dark:bg-slate-800/90">
                                              <div
                                                className="h-full rounded-full bg-primary transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                              />
                                            </div>
                                            <span className="w-9 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                                              {uploadProgress}%
                                            </span>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>

                                <p className="text-xs text-muted-foreground">{finalUploadFooterText}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-[#D3E1F8] bg-[#F8FBFF]/60 px-3 py-3 text-xs text-muted-foreground dark:border-border/50 dark:bg-muted/20">
                          <Upload className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span>No files added yet — click <span className="font-medium text-[#3D5A9E] dark:text-slate-300">Add files</span> or drag &amp; drop here</span>
                        </div>
                      )}
                    </div>

                    {/* Section: Version Note */}
                    <div className="mt-4 px-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Version Note <span className="font-normal normal-case tracking-normal opacity-55">(optional)</span>
                      </p>
                      <Textarea
                        value={finalVersionNote}
                        onChange={(event) => setFinalVersionNote(event.target.value)}
                        rows={2}
                        className="mt-2 min-h-[68px] rounded-lg border-[#D9E6FF] bg-[#F8FBFF] px-3 py-2.5 text-sm focus-visible:ring-primary/25 dark:bg-muted/30 dark:border-border dark:text-slate-100 dark:placeholder:text-slate-500"
                        placeholder="Summarize what changed in this version..."
                      />
                    </div>

                    {/* Section: Google Drive link */}
                    <div className="mt-4 px-4 pb-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <img
                          src="/google-drive.ico"
                          alt=""
                          aria-hidden="true"
                          className="h-[12px] w-[12px] shrink-0 object-contain opacity-80"
                        />
                        Google Drive Link <span className="font-normal normal-case tracking-normal opacity-55">(optional)</span>
                      </p>
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://drive.google.com/..."
                            value={finalLinkUrl}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setFinalLinkUrl(nextValue);
                              if (!finalLinkValidationError) return;
                              if (!nextValue.trim()) {
                                setFinalLinkValidationError('');
                                return;
                              }
                              const nextValidation = validateFinalGoogleDriveLink(nextValue);
                              if (nextValidation.valid) {
                                setFinalLinkValidationError('');
                              }
                            }}
                            className={cn(
                              'h-9 select-text rounded-lg border-[#D9E6FF] bg-[#F8FBFF] px-3 text-sm dark:border-border dark:bg-muted/30 dark:text-slate-100 dark:placeholder:text-slate-500',
                              finalLinkValidationError &&
                                'border-red-300 bg-red-50/40 focus-visible:border-red-400 dark:border-red-400/70 dark:bg-red-950/20'
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddFinalLink}
                            disabled={!finalLinkUrl.trim() || isAddingFinalLink}
                            className="h-9 shrink-0 rounded-lg border-[#D0DCFF] px-4 text-sm text-[#3D5A9E] hover:bg-[#EEF2FF] dark:border-border dark:text-slate-300 dark:hover:bg-muted/60"
                          >
                            {isAddingFinalLink ? 'Adding...' : 'Add link'}
                          </Button>
                        </div>
                        <Input
                          placeholder="Item name (optional)"
                          value={finalLinkName}
                          onChange={(event) => setFinalLinkName(event.target.value)}
                          className="h-9 select-text rounded-lg border-[#D9E6FF] bg-[#F8FBFF] px-3 text-sm dark:border-border dark:bg-muted/30 dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                        {finalLinkValidationError && (
                          <p className="text-xs font-medium text-red-500 dark:text-red-300">
                            {finalLinkValidationError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Panel footer — submit action */}
                    {(normalizedTaskStatus !== 'completed' || hasPendingFinalFiles) && (
                      <div className="flex items-center justify-between gap-3 border-t border-[#E8EEFB] bg-[#F8FBFF]/60 px-4 py-3 dark:border-border dark:bg-muted/20">
                        <span className="text-xs text-muted-foreground">
                          {hasPendingFinalFiles
                            ? submitActionHint
                            : finalDeliverableReviewStatus === 'pending'
                            ? 'The latest submission is under review.'
                            : finalDeliverableReviewStatus === 'rejected'
                            ? 'Add updated files or a link to submit the next revision.'
                            : hasFinalDeliverables
                            ? 'Final approval will move this task to completed.'
                            : 'Add files or a Drive link to submit.'}
                        </span>
                        <Button
                          onClick={handleHandoverTask}
                          disabled={!canHandover}
                          className="h-8 shrink-0 rounded-lg px-4 text-xs font-semibold"
                        >
                          {submitActionLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            ) : null}

            {user?.role === 'treasurer' && (
              <>
                {renderChangeHistoryPanel()}
                {isTreasurerReviewMode && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2 animate-slide-up">
                    <Button
                      onClick={() => handleApprovalDecision('approved')}
                      disabled={approvalDecisionInFlight !== null}
                      className="h-9 gap-2 rounded-full px-4 border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-none hover:bg-primary/85 dark:border-transparent"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {approvalDecisionInFlight === 'approved' ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApprovalDecision('rejected')}
                      disabled={approvalDecisionInFlight !== null}
                      className="h-9 gap-2 rounded-full px-4 border-[#D9E6FF] bg-[#F8FBFF] text-[#1E2A5A] shadow-none hover:bg-[#EEF4FF] dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:hover:bg-slate-900/80 dark:hover:text-white"
                    >
                      <XCircle className="h-4 w-4" />
                      {approvalDecisionInFlight === 'rejected' ? 'Rejecting...' : 'Reject'}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Internal Chat */}
            <div className={`${glassPanelClass} p-4 animate-slide-up`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Internal Chat ({taskState.comments.length})
                  </h2>
                </div>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
                    commentSearch.trim() || isCommentSearchVisible
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-[#D9E6FF] bg-white/85 text-[#6B7A99] hover:border-[#BFD3FF] hover:bg-[#F3F7FF] dark:border-border dark:bg-card/85 dark:text-muted-foreground dark:hover:bg-muted'
                  )}
                  onClick={() => {
                    if (commentSearch.trim()) {
                      setCommentSearch('');
                      setIsCommentSearchVisible(false);
                      return;
                    }
                    setIsCommentSearchVisible((current) => !current);
                  }}
                  aria-label={commentSearch.trim() ? 'Clear message search' : 'Search messages'}
                >
                  {commentSearch.trim() ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </button>
              </div>

              {(isCommentSearchVisible || commentSearch.trim()) && (
                <div className="mb-4 flex items-center gap-2">
                  <div className="search-elastic group flex max-w-sm flex-1 items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 px-3 py-2 shadow-none dark:border-border dark:bg-card/80">
                    <Search className="search-elastic-icon h-4 w-4 text-muted-foreground" />
                    <input
                      ref={commentSearchInputRef}
                      value={commentSearch}
                      onChange={(event) => setCommentSearch(event.target.value)}
                      placeholder="Search messages"
                      className="search-elastic-input w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full px-3 text-muted-foreground"
                    onClick={() => {
                      setCommentSearch('');
                      setIsCommentSearchVisible(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
              )}

              {commentSearch.trim() && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{matchingCommentCount} match{matchingCommentCount === 1 ? '' : 'es'}</span>
                </div>
              )}

              {visibleTopLevelComments.length > 0 ? (
                <div className="mb-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                  {visibleTopLevelComments.map((comment) => renderCommentThread(comment))}
                </div>
              ) : taskState.comments.length > 0 && commentSearch.trim() ? (
                <div className="mb-6 rounded-2xl border border-dashed border-[#D9E6FF] bg-white/55 px-4 py-5 text-sm text-muted-foreground dark:border-border dark:bg-card/25">
                  No messages match "{commentSearch.trim()}".
                </div>
              ) : (
                <div className="mb-6 text-sm text-muted-foreground">
                  No messages yet. Start a thread with {formatMentionList(user?.role)}.
                </div>
              )}

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div
                    className={cn(
                      'rounded-2xl border border-[#D9E6FF] bg-white/85 px-3 py-2.5 backdrop-blur-md transition-colors focus-within:border-primary/45 focus-within:ring-1 focus-within:ring-primary/20 dark:border-border dark:bg-card/85',
                      isCommentComposerDragging &&
                        'border-primary/75 bg-[#F4F8FF] ring-1 ring-primary/25 dark:bg-card/95',
                      isUploadingCommentAttachments && 'opacity-70'
                    )}
                    onDragOver={(event) => handleChatComposerDragOver(event, 'comment')}
                    onDragLeave={(event) => handleChatComposerDragLeave(event, 'comment')}
                    onDrop={(event) => void handleChatComposerDrop(event, 'comment')}
                  >
                    {commentAttachments.length > 0 && (
                      <div className="mb-2.5">
                        {renderComposerAttachments(commentAttachments, 'comment')}
                      </div>
                    )}
                    <div className="relative">
                      {canComment &&
                        !isChatComposerFocused &&
                        !newComment.trim() &&
                        commentAttachments.length === 0 && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 flex min-h-[72px] items-start">
                          <div className="chat-composer-placeholder pt-0.5">
                            <MessageSquare className="chat-composer-placeholder-icon h-[1.05rem] w-[1.05rem]" />
                            <span className="chat-composer-placeholder-static">Message</span>
                            <span className="chat-composer-placeholder-words">
                              <span className="chat-composer-placeholder-wordlist">
                                {chatComposerHintLines.map((line) => (
                                  <span key={line}>{line}</span>
                                ))}
                              </span>
                            </span>
                          </div>
                        </div>
                      )}
                      <Textarea
                        ref={commentComposerRef}
                        placeholder=""
                        value={newComment}
                        onChange={(e) =>
                          handleComposerChange('comment', e.target.value, e.target.selectionStart)
                        }
                        onPaste={(event) => void handleChatComposerPaste(event, 'comment')}
                        onFocus={() => {
                          if (mentionBlurTimeoutRef.current) {
                            clearTimeout(mentionBlurTimeoutRef.current);
                            mentionBlurTimeoutRef.current = null;
                          }
                          handleChatComposerFocus();
                          syncMentionContext(
                            newComment,
                            'comment',
                            commentComposerRef.current?.selectionStart
                          );
                        }}
                        onBlur={() => {
                          handleChatComposerBlur();
                          scheduleMentionContextClose('comment');
                        }}
                        onKeyDown={(event) =>
                          handleComposerKeyDown(
                            event,
                            'comment',
                            newComment,
                            commentAttachments
                          )
                        }
                        rows={2}
                        className="min-h-[72px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-transparent"
                        disabled={!canComment}
                      />
                    </div>
                    {isUploadingCommentAttachments && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Uploading attachment
                        {commentAttachmentUploadProgress
                          ? ` (${commentAttachmentUploadProgress}%)`
                          : ''}...
                      </p>
                    )}
                    {isCommentComposerDragging && !isUploadingCommentAttachments && (
                      <p className="mt-2 text-xs font-medium text-primary/80">Drop files to attach</p>
                    )}
                  </div>
                  {renderMentionSuggestions('comment')}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={commentAttachmentInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => void handleChatAttachmentSelection(event, 'comment')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="self-end"
                    onClick={() => commentAttachmentInputRef.current?.click()}
                    disabled={!canComment || isUploadingCommentAttachments}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleAddComment}
                    disabled={
                      !canComment ||
                      isUploadingCommentAttachments ||
                      (!newComment.trim() && commentAttachments.length === 0)
                    }
                    size="icon"
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {Object.keys(typingUsers).length > 0 && (
                <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground dark:border-slate-600/70 dark:bg-slate-800/85 dark:text-slate-200">
                  <span>
                    {(() => {
                      const entries = Object.values(typingUsers);
                      const names = entries
                        .map((entry) =>
                          `${entry.name}${entry.role ? ` (${roleLabels[entry.role]})` : ''}`
                        )
                        .join(', ');
                      const verb = entries.length === 1 ? 'is' : 'are';
                      return `${names} ${verb} typing`;
                    })()}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse dark:bg-[#9FB1FF]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms] dark:bg-[#9FB1FF]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms] dark:bg-[#9FB1FF]" />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className={`space-y-6 ${usesCampaignOverviewLayout ? "hidden" : ""}`}>
            {/* Task Info */}
            <div className={`${glassPanelClass} p-5 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Details</h2>
              <dl className="space-y-4">
                {usesCampaignOverviewLayout && (
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                      Campaign Mode
                    </dt>
                    <dd className="mt-1 text-[13px] text-foreground">
                      {campaignDeadlineMode === 'common' ? 'Common deadline across collaterals' : 'Individual collateral deadlines'}
                    </dd>
                    <dd className="text-xs text-muted-foreground mt-0.5">
                      {collateralItems.length} collateral item{collateralItems.length === 1 ? '' : 's'}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Requester
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-[13px]">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{taskState.requesterName}</span>
                  </dd>
                  {taskState.requesterDepartment && (
                    <dd className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {taskState.requesterDepartment}
                    </dd>
                  )}
                </div>

                {taskState.assignedToName && (
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                      Assigned To
                    </dt>
                    <dd className="mt-1 flex items-center gap-2 text-[13px]">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{taskState.assignedToName}</span>
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Deadline
                  </dt>
                  <dd
                    className={cn(
                      'mt-1 flex items-center gap-2 text-[13px]',
                      isOverdue && 'text-status-urgent font-medium dark:text-rose-300'
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>{format(taskState.deadline, 'MMM d, yyyy')}</span>
                  </dd>
                  {isOverdue && (
                    <dd className="text-xs text-status-urgent dark:text-rose-300/95 mt-0.5 ml-6 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Overdue by {formatDistanceToNow(taskState.deadline)}
                    </dd>
                  )}
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Created
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-[13px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(taskState.createdAt, 'MMM d, yyyy')}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-[13px] text-muted-foreground">
                    {formatDistanceToNow(taskState.updatedAt, { addSuffix: true })}
                  </dd>
                </div>

                {emergencyStatus && (
                  <div className="border-t border-[#E1E9FF] pt-5 dark:border-slate-700/60">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                          Emergency Approval
                        </dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          Emergency request review
                        </dd>
                      </div>
                      <Badge variant={emergencyVariant}>{emergencyLabel}</Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                          Requested
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {format(
                            taskState.emergencyRequestedAt || taskState.createdAt,
                            'MMM d, yyyy'
                          )}
                        </p>
                      </div>

                      {taskState.emergencyApprovedAt && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Decision
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {emergencyStatus === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                            {taskState.emergencyApprovedBy || 'Designer'} on{' '}
                            {format(taskState.emergencyApprovedAt, 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}

                      {latestEmergencyDecisionNote && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Reason
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {latestEmergencyDecisionNote}
                          </p>
                        </div>
                      )}

                      {canDesignerActions && emergencyStatus === 'pending' && (
                        <div className="space-y-3 rounded-2xl border border-[#D9E6FF] bg-[#F8FBFF]/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
                          <Textarea
                            value={emergencyDecisionReason}
                            onChange={(event) => setEmergencyDecisionReason(event.target.value)}
                            rows={3}
                            placeholder="Reason for approve/reject (required)"
                            className="select-text"
                            disabled={isEmergencyUpdating}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEmergencyDecision('approved')}
                              disabled={isEmergencyUpdating || !emergencyDecisionReason.trim()}
                            >
                              {approvalDecisionInFlight === 'approved' ? 'Approving...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEmergencyDecision('rejected')}
                              disabled={isEmergencyUpdating || !emergencyDecisionReason.trim()}
                            >
                              {approvalDecisionInFlight === 'rejected' ? 'Rejecting...' : 'Reject'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {user?.role !== 'treasurer' && renderChangeHistoryPanel()}
            {emergencyStatus && designVersions.length > 0 && (
              <div className={`${glassPanelClass} p-5 animate-slide-up`}>
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    Version History
                  </h3>
                  <div className="space-y-2">
                    {designVersions.map((version, index) => (
                      <div key={`${version.id}-${index}`} className={cn(fileRowClass, 'items-start gap-3 min-w-0')}>
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-sm font-medium text-foreground line-clamp-2 break-words">
                            {getVersionLabel(version)} - {version.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded {format(version.uploadedAt, 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {activeDesignVersionId === version.id && (
                            <Badge variant="secondary">Active</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!version.url}
                            className={fileActionButtonClass}
                            onClick={() => {
                              if (version.url) {
                                window.open(version.url, '_blank', 'noopener,noreferrer');
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canManageVersions && activeDesignVersionId !== version.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRollbackVersion(version.id)}
                            >
                              Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {designVersions.length > 1 && (
                    <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Compare Left
                          </span>
                          <Select value={compareLeftId} onValueChange={setCompareLeftId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select version" />
                            </SelectTrigger>
                            <SelectContent>
                              {designVersions.map((version, index) => (
                                <SelectItem key={`${version.id}-${index}`} value={version.id}>
                                  {getVersionLabel(version)} - {version.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Compare Right
                          </span>
                          <Select value={compareRightId} onValueChange={setCompareRightId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select version" />
                            </SelectTrigger>
                            <SelectContent>
                              {designVersions.map((version, index) => (
                                <SelectItem key={`${version.id}-${index}`} value={version.id}>
                                  {getVersionLabel(version)} - {version.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {compareLeft && compareRight && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {[compareLeft, compareRight].map((version, index) => (
                            <div
                              key={`${version.id}-${index}`}
                              className="rounded-lg border border-border/60 bg-background p-3"
                            >
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                {getVersionLabel(version)} - {version.name}
                              </div>
                              {version.url && isImageVersion(version) ? (
                                <img
                                  src={version.url}
                                  alt={version.name}
                                  className="w-full rounded-md border border-border/40"
                                />
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  {version.url ? (
                                    <>
                                      Preview not available.{' '}
                                      <button
                                        type="button"
                                        className="text-primary hover:underline"
                                        onClick={() =>
                                          window.open(version.url, '_blank', 'noopener,noreferrer')
                                        }
                                      >
                                        Open file
                                      </button>
                                    </>
                                  ) : (
                                    'No file URL available for this version.'
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Progress Tracker — 40% */}
            </div>
            <div className="space-y-5">
            <div className={`${glassPanelClass} overflow-hidden p-5 animate-slide-up`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Delivery Workflow
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {statusConfig[normalizedTaskStatus].label}
                    </h2>
                    <span className="inline-flex items-center rounded-full border border-[#D7E3FF] bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#35508A] dark:border-border dark:bg-muted/70 dark:text-foreground/85">
                      Step {deliveryStepIndex + 1} of {TASK_STATUS_STEPS.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {statusDetails[normalizedTaskStatus]}
                  </p>
                </div>
                <div className="min-w-[13rem] flex-1 sm:max-w-[16rem]">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span>Progress</span>
                    <span>{deliveryProgressPercent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E4EBF7] dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#3657C9] via-[#4F6EE0] to-[#7FA3FF] transition-all duration-300 ease-out"
                      style={{ width: `${deliveryProgressPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE5FB] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#52627F] dark:border-border dark:bg-muted/70 dark:text-foreground/85">
                      <User className="h-3.5 w-3.5" />
                      {workflowAssigneeLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE5FB] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#52627F] dark:border-border dark:bg-muted/70 dark:text-foreground/85">
                      <Clock className="h-3.5 w-3.5" />
                      {workflowUpdatedLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {TASK_STATUS_STEPS.map((step, index) => {
                  const isCurrent = index === deliveryStepIndex;
                  const isPast = index < deliveryStepIndex;
                  const isUpcoming = index > deliveryStepIndex;

                  return (
                    <div key={step} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
                      <div className="relative flex justify-center">
                        <span
                          className={cn(
                            'relative z-[1] mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                            isPast
                              ? 'border-[#C9DBFF] bg-[linear-gradient(135deg,#FBFDFF_0%,#EEF5FF_48%,#E1ECFF_100%)] text-[#4D6BC4] dark:border-[#5A79BF]/45 dark:bg-[#1A2B52]/55 dark:text-[#D9E5FF]'
                            : isCurrent
                                ? 'border-[#3657C9] bg-[#3657C9] text-white shadow-[0_0_0_4px_rgba(54,87,201,0.12)] motion-safe:animate-[trackingNodePulse_1.9s_ease-in-out_infinite] dark:border-[#6C8DFF] dark:bg-[#4E6FE0] dark:shadow-[0_0_0_4px_rgba(108,141,255,0.18)]'
                                : 'border-[#D7E3FF] bg-white text-[#7A8EBA] dark:border-slate-600/70 dark:bg-slate-900 dark:text-slate-300'
                          )}
                        >
                          {isCurrent ? (
                            <span className="pointer-events-none absolute inset-[-6px] rounded-full border border-[#9CB2FF]/55 motion-safe:animate-[trackingHalo_1.9s_ease-out_infinite] dark:border-[#8EA7FF]/35" />
                          ) : null}
                          {isCurrent ? (
                            <span className="pointer-events-none absolute inset-[-2px] rounded-full border border-white/40 dark:border-white/20" />
                          ) : null}
                          <span className="relative z-[1]">{isPast ? <Check className="h-4 w-4" /> : index + 1}</span>
                        </span>
                        {index !== TASK_STATUS_STEPS.length - 1 && (
                          <span
                            className={cn(
                              'absolute left-1/2 top-9 h-[calc(100%-1.25rem)] w-px -translate-x-1/2 overflow-visible rounded-full',
                              isPast
                                ? 'bg-[#D8E6FF] dark:bg-[#4A67A5]/35'
                              : isCurrent
                                  ? 'bg-gradient-to-b from-[#3657C9]/50 to-[#D7E3FF] dark:from-[#6C8DFF]/55 dark:to-slate-700'
                                  : 'bg-[#DDE7FB] dark:bg-slate-700/80'
                            )}
                          >
                            {isCurrent ? (
                              <>
                                <span className="absolute inset-x-[-1px] inset-y-0 rounded-full bg-[linear-gradient(180deg,transparent_0%,rgba(54,87,201,0.18)_16%,rgba(54,87,201,0.95)_50%,rgba(151,177,255,0.26)_82%,transparent_100%)] bg-[length:100%_180%] motion-safe:animate-[trackingLineFlow_1.55s_linear_infinite] dark:bg-[linear-gradient(180deg,transparent_0%,rgba(108,141,255,0.14)_16%,rgba(108,141,255,0.92)_50%,rgba(168,189,255,0.24)_82%,transparent_100%)]" />
                              </>
                            ) : null}
                          </span>
                        )}
                      </div>

                      <div className={cn(index === TASK_STATUS_STEPS.length - 1 ? 'pb-0' : 'pb-5')}>
                        <div
                          className={cn(
                            'rounded-2xl border px-4 py-3 transition-colors',
                            isCurrent
                              ? 'border-[#C7D7FF] bg-white/88 shadow-[0_10px_30px_-24px_rgba(54,87,201,0.65)] dark:border-border dark:bg-card/90 dark:[background-image:none] dark:shadow-none'
                              : isPast
                                ? 'border-[#D9E6FF] bg-[linear-gradient(135deg,rgba(251,253,255,0.94),rgba(242,247,255,0.86),rgba(234,241,255,0.8))] dark:border-border dark:bg-card/78 dark:[background-image:none]'
                                : 'border-[#E2E9F8] bg-white/55 dark:border-border dark:bg-card/60 dark:[background-image:none]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={cn(
                                    'text-sm font-semibold',
                                    isCurrent
                                      ? 'text-foreground'
                                      : isPast
                                        ? 'text-[#3C4F7A] dark:text-[#D9E4FF]'
                                        : 'text-muted-foreground'
                                  )}
                                >
                                  {statusConfig[step].label}
                                </p>
                                {isCurrent ? (
                                  <span className="inline-flex items-center rounded-full border border-[#C7D7FF] bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3657C9] dark:border-border dark:bg-muted/70 dark:text-foreground">
                                    Active
                                  </span>
                                ) : isPast ? (
                                  <span className="inline-flex items-center rounded-full border border-[#C9DBFF] bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4B69C3] dark:border-border dark:bg-card/85 dark:text-foreground/88">
                                    Done
                                  </span>
                                ) : null}
                              </div>
                              <p
                                className={cn(
                                  'mt-1 text-xs leading-relaxed',
                                  isCurrent
                                    ? 'text-muted-foreground'
                                    : isUpcoming
                                      ? 'text-muted-foreground/70'
                                      : 'text-muted-foreground/85'
                                )}
                              >
                                {statusDetails[step]}
                              </p>
                            </div>
                            {!isPast ? (
                              <span
                                className={cn(
                                  'hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] 2xl:inline',
                                  isCurrent
                                    ? 'text-[#3657C9] dark:text-[#C8D7FF]'
                                    : 'text-muted-foreground/70'
                                )}
                              >
                                {isCurrent ? 'Current' : `Step ${index + 1}`}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {showWorkflowInsights ? (
                <div className="mt-5 border-t border-[#DCE5FB] pt-4 dark:border-border">
                  {secondaryWorkflowSignals.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Review & Approval
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {secondaryWorkflowSignals.map((signal) => (
                          <div
                            key={signal.key}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium',
                              signal.className
                            )}
                          >
                            <span className="uppercase tracking-[0.14em] opacity-70">{signal.label}</span>
                            <span className="font-semibold">{signal.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {usesCampaignOverviewLayout ? (
                    <div className={cn('grid gap-3', secondaryWorkflowSignals.length > 0 ? 'mt-4' : '')}>
                      <div className="rounded-2xl border border-[#DCE5FB] bg-white/72 px-4 py-3 dark:border-border dark:bg-card/78 dark:[background-image:none]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {isCampaignRequest ? 'Campaign Progress' : 'Request Progress'}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {campaignCompletedCollaterals} / {collateralItems.length} collateral items completed
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {collateralCompletionPercent}%
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E4EBF7] dark:bg-slate-800">
                          <div
                            className="relative h-full rounded-full bg-gradient-to-r from-[#3657C9] via-[#4F6EE0] to-[#7FA3FF] shadow-[0_0_18px_-8px_rgba(79,110,224,0.85)] transition-all duration-300 ease-out"
                            style={{ width: `${collateralCompletionPercent}%` }}
                          >
                            <span className="pointer-events-none absolute inset-y-[-3px] right-0 w-7 rounded-full bg-[radial-gradient(circle_at_left_center,rgba(255,255,255,0.96)_0%,rgba(214,245,255,0.84)_36%,rgba(144,234,255,0.22)_58%,rgba(144,234,255,0)_78%)] blur-[5px] motion-safe:animate-[progressEndPulse_1.75s_ease-in-out_infinite]" />
                            <span className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.24)_26%,rgba(255,255,255,0.88)_56%,rgba(208,245,255,0.76)_76%,transparent_100%)] opacity-80 blur-[2px] motion-safe:animate-[progressEndShimmer_1.75s_ease-in-out_infinite]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      <Dialog open={isAssignModalOpen} onOpenChange={handleAssignModalChange}>
        <DialogContent className={`sm:max-w-xl ${assignPanelClassName} dark:border-0`}>
          <DialogHeader>
            <DialogTitle>Assign Designer</DialogTitle>
            <DialogDescription>
              {assignSuccessInfo
                ? `Assignment submitted for "${assignSuccessInfo.taskTitle}".`
                : assigningTask
                  ? `Assign a designer for "${assigningTask.title}" and notify everyone in CC.`
                  : 'Assign a designer and send an email notification.'}
            </DialogDescription>
          </DialogHeader>

          {assignSuccessInfo ? (
            <div className="rounded-xl border border-[#D9E6FF] bg-[#F5F8FF] p-4 dark:border-[#2A3C6B]/70 dark:bg-[#0F1D39]/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-[#EAF0FF] p-1.5 text-[#34429D] dark:bg-[#1A315E] dark:text-[#AFC5FF]">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1E2A5A] dark:text-[#E8EEFF]">
                    Assignment confirmed
                  </p>
                  <p className="text-sm text-[#2B3F86] dark:text-[#C4D3FF]">
                    <span className="font-medium">{assignSuccessInfo.taskTitle}</span> has been assigned to{' '}
                    <span className="font-medium">{assignSuccessInfo.designerName}</span>.
                  </p>
                  <p className="text-xs text-[#4B5FA8] dark:text-[#94A9E8]">
                    Email notification sent
                    {assignSuccessInfo.ccCount > 0
                      ? ` to ${assignSuccessInfo.ccCount} CC recipient(s).`
                      : '.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="assign-designer-select">Assign Designer</Label>
                <Select
                  value={selectedDesignerId}
                  onValueChange={setSelectedDesignerId}
                  disabled={isLoadingDesigners || isAssigningDesigner}
                >
                  <SelectTrigger id="assign-designer-select" className={assignFieldClassName}>
                    <SelectValue
                      placeholder={isLoadingDesigners ? 'Loading designers...' : 'Select designer'}
                    />
                  </SelectTrigger>
                  <SelectContent className={assignSelectContentClassName}>
                    {designerOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No designers available.
                      </div>
                    ) : (
                      designerOptions.map((designer) => (
                        <SelectItem key={designer.id} value={designer.id}>
                          {designer.name} ({getDesignerScopeLabel(designer.designerScope)}
                          {designer.portalId ? ` | ${designer.portalId}` : ''})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-cc-input">CC Email(s)</Label>
                <Input
                  id="assign-cc-input"
                  type="email"
                  value={ccInput}
                  onChange={(event) => setCcInput(event.target.value)}
                  onKeyDown={handleCcInputKeyDown}
                  onBlur={() => addCcEmail(ccInput)}
                  placeholder="Type email and press Enter"
                  disabled={isAssigningDesigner}
                  className={assignFieldClassName}
                />
                {ccEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ccEmails.map((email) => (
                      <Badge key={email} variant="secondary" className="flex items-center gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => removeCcEmail(email)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted/70"
                          aria-label={`Remove ${email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-message">Message (optional)</Label>
                <Textarea
                  id="assign-message"
                  value={assignmentMessage}
                  onChange={(event) => setAssignmentMessage(event.target.value)}
                  placeholder="Add an optional assignment note"
                  rows={4}
                  disabled={isAssigningDesigner}
                  className={`resize-none ${assignFieldClassName}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-deadline">Deadline</Label>
                <div className="grid gap-3 md:grid-cols-[1.45fr,1fr] md:items-center">
                  <Popover open={deadlineCalendarOpen} onOpenChange={setDeadlineCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="assign-deadline"
                        type="button"
                        variant="outline"
                        disabled={isAssigningDesigner}
                        className={`h-10 justify-start text-left font-medium ${assignFieldClassName}`}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-[#4863B7] dark:text-[#9FB4FF]" />
                        {assignmentDeadline
                          ? format(new Date(`${assignmentDeadline}T00:00:00`), 'PPP')
                          : 'Pick deadline date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto border-[#C9D7FF] bg-[#F2F6FF]/95 p-2 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:supports-[backdrop-filter]:bg-slate-900/70"
                    >
                      <DateCalendar
                        mode="single"
                        selected={
                          assignmentDeadline
                            ? new Date(`${assignmentDeadline}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;
                          setAssignmentDeadline(format(date, 'yyyy-MM-dd'));
                          setDeadlineCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className="rounded-lg border border-[#D9E6FF] bg-white/75 p-2 dark:border-slate-700/60 dark:bg-slate-900/60"
                        classNames={{
                          caption_label:
                            'text-sm font-semibold text-[#253977] dark:text-[#C8D7FF]',
                          head_cell:
                            'w-9 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#5D75B9] dark:text-[#9CB3EE]',
                          cell:
                            'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
                          day:
                            'h-9 w-9 rounded-md border border-transparent p-0 font-medium text-[#223067] hover:bg-[#EAF1FF] hover:text-[#223067] aria-selected:opacity-100 dark:text-[#D6E2FF] dark:hover:bg-[#1A315E] dark:hover:text-[#D6E2FF]',
                          nav_button:
                            'h-7 w-7 border border-[#C7D9FF] bg-white text-[#3B54A6] hover:bg-[#EEF4FF] dark:border-[#33508A] dark:bg-[#15274F] dark:text-[#B4C7FF] dark:hover:bg-[#1B315F]',
                          day_selected:
                            'bg-[#3550A8] text-white hover:bg-[#2C4391] focus:bg-[#2C4391] focus:text-white',
                          day_today:
                            'bg-[#E1EBFF] text-[#1E2E66] dark:bg-[#29447D] dark:text-[#D9E4FF]',
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="rounded-xl border border-[#D9E6FF] bg-white/75 px-3 py-2 backdrop-blur-lg dark:border-slate-700/60 dark:bg-slate-900/60">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6B82C3] dark:text-[#8FA7E6]">
                          Time
                        </p>
                        <p className="mt-0.5 text-sm font-semibold tracking-tight text-[#223067] dark:text-[#D6E2FF]">
                          {deadlineTimeParts.hour}:{deadlineTimeParts.minute}{' '}
                          {deadlineTimeParts.period}
                        </p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-[#4863B7] ring-1 ring-[#D7E2FF] dark:bg-slate-800/70 dark:text-slate-200 dark:ring-slate-700/60">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={deadlineTimeParts.hour}
                        onValueChange={(value) =>
                          setAssignmentDeadlineTime(
                            toTwentyFourHourTime(
                              value,
                              deadlineTimeParts.minute,
                              deadlineTimeParts.period
                            )
                          )
                        }
                        disabled={isAssigningDesigner}
                      >
                        <SelectTrigger className={`h-9 rounded-lg font-semibold ${assignFieldClassName}`}>
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent className={assignSelectContentClassName}>
                          {DEADLINE_HOURS.map((hour) => (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={deadlineTimeParts.minute}
                        onValueChange={(value) =>
                          setAssignmentDeadlineTime(
                            toTwentyFourHourTime(
                              deadlineTimeParts.hour,
                              value,
                              deadlineTimeParts.period
                            )
                          )
                        }
                        disabled={isAssigningDesigner}
                      >
                        <SelectTrigger className={`h-9 rounded-lg font-semibold ${assignFieldClassName}`}>
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent className={`max-h-72 ${assignSelectContentClassName}`}>
                          {DEADLINE_MINUTES.map((minute) => (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={deadlineTimeParts.period}
                        onValueChange={(value: (typeof DEADLINE_PERIODS)[number]) =>
                          setAssignmentDeadlineTime(
                            toTwentyFourHourTime(
                              deadlineTimeParts.hour,
                              deadlineTimeParts.minute,
                              value
                            )
                          )
                        }
                        disabled={isAssigningDesigner}
                      >
                        <SelectTrigger className={`h-9 rounded-lg font-semibold ${assignFieldClassName}`}>
                          <SelectValue placeholder="AM/PM" />
                        </SelectTrigger>
                        <SelectContent className={assignSelectContentClassName}>
                          {DEADLINE_PERIODS.map((period) => (
                            <SelectItem key={period} value={period}>
                              {period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set exact deadline date and time for the assigned junior designer.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {assignSuccessInfo ? (
              <Button type="button" onClick={() => handleAssignModalChange(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAssignModalChange(false)}
                  disabled={isAssigningDesigner}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitAssignDesigner}
                  disabled={
                    !selectedDesignerId ||
                    !assignmentDeadline ||
                    !assignmentDeadlineTime ||
                    isAssigningDesigner ||
                    isLoadingDesigners
                  }
                >
                  {isAssigningDesigner ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign & Notify'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImageAnnotationDialog
        open={annotationDialogOpen}
        onOpenChange={(open) => {
          setAnnotationDialogOpen(open);
          if (!open) {
            setAnnotationTargetFile(null);
            setAnnotationDialogReadOnly(false);
          }
        }}
        readOnly={annotationDialogReadOnly}
        actorName={user?.name || user?.email || ''}
        file={
          annotationTargetFile
            ? {
                id: annotationTargetFile.id,
                name: annotationTargetFile.name,
                url: annotationTargetFile.url,
                previewUrl: annotationPreviewUrl,
              }
            : null
        }
        initialAnnotation={annotationForDialog}
        onSave={handleSaveReviewAnnotation}
      />
      <AttachmentPreviewDialog
        file={attachmentPreviewFile}
        open={Boolean(attachmentPreviewFile)}
        onOpenChange={(open) => {
          if (!open) {
            setAttachmentPreviewFile(null);
          }
        }}
        description="Previewing task attachment"
      />
      <SubmissionSuccessDialog
        open={showHandoverModal}
        onOpenChange={(open) => {
          if (!open) handleHandoverClose();
        }}
        title="Submission received"
        description={
          <>
            The final deliverables were submitted successfully.
            <br />
            The reviewer will be notified shortly.
          </>
        }
        actionLabel="Close"
        onAction={handleHandoverClose}
      />
    </DashboardLayout>
    </>
  );
}

export default function TaskDetail() {
  return (
    <TaskDetailErrorBoundary>
      <TaskDetailScreen />
    </TaskDetailErrorBoundary>
  );
}




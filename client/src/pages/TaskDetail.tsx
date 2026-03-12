import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Lottie from 'lottie-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FileText,
  Edit3,
  Upload,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  History,
  Check,
  ChevronDown,
  Copy,
  PenTool,
  X,
  XCircle,
  ExternalLink,
  Folder,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ApprovalStatus,
  DesignVersion,
  FinalDeliverableFile,
  FinalDeliverableReviewAnnotation,
  FinalDeliverableReviewStatus,
  FinalDeliverableVersion,
  TaskChange,
  TaskComment,
  TaskStatus,
  UserRole,
} from '@/types';
import { cn } from '@/lib/utils';
import { loadLocalTaskById } from '@/lib/taskStorage';
import { createSocket } from '@/lib/socket';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { pushScheduleNotification } from '@/lib/designerSchedule';
import { GridBackground } from '@/components/ui/background';
import { ImageAnnotationDialog } from '@/components/tasks/ImageAnnotationDialog';
import { isMainDesigner } from '@/lib/designerAccess';

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
  if (normalized === 'assigned' || normalized === 'accepted') return '';
  return normalized;
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
const normalizeUserRole = (role?: string) =>
  allRoles.includes(role as UserRole) ? (role as UserRole) : 'staff';
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
type UploadItem = { id: string; name: string; status: UploadStatus; progress?: number };
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
type FileActionTarget = (typeof mockTasks)[number]['files'][number] | OutputDisplayFile;
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
  'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF]/35 ring-0 rounded-2xl shadow-none dark:bg-card dark:border-border/55 dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent';
const fileRowClass =
  'flex items-center justify-between rounded-lg border border-transparent bg-gradient-to-r from-[#F7FAFF]/90 via-[#EEF4FF]/60 to-[#EAF2FF]/80 px-4 py-1.5 supports-[backdrop-filter]:bg-[#EEF4FF]/55 backdrop-blur-xl dark:bg-none dark:bg-slate-900/70 dark:border-slate-700/60 dark:text-slate-200';
const fileActionButtonClass =
  'icon-action-press h-9 w-9 rounded-xl border border-[#D3E1FF] bg-gradient-to-r from-white/85 via-[#EEF4FF]/78 to-[#E8F1FF]/88 text-[#223467] shadow-none transition-all duration-150 ease-out supports-[backdrop-filter]:bg-[#EEF4FF]/62 backdrop-blur-md hover:border-[#D3E1FF] hover:bg-[#EEF4FF]/62 hover:text-[#223467] hover:shadow-none dark:border-slate-600/70 dark:bg-none dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600/70 dark:hover:bg-slate-900/70 dark:hover:text-slate-100';
const fileGlassPillButtonClass =
  'h-9 rounded-xl border border-[#D3E1FF] bg-gradient-to-r from-white/85 via-[#EEF4FF]/78 to-[#E8F1FF]/88 px-3 text-[#223467] shadow-none transition-all duration-150 ease-out supports-[backdrop-filter]:bg-[#EEF4FF]/62 backdrop-blur-md hover:border-[#D3E1FF] hover:bg-[#EEF4FF]/62 hover:text-[#223467] hover:shadow-none active:translate-y-[1px] active:scale-[0.98] dark:border-slate-600/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600/70 dark:hover:bg-slate-900/70 dark:hover:text-slate-100';
const fileGlassIconButtonClass =
  'h-9 w-9 rounded-xl border border-[#D3E1FF] bg-gradient-to-r from-white/85 via-[#EEF4FF]/78 to-[#E8F1FF]/88 text-[#223467] shadow-none transition-all duration-150 ease-out supports-[backdrop-filter]:bg-[#EEF4FF]/62 backdrop-blur-md hover:border-[#D3E1FF] hover:bg-[#EEF4FF]/62 hover:text-[#223467] hover:shadow-none active:translate-y-[1px] active:scale-[0.94] dark:border-slate-600/70 dark:bg-none dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600/70 dark:hover:bg-slate-900/70 dark:hover:text-slate-100';
const badgeGlassClass =
  'rounded-full border border-[#C9D7FF] bg-gradient-to-r from-white/80 via-[#E6F1FF]/85 to-[#D6E5FF]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1E2A5A] backdrop-blur-xl dark:border-slate-700/80 dark:bg-gradient-to-r dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-800/85 dark:text-slate-100 dark:shadow-none';
const changeHistoryCardClass = 'rounded-lg border border-border/60 bg-secondary/40';
const PSD_FILE_ICON_URL = '/icons/psd-file.svg';
const MAX_WORKING_FILE_BYTES = Math.floor(2.5 * 1024 * 1024 * 1024);
const WORKING_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;

import { API_URL, authFetch, getAuthToken, openDriveReconnectWindow } from '@/lib/api';

const shouldPromptDriveReconnect = (errorMessage?: string) => {
  const normalized = String(errorMessage || '').toLowerCase();
  return (
    normalized.includes('drive oauth not connected') ||
    normalized.includes('must be set for oauth') ||
    normalized.includes('missing oauth code')
  );
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | { task?: typeof mockTasks[number]; highlightChangeId?: string }
    | null;
  const { user } = useAuth();
  const apiUrl = API_URL;
  const stateTask = locationState?.task;
  const highlightChangeId = locationState?.highlightChangeId;
  const localTask = id ? loadLocalTaskById(id) : undefined;
  const initialTask = stateTask || localTask || mockTasks.find((t) => t.id === id);
  const [taskState, setTaskState] = useState<typeof mockTasks[number] | undefined>(initialTask);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; role: UserRole }>>(
    {}
  );
  const [newStatus, setNewStatus] = useState<TaskStatus | ''>(
    getStatusSelectValue(initialTask?.status)
  );
  const [changeCount, setChangeCount] = useState(initialTask?.changeCount ?? 0);
  const initialApprovalStatus: ApprovalStatus | undefined =
    initialTask?.approvalStatus ?? ((initialTask?.changeCount ?? 0) >= 3 ? 'pending' : undefined);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | undefined>(
    initialApprovalStatus
  );
  const [changeHistory, setChangeHistory] = useState<TaskChange[]>(initialTask?.changeHistory ?? []);
  const [editedDescription, setEditedDescription] = useState(initialTask?.description ?? '');
  const [staffNote, setStaffNote] = useState('');
  const [editedDeadline, setEditedDeadline] = useState(
    initialTask ? format(initialTask.deadline, 'yyyy-MM-dd') : ''
  );
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [deadlineRequest, setDeadlineRequest] = useState(
    initialTask?.proposedDeadline ? format(initialTask.proposedDeadline, 'yyyy-MM-dd') : ''
  );
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<'reference' | 'others'>('reference');
  const [newFileDetails, setNewFileDetails] = useState('');
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<number | null>(null);
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
  const [showReferenceFileList, setShowReferenceFileList] = useState(true);
  const [showWorkingFileList, setShowWorkingFileList] = useState(true);
  const [showFinalDeliverableList, setShowFinalDeliverableList] = useState(true);
  const [isEditAttachmentDragging, setIsEditAttachmentDragging] = useState(false);
  const [isWorkingUploadDragging, setIsWorkingUploadDragging] = useState(false);
  const [copiedFileKey, setCopiedFileKey] = useState('');
  const [handoverAnimation, setHandoverAnimation] = useState<object | null>(null);
  const [approvalDecisionInFlight, setApprovalDecisionInFlight] = useState<ApprovalDecision | null>(null);
  const [finalReviewDecisionInFlight, setFinalReviewDecisionInFlight] =
    useState<ApprovalDecision | null>(null);
  const [finalReviewNote, setFinalReviewNote] = useState('');
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const [annotationDialogReadOnly, setAnnotationDialogReadOnly] = useState(false);
  const [annotationTargetFile, setAnnotationTargetFile] = useState<OutputDisplayFile | null>(null);
  const [draftReviewAnnotationsByFile, setDraftReviewAnnotationsByFile] = useState<
    Record<string, FinalDeliverableReviewAnnotation>
  >({});
  const sizeFetchRef = useRef(new Set<string>());
  const addAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const workingUploadInputRef = useRef<HTMLInputElement | null>(null);
  const finalUploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFinalFileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const copiedFileResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isChatComposerFocusedRef = useRef(false);
  const clientIdRef = useRef<string>('');
  const finalUploadAbortRef = useRef<AbortController | null>(null);
  const workingUploadDismissTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const storageKey = id ? `designhub.task.${id}` : '';
  const commentDraftKey = useMemo(() => {
    const taskIdForDraft = String(id || taskState?.id || '').trim();
    const userIdForDraft = String(user?.id || '').trim();
    if (!taskIdForDraft || !userIdForDraft) return '';
    return `designhub.task.${taskIdForDraft}.chat-draft.${userIdForDraft}`;
  }, [id, taskState?.id, user?.id]);
  const staffChangeCount = useMemo(() => {
    const latestApprovalCheckpointAt = changeHistory.reduce((latest, entry) => {
      if (entry.field !== 'approval_status') return latest;
      const time = new Date(entry.createdAt ?? 0).getTime();
      return time > latest ? time : latest;
    }, 0);
    return changeHistory.filter((entry) => {
      if (entry.userRole !== 'staff') return false;
      if (!STAFF_EDIT_CHANGE_FIELDS.has(String(entry.field || ''))) return false;
      const time = new Date(entry.createdAt ?? 0).getTime();
      return latestApprovalCheckpointAt ? time > latestApprovalCheckpointAt : true;
    }).length;
  }, [changeHistory]);
  useEffect(() => {
    return () => {
      if (copiedFileResetTimerRef.current) {
        clearTimeout(copiedFileResetTimerRef.current);
      }
      workingUploadDismissTimersRef.current.forEach((timer) => clearTimeout(timer));
      workingUploadDismissTimersRef.current.clear();
    };
  }, []);
  const displayedChangeCount = user?.role === 'staff' ? staffChangeCount : changeCount;
  const approvalLockedForStaff = false;
  const staffChangeLabel = staffChangeCount === 1 ? '1 change updated' : `${staffChangeCount} changes updated`;
  const canSendForApproval =
    user?.role === 'staff' && staffChangeCount >= 3;
  const staffChangeLimitReached = user?.role === 'staff' && staffChangeCount >= 3;
  const editsRemainingBeforeTreasurerApproval = Math.max(0, 3 - staffChangeCount);
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
  const changeHistoryForDisplay = useMemo(() => {
    if (
      user?.role === 'treasurer' &&
      approvalStatus === 'pending' &&
      treasurerApprovalCycleChanges.length > 0
    ) {
      return treasurerApprovalCycleChanges;
    }
    return editTaskChangeHistory;
  }, [
    user?.role,
    approvalStatus,
    treasurerApprovalCycleChanges,
    editTaskChangeHistory,
  ]);
  const isTreasurerReviewMode = user?.role === 'treasurer' && approvalStatus === 'pending';
  const designVersions = taskState?.designVersions ?? [];
  const activeDesignVersionId =
    taskState?.activeDesignVersionId || designVersions[designVersions.length - 1]?.id;
  const activeDesignVersion = designVersions.find((version) => version.id === activeDesignVersionId);
  const isDesignerRole = user?.role === 'designer';
  const isMainDesignerUser = isMainDesigner(user);
  const compareLeft = designVersions.find((version) => version.id === compareLeftId);
  const compareRight = designVersions.find((version) => version.id === compareRightId);
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const taskKey = taskState?.id || id;
    if (!taskKey) return;
    localStorage.setItem(`designhub.task.viewed.${user.id}.${taskKey}`, 'true');
  }, [user, taskState?.id, id]);

  useEffect(() => {
    let isActive = true;
    const fetchAnimation = async (path: string) => {
      const response = await fetch(path);
      return response.ok ? response.json() : null;
    };
    fetchAnimation('/lottie/thank-you.json')
      .then((data) => {
        if (!isActive) return;
        if (data) setHandoverAnimation(data);
      })
      .catch(() => { });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!highlightChangeId || typeof document === 'undefined') return;
    const target = document.getElementById(`change-${highlightChangeId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightChangeId, changeHistory.length]);

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
        receiverRoles:
          comment.receiverRoles?.filter((role) => allRoles.includes(role)) ?? [],
        seenBy: comment.seenBy?.map((entry) => ({
          ...entry,
          role: normalizeUserRole(entry.role),
          seenAt: new Date(entry.seenAt),
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
      changeHistory: raw.changeHistory?.map((entry) => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
      })),
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
    receiverRoles:
      comment?.receiverRoles?.filter((role: string) => allRoles.includes(role as UserRole)) ?? [],
    seenBy:
      comment?.seenBy?.map((entry: any) => ({
        ...entry,
        role: normalizeUserRole(entry.role),
        seenAt: new Date(entry.seenAt),
      })) ?? [],
    createdAt: new Date(comment?.createdAt ?? Date.now()),
  });

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
  };

  const handleChatComposerBlur = () => {
    isChatComposerFocusedRef.current = false;
    clearTyping();
  };

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
      const incoming = normalizeIncomingComment(payload.comment);
      setTaskState((prev) => {
        if (!prev) return prev;
        if (prev.comments.some((comment) => comment.id === incoming.id)) {
          return prev;
        }
        return {
          ...prev,
          comments: [...prev.comments, incoming],
          updatedAt: new Date(),
        };
      });
    });

    socket.on('task:updated', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !payload.task) return;
      const hydrated = withAccessMetadata(hydrateTask(payload.task));
      setTaskState(hydrated);
      setChangeHistory(hydrated?.changeHistory ?? []);
      setChangeCount(hydrated?.changeCount ?? 0);
      setApprovalStatus(hydrated?.approvalStatus);
      persistTask(hydrated);
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
      const hydrated = withAccessMetadata(hydrateTask({ ...payload, id: payloadId }));
      setTaskState(hydrated);
      setChangeHistory(hydrated?.changeHistory ?? []);
      setChangeCount(hydrated?.changeCount ?? 0);
      setApprovalStatus(hydrated?.approvalStatus);
      persistTask(hydrated);
    };
    window.addEventListener('designhub:task:updated', handleTaskUpdated);
    return () => window.removeEventListener('designhub:task:updated', handleTaskUpdated);
  }, [id, taskState?.id, taskState?._id]);

  const persistTask = (nextTask: typeof taskState, nextHistory?: TaskChange[]) => {
    if (!nextTask || !storageKey) return;
    const payload = {
      ...nextTask,
      changeHistory: nextHistory ?? nextTask.changeHistory,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
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

  const hasUnseenForRole = (task: typeof taskState, role?: UserRole) => {
    if (!task || !role) return false;
    return task.comments?.some((comment) => {
      const receivers = resolveCommentReceivers(comment);
      if (!receivers.includes(role)) return false;
      const seenBy = comment.seenBy ?? [];
      return !seenBy.some((entry) => entry.role === role);
    });
  };

  const hasUnseenComments = useMemo(
    () => hasUnseenForRole(taskState, user?.role),
    [taskState?.comments, user?.role]
  );
  const unseenFingerprint = useMemo(() => {
    if (!taskState || !user?.role) return '';
    const relevant = taskState.comments
      .filter((comment) => resolveCommentReceivers(comment).includes(user.role))
      .map((comment) => {
        const id = (comment as { id?: string; _id?: string }).id || (comment as { _id?: string })._id;
        const seenCount = (comment.seenBy ?? []).length;
        return `${id || comment.createdAt?.toString() || 'comment'}:${seenCount}`;
      })
      .join('|');
    return `${taskState.id}:${user.role}:${relevant}`;
  }, [taskState?.comments, taskState?.id, user?.role]);
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

  if (!taskState) {
    const fallbackHref = user?.role === 'designer' ? '/tasks' : '/dashboard';
    const fallbackLabel = user?.role === 'designer' ? 'Go to Task Portal' : 'Back to Dashboard';
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">
            {isLoading ? 'Loading task...' : 'Task not found'}
          </h2>
          <Button asChild className="mt-4">
            <Link to={fallbackHref}>{fallbackLabel}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

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
  const canDesignerActions = isDesignerRole && hasFullTaskAccess && !isViewOnlyTask;
  const canFinalizeTaskActions = canDesignerActions || (isDesignerRole && isMainDesignerUser);
  const isStaffRole = user?.role === 'staff';
  const canEditTask = user?.role === 'staff' && !isViewOnlyTask;
  const editTaskActionTooltip = approvalLockedForStaff
    ? 'Editing is temporarily locked while this request is under approval.'
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
  const minDeadlineDate = addWorkingDays(new Date(), 3);
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
  const inputFiles = taskState.files.filter((f) => f.type === 'input');
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
  const hasFinalDeliverables = sortedFinalDeliverableVersions.length > 0;
  const finalDeliverableReviewStatus = normalizeFinalDeliverableReviewStatus(
    taskState?.finalDeliverableReviewStatus,
    hasFinalDeliverables ? 'approved' : 'not_submitted'
  );
  const finalDeliverableReviewNote = String(taskState?.finalDeliverableReviewNote || '').trim();
  const finalDeliverableReviewedBy = String(taskState?.finalDeliverableReviewedBy || '').trim();
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
    hasFinalDeliverables &&
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
    ((!isTaskCompleted && (hasFinalDeliverables || hasPendingFinalFiles)) ||
      (isTaskCompleted && hasPendingFinalFiles)) &&
    !isUploadingFinal;
  const submitActionLabel = isTaskCompleted ? 'Submit Revision' : 'Submit';
  const submitActionHint = isTaskCompleted
    ? 'Submit creates the next version (V1, V2, ...) and keeps this task completed.'
    : 'Submit creates the next version (V1, V2, ...) and marks the task as completed.';
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
    const progressItems = finalUploadItems.some((item) => item.status === 'uploading')
      ? finalUploadItems.filter((item) => item.status === 'uploading')
      : finalUploadItems;
    if (progressItems.length === 0) return 0;
    const totalProgress = progressItems.reduce((sum, item) => {
      if (item.status === 'done') return sum + 100;
      const raw = Number(item.progress);
      const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(99, Math.round(raw))) : 0;
      return sum + normalized;
    }, 0);
    return Math.max(0, Math.min(100, Math.round(totalProgress / progressItems.length)));
  }, [finalUploadItems]);
  const finalUploadLabel =
    finalUploadTotals.uploading > 0
      ? `Uploading ${finalUploadTotals.uploading} item${finalUploadTotals.uploading === 1 ? '' : 's'} (${finalUploadProgress}%)`
      : finalUploadTotals.error > 0 && finalUploadTotals.done === 0
        ? 'Upload failed'
        : `${finalUploadTotals.done || finalUploadItems.length} upload${(finalUploadTotals.done || finalUploadItems.length) === 1 ? '' : 's'} complete`;

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
          message = payload.error.trim();
        }
      } catch {
        const detail = await response.text().catch(() => '');
        if (detail.trim()) {
          message = detail.trim();
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
  const toOutputFile = (file: FinalDeliverableFile, index: number): OutputDisplayFile => ({
    id: file.id || `final-file-${index}`,
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
  const openReviewAnnotationDialog = (file: OutputDisplayFile, readOnly = false) => {
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
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[9px]">
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
            'relative flex h-11 w-12 shrink-0 flex-col items-center justify-between overflow-hidden rounded-[10px] border px-1.5 py-1.5',
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
      <div className="relative h-9 w-12 overflow-hidden rounded-[6px] border border-transparent bg-[radial-gradient(circle_at_top_left,_rgba(191,214,255,0.6),_transparent_55%),linear-gradient(160deg,_rgba(236,244,255,0.85),_rgba(198,220,255,0.45))] backdrop-blur-xl dark:border-slate-700/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(100,116,139,0.35),_transparent_55%),linear-gradient(160deg,_rgba(30,41,59,0.95),_rgba(51,65,85,0.75))] dark:shadow-none">
        <div className="absolute inset-0 rounded-[6px] border border-transparent bg-gradient-to-br from-white/85 via-[#EEF4FF]/75 to-[#D5E5FF]/65 backdrop-blur-sm dark:bg-gradient-to-br dark:from-slate-800/95 dark:via-slate-700/90 dark:to-slate-700/70 dark:border-slate-700/60">
          <div className="absolute left-2 top-2 h-1 w-6 rounded-full bg-[#D6E2FA]/70 dark:bg-slate-400/55" />
          <div className="absolute left-2 top-4 h-1 w-8 rounded-full bg-[#DDE8FB]/70 dark:bg-slate-400/45" />
          <div className="absolute left-2 top-6 h-1 w-5 rounded-full bg-[#DDE8FB]/70 dark:bg-slate-400/45" />
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
        <span className="absolute bottom-1 left-1 z-20 rounded-[4px] border border-white/70 bg-white/55 px-1.5 py-0.5 text-[9px] font-semibold text-[#2C4A83] backdrop-blur-md dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-200 dark:shadow-none">
          {extLabel}
        </span>
        <span className="absolute bottom-0 right-0 z-20 h-0 w-0 border-b-[12px] border-b-[#D8E4FF] border-l-[12px] border-l-transparent dark:border-b-slate-500/70" />
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
        if (!initialTask) {
          setTaskState(undefined);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadTask();
  }, [apiUrl, id]);

  useEffect(() => {
    if (apiUrl || !id) return;
    const local = loadLocalTaskById(id);
    if (!local) return;
    const hydrated = withAccessMetadata(hydrateTask(local));
    setTaskState(hydrated);
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
          if (seenBy.some((entry) => entry.role === user.role)) return comment;
          return {
            ...comment,
            seenBy: [...seenBy, { role: user.role, seenAt: new Date() }],
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
    onSuccess?: () => void
  ) => {
    if (!content.trim() || !taskState) return;
    if (!canComment) {
      toast.error('Comments are disabled for this task.');
      return;
    }
    const trimmed = content.trim();
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
      seenBy: [],
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
    submitComment(newComment, undefined, () => setNewComment(''));
  };

  const handleReplySubmit = (parentId: string) => {
    submitComment(replyText, parentId, () => {
      setReplyText('');
      setReplyToId(null);
    });
  };

  const handleStatusChange = (status: TaskStatus) => {
    if (status === getStatusSelectValue(taskState?.status)) return;
    const isCompletion = status === 'completed';
    recordChanges(
      [
        {
          type: 'status',
          field: 'status',
          oldValue: statusConfig[normalizedTaskStatus].label,
          newValue: statusConfig[status].label,
          note: isCompletion ? `Completed by ${user?.name || 'Designer'}` : undefined,
        },
      ],
      { status }
    );
    setNewStatus(status);
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
    if (!hasFinalDeliverables && !hasPendingFinalFiles) {
      toast.message('Upload final files before handing over the task.');
      return;
    }
    if (isTaskCompleted && !hasPendingFinalFiles) {
      toast.message('Add files or link, then submit the revision.');
      return;
    }
    if (!apiUrl) {
      toast.error('Submit requires backend connection.');
      return;
    }
    if (hasPendingFinalFiles) {
      try {
        await submitFinalDeliverableVersion({
          files: pendingFinalFiles,
          note: finalVersionNote.trim(),
        });
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
        return;
      }
    }
    if (isTaskCompleted) {
      toast.success('New revision version submitted.');
      return;
    }
    const didComplete = await recordChanges(
      [
        {
          type: 'status',
          field: 'status',
          oldValue: statusConfig[normalizedTaskStatus].label,
          newValue: statusConfig.completed.label,
          note: `Completed by ${user?.name || 'Designer'}`,
        },
      ],
      { status: 'completed' }
    );
    if (didComplete) {
      setShowHandoverModal(true);
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

  const handleRequestApproval = () => {
    if (user?.role !== 'staff' || staffChangeCount < 3) {
      toast.message('Send for approval after 3 staff changes.');
      return;
    }
    recordChanges(
      [
        {
          type: 'status',
          field: 'approval_status',
          oldValue: approvalStatus ?? 'pending',
          newValue: 'Pending',
          note: `Approval requested - ${user?.name || 'Staff'}`,
        },
      ],
      { approvalStatus: 'pending' }
    );
    toast.message('Approval request sent to treasurer.');
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
      toast.message('Approval pending. Changes are locked.');
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
      toast.message('Approval pending. Changes are locked.');
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
            item.id === uploadId ? { ...item, status: 'uploading', progress: nextProgress } : item
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
                  ? { ...item, status: 'done', progress: 100 }
                  : item
              )
            );
          }
        } catch (error) {
          const maybeAbortError = error as { name?: string; message?: string };
          if (maybeAbortError?.name === 'AbortError') {
            if (uploadId) {
              setFinalUploadItems((prev) =>
                prev.map((item) =>
                  item.id === uploadId
                    ? { ...item, status: 'error', progress: item.progress ?? 0 }
                    : item
                )
              );
            }
            throw error;
          }
          const errorMsg = maybeAbortError?.message || 'Upload failed';
          if (uploadId) {
            setFinalUploadItems((prev) =>
              prev.map((item) =>
                item.id === uploadId
                  ? { ...item, status: 'error', progress: item.progress ?? 0 }
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
          toast.error('File upload failed', {
            description: 'One or more files could not be uploaded. Please retry.',
          });
        } else if (uploadedFiles.length > 0) {
          setPendingFinalFiles((prev) => [...prev, ...uploadedFiles]);
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
          item.id === uploadId ? { ...item, status: 'done', progress: 100 } : item
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
          item.id === uploadId ? { ...item, status: 'error', progress: item.progress ?? 0 } : item
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
      prev.map((item) =>
        item.status === 'uploading' ? { ...item, status: 'error' } : item
      )
    );
    setIsUploadingFinal(false);
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
          toast.error(`Working file upload failed: ${file.name}`, {
            description: message,
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
      toast.message('Approval pending. Changes are locked.');
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
    const replies = repliesByParent.get(comment.id) ?? [];
    const isReply = depth > 0;
    return (
      <div key={comment.id} className={cn('flex gap-3', isReply && 'pl-6 border-l border-border/60')}>
        <div
          className={cn(
            'rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium flex-shrink-0',
            isReply ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'
          )}
        >
          {comment.userName.charAt(0)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{comment.userName}</span>
            {comment.userRole && (
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {roleLabels[comment.userRole] ?? comment.userRole}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-1">
            {renderCommentContent(comment.content)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
            <span>{format(comment.createdAt, 'MMM d, yyyy - h:mm a')}</span>
            {canComment && (
              <button
                type="button"
                className="text-primary/80 hover:text-primary font-medium"
                onClick={() => {
                  setReplyToId(comment.id);
                  setReplyText('');
                }}
              >
                Reply
              </button>
            )}
            {comment.userId === user?.id && (
              <span>
                {(() => {
                  const receivers = resolveCommentReceivers(comment);
                  const seenBy = comment.seenBy ?? [];
                  const seenRoles = receivers.filter((role) =>
                    seenBy.some((entry) => entry.role === role)
                  );
                  const pendingRoles = receivers.filter(
                    (role) => !seenRoles.includes(role)
                  );
                  if (receivers.length === 0) {
                    return null;
                  }
                  if (seenRoles.length === 0) {
                    return 'Sent';
                  }
                  if (pendingRoles.length === 0) {
                    return `Seen by ${seenRoles
                      .map((role) => roleLabels[role] ?? role)
                      .join(', ')}`;
                  }
                  return `Seen by ${seenRoles
                    .map((role) => roleLabels[role] ?? role)
                    .join(', ')} - Pending ${pendingRoles
                      .map((role) => roleLabels[role] ?? role)
                      .join(', ')}`;
                })()}
              </span>
            )}
          </div>
          {canComment && replyToId === comment.id && (
            <div className="mt-3 flex gap-2">
              <Textarea
                placeholder={getMentionPlaceholder(user?.role, 'Reply with')}
                value={replyText}
                onChange={(e) => {
                  const value = e.target.value;
                  setReplyText(value);
                  handleChatTypingInput();
                }}
                onFocus={handleChatComposerFocus}
                onBlur={handleChatComposerBlur}
                rows={2}
                className="flex-1 select-text"
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={!replyText.trim()}
                  size="sm"
                >
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyToId(null);
                    setReplyText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {replies.map((reply) => renderCommentThread(reply, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChangeHistoryPanel = () => (
    <div className={`${glassPanelClass} p-6 animate-slide-up`}>
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
      {changeHistoryForDisplay.length > 0 ? (
        <div className="max-h-[460px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
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
                className="relative pl-10 pb-4 last:pb-0"
              >
                {index !== changeHistoryForDisplay.length - 1 && (
                  <span className="absolute left-[0.875rem] top-8 h-[calc(100%-1.1rem)] w-px bg-[#C9D7FF]/70 dark:bg-gradient-to-b dark:from-[#3A60A8]/75 dark:to-[#24457F]/55" />
                )}
                <span className="absolute left-0 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#BFD1F4] bg-gradient-to-br from-white/95 via-[#F2F7FF]/90 to-[#E5EEFF]/85 text-[11px] font-semibold text-[#1E2A5A] dark:border-[#4D70B4]/70 dark:bg-gradient-to-br dark:from-[#1E3D79]/95 dark:via-[#1A3468]/92 dark:to-[#132951]/92 dark:text-[#E6EEFF] dark:shadow-none">
                  {index + 1}
                </span>
                <div
                  className={cn(
                    changeHistoryCardClass,
                    'rounded-xl border border-[#BFD1F4]/70 bg-gradient-to-br from-white/88 via-[#F4F8FF]/78 to-[#E8F1FF]/70 supports-[backdrop-filter]:bg-[#F4F8FF]/60 backdrop-blur-xl p-3 transition-colors dark:border-border/70 dark:bg-slate-900/55 dark:backdrop-blur-none',
                    entry.id === highlightChangeId && 'border-primary/40 bg-primary/10'
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

  return (
    <DashboardLayout hideGrid>
      <div className="space-y-6 max-w-4xl select-none relative z-10">
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
        <div className="animate-slide-up">
          <div className="flex flex-wrap items-center gap-2 mb-3">
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
          <h1 className="text-2xl font-bold text-foreground premium-headline">{taskState.title}</h1>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-3">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {taskState.description}
              </p>
            </div>

            {canEditTask && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
                <div className="flex items-center justify-between mb-4">
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
                {isEditingTask ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Description
                      </p>
                      <Textarea
                        value={editedDescription}
                        onChange={(event) => setEditedDescription(event.target.value)}
                        rows={4}
                        className="mt-2 select-text text-[15px] leading-7"
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
                          className="mt-2 select-text"
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
                          'Save Updates'
                        )}
                      </Button>
                      {canSendForApproval && (
                        <Button
                          variant="outline"
                          onClick={handleRequestApproval}
                          disabled={isUploadingAttachment}
                        >
                          {isUploadingAttachment ? (
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
                    <p className="whitespace-pre-line text-[15px] leading-7 text-[#5B6E8E] dark:text-slate-300">
                      {taskState.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {canAcceptTask && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
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
            {canDesignerActions && normalizedTaskStatus !== 'completed' && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="clarification_required">
                        Clarification Required
                      </SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
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

            {/* Files */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Files</h2>

              {/* Input Files */}
              {inputFiles.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Associated Files
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowReferenceFileList((prev) => !prev)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#D9E6FF] bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-[#F3F7FF] dark:border-border dark:bg-card/85 dark:hover:bg-muted/80"
                      aria-expanded={showReferenceFileList}
                      aria-label="Toggle associated files list"
                    >
                      <span>{inputFiles.length}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          showReferenceFileList ? 'rotate-180' : ''
                        )}
                      />
                    </button>
                  </div>
                  {showReferenceFileList && (
                    <div className="space-y-2">
                      {inputFiles.map((file, index) => {
                        const isCopied = copiedFileKey === getFileCopyFeedbackKey(file);
                        return (
                        <div
                          key={getFileListItemKey(file, index)}
                          className={fileRowClass}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {renderFilePreview(file)}
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {toTitleCaseFileName(file.name)}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {(() => {
                                  const sizeLabel = formatFileSize(file.size);
                                  return sizeLabel || '';
                                })()}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {canRemoveFiles && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={approvalLockedForStaff || staffChangeLimitReached}
                                className={fileActionButtonClass}
                                onClick={() => handleRemoveFile(file.id, file.name, file.type)}
                              >
                                <Trash2 className="h-4 w-4 text-status-urgent" />
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
                  )}
                </div>
              )}

              {canViewWorkingFiles && (workingFiles.length > 0 || canManageWorkingFiles) && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Designer Working Files
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
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
                        <div className="space-y-2">
                          {workingFiles.map((file, index) => {
                            const isCopied = copiedFileKey === getFileCopyFeedbackKey(file);
                            return (
                            <div
                              key={getFileListItemKey(file, index)}
                              className={fileRowClass}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {renderFilePreview(file)}
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {toTitleCaseFileName(file.name)}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {formatFileSize(file.size) || 'Working file'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
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
                                  <p className="truncate text-sm font-medium text-foreground">
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
                <div className="mb-4 rounded-lg border border-[#D9E6FF]/70 bg-[#F7FBFF]/80 px-4 py-3 text-sm text-[#1E2A5A] dark:border-border/70 dark:bg-card/80 dark:text-slate-200">
                  {finalDeliverableReviewStatus === 'pending'
                    ? 'Final deliverables are submitted and waiting for Design Lead approval.'
                    : `Design Lead requested updates before sharing with staff.${finalDeliverableReviewNote ? ` Reason: ${finalDeliverableReviewNote}` : ''}`}
                </div>
              )}

              {shouldShowJuniorFinalReviewState && (
                <div className="mb-4 rounded-lg border border-[#D9E6FF]/70 bg-[#F7FBFF]/80 px-4 py-3 text-sm text-[#1E2A5A] dark:border-border/70 dark:bg-card/80 dark:text-slate-200">
                  {finalDeliverableReviewStatus === 'pending'
                    ? 'Waiting for Design Lead approval.'
                    : `Design Lead marked this submission as update needed.${finalDeliverableReviewNote ? ` Reason: ${finalDeliverableReviewNote}` : ''} Upload updates and submit again.`}
                </div>
              )}

              {/* Output Files */}
              {sortedFinalDeliverableVersions.length > 0 && (
                <div className="mb-6 deliverables-highlight">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-status-completed" />
                      Final Deliverables
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Version
                      </span>
                      <Select
                        value={selectedFinalVersionId || activeFinalVersion?.id || ''}
                        onValueChange={setSelectedFinalVersionId}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SelectTrigger
                              className="h-8 w-[200px]"
                              aria-label="Final deliverable version selector"
                            >
                              <SelectValue placeholder="Select version" />
                            </SelectTrigger>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            align="start"
                            sideOffset={8}
                            className="max-w-[320px] text-xs leading-relaxed"
                          >
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
                      <button
                        type="button"
                        onClick={() => setShowFinalDeliverableList((prev) => !prev)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D9E6FF] bg-white/85 text-muted-foreground transition hover:bg-[#F3F7FF] dark:border-border dark:bg-card/85 dark:hover:bg-muted/80"
                        aria-expanded={showFinalDeliverableList}
                        aria-label="Toggle final deliverables list"
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            showFinalDeliverableList ? 'rotate-180' : ''
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  {showFinalDeliverableList && (
                    <>
                      {activeFinalVersionNote && (
                        <div className="mb-3 rounded-lg border border-[#D9E6FF]/60 bg-[#F8FBFF]/70 px-3 py-2 dark:border-border/70 dark:bg-card/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Version note
                          </p>
                          <p className="mt-1 text-sm text-foreground/90 dark:text-slate-200">
                            {activeFinalVersionNote}
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        {finalDeliverableFiles.map((file, index) => {
                          const displayFile = toOutputFile(file, index);
                          const isLinkCard = isLinkOnlyFile(displayFile) && isGoogleDriveLinkFile(displayFile);
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
                          return (
                            <div key={getFileListItemKey(displayFile, index)} className={fileRowClass}>
                              {isLinkCard ? (
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#CFDBF8]/65 bg-gradient-to-br from-[#EEF4FF]/90 to-[#DCE8FF]/75 dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-800/90 dark:to-slate-700/70">
                                    <Folder className="h-5 w-5 text-[#4A5EA1] dark:text-slate-200" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">
                                      {displayName}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {getLinkSubLabel(displayFile.url || '')}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex min-w-0 items-center gap-3">
                                  {renderFilePreview(displayFile)}
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {displayName}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {(() => {
                                        const sizeLabel = formatFileSize(displayFile.size);
                                        return sizeLabel || '';
                                      })()}
                                    </span>
                                    {fileHasReviewFeedback && (
                                      <span className="mt-0.5 block text-[11px] text-[#475FB9] dark:text-[#B8C7FF]">
                                        {fileCommentCount} comment(s), {fileShapeCount} drawing mark(s)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div className="flex shrink-0 items-center gap-2">
                                {canAnnotateFile && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className={fileGlassIconButtonClass}
                                    aria-label={fileHasReviewFeedback ? 'Edit feedback' : 'Annotate file'}
                                    title={fileHasReviewFeedback ? 'Edit Feedback' : 'Annotate'}
                                    onClick={() => openReviewAnnotationDialog(displayFile)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                )}
                                {canViewFeedbackFile && !canAnnotateFile && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className={fileGlassIconButtonClass}
                                    aria-label="View feedback"
                                    title="View Feedback"
                                    onClick={() => openReviewAnnotationDialog(displayFile, true)}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                )}
                                {canReplaceThisFile && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className={fileGlassIconButtonClass}
                                    disabled={isUploadingFinal}
                                    aria-label="Replace file"
                                    title="Replace"
                                    onClick={() => triggerReplaceFinalFile(displayFile, index)}
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )}
                                {canRemoveFiles && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled={approvalLockedForStaff || staffChangeLimitReached}
                                    className={fileActionButtonClass}
                                    onClick={() =>
                                      handleRemoveFile(displayFile.id, displayFile.name, displayFile.type)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 text-status-urgent" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={!getFileShareUrl(displayFile)}
                                  data-success={isCopied}
                                  className={cn(
                                    fileActionButtonClass,
                                    isCopied &&
                                      'border-primary/50 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/20 dark:text-primary'
                                  )}
                                  onClick={() => void handleCopyFileLink(displayFile)}
                                  title={isCopied ? 'Copied' : 'Copy link'}
                                  aria-label={isCopied ? 'File link copied' : 'Copy file link'}
                                >
                                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              {(() => {
                                  const fileLinkUrl = getFileActionUrl(displayFile);
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={!fileLinkUrl || fileLinkUrl === '#'}
                                      className={fileActionButtonClass}
                                      onClick={() => handleFileAction(displayFile)}
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
                    </>
                  )}
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
                    <div className="mt-3 rounded-lg border border-[#D9E6FF]/60 bg-[#F8FBFF]/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Design Lead review
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Annotated files: {draftReviewAnnotationList.length}
                      </p>
                      <Textarea
                        value={finalReviewNote}
                        onChange={(event) => setFinalReviewNote(event.target.value)}
                        rows={2}
                        placeholder="Add review note (or use image annotations) for Update Needed."
                        className="mt-2 bg-white/90 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        <Button
                          onClick={() => handleFinalDeliverableReviewDecision('approved')}
                          disabled={finalReviewDecisionInFlight !== null}
                          className="h-9 gap-2 rounded-full px-4"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {finalReviewDecisionInFlight === 'approved' ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleFinalDeliverableReviewDecision('rejected')}
                          disabled={finalReviewDecisionInFlight !== null}
                          className="h-9 rounded-full px-4 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-900/70"
                        >
                          {finalReviewDecisionInFlight === 'rejected' ? 'Marking...' : 'Update Needed'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canEditTask && (
                hasFinalDeliverables ? (
                  <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4">
                    <p className="text-sm font-medium text-foreground">Final deliverables shared</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestFinalUploadAt
                        ? `Last updated ${format(new Date(latestFinalUploadAt), 'MMM d, yyyy')}.`
                        : 'Designer has shared final files. Please review the files above.'}
                    </p>
                    {activeFinalVersionNote && (
                      <div className="mt-3 rounded-md border border-[#D9E6FF]/60 bg-white/75 px-3 py-2 text-sm text-foreground/90 dark:border-border/70 dark:bg-card/75 dark:text-slate-200">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Version note:
                        </span>{' '}
                        {activeFinalVersionNote}
                      </div>
                    )}
                  </div>
                ) : (
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

              {/* Upload (Designer only) */}
              {canFinalizeTaskActions && (
                <>
                  <div
                    className={cn(
                      'mt-6 relative overflow-hidden rounded-2xl gradient-border bg-white p-6 text-center shadow-none transition-colors dark:bg-card',
                      isFinalUploadDragging &&
                        'border-primary/40 bg-[#F4F8FF] ring-2 ring-primary/25 dark:bg-card/95'
                    )}
                    onDragOver={handleFinalUploadDragOver}
                    onDragLeave={handleFinalUploadDragLeave}
                    onDrop={handleFinalUploadDrop}
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#E9F1FF] dark:bg-muted/60 blur-2xl" />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={openFinalFilePicker}
                        disabled={isUploadingFinal}
                        className="mx-auto flex flex-col items-center rounded-xl px-3 py-2 transition hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-muted/50"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-semibold text-foreground">Upload Final Files</p>
                        <p className="text-xs text-muted-foreground">
                          {isFinalUploadDragging ? 'Drop files to upload' : 'Drag and drop or click to upload'}
                        </p>
                      </button>
                      <div className="mt-3 text-left">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Version note (optional)
                        </p>
                        <Textarea
                          value={finalVersionNote}
                          onChange={(event) => setFinalVersionNote(event.target.value)}
                          rows={2}
                          className="mt-2 bg-white/90 dark:bg-card/90 dark:border-border dark:text-slate-100 dark:placeholder:text-slate-400"
                          placeholder="Summarize changes in this version..."
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleUpdateFinalVersionNote}
                            disabled={
                              isUploadingFinal ||
                              isUpdatingFinalVersionNote ||
                              !hasFinalDeliverables ||
                              !activeFinalVersion?.id ||
                              !isFinalVersionNoteDirty
                            }
                            className="h-8 rounded-full px-4 text-xs"
                          >
                            {isUpdatingFinalVersionNote ? 'Updating...' : 'Update note'}
                          </Button>
                        </div>
                      </div>
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
                      <label
                        htmlFor="final-file-upload"
                        className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-[#D9E6FF] bg-white px-4 py-2 text-xs font-semibold text-foreground hover:bg-[#F4F7FF] dark:border-border dark:bg-card/90 dark:text-slate-100 dark:shadow-none dark:hover:bg-muted/80"
                      >
                        {isUploadingFinal ? 'Uploading...' : 'Select files'}
                      </label>
                      {finalUploadItems.length > 0 && (
                        <div className="mt-4 w-full rounded-2xl border border-[#D9E6FF] bg-white/80 p-3 text-left dark:border-border dark:bg-card/90 dark:shadow-none">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-foreground">
                              {finalUploadLabel}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isUploadingFinal && (
                                <button
                                  type="button"
                                  onClick={handleCancelFinalUpload}
                                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-primary/80 hover:text-primary dark:text-slate-300 dark:hover:text-slate-100"
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowFinalUploadList((prev) => !prev)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-[#D9E6FF] hover:bg-white dark:hover:border-border dark:hover:bg-muted/80"
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    showFinalUploadList ? 'rotate-180' : ''
                                  )}
                                />
                              </button>
                              {!isUploadingFinal && (
                                <button
                                  type="button"
                                  onClick={clearFinalUploadItems}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-[#D9E6FF] hover:bg-white dark:hover:border-border dark:hover:bg-muted/80"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          {showFinalUploadList && (
                            <div className="mt-3 space-y-2 border-t border-[#E1E9FF] pt-3 dark:border-border">
                              {finalUploadItems.map((item) => {
                                const extension = getFileExtension(item.name);
                                const itemProgress =
                                  item.status === 'done'
                                    ? 100
                                    : Math.max(0, Math.min(99, Math.round(Number(item.progress) || 0)));
                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-xl border border-[#E1E9FF] bg-white/95 px-3 py-2.5 dark:border-border dark:bg-card/95"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF3FF] text-[10px] font-semibold text-[#4B57A6] dark:bg-muted dark:text-slate-200">
                                          {extension.slice(0, 4)}
                                        </div>
                                        <span className="min-w-0 truncate text-xs font-medium text-foreground">
                                          {item.name}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                        {item.status === 'uploading' && (
                                          <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/90">
                                              Uploading
                                            </span>
                                          </>
                                        )}
                                        {item.status === 'done' && (
                                          <>
                                            <Check className="h-4 w-4 text-emerald-500" />
                                            <span className="font-semibold tabular-nums text-emerald-500">
                                              100%
                                            </span>
                                          </>
                                        )}
                                        {item.status === 'error' && (
                                          <>
                                            <AlertTriangle className="h-4 w-4 text-red-500" />
                                            <span className="font-semibold text-red-500">Failed</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {item.status === 'uploading' && (
                                      <div className="mt-2.5 grid grid-cols-[1fr_auto] items-center gap-2">
                                        <Progress
                                          value={itemProgress}
                                          className="h-1.5 rounded-full bg-[#E7EEFF] dark:bg-[#1A2748]"
                                        />
                                        <span className="min-w-[2.5rem] text-right text-[11px] font-semibold tabular-nums text-foreground/90 dark:text-slate-100">
                                          {itemProgress}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {finalUploadTotals.uploading > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Upload in progress: {finalUploadProgress}%
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-5 rounded-xl border border-[#D9E6FF] bg-white/90 p-4 text-left shadow-none dark:border-border dark:bg-card/90 dark:shadow-none">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          Or add a Google Drive link
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.6fr_auto]">
                          <Input
                            placeholder="Drive item name (optional)"
                            value={finalLinkName}
                            onChange={(event) => setFinalLinkName(event.target.value)}
                            className="h-10 select-text rounded-full border-[#D9E6FF] bg-[#F9FBFF] px-4 dark:border-border dark:bg-card/95 dark:text-slate-100 dark:placeholder:text-slate-400"
                          />
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
                              'h-10 select-text rounded-full border-[#D9E6FF] bg-[#F9FBFF] px-4 dark:border-border dark:bg-card/95 dark:text-slate-100 dark:placeholder:text-slate-400',
                              finalLinkValidationError &&
                                'border-red-300 bg-red-50/40 focus-visible:border-red-400 dark:border-red-400/70 dark:bg-red-950/20'
                            )}
                          />
                          <Button
                            type="button"
                            onClick={handleAddFinalLink}
                            disabled={!finalLinkUrl.trim() || isAddingFinalLink}
                            className="h-10 rounded-full px-5"
                          >
                            {isAddingFinalLink ? 'Adding...' : 'Add link'}
                          </Button>
                        </div>
                        {finalLinkValidationError && (
                          <p className="mt-2 text-xs font-medium text-red-500 dark:text-red-300">
                            {finalLinkValidationError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {(normalizedTaskStatus !== 'completed' || hasPendingFinalFiles) && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <Button
                        onClick={handleHandoverTask}
                        disabled={!canHandover}
                        className="min-w-[180px] px-6"
                      >
                        {submitActionLabel}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {submitActionHint}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

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
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Internal Chat ({taskState.comments.length})
              </h2>

              {topLevelComments.length > 0 ? (
                <div className="space-y-5 mb-6">
                  {topLevelComments.map((comment) => renderCommentThread(comment))}
                </div>
              ) : (
                <div className="mb-6 text-sm text-muted-foreground">
                  No messages yet. Start a thread with {formatMentionList(user?.role)}.
                </div>
              )}

              <div className="flex gap-3">
                <Textarea
                  placeholder={canComment ? getMentionPlaceholder(user?.role) : ''}
                  value={newComment}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewComment(value);
                    handleChatTypingInput();
                  }}
                  onFocus={handleChatComposerFocus}
                  onBlur={handleChatComposerBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (newComment.trim()) {
                        handleAddComment();
                      }
                    }
                  }}
                  rows={2}
                  className="flex-1 select-text"
                  disabled={!canComment}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!canComment || !newComment.trim()}
                  size="icon"
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
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
          <div className="space-y-6">
            {/* Task Info */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Details</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Requester
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm">
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
                    <dd className="mt-1 flex items-center gap-2 text-sm">
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
                      'mt-1 flex items-center gap-2 text-sm',
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
                  <dd className="mt-1 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(taskState.createdAt, 'MMM d, yyyy')}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
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

            {/* Status Timeline */}
            <div className={`${glassPanelClass} p-6 overflow-hidden animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Status</h2>
              {(() => {
                const steps: DisplayTaskStatus[] = [
                  'pending',
                  'assigned',
                  'accepted',
                  'in_progress',
                  'clarification_required',
                  'under_review',
                  'completed',
                ];
                const currentIndex = steps.indexOf(normalizedTaskStatus);
                return (
                  <div className="space-y-3 sm:space-y-4">
                    {steps.map((step, index) => {
                      const isCurrent = index === currentIndex;
                      const isPast = index < currentIndex;
                      return (
                        <div key={step} className="flex items-start gap-3 sm:gap-4">
                          <div className="relative flex flex-col items-center">
                            <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center">
                              {isPast ? (
                                <span className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/85 text-white dark:bg-primary/80 dark:shadow-none">
                                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </span>
                              ) : isCurrent ? (
                                <span className="flex h-12 w-12 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white dark:bg-transparent">
                                  <DotLottieReact
                                    src="https://lottie.host/31b5d829-4d1f-42a6-ba16-3560e550c0ac/KTsiywVfWC.lottie"
                                    loop
                                    autoplay
                                    className="h-11 w-11 sm:h-16 sm:w-16"
                                  />
                                </span>
                              ) : (
                                <span className="h-6 w-6 sm:h-8 sm:w-8 rounded-full border-2 border-[#D9E6FF] bg-white dark:border-slate-500/80 dark:bg-slate-800" />
                              )}
                            </div>
                            {index !== steps.length - 1 && (
                              <div
                                className={cn(
                                  'mt-1 h-8 sm:h-10 w-px rounded-full',
                                  isPast
                                    ? 'bg-primary/75 dark:bg-primary/55'
                                    : 'bg-[#D9E6FF] dark:bg-slate-700/70'
                                )}
                              />
                            )}
                          </div>
                          <div className={cn(changeHistoryCardClass, 'w-full min-w-0 flex-1 px-3 py-2 sm:px-4 sm:py-3')}>
                            <div
                              className={cn(
                                'min-w-0 text-xs sm:text-sm font-semibold',
                                isCurrent
                                  ? 'text-foreground dark:text-slate-100'
                                  : isPast
                                    ? 'text-muted-foreground dark:text-slate-300'
                                    : 'text-muted-foreground/60 dark:text-slate-300'
                              )}
                            >
                              {statusConfig[step].label}
                            </div>
                            <div
                              className={cn(
                                'mt-1 text-[11px] sm:text-xs',
                                isCurrent
                                  ? 'text-muted-foreground dark:text-slate-300'
                                  : isPast
                                    ? 'text-muted-foreground/80 dark:text-slate-400'
                                    : 'text-muted-foreground/60 dark:text-slate-400'
                              )}
                            >
                              {statusDetails[step]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            {emergencyStatus && designVersions.length > 0 && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
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

            {user?.role !== 'treasurer' && renderChangeHistoryPanel()}
          </div>
        </div>
      </div>
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
      <Dialog
        open={showHandoverModal}
        onOpenChange={(open) => {
          if (!open) handleHandoverClose();
        }}
      >
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="relative h-44 bg-primary/10">
            {handoverAnimation && (
              <Lottie animationData={handoverAnimation} loop={6} className="h-full w-full" />
            )}
          </div>
          <div className="px-7 pb-7 pt-5 text-center">
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-2xl font-bold text-foreground premium-headline">
                Thank you!
              </DialogTitle>
              <DialogDescription className="mt-2.5 text-sm text-muted-foreground">
                The handover has been successfully submitted.
                <br />
                The requester will be notified shortly.
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-8 w-full" onClick={handleHandoverClose}>
              Close
            </Button>
            <div className="mt-6 border-t border-border/60 pt-4 pb-2 text-center text-[11px] text-muted-foreground">
              For assistance, please contact the coordinator at{' '}
              <a href="tel:+919360960019" className="font-medium text-foreground/80 hover:text-foreground">
                +91 9360960019
              </a>{' '}
              or{' '}
              <a
                href="mailto:design@smvec.ac.in"
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                design@smvec.ac.in
              </a>
              .
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}




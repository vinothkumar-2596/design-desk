import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import BoringAvatar from 'boring-avatars';
import { toast } from '@/components/ui/sonner';
import { SubmissionSuccessDialog } from '@/components/common/SubmissionSuccessDialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { AttachmentUploadField } from '@/components/request-builder/AttachmentUploadField';
import { CollateralEditorCard } from '@/components/request-builder/CollateralEditorCard';
import { CollateralPresetDialog } from '@/components/request-builder/CollateralPresetDialog';
import type { BuilderAttachment, CollateralDraft } from '@/components/request-builder/types';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, authFetch } from '@/lib/api';
import {
  buildCampaignDescription,
  deriveEffectiveDeadline,
  deriveTaskCategoryFromCollaterals,
  deriveTaskStatusFromCollaterals,
  deriveTaskUrgencyFromCollaterals,
  formatCollateralPriorityLabel,
  formatCollateralStatusLabel,
  getCollateralDisplayName,
  getCollateralSizeSummary,
  type CollateralPreset,
} from '@/lib/campaignRequest';
import {
  clearRequestDraft,
  loadRequestDraft,
  saveRequestDraft,
  type RequestDraftCollateral,
  type RequestDraftPayload,
} from '@/lib/requestDrafts';
import { loadLocalTaskList, upsertLocalTask } from '@/lib/taskStorage';
import { cn } from '@/lib/utils';
import { addOfficeOpenDays } from '@/lib/officeCalendar';
import type { RequestType, Task, TaskCategory, TaskUrgency } from '@/types';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  Building2,
  CalendarRange,
  Check,
  ChevronLeft,
  ClipboardCheck,
  FileImage,
  FileText,
  GraduationCap,
  Layers3,
  Landmark,
  ListChecks,
  Megaphone,
  Monitor,
  Paperclip,
  Phone,
  Plus,
  ShieldCheck,
  Tv,
  UsersRound,
  Wrench,
} from 'lucide-react';

type BuilderStepId = 'campaign' | 'timeline' | 'collaterals' | 'review';
type BuilderTourStepId = 'campaign' | 'timeline' | 'collaterals' | 'review';
type DepartmentHeadDirectoryEntry = {
  department: string;
  headName: string;
};
type BuilderTourStep = {
  id: BuilderTourStepId;
  /** Which builder stage to navigate to when this tour step is active */
  builderStage: BuilderStepId;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  align: 'left' | 'right';
  icon: React.ComponentType<{ className?: string }>;
};
type TourCardPosition = {
  top: number;
  left: number;
  arrowSide: 'left' | 'right' | 'top' | 'bottom';
  arrowOffset: number;
};
type TourSpotlight = {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  card: TourCardPosition;
};
type SubmitSuccessState = {
  requestType: RequestType;
  storedLocally: boolean;
  taskTitle: string;
};

type SingleRequestStepId = 'details' | 'files' | 'review';

type BriefAvatarVariant =
  | 'marble'
  | 'beam'
  | 'pixel'
  | 'sunset'
  | 'ring'
  | 'bauhaus'
  | 'geometric'
  | 'abstract';

const BRIEF_AVATAR_CONFIGS: Array<{
  key: string;
  variant: BriefAvatarVariant;
  colors: string[];
  shellClassName: string;
  size: number;
}> = [
  {
    key: 'halo',
    variant: 'abstract',
    colors: ['#0F172A', '#5F7CFF', '#CBD8FF', '#F3D7E4', '#F8FAFC'],
    shellClassName: 'mt-8 h-[54px] w-[54px]',
    size: 50,
  },
  {
    key: 'orbit',
    variant: 'sunset',
    colors: ['#111827', '#334155', '#8CA4FF', '#D8E2FF', '#FFFFFF'],
    shellClassName: 'mt-2 h-[64px] w-[64px]',
    size: 60,
  },
  {
    key: 'signal',
    variant: 'geometric',
    colors: ['#203768', '#6D84FF', '#B6C4FF', '#F2D5E3', '#F8FAFC'],
    shellClassName: 'mt-5 h-[68px] w-[68px]',
    size: 64,
  },
  {
    key: 'focus',
    variant: 'bauhaus',
    colors: ['#0F172A', '#4259A8', '#AEBDFE', '#E6ECFF', '#F8FAFC'],
    shellClassName: 'mt-1 h-[56px] w-[56px]',
    size: 52,
  },
];

const DEFAULT_DEPARTMENT_HEAD_DIRECTORY: DepartmentHeadDirectoryEntry[] = [
  { department: 'Marketing', headName: 'Marketing Department Head' },
  { department: 'Human Resources', headName: 'HR Department Head' },
  { department: 'Administration', headName: 'Admin Department Head' },
  { department: 'Admissions', headName: 'Admissions Department Head' },
  { department: 'Placement Cell', headName: 'Placement Department Head' },
  { department: 'Finance', headName: 'Finance Department Head' },
  { department: 'Examinations', headName: 'Examinations Department Head' },
  { department: 'Student Affairs', headName: 'Student Affairs Department Head' },
];

const normalizeLookupToken = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const getDepartmentIcon = (department: string) => {
  const token = normalizeLookupToken(department);

  if (token.includes('marketing') || token.includes('media') || token.includes('branding')) {
    return Megaphone;
  }

  if (
    token.includes('human resource') ||
    token === 'hr' ||
    token.includes('people') ||
    token.includes('student affairs')
  ) {
    return UsersRound;
  }

  if (token.includes('admission') || token.includes('academic')) {
    return GraduationCap;
  }

  if (token.includes('placement') || token.includes('career')) {
    return BriefcaseBusiness;
  }

  if (token.includes('finance') || token.includes('accounts')) {
    return Landmark;
  }

  if (token.includes('exam') || token.includes('assessment')) {
    return ClipboardCheck;
  }

  if (token.includes('library')) {
    return BookOpen;
  }

  if (token.includes('maintenance') || token.includes('facility')) {
    return Wrench;
  }

  if (token.includes('admin') || token.includes('administration')) {
    return ShieldCheck;
  }

  return Building2;
};

const mergeDepartmentHeadDirectory = (
  entries: DepartmentHeadDirectoryEntry[]
): DepartmentHeadDirectoryEntry[] => {
  const deduped: DepartmentHeadDirectoryEntry[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const department = String(entry.department || '').trim();
    const headName = String(entry.headName || '').trim();
    if (!department || !headName) continue;

    const key = `${normalizeLookupToken(department)}::${normalizeLookupToken(headName)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push({ department, headName });
  }

  return deduped;
};

const BUILDER_STEPS: Array<{
  id: BuilderStepId;
  label: string;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: 'campaign',
    label: '01',
    title: 'Campaign Details',
    description: 'Add the request details and brief.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'timeline',
    label: '02',
    title: 'Timeline & Files',
    description: 'Set deadlines and upload shared files.',
    icon: CalendarRange,
  },
  {
    id: 'collaterals',
    label: '03',
    title: 'Collateral Builder',
    description: 'Add collateral items and item briefs.',
    icon: Layers3,
  },
  {
    id: 'review',
    label: '04',
    title: 'Review & Submit',
    description: 'Review the request before submission.',
    icon: ListChecks,
  },
];

const SINGLE_REQUEST_STEPS: Array<{
  label: string;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    label: '01',
    title: 'Request Details',
    description: 'Define the creative, requester, and deadline.',
    icon: FileText,
  },
  {
    label: '02',
    title: 'Files',
    description: 'Attach references and source material.',
    icon: Paperclip,
  },
  {
    label: '03',
    title: 'Review & Submit',
    description: 'Confirm the request before sending it.',
    icon: ListChecks,
  },
];

const REQUEST_TYPE_OPTIONS: Array<{
  value: RequestType;
  tag: string;
  label: string;
  description: string;
  cta: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    value: 'single_task',
    tag: 'Single',
    label: 'Quick Design',
    description: 'Request a single design deliverable.',
    cta: 'Start Request',
    icon: ClipboardCheck,
  },
  {
    value: 'campaign_request',
    tag: 'Multi-item',
    label: 'Campaign Suite',
    description: 'Request multiple related deliverables under one campaign.',
    cta: 'Start Campaign',
    icon: Layers3,
  },
];

const SINGLE_REQUEST_CATEGORY_OPTIONS: Array<{
  value: TaskCategory;
  label: string;
  icon: typeof Layers3;
}> = [
  { value: 'social_media_creative', label: 'Social Media Creative', icon: Megaphone },
  { value: 'banner', label: 'Banner', icon: FileImage },
  { value: 'flyer', label: 'Flyer', icon: FileText },
  { value: 'brochure', label: 'Brochure', icon: BookOpen },
  { value: 'website_assets', label: 'Website Assets', icon: Monitor },
  { value: 'ui_ux', label: 'UI / UX', icon: Monitor },
  { value: 'led_backdrop', label: 'LED Backdrop', icon: Tv },
];

const SINGLE_REQUEST_URGENCY_OPTIONS: Array<{ value: TaskUrgency; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  banner: 'Banner',
  campaign_or_others: 'Campaign or others',
  social_media_creative: 'Social Media Creative',
  website_assets: 'Website Assets',
  ui_ux: 'UI / UX',
  led_backdrop: 'LED Backdrop',
  brochure: 'Brochure',
  flyer: 'Flyer',
};

const TASK_URGENCY_LABELS: Record<TaskUrgency, string> = {
  low: 'Low',
  intermediate: 'Intermediate',
  normal: 'Normal',
  urgent: 'Urgent',
};

const HEADER_TITLE_MAX_LENGTH = 60;

const INDIAN_MOBILE_REGEX = /^\+91[6-9]\d{9}$/;
const NEW_REQUEST_TOUR_STORAGE_KEY_PREFIX = 'designhub:new-request:tour-seen';

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const getIndianPhoneLocalDigits = (value?: string) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const local = digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;
  return local.slice(0, 10);
};

const formatIndianPhoneInput = (value?: string) => {
  const local = getIndianPhoneLocalDigits(value);
  return local ? `+91 ${local}` : '';
};

const normalizeIndianPhone = (value?: string) => {
  const local = getIndianPhoneLocalDigits(value);
  if (local.length !== 10) return '';
  const normalized = `+91${local}`;
  return INDIAN_MOBILE_REGEX.test(normalized) ? normalized : '';
};

const truncateHeaderTitle = (value: string, maxLength = HEADER_TITLE_MAX_LENGTH) => {
  const normalized = String(value || '').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}â€¦`;
};

const minDeadlineDate = startOfDay(addOfficeOpenDays(new Date(), 3));
const minDeadlineInputValue = format(minDeadlineDate, 'yyyy-MM-dd');

const toBuilderAttachmentRecord = (attachments: BuilderAttachment[], uploadedBy?: string) =>
  attachments
    .filter((attachment) => !attachment.uploading && !attachment.error)
    .map((attachment) => ({
      id: attachment.driveId || attachment.id,
      name: attachment.name,
      url: attachment.url || attachment.webViewLink || '',
      driveId: attachment.driveId || '',
      webViewLink: attachment.webViewLink || '',
      webContentLink: attachment.webContentLink || '',
      type: 'input' as const,
      uploadedAt: new Date(),
      uploadedBy: uploadedBy || '',
      size: attachment.size,
      thumbnailUrl: attachment.thumbnailUrl,
    }));

const mapDraftCollateral = (collateral: CollateralDraft): RequestDraftCollateral => ({
  ...collateral,
  deadline: collateral.deadline?.toISOString(),
  referenceFiles: collateral.referenceFiles.map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    driveId: file.driveId,
    url: file.url,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    thumbnailUrl: file.thumbnailUrl,
  })),
});

const hydrateDraftCollateral = (collateral: RequestDraftCollateral): CollateralDraft => ({
  ...collateral,
  deadline: collateral.deadline ? new Date(collateral.deadline) : undefined,
  referenceFiles: collateral.referenceFiles.map((file) => ({
    ...file,
    uploading: false,
  })),
});

const createCollateralDraftFromPreset = (
  preset: CollateralPreset,
  deadlineMode: 'common' | 'itemized',
  commonDeadline?: Date
): CollateralDraft => ({
  id: crypto.randomUUID(),
  title: '',
  collateralType: preset.collateralType,
  presetCategory: preset.group,
  presetKey: preset.id,
  presetLabel: preset.label,
  sizeMode: preset.width && preset.height ? 'preset' : 'custom',
  width: preset.width,
  height: preset.height,
  unit: preset.unit || 'px',
  sizeLabel: preset.sizeLabel,
  ratioLabel: preset.ratioLabel,
  customSizeLabel: '',
  orientation: preset.orientation || 'custom',
  platform: preset.platform || '',
  usageType: preset.usageType || '',
  brief: '',
  deadline: deadlineMode === 'common' ? commonDeadline : minDeadlineDate,
  priority: 'normal',
  status: 'pending',
  referenceFiles: [],
});

const hasUploadingFiles = (attachments: BuilderAttachment[]) =>
  attachments.some((attachment) => attachment.uploading);

const hasErroredFiles = (attachments: BuilderAttachment[]) =>
  attachments.some((attachment) => attachment.error);

const getCompletedAttachmentCount = (attachments: BuilderAttachment[]) =>
  attachments.filter((attachment) => !attachment.uploading && !attachment.error).length;

const validateCampaignStep = ({
  title,
  department,
  requesterPhone,
  brief,
}: {
  title: string;
  department: string;
  requesterPhone: string;
  brief: string;
}) => {
  if (!title.trim()) return 'Campaign title is required.';
  if (!department.trim()) return 'Department is required.';
  if (!brief.trim()) return 'Overall campaign brief is required.';
  if (!normalizeIndianPhone(requesterPhone)) return 'Enter a valid 10-digit contact number.';
  return '';
};

const validateTimelineStep = ({
  deadlineMode,
  commonDeadline,
  masterAttachments,
}: {
  deadlineMode: 'common' | 'itemized';
  commonDeadline?: Date;
  masterAttachments: BuilderAttachment[];
}) => {
  if (deadlineMode === 'common' && !commonDeadline) {
    return 'Set a common deadline for the campaign.';
  }
  if (commonDeadline && startOfDay(commonDeadline) < minDeadlineDate) {
    return 'Campaign deadline must be at least 3 working days from today.';
  }
  if (hasUploadingFiles(masterAttachments)) {
    return 'Wait for master reference uploads to finish before continuing.';
  }
  if (hasErroredFiles(masterAttachments)) {
    return 'Resolve master reference upload errors before continuing.';
  }
  return '';
};

const validateCollateralsStep = ({
  deadlineMode,
  commonDeadline,
  collaterals,
}: {
  deadlineMode: 'common' | 'itemized';
  commonDeadline?: Date;
  collaterals: CollateralDraft[];
}) => {
  if (collaterals.length === 0) return 'Add at least one collateral item.';

  for (const collateral of collaterals) {
    if (!collateral.collateralType.trim()) {
      return 'Each collateral must have a collateral type.';
    }
    if (!collateral.brief.trim()) {
      return `Add a content brief for ${getCollateralDisplayName(collateral)}.`;
    }
    if (
      collateral.sizeMode === 'custom' &&
      !collateral.customSizeLabel?.trim() &&
      !(collateral.width && collateral.height)
    ) {
      return `Provide a custom size for ${getCollateralDisplayName(collateral)}.`;
    }

    const effectiveDeadline = deadlineMode === 'common' ? commonDeadline : collateral.deadline;
    if (!effectiveDeadline) {
      return `Set a deadline for ${getCollateralDisplayName(collateral)}.`;
    }
    if (startOfDay(effectiveDeadline) < minDeadlineDate) {
      return `Deadline for ${getCollateralDisplayName(collateral)} must be at least 3 working days from today.`;
    }
    if (hasUploadingFiles(collateral.referenceFiles)) {
      return `Wait for the uploads to finish for ${getCollateralDisplayName(collateral)}.`;
    }
    if (hasErroredFiles(collateral.referenceFiles)) {
      return `Resolve reference upload errors for ${getCollateralDisplayName(collateral)}.`;
    }
  }

  return '';
};

const validateReferenceCoverage = ({
  collaterals,
  masterAttachments,
}: {
  collaterals: CollateralDraft[];
  masterAttachments: BuilderAttachment[];
}) => {
  const hasAnyReference =
    masterAttachments.some((file) => !file.uploading && !file.error) ||
    collaterals.some((collateral) =>
      collateral.referenceFiles.some((file) => !file.uploading && !file.error)
    );

  if (!hasAnyReference) {
    return 'Upload at least one master or collateral-level reference before submitting.';
  }

  return '';
};

const validateBuilder = ({
  title,
  department,
  requesterPhone,
  brief,
  deadlineMode,
  commonDeadline,
  collaterals,
  masterAttachments,
}: {
  title: string;
  department: string;
  requesterPhone: string;
  brief: string;
  deadlineMode: 'common' | 'itemized';
  commonDeadline?: Date;
  collaterals: CollateralDraft[];
  masterAttachments: BuilderAttachment[];
}) =>
  validateCampaignStep({ title, department, requesterPhone, brief }) ||
  validateTimelineStep({ deadlineMode, commonDeadline, masterAttachments }) ||
  validateCollateralsStep({ deadlineMode, commonDeadline, collaterals }) ||
  validateReferenceCoverage({ collaterals, masterAttachments });

const validateSingleRequest = ({
  title,
  department,
  requesterPhone,
  brief,
  category,
  deadline,
  attachments,
}: {
  title: string;
  department: string;
  requesterPhone: string;
  brief: string;
  category: TaskCategory | '';
  deadline?: Date;
  attachments: BuilderAttachment[];
}) => {
  if (!title.trim()) return 'Creative title is required.';
  if (!department.trim()) return 'Department is required.';
  if (!brief.trim()) return 'Creative brief is required.';
  if (!category) return 'Select a creative category.';
  if (!normalizeIndianPhone(requesterPhone)) return 'Enter a valid 10-digit contact number.';
  if (!deadline) return 'Set a deadline for this request.';
  if (startOfDay(deadline) < minDeadlineDate) {
    return 'Deadline must be at least 3 working days from today.';
  }
  if (hasUploadingFiles(attachments)) {
    return 'Wait for file uploads to finish before submitting.';
  }
  if (hasErroredFiles(attachments)) {
    return 'Resolve file upload errors before submitting.';
  }
  if (getCompletedAttachmentCount(attachments) === 0) {
    return 'Upload at least one attachment or reference file before submitting.';
  }
  return '';
};

const resolveWizardStep = ({
  title,
  department,
  requesterPhone,
  brief,
  deadlineMode,
  commonDeadline,
  collaterals,
  masterAttachments,
}: {
  title: string;
  department: string;
  requesterPhone: string;
  brief: string;
  deadlineMode: 'common' | 'itemized';
  commonDeadline?: Date;
  collaterals: CollateralDraft[];
  masterAttachments: BuilderAttachment[];
}): BuilderStepId => {
  if (validateCampaignStep({ title, department, requesterPhone, brief })) return 'campaign';
  if (validateTimelineStep({ deadlineMode, commonDeadline, masterAttachments })) return 'timeline';
  if (validateCollateralsStep({ deadlineMode, commonDeadline, collaterals })) return 'collaterals';
  return 'review';
};

export default function NewRequest() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeRequestType = useMemo<RequestType | null>(() => {
    if (location.pathname === '/new-request/quick-design') return 'single_task';
    if (location.pathname === '/new-request/campaign-suite') return 'campaign_request';
    return null;
  }, [location.pathname]);
  const [selectedRequestType, setSelectedRequestType] = useState<RequestType | null>(routeRequestType);
  const [requestTitle, setRequestTitle] = useState('');
  const [department, setDepartment] = useState(user?.department || '');
  const [requesterPhone, setRequesterPhone] = useState(formatIndianPhoneInput(user?.phone));
  const [overallBrief, setOverallBrief] = useState('');
  const [singleCategory, setSingleCategory] = useState<TaskCategory | ''>('');
  const [singleUrgency, setSingleUrgency] = useState<TaskUrgency>('normal');
  const [singleDeadline, setSingleDeadline] = useState<Date | undefined>(minDeadlineDate);
  const [singleDeadlineCalendarOpen, setSingleDeadlineCalendarOpen] = useState(false);
  const [deadlineMode, setDeadlineMode] = useState<'common' | 'itemized'>('common');
  const [commonDeadline, setCommonDeadline] = useState<Date | undefined>(minDeadlineDate);
  const [commonDeadlineCalendarOpen, setCommonDeadlineCalendarOpen] = useState(false);
  const [masterAttachments, setMasterAttachments] = useState<BuilderAttachment[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralDraft[]>([]);
  const [expandedCollateralId, setExpandedCollateralId] = useState<string | null>(null);
  const existingCollateralTypes = useMemo(() => collaterals.map((c) => c.collateralType), [collaterals]);
  const [currentStep, setCurrentStep] = useState<BuilderStepId>('campaign');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessState, setSubmitSuccessState] = useState<SubmitSuccessState | null>(null);
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [isDepartmentSuggestionOpen, setIsDepartmentSuggestionOpen] = useState(false);
  const [shouldRevealSingleValidation, setShouldRevealSingleValidation] = useState(false);
  const [singleRequestActiveStep, setSingleRequestActiveStep] =
    useState<SingleRequestStepId>('details');
  const [revealedValidationSteps, setRevealedValidationSteps] = useState<
    Partial<Record<BuilderStepId, boolean>>
  >({});
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourSpotlight, setTourSpotlight] = useState<TourSpotlight | null>(null);
  const stepTrackerTourRef = useRef<HTMLElement | null>(null);
  const formPanelTourRef = useRef<HTMLElement | null>(null);
  const sidebarTourRef = useRef<HTMLElement | null>(null);
  const footerActionsTourRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledStepRef = useRef<string | null>(null);
  const prevSpotlightKeyRef = useRef<string>('');
  const tourStepIndexRef = useRef(tourStepIndex);
  tourStepIndexRef.current = tourStepIndex;

  const tourStorageKey = useMemo(() => {
    const userKey = String(
      user?.id || (user as { _id?: string } | null)?._id || user?.email || 'guest'
    );
    return `${NEW_REQUEST_TOUR_STORAGE_KEY_PREFIX}:${userKey}`;
  }, [user]);

  const handleSubmitSuccessModalChange = (open: boolean) => {
    if (open) return;
    setSubmitSuccessState(null);
    navigate('/my-requests');
  };

  const builderTourSteps = useMemo<BuilderTourStep[]>(
    () => [
      {
        id: 'campaign',
        builderStage: 'campaign',
        eyebrow: 'Step 1 of 4',
        title: 'Campaign Details',
        description:
          'Start here — add the campaign title, requester info, contact number, and a clear brief for the design team.',
        detail:
          'A well-written brief reduces revision rounds and speeds up delivery.',
        align: 'right',
        icon: BriefcaseBusiness,
      },
      {
        id: 'timeline',
        builderStage: 'timeline',
        eyebrow: 'Step 2 of 4',
        title: 'Timeline & Files',
        description:
          'Set practical deadlines and upload any shared reference files the design team will need.',
        detail:
          'Clear timelines help prioritise work across campaigns.',
        align: 'right',
        icon: CalendarRange,
      },
      {
        id: 'collaterals',
        builderStage: 'collaterals',
        eyebrow: 'Step 3 of 4',
        title: 'Collateral Builder',
        description:
          'Add each deliverable — posters, social media assets, banners — with its own brief, size, and references.',
        detail:
          'Each item gets its own spec so nothing is missed during execution.',
        align: 'right',
        icon: Layers3,
      },
      {
        id: 'review',
        builderStage: 'review',
        eyebrow: 'Step 4 of 4',
        title: 'Review & Submit',
        description:
          'Review everything in one summary before submitting. You can go back to edit any section.',
        detail:
          'The review shows all details across every stage in one glance.',
        align: 'right',
        icon: ListChecks,
      },
    ],
    []
  );
  const activeTourStep = builderTourSteps[tourStepIndex];

  const departmentHeadDirectory = useMemo(() => {
    const userDerived: DepartmentHeadDirectoryEntry[] =
      user?.department && user?.name
        ? [
            {
              department: user.department,
              headName: user.name,
            },
          ]
        : [];

    const taskDerived: DepartmentHeadDirectoryEntry[] = loadLocalTaskList()
      .map((task) => ({
        department: String(task.requesterDepartment || '').trim(),
        headName: String(task.requesterName || '').trim(),
      }))
      .filter((entry) => entry.department && entry.headName);

    return mergeDepartmentHeadDirectory([
      ...userDerived,
      ...taskDerived,
      ...DEFAULT_DEPARTMENT_HEAD_DIRECTORY,
    ]);
  }, [user?.department, user?.name]);

  const departmentSearchToken = useMemo(() => normalizeLookupToken(department), [department]);
  const resolveDepartmentHeadMatch = (value: string) => {
    const token = normalizeLookupToken(value);
    if (!token) return undefined;

    return departmentHeadDirectory.find((entry) => {
      const departmentToken = normalizeLookupToken(entry.department);
      const headToken = normalizeLookupToken(entry.headName);
      return departmentToken === token || headToken === token;
    });
  };

  const departmentSuggestions = useMemo(() => {
    const sorted = [...departmentHeadDirectory].sort(
      (left, right) =>
        left.department.localeCompare(right.department) ||
        left.headName.localeCompare(right.headName)
    );
    if (!departmentSearchToken) return sorted.slice(0, 8);

    const startsWithMatches: DepartmentHeadDirectoryEntry[] = [];
    const includesMatches: DepartmentHeadDirectoryEntry[] = [];

    for (const entry of sorted) {
      const departmentToken = normalizeLookupToken(entry.department);
      const headToken = normalizeLookupToken(entry.headName);
      const searchable = `${departmentToken} ${headToken}`;
      if (!searchable.includes(departmentSearchToken)) continue;

      if (
        departmentToken.startsWith(departmentSearchToken) ||
        headToken.startsWith(departmentSearchToken)
      ) {
        startsWithMatches.push(entry);
      } else {
        includesMatches.push(entry);
      }
    }

    return [...startsWithMatches, ...includesMatches].slice(0, 8);
  }, [departmentHeadDirectory, departmentSearchToken]);

  const exactDepartmentHeadMatch = resolveDepartmentHeadMatch(department);
  const shouldShowDepartmentSuggestions =
    isDepartmentSuggestionOpen &&
    departmentSuggestions.length > 0 &&
    !(
      exactDepartmentHeadMatch &&
      departmentSuggestions.length === 1 &&
      normalizeLookupToken(department) === normalizeLookupToken(exactDepartmentHeadMatch.headName)
    );

  const handleDepartmentHeadSelection = (entry: DepartmentHeadDirectoryEntry) => {
    setDepartment(entry.headName);
    setIsDepartmentSuggestionOpen(false);
    if (selectedRequestType === 'single_task') {
      setSingleRequestActiveStep('details');
    }
  };

  const handleDepartmentInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const match = resolveDepartmentHeadMatch(event.currentTarget.value);
    if (match && normalizeLookupToken(event.currentTarget.value) === normalizeLookupToken(match.headName)) {
      event.currentTarget.select();
    }
  };

  const handleDepartmentInputBlur = () => {
    window.setTimeout(() => setIsDepartmentSuggestionOpen(false), 120);
    const match = resolveDepartmentHeadMatch(department);
    if (match && normalizeLookupToken(department) === normalizeLookupToken(match.department)) {
      setDepartment(match.headName);
    }
  };

  useEffect(() => {
    setDepartment((current) => current || user?.department || '');
    setRequesterPhone((current) => current || formatIndianPhoneInput(user?.phone));
  }, [user?.department, user?.phone]);

  useEffect(() => {
    if (!routeRequestType) return;
    setSelectedRequestType(routeRequestType);
    if (routeRequestType === 'campaign_request') {
      setCurrentStep('campaign');
    }
  }, [routeRequestType]);

  useEffect(() => {
    const draft = loadRequestDraft(user);
    if (!draft) return;
    setDidRestoreDraft(true);

    const draftTitle = draft.title || '';
    const draftDepartment = draft.requesterDepartment || user?.department || '';
    const draftPhone = draft.requesterPhone || formatIndianPhoneInput(user?.phone);
    const draftBrief = draft.description || '';
    const draftAttachments = (draft.files || []).map((file) => ({
      ...file,
      uploading: false,
    }));

    setRequestTitle(draftTitle);
    setDepartment(draftDepartment);
    setRequesterPhone(draftPhone);
    setOverallBrief(draftBrief);
    setMasterAttachments(draftAttachments);

    const resolvedRequestType = routeRequestType || draft.requestType;

    if (resolvedRequestType === 'single_task') {
      const draftDeadline =
        draft.requestType === 'single_task' && draft.deadline
          ? new Date(draft.deadline)
          : minDeadlineDate;
      const restoredSingleCategory =
        draft.requestType === 'single_task' && draft.category !== 'campaign_or_others'
          ? draft.category || ''
          : '';
      setSelectedRequestType('single_task');
      setSingleCategory(restoredSingleCategory);
      setSingleUrgency(draft.requestType === 'single_task' ? draft.urgency || 'normal' : 'normal');
      setSingleDeadline(draftDeadline);
      setDeadlineMode('common');
      setCommonDeadline(minDeadlineDate);
      setCollaterals([]);
      setCurrentStep('campaign');
    } else {
      const draftDeadlineMode =
        draft.requestType === 'campaign_request' ? draft.deadlineMode || 'common' : 'common';
      const draftCommonDeadline =
        draft.requestType === 'campaign_request' && draft.commonDeadline
          ? new Date(draft.commonDeadline)
          : minDeadlineDate;
      const draftCollaterals =
        draft.requestType === 'campaign_request'
          ? (draft.collaterals || []).map(hydrateDraftCollateral)
          : [];

      setSelectedRequestType('campaign_request');
      setDeadlineMode(draftDeadlineMode);
      setCommonDeadline(draftCommonDeadline);
      setCollaterals(draftCollaterals);
      setSingleCategory('');
      setSingleUrgency('normal');
      setSingleDeadline(minDeadlineDate);
      setCurrentStep(
        resolveWizardStep({
          title: draftTitle,
          department: draftDepartment,
          requesterPhone: draftPhone,
          brief: draftBrief,
          deadlineMode: draftDeadlineMode,
          commonDeadline: draftCommonDeadline,
          collaterals: draftCollaterals,
          masterAttachments: draftAttachments,
        })
      );
    }

    toast.message('Draft restored.');
  }, [routeRequestType, user?.department, user?.email, user?.id, user?.phone]);

  const completeTour = useCallback(() => {
    setIsTourOpen(false);
    setTourSpotlight(null);
    lastScrolledStepRef.current = null;
    // Return user to the first stage after the tour finishes
    setCurrentStep('campaign');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tourStorageKey, '1');
    }
  }, [tourStorageKey]);

  const openTour = useCallback((nextStepIndex = 0) => {
    lastScrolledStepRef.current = null;
    setCurrentStep('campaign');
    setTourStepIndex(nextStepIndex);
    setIsTourOpen(true);
  }, []);

  // ── Tour: resolve target element for a given step ──
  // All tour steps highlight the main form panel since each step navigates
  // to a different builder stage — the form content changes with the stage.
  const resolveTourTarget = useCallback(
    (_stepId: BuilderTourStepId): HTMLElement | null => {
      return formPanelTourRef.current;
    },
    []
  );

  // ── Tour: compute & apply spotlight position ──
  // Reads step index from a ref so it never goes stale inside the rAF loop.
  const computeAndSetSpotlight = useCallback(() => {
    if (typeof window === 'undefined') return;

    const idx = tourStepIndexRef.current;
    const step = builderTourSteps[idx];
    if (!step) return;

    const target = resolveTourTarget(step.id);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const pad = 6;
    const spotW = Math.min(rect.width + pad * 2, window.innerWidth - 8);
    const spotH = Math.min(rect.height + pad * 2, window.innerHeight - 8);
    const spotL = Math.min(Math.max(4, rect.left - pad), window.innerWidth - spotW - 4);
    const spotT = Math.min(Math.max(4, rect.top - pad), window.innerHeight - spotH - 4);

    // All tour steps highlight the form panel (rounded-[24px])
    const radius = 24 + pad;

    const cardW = 370;
    const cardGap = 18;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let cardTop: number;
    let cardLeft: number;
    let arrowSide: TourCardPosition['arrowSide'];
    let arrowOffset: number;

    const spaceRight = vw - (spotL + spotW);
    const spaceLeft = spotL;
    const spaceBelow = vh - (spotT + spotH);

    if (spaceRight >= cardW + cardGap + 12) {
      cardLeft = spotL + spotW + cardGap;
      cardTop = Math.min(Math.max(16, spotT), vh - 320);
      arrowSide = 'left';
      arrowOffset = Math.min(Math.max(28, (spotT + spotH / 2) - cardTop), 280);
    } else if (spaceLeft >= cardW + cardGap + 12) {
      cardLeft = spotL - cardW - cardGap;
      cardTop = Math.min(Math.max(16, spotT), vh - 320);
      arrowSide = 'right';
      arrowOffset = Math.min(Math.max(28, (spotT + spotH / 2) - cardTop), 280);
    } else if (spaceBelow >= 200) {
      cardTop = spotT + spotH + cardGap;
      cardLeft = Math.min(Math.max(16, spotL + spotW / 2 - cardW / 2), vw - cardW - 16);
      arrowSide = 'top';
      arrowOffset = Math.min(Math.max(28, (spotL + spotW / 2) - cardLeft), cardW - 28);
    } else {
      cardTop = Math.max(16, spotT - 300 - cardGap);
      cardLeft = Math.min(Math.max(16, spotL + spotW / 2 - cardW / 2), vw - cardW - 16);
      arrowSide = 'bottom';
      arrowOffset = Math.min(Math.max(28, (spotL + spotW / 2) - cardLeft), cardW - 28);
    }

    // Skip state update if position didn't change (avoids 60fps re-renders)
    const key = `${step.id}|${Math.round(spotT)}|${Math.round(spotL)}|${Math.round(spotW)}|${Math.round(spotH)}|${arrowSide}`;
    if (key === prevSpotlightKeyRef.current) return;
    prevSpotlightKeyRef.current = key;

    setTourSpotlight({
      top: spotT,
      left: spotL,
      width: spotW,
      height: spotH,
      radius,
      card: { top: cardTop, left: cardLeft, arrowSide, arrowOffset },
    });
  }, [builderTourSteps, resolveTourTarget]);

  // ── Tour: auto-trigger on first visit ──
  useEffect(() => {
    if (selectedRequestType !== 'campaign_request') return;
    if (typeof window === 'undefined' || didRestoreDraft) return;
    if (window.localStorage.getItem(tourStorageKey) === '1') return;

    const timeoutId = window.setTimeout(() => {
      setTourStepIndex(0);
      setIsTourOpen(true);
    }, 480);

    return () => window.clearTimeout(timeoutId);
  }, [didRestoreDraft, selectedRequestType, tourStorageKey]);

  // ── Tour: navigate to the correct builder stage + scroll into view ──
  useEffect(() => {
    if (!isTourOpen || typeof window === 'undefined') return;
    const step = builderTourSteps[tourStepIndex];
    if (!step) return;

    // Only act once per step
    if (lastScrolledStepRef.current === step.id) return;
    lastScrolledStepRef.current = step.id;

    // Navigate to the builder stage this tour step describes
    setCurrentStep(step.builderStage);

    // Wait for React to render the new stage content, then scroll
    const timerId = window.setTimeout(() => {
      const target = resolveTourTarget(step.id);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }, 80);

    return () => window.clearTimeout(timerId);
  }, [builderTourSteps, isTourOpen, resolveTourTarget, tourStepIndex]);

  // ── Tour: main rAF loop + keyboard + cleanup ──
  // This single effect runs the entire time the tour is open.
  // It does NOT depend on tourStepIndex or activeTourStep —
  // computeAndSetSpotlight reads from tourStepIndexRef so it's never stale.
  useEffect(() => {
    if (selectedRequestType !== 'campaign_request') {
      setIsTourOpen(false);
      setTourSpotlight(null);
      return;
    }
    if (!isTourOpen || typeof window === 'undefined') return;

    let alive = true;
    let rafId: number | undefined;

    const tick = () => {
      if (!alive) return;
      computeAndSetSpotlight();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        completeTour();
        return;
      }
      if (event.key === 'ArrowRight') {
        setTourStepIndex((c) => Math.min(c + 1, builderTourSteps.length - 1));
        return;
      }
      if (event.key === 'ArrowLeft') {
        setTourStepIndex((c) => Math.max(c - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      alive = false;
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    builderTourSteps.length,
    completeTour,
    computeAndSetSpotlight,
    isTourOpen,
    selectedRequestType,
  ]);

  const summary = useMemo(() => {
    const effectiveDeadline = deriveEffectiveDeadline(collaterals, {
      deadlineMode,
      commonDeadline,
    });
    const masterReferenceCount = masterAttachments.filter((attachment) => !attachment.error).length;
    const collateralReferenceCount = collaterals.reduce(
      (total, collateral) =>
        total + collateral.referenceFiles.filter((attachment) => !attachment.error).length,
      0
    );
    return {
      collateralCount: collaterals.length,
      masterReferenceCount,
      collateralReferenceCount,
      totalReferenceCount: masterReferenceCount + collateralReferenceCount,
      effectiveDeadline,
      taskCategory: deriveTaskCategoryFromCollaterals(collaterals),
      urgency: deriveTaskUrgencyFromCollaterals(collaterals),
    };
  }, [collaterals, commonDeadline, deadlineMode, masterAttachments]);

  const campaignValidationMessage = useMemo(
    () =>
      validateCampaignStep({
        title: requestTitle,
        department,
        requesterPhone,
        brief: overallBrief,
      }),
    [department, overallBrief, requestTitle, requesterPhone]
  );

  const timelineValidationMessage = useMemo(
    () =>
      validateTimelineStep({
        deadlineMode,
        commonDeadline,
        masterAttachments,
      }),
    [commonDeadline, deadlineMode, masterAttachments]
  );

  const collateralValidationMessage = useMemo(
    () =>
      validateCollateralsStep({
        deadlineMode,
        commonDeadline,
        collaterals,
      }),
    [collaterals, commonDeadline, deadlineMode]
  );

  const reviewValidationMessage = useMemo(
    () =>
      validateBuilder({
        title: requestTitle,
        department,
        requesterPhone,
        brief: overallBrief,
        deadlineMode,
        commonDeadline,
        collaterals,
        masterAttachments,
      }),
    [
      collaterals,
      commonDeadline,
      deadlineMode,
      department,
      masterAttachments,
      overallBrief,
      requestTitle,
      requesterPhone,
    ]
  );

  const singleValidationMessage = useMemo(
    () =>
      validateSingleRequest({
        title: requestTitle,
        department,
        requesterPhone,
        brief: overallBrief,
        category: singleCategory,
        deadline: singleDeadline,
        attachments: masterAttachments,
      }),
    [
      department,
      masterAttachments,
      overallBrief,
      requestTitle,
      requesterPhone,
      singleCategory,
      singleDeadline,
    ]
  );
  const singleDetailsValidationMessage = useMemo(() => {
    if (!requestTitle.trim()) return 'Creative title is required.';
    if (!department.trim()) return 'Department is required.';
    if (!overallBrief.trim()) return 'Creative brief is required.';
    if (!singleCategory) return 'Select a creative category.';
    if (!normalizeIndianPhone(requesterPhone)) return 'Enter a valid 10-digit contact number.';
    if (!singleDeadline) return 'Set a deadline for this request.';
    if (startOfDay(singleDeadline) < minDeadlineDate) {
      return 'Deadline must be at least 3 working days from today.';
    }
    return '';
  }, [
    department,
    overallBrief,
    requestTitle,
    requesterPhone,
    singleCategory,
    singleDeadline,
  ]);
  const singleFilesValidationMessage = useMemo(() => {
    if (hasUploadingFiles(masterAttachments)) {
      return 'Wait for file uploads to finish before continuing.';
    }
    if (hasErroredFiles(masterAttachments)) {
      return 'Resolve file upload errors before continuing.';
    }
    if (getCompletedAttachmentCount(masterAttachments) === 0) {
      return 'Upload at least one attachment or reference file before continuing.';
    }
    return '';
  }, [masterAttachments]);
  const singleCompletedAttachmentCount = useMemo(
    () => getCompletedAttachmentCount(masterAttachments),
    [masterAttachments]
  );
  const singleFilesStepComplete = singleCompletedAttachmentCount > 0;
  const singleRequestCurrentStepIndex =
    singleRequestActiveStep === 'files' ? 1 : singleRequestActiveStep === 'review' ? 2 : 0;

  const validationMessages: Record<BuilderStepId, string> = {
    campaign: campaignValidationMessage,
    timeline: timelineValidationMessage,
    collaterals: collateralValidationMessage,
    review: reviewValidationMessage,
  };
  const currentStepValidationMessage = revealedValidationSteps[currentStep]
    ? validationMessages[currentStep]
    : '';

  const currentStepIndex = BUILDER_STEPS.findIndex((step) => step.id === currentStep);
  const furthestUnlockedStepIndex = campaignValidationMessage
    ? 0
    : timelineValidationMessage
      ? 1
      : collateralValidationMessage
        ? 2
        : 3;

  const saveDraft = () => {
    if (!selectedRequestType) {
      toast.error('Choose a request type first.');
      return;
    }

    if (selectedRequestType === 'single_task') {
      saveRequestDraft(user, {
        title: requestTitle,
        description: overallBrief,
        category: singleCategory,
        urgency: singleUrgency,
        deadline: singleDeadline?.toISOString() || '',
        hasDeadlineInteracted: Boolean(singleDeadline),
        isEmergency: false,
        requesterPhone,
        files: masterAttachments.map((file) => ({
          id: file.id,
          name: file.name,
          size: file.size,
          driveId: file.driveId,
          url: file.url,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink,
          thumbnailUrl: file.thumbnailUrl,
        })),
        requestType: 'single_task',
        requesterDepartment: department,
        savedAt: new Date().toISOString(),
      });
      toast.success('Draft saved.');
      return;
    }

    const payload: RequestDraftPayload = {
      title: requestTitle,
      description: overallBrief,
      category: deriveTaskCategoryFromCollaterals(collaterals),
      urgency: deriveTaskUrgencyFromCollaterals(collaterals),
      deadline: commonDeadline?.toISOString() || '',
      hasDeadlineInteracted: Boolean(commonDeadline),
      isEmergency: false,
      requesterPhone,
      files: masterAttachments.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        driveId: file.driveId,
        url: file.url,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        thumbnailUrl: file.thumbnailUrl,
      })),
      requestType: 'campaign_request',
      deadlineMode,
      commonDeadline: commonDeadline?.toISOString(),
      collaterals: collaterals.map(mapDraftCollateral),
      requesterDepartment: department,
      savedAt: new Date().toISOString(),
    };
    saveRequestDraft(user, payload);
    toast.success('Draft saved.');
  };

  const handleStepChange = (nextStep: BuilderStepId) => {
    const targetIndex = BUILDER_STEPS.findIndex((step) => step.id === nextStep);
    if (targetIndex <= furthestUnlockedStepIndex) {
      setCurrentStep(nextStep);
      return;
    }

    const blockingStep = BUILDER_STEPS[furthestUnlockedStepIndex].id;
    setCurrentStep(blockingStep);
    setRevealedValidationSteps((previous) => ({ ...previous, [blockingStep]: true }));
  };

  const handleNextStep = () => {
    const validationMessage = validationMessages[currentStep];
    if (validationMessage) {
      setRevealedValidationSteps((previous) => ({ ...previous, [currentStep]: true }));
      return;
    }

    const nextStep = BUILDER_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setCurrentStep(nextStep.id);
    }
  };

  const handlePreviousStep = () => {
    const previousStep = BUILDER_STEPS[currentStepIndex - 1];
    if (previousStep) {
      setCurrentStep(previousStep.id);
    }
  };

  const openSubmitSuccessModal = (
    requestType: RequestType,
    taskTitle: string,
    storedLocally = false
  ) => {
    setSubmitSuccessState({
      requestType,
      taskTitle,
      storedLocally,
    });
  };

  const handleSubmit = async () => {
    if (!selectedRequestType) {
      toast.error('Choose a request type first.');
      return;
    }

    if (selectedRequestType === 'single_task') {
      const validationMessage = validateSingleRequest({
        title: requestTitle,
        department,
        requesterPhone,
        brief: overallBrief,
        category: singleCategory,
        deadline: singleDeadline,
        attachments: masterAttachments,
      });

      if (validationMessage) {
        setShouldRevealSingleValidation(true);
        setSingleRequestActiveStep(singleDetailsValidationMessage ? 'details' : 'files');
        return;
      }

      setSingleRequestActiveStep('review');

      const normalizedPhone = normalizeIndianPhone(requesterPhone);
      const payload = {
        requestType: 'single_task' as const,
        title: requestTitle.trim(),
        description: overallBrief.trim(),
        category: singleCategory,
        urgency: singleUrgency,
        status: 'pending' as const,
        deadline: singleDeadline,
        requesterId: user?.id || '',
        requesterName: user?.name || '',
        requesterEmail: user?.email || '',
        requesterPhone: normalizedPhone,
        requesterDepartment: department.trim(),
        isEmergency: false,
        designVersions: [],
        files: toBuilderAttachmentRecord(masterAttachments, user?.id),
      };

      setIsSubmitting(true);
      try {
        if (!API_URL) {
          throw new Error('API unavailable');
        }
        const response = await authFetch(`${API_URL}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            data && typeof data.error === 'string' && data.error.trim()
              ? data.error.trim()
              : 'Failed to create request.'
          );
        }
        window.dispatchEvent(new CustomEvent('designhub:request:new', { detail: data }));
        clearRequestDraft(user);
        openSubmitSuccessModal('single_task', requestTitle.trim() || 'Quick Design Request');
        return;
      } catch (error) {
        const now = new Date();
        const fallbackTask: Task = {
          id: crypto.randomUUID(),
          requestType: 'single_task',
          title: requestTitle.trim(),
          description: overallBrief.trim(),
          category: singleCategory || 'social_media_creative',
          urgency: singleUrgency,
          status: 'pending',
          requesterId: user?.id || '',
          requesterName: user?.name || 'Staff',
          requesterEmail: user?.email,
          requesterPhone: normalizedPhone,
          requesterDepartment: department.trim(),
          deadline: singleDeadline || minDeadlineDate,
          isModification: false,
          changeCount: 0,
          changeHistory: [
            {
              id: crypto.randomUUID(),
              type: 'status',
              field: 'created',
              newValue: 'Created',
              note: `Single creative request submitted by ${user?.name || 'Staff'}`,
              userId: user?.id || '',
              userName: user?.name || 'Staff',
              userRole: user?.role || 'staff',
              createdAt: now,
            },
          ],
          designVersions: [],
          files: toBuilderAttachmentRecord(masterAttachments, user?.id),
          comments: [],
          createdAt: now,
          updatedAt: now,
        };
        upsertLocalTask(fallbackTask);
        clearRequestDraft(user);
        window.dispatchEvent(new CustomEvent('designhub:request:new', { detail: fallbackTask }));
        openSubmitSuccessModal('single_task', fallbackTask.title, true);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const validationMessage = validateBuilder({
      title: requestTitle,
      department,
      requesterPhone,
      brief: overallBrief,
      deadlineMode,
      commonDeadline,
      collaterals,
      masterAttachments,
    });

    if (validationMessage) {
      const blockingStep = resolveWizardStep({
        title: requestTitle,
        department,
        requesterPhone,
        brief: overallBrief,
        deadlineMode,
        commonDeadline,
        collaterals,
        masterAttachments,
      });
      setCurrentStep(blockingStep);
      setRevealedValidationSteps((previous) => ({
        ...previous,
        [blockingStep]: true,
      }));
      return;
    }

    const normalizedPhone = normalizeIndianPhone(requesterPhone);
    const persistedCollaterals = collaterals.map((collateral) => ({
      ...collateral,
      deadline: deadlineMode === 'common' ? commonDeadline : collateral.deadline,
      referenceFiles: toBuilderAttachmentRecord(collateral.referenceFiles, user?.id),
      status: 'pending' as const,
    }));
    const campaign = {
      requestName: requestTitle.trim(),
      brief: overallBrief.trim(),
      deadlineMode,
      commonDeadline,
    };
    const effectiveDeadline = deriveEffectiveDeadline(persistedCollaterals, campaign);
    if (!effectiveDeadline) {
      toast.error('Unable to derive a request deadline.');
      return;
    }

    const payload = {
      requestType: 'campaign_request' as const,
      title: requestTitle.trim(),
      description: buildCampaignDescription(campaign, persistedCollaterals as any),
      category: deriveTaskCategoryFromCollaterals(persistedCollaterals as any),
      urgency: deriveTaskUrgencyFromCollaterals(persistedCollaterals as any),
      status: deriveTaskStatusFromCollaterals(persistedCollaterals, 'pending'),
      deadline: effectiveDeadline,
      requesterId: user?.id || '',
      requesterName: user?.name || '',
      requesterEmail: user?.email || '',
      requesterPhone: normalizedPhone,
      requesterDepartment: department.trim(),
      isEmergency: false,
      designVersions: [],
      files: toBuilderAttachmentRecord(masterAttachments, user?.id),
      campaign: {
        requestName: requestTitle.trim(),
        brief: overallBrief.trim(),
        deadlineMode,
        commonDeadline,
      },
      collaterals: persistedCollaterals,
    };

    setIsSubmitting(true);
    try {
      if (!API_URL) {
        throw new Error('API unavailable');
      }
      const response = await authFetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data && typeof data.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'Failed to create request.'
        );
      }
      window.dispatchEvent(new CustomEvent('designhub:request:new', { detail: data }));
      clearRequestDraft(user);
      openSubmitSuccessModal('campaign_request', requestTitle.trim() || 'Campaign Request');
      return;
    } catch (error) {
      const now = new Date();
      const fallbackTask: Task = {
        id: crypto.randomUUID(),
        requestType: 'campaign_request',
        title: requestTitle.trim(),
        description: buildCampaignDescription(campaign, persistedCollaterals as any),
        category: deriveTaskCategoryFromCollaterals(persistedCollaterals as any),
        urgency: deriveTaskUrgencyFromCollaterals(persistedCollaterals as any),
        status: 'pending',
        requesterId: user?.id || '',
        requesterName: user?.name || 'Staff',
        requesterEmail: user?.email,
        requesterPhone: normalizedPhone,
        requesterDepartment: department.trim(),
        deadline: effectiveDeadline,
        isModification: false,
        changeCount: 0,
        changeHistory: [
          {
            id: crypto.randomUUID(),
            type: 'status',
            field: 'created',
            newValue: 'Created',
            note: `Campaign request submitted by ${user?.name || 'Staff'}`,
            userId: user?.id || '',
            userName: user?.name || 'Staff',
            userRole: user?.role || 'staff',
            createdAt: now,
          },
        ],
        designVersions: [],
        files: toBuilderAttachmentRecord(masterAttachments, user?.id),
        campaign: {
          requestName: requestTitle.trim(),
          brief: overallBrief.trim(),
          deadlineMode,
          commonDeadline,
        },
        collaterals: persistedCollaterals as any,
        comments: [],
        createdAt: now,
        updatedAt: now,
      };
      upsertLocalTask(fallbackTask);
      clearRequestDraft(user);
      window.dispatchEvent(new CustomEvent('designhub:request:new', { detail: fallbackTask }));
      openSubmitSuccessModal('campaign_request', fallbackTask.title, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const glassInputClass =
    'border-input bg-background shadow-none focus-visible:ring-ring/30 focus-visible:ring-offset-0';
  const glassCardClass =
    'rounded-[24px] border border-[#CEDBFF]/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(243,247,255,0.16),rgba(231,239,255,0.12))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(243,247,255,0.12),rgba(231,239,255,0.08))] backdrop-blur-xl dark:border-sidebar-border dark:bg-sidebar/95 dark:supports-[backdrop-filter]:bg-sidebar/86 dark:backdrop-blur-[24px]';
  const reviewSurfaceClass =
    'rounded-[24px] border border-[#CEDBFF]/35 bg-white/80 supports-[backdrop-filter]:bg-white/62 backdrop-blur-xl dark:border-sidebar-border dark:bg-sidebar/95 dark:supports-[backdrop-filter]:bg-sidebar/86 dark:backdrop-blur-[24px]';
  const reviewDenseCardClass =
    'overflow-hidden rounded-[18px] border border-[#D8E4FF]/80 bg-white/84 supports-[backdrop-filter]:bg-white/66 shadow-none backdrop-blur-xl dark:border-sidebar-border dark:bg-sidebar/95 dark:supports-[backdrop-filter]:bg-sidebar/86 dark:shadow-none dark:backdrop-blur-[24px]';
  const reviewDenseLabelClass =
    'text-[12px] font-medium leading-[1.35] text-muted-foreground';
  const reviewDenseValueClass =
    'text-[14px] font-medium leading-[1.4] text-foreground';
  const reviewDenseChipClass =
    'inline-flex items-center rounded-full border border-[#D8E4FF]/90 bg-[#F8FBFF]/90 px-3 py-1 text-[12px] font-medium leading-none text-[#33446F] dark:border-sidebar-border dark:bg-sidebar-accent/72 dark:text-sidebar-foreground';
  const reviewDenseTableHeaderClass =
    'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground';
  const builderSurfaceClass =
    'rounded-[24px] border border-border/70 bg-white dark:border-sidebar-border dark:bg-sidebar-accent dark:[background-image:none]';
  const builderInsetCardClass =
    'rounded-2xl border border-border/70 bg-background/70 dark:border-sidebar-border dark:bg-sidebar-accent/76 dark:supports-[backdrop-filter]:bg-sidebar-accent/62 dark:backdrop-blur-[24px]';
  const builderFooterClass =
    'relative border-t border-[#E7EEFF]/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.56),rgba(243,247,255,0.74))] px-5 py-3 supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(243,247,255,0.5))] backdrop-blur-md dark:border-sidebar-border dark:bg-sidebar dark:[background-image:none]';
  const builderSecondaryActionClass =
    'h-10 rounded-[14px] border border-[#D7E2FF]/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(242,246,255,0.92))] px-4 text-[13px] font-semibold text-[#223067] shadow-[0_12px_24px_-22px_rgba(59,99,204,0.24)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.74),rgba(242,246,255,0.66))] backdrop-blur-md transition-all duration-200 hover:border-[#C7D8FF] hover:bg-[#EEF4FF]/92 hover:text-[#1E2A5A] hover:shadow-[0_16px_30px_-22px_rgba(59,99,204,0.28)] dark:border-sidebar-border dark:bg-sidebar/60 dark:[background-image:none] dark:text-sidebar-foreground dark:shadow-none dark:hover:border-sidebar-ring/35 dark:hover:bg-sidebar-accent dark:hover:text-white';
  const builderValidationClass =
    'mb-3 flex items-center gap-3 rounded-[18px] border border-[#D9E6FF]/75 bg-[radial-gradient(circle_at_top_left,rgba(143,168,255,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,249,255,0.92),rgba(236,243,255,0.84))] px-3.5 py-3 text-sm text-foreground shadow-[0_18px_45px_-30px_rgba(37,99,235,0.2)] supports-[backdrop-filter]:bg-[radial-gradient(circle_at_top_left,rgba(143,168,255,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(245,249,255,0.72),rgba(236,243,255,0.62))] backdrop-blur-md ring-1 ring-white/70 dark:border-[#253D78]/90 dark:bg-[radial-gradient(circle_at_top_left,rgba(96,124,255,0.16),transparent_30%),linear-gradient(135deg,rgba(8,16,39,0.96),rgba(10,22,49,0.92),rgba(12,27,59,0.88))] dark:text-slate-100 dark:ring-white/5 dark:shadow-[0_22px_56px_-32px_rgba(2,8,23,0.95)]';
  const suggestionPopoverClass =
    'absolute left-0 top-[calc(100%+0.5rem)] z-40 w-full overflow-hidden rounded-2xl border border-[#D9E6FF]/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,248,255,0.74))] p-2.5 shadow-[0_24px_54px_-30px_rgba(59,99,204,0.24)] supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(244,248,255,0.3))] backdrop-blur-[22px] ring-1 ring-white/55 animate-dropdown sm:min-w-[23rem] dark:border-[#253D78]/90 dark:bg-[linear-gradient(180deg,rgba(8,16,39,0.96),rgba(10,22,49,0.92),rgba(12,27,59,0.88))] dark:ring-white/5 dark:shadow-[0_24px_60px_-34px_rgba(2,8,23,0.95)] dark:supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(8,16,39,0.82),rgba(10,22,49,0.72),rgba(12,27,59,0.66))]';
  const suggestionItemClass =
    'group flex w-full items-center gap-2 rounded-[18px] border px-3.5 py-3 text-left transition-all duration-200';
  const requestFieldClass =
    'h-11 rounded-xl border-[#D9E6FF] bg-white/90 px-3 text-sm text-[#1E2A44] shadow-none transition-colors placeholder:text-[13px] placeholder:text-[#8090B2] focus-visible:border-[#BDD0FF] focus-visible:ring-0 dark:border-sidebar-border dark:bg-sidebar/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-sidebar-ring/50';
  const requestFieldWithIconClass = cn(
    requestFieldClass,
    'pl-12 pr-3.5'
  );
  const requestFieldIconClass =
    'pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200';
  const requestSelectTriggerClass =
    'h-11 rounded-xl border-[#D9E6FF] bg-white/90 px-3 text-left text-sm text-[#1E2A44] shadow-none transition-colors focus:ring-0 dark:border-sidebar-border dark:bg-sidebar/60 dark:text-slate-100';
  const requestSelectContentClass =
    'rounded-xl border-[#D9E6FF] bg-white/95 p-1.5 shadow-lg dark:border-border dark:bg-card/95';
  const requestSelectItemClass =
    'rounded-lg pl-9 pr-3 data-[state=checked]:bg-primary/15 data-[state=checked]:text-[#1E2A5A] data-[state=checked]:font-semibold';
  const requestTextareaClass =
    'min-h-[132px] rounded-xl border-[#D9E6FF] bg-white/90 px-4 py-3 text-sm text-[#1E2A44] shadow-none transition-colors placeholder:text-[13px] placeholder:text-[#8090B2] focus-visible:border-[#BDD0FF] focus-visible:ring-0 dark:border-sidebar-border dark:bg-sidebar/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-sidebar-ring/50';
  const phoneFieldShellClass =
    'group flex h-11 items-center gap-2 rounded-xl border border-[#D9E6FF] bg-white/90 px-3 shadow-none transition-colors duration-200 focus-within:border-[#BDD0FF] dark:border-sidebar-border dark:bg-sidebar/60 dark:focus-within:border-sidebar-ring/50';
  const requesterPhoneLocal = getIndianPhoneLocalDigits(requesterPhone);
  const selectedSingleCategoryOption = SINGLE_REQUEST_CATEGORY_OPTIONS.find(
    (option) => option.value === singleCategory
  );
  const SelectedSingleCategoryIcon = selectedSingleCategoryOption?.icon || Layers3;
  const selectedSingleUrgencyOption = SINGLE_REQUEST_URGENCY_OPTIONS.find(
    (option) => option.value === singleUrgency
  );
  const selectedDeadlineModeLabel =
    deadlineMode === 'itemized' ? 'Individual item deadlines' : 'Common deadline';

  const handleRequestTypeSelect = (nextType: RequestType) => {
    setSelectedRequestType(nextType);
    setShouldRevealSingleValidation(false);
    setSingleRequestActiveStep('details');
    navigate(
      nextType === 'single_task' ? '/new-request/quick-design' : '/new-request/campaign-suite'
    );
    if (nextType === 'campaign_request') {
      setCurrentStep('campaign');
    } else {
      setIsPresetDialogOpen(false);
      setIsTourOpen(false);
      setTourSpotlight(null);
    }
  };

  const resetRequestTypeSelection = () => {
    setSelectedRequestType(null);
    setShouldRevealSingleValidation(false);
    setSingleRequestActiveStep('details');
    setIsPresetDialogOpen(false);
    setIsTourOpen(false);
    setTourSpotlight(null);
    navigate('/new-request');
  };

  const renderDepartmentRequesterField = () => (
    <div className="space-y-2">
      <Label>Department / Requester</Label>
      <div className="relative">
        <span className={requestFieldIconClass}>
          <Building2 className="h-4 w-4" />
        </span>
        <Input
          value={department}
          onChange={(event) => {
            setDepartment(event.target.value);
            setIsDepartmentSuggestionOpen(Boolean(event.target.value.trim()));
          }}
          onFocus={handleDepartmentInputFocus}
          onBlur={handleDepartmentInputBlur}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsDepartmentSuggestionOpen(false);
              return;
            }
            if (event.key === 'ArrowDown') {
              if (departmentSuggestions.length > 0) {
                setIsDepartmentSuggestionOpen(true);
              }
              return;
            }
            if (event.key !== 'Enter') return;

            const exactMatch = resolveDepartmentHeadMatch(event.currentTarget.value);
            const suggestedMatch = exactMatch || departmentSuggestions[0];
            if (!suggestedMatch) return;

            if (exactMatch || departmentSuggestions.length === 1) {
              event.preventDefault();
              handleDepartmentHeadSelection(suggestedMatch);
            }
          }}
          autoComplete="off"
          placeholder="Type department or requester name"
          className={cn(requestFieldWithIconClass, 'py-0 leading-[2.25rem]')}
        />
        {shouldShowDepartmentSuggestions && (
          <div className={suggestionPopoverClass}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(164,190,255,0.24),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.32),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,124,255,0.2),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
            <div className="relative max-h-56 space-y-1.5 overflow-auto scrollbar-none">
              {departmentSuggestions.map((entry, index) => {
                const isSelected =
                  normalizeLookupToken(department) === normalizeLookupToken(entry.headName);
                const DepartmentIcon = getDepartmentIcon(entry.department);
                return (
                  <div key={`${entry.department}-${entry.headName}`}>
                    <button
                      type="button"
                      onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
                      onClick={() => handleDepartmentHeadSelection(entry)}
                      className={cn(
                        suggestionItemClass,
                        isSelected
                          ? 'border-[#D4E2FF] bg-[linear-gradient(135deg,rgba(243,247,255,0.98),rgba(234,241,255,0.92))] shadow-[0_16px_30px_-24px_rgba(59,99,204,0.28)] dark:border-sidebar-ring/30 dark:bg-sidebar-accent/82 dark:shadow-none'
                          : 'border-transparent bg-transparent hover:border-[#C9DBFF] hover:bg-[linear-gradient(135deg,rgba(243,247,255,0.9),rgba(232,240,255,0.82))] hover:shadow-[0_14px_28px_-24px_rgba(59,99,204,0.22)] dark:hover:border-sidebar-border dark:hover:bg-sidebar-accent/74 dark:hover:shadow-none'
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(240,245,255,0.74),rgba(233,240,255,0.68))] text-[#5A74B7] shadow-[0_12px_24px_-20px_rgba(59,99,204,0.22)] ring-1 ring-white/55 supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(240,245,255,0.42),rgba(233,240,255,0.36))] backdrop-blur-md dark:border-white/10 dark:bg-sidebar/78 dark:text-slate-300 dark:ring-white/10 dark:shadow-none">
                        <DepartmentIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <span
                          title={entry.headName}
                          className="block truncate pr-1 text-[14px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#1E2A44] dark:text-slate-100"
                        >
                          {entry.headName}
                        </span>
                        <span className="inline-flex rounded-full bg-[#EEF4FF]/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7087BC] dark:bg-sidebar-accent dark:text-slate-400">
                          {entry.department}
                        </span>
                      </div>
                      {isSelected ? (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(241,246,255,0.74))] text-[#4A65A8] ring-1 ring-white/55 supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.62),rgba(241,246,255,0.5))] backdrop-blur-sm dark:border-white/10 dark:bg-sidebar dark:text-white dark:ring-white/10">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : null}
                    </button>
                    {index < departmentSuggestions.length - 1 ? (
                      <div className="mx-3 h-px bg-[linear-gradient(90deg,transparent,rgba(199,214,255,0.9),transparent)] dark:bg-[linear-gradient(90deg,transparent,rgba(92,119,198,0.5),transparent)]" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {isDepartmentSuggestionOpen && department.trim() && departmentSuggestions.length === 0 && (
          <div
            className={cn(
              suggestionPopoverClass,
              'border-dashed px-4 py-3 text-xs text-muted-foreground backdrop-blur-xl'
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(164,190,255,0.24),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.32),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,124,255,0.2),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
            <div className="relative">
              No matching department head found. Press Enter to keep the typed value.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPhoneField = () => (
    <div className="space-y-2">
      <Label>Contact Number</Label>
      <div className={phoneFieldShellClass}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200">
          <Phone className="h-4 w-4" />
        </div>
        <div className="h-5 w-px shrink-0 bg-[#D8E2FF] dark:bg-sidebar-border" />
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#DCE6FF] bg-[#F8FAFF] px-2.5 py-1 text-[12px] font-semibold tracking-[0.08em] text-[#415896] dark:border-sidebar-border/70 dark:bg-sidebar-accent dark:text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5E7BDA] dark:bg-sidebar-primary" />
          +91
        </div>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          value={requesterPhoneLocal}
          onChange={(event) =>
            setRequesterPhone(formatIndianPhoneInput(`+91 ${event.target.value}`))
          }
          placeholder="9876543210"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium tracking-[0.01em] text-[#1E2A44] outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-[#8090B2] selection:bg-transparent autofill:bg-transparent autofill:shadow-[inset_0_0_0px_1000px_transparent] autofill:[-webkit-text-fill-color:#1E2A44] dark:text-slate-100 dark:autofill:[-webkit-text-fill-color:#F8FAFC]"
        />
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (currentStep === 'campaign') {
      return (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Campaign Title</Label>
              <div className="relative">
                <span className={requestFieldIconClass}>
                  <FileText className="h-4 w-4" />
                </span>
                <Input
                  value={requestTitle}
                  onChange={(event) => setRequestTitle(event.target.value)}
                  placeholder="Admissions Drive 2026 / Annual Day / Product Launch Campaign"
                  className={requestFieldWithIconClass}
                />
              </div>
            </div>
            {renderDepartmentRequesterField()}
            {renderPhoneField()}
          </div>

          <div className="space-y-2">
            <Label>Overall Brief</Label>
            <Textarea
              value={overallBrief}
              onChange={(event) => setOverallBrief(event.target.value)}
              className={requestTextareaClass}
              placeholder="Describe the campaign objective, audience, message hierarchy, mandatory copy, visual tone, logos, language, and approval context."
            />
          </div>
        </section>
      );
    }

    if (currentStep === 'timeline') {
      return (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
            <div className="space-y-2">
              <Label>Deadline Mode</Label>
              <Select
                value={deadlineMode}
                onValueChange={(value) => setDeadlineMode(value as 'common' | 'itemized')}
              >
                <SelectTrigger className={requestSelectTriggerClass}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200">
                      <CalendarRange className="h-4 w-4" />
                    </span>
                    <span className="block truncate font-medium">{selectedDeadlineModeLabel}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className={requestSelectContentClass}>
                  <SelectItem value="common" className={requestSelectItemClass}>
                    Common deadline
                  </SelectItem>
                  <SelectItem value="itemized" className={requestSelectItemClass}>
                    Individual item deadlines
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Common Deadline</Label>
              <Popover
                open={deadlineMode === 'common' ? commonDeadlineCalendarOpen : false}
                onOpenChange={(open) => {
                  if (deadlineMode !== 'common') return;
                  setCommonDeadlineCalendarOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deadlineMode !== 'common'}
                    className={cn(
                      requestSelectTriggerClass,
                      'w-full justify-between font-medium disabled:opacity-60',
                      !commonDeadline && 'text-muted-foreground'
                    )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200">
                          <Calendar className="h-4 w-4" />
                        </span>
                        <span className="truncate">
                          {commonDeadline ? format(commonDeadline, 'PPP') : 'Pick deadline date'}
                        </span>
                      </span>
                    </Button>
                  </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto border-[#C9D7FF] bg-[#F2F6FF]/95 p-2 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:supports-[backdrop-filter]:bg-slate-900/70"
                >
                  <DateCalendar
                    mode="single"
                    selected={commonDeadline}
                    onSelect={(date) => {
                      if (!date) return;
                      setCommonDeadline(date);
                      setCommonDeadlineCalendarOpen(false);
                    }}
                    disabled={(date) => startOfDay(date) < minDeadlineDate}
                    initialFocus
                    className="rounded-lg border border-[#D9E6FF] bg-white/75 p-2 dark:border-slate-700/60 dark:bg-slate-900/60"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {deadlineMode === 'itemized' ? (
              <p className="mt-0.5 text-[11px] leading-[14px] text-primary md:col-start-2">
                Set deadlines per item in the next step.
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground md:col-start-2">
                Delivery dates must be at least 3 working days from today.
              </p>
            )}
          </div>

          <AttachmentUploadField
            label="Master References"
            description="Upload shared campaign assets (logos, copy, guidelines)."
            attachments={masterAttachments}
            onChange={setMasterAttachments}
            taskTitle={requestTitle || 'Campaign Suite'}
            taskSection="Campaign Master References"
            uploadTitle="Drag and drop files or upload"
            uploadDescription="Securely stored and available across the campaign."
            emptyLabel=""
          />
        </section>
      );
    }

    if (currentStep === 'collaterals') {
      return (
        <section className="space-y-3">
          {collaterals.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#D2DFFF]/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.6),rgba(243,247,255,0.72))] px-5 py-5 supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.42),rgba(243,247,255,0.54))] backdrop-blur-md dark:border-sidebar-border dark:bg-sidebar-accent/80">
              <h3 className="text-base font-semibold text-foreground">No collaterals added yet</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Choose a preset to add the first collateral item for this request.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {collaterals.map((collateral) => (
                <CollateralEditorCard
                  key={collateral.id}
                  collateral={collateral}
                  expanded={expandedCollateralId === collateral.id}
                  onToggle={() =>
                    setExpandedCollateralId((prev) =>
                      prev === collateral.id ? null : collateral.id
                    )
                  }
                  useCommonDeadline={deadlineMode === 'common'}
                  commonDeadline={commonDeadline}
                  minDeadline={minDeadlineInputValue}
                  onChange={(next) =>
                    setCollaterals((previous) =>
                      previous.map((item) =>
                        item.id === collateral.id
                          ? typeof next === 'function'
                            ? next(item)
                            : next
                          : item
                      )
                    )
                  }
                  onRemove={() => {
                    setCollaterals((previous) => previous.filter((item) => item.id !== collateral.id));
                    if (expandedCollateralId === collateral.id) setExpandedCollateralId(null);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="space-y-3">
        <div className={cn(reviewDenseCardClass, 'px-5 py-4')}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-foreground">
                {requestTitle.trim() || 'Campaign request'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={reviewDenseChipClass}>
                {summary.collateralCount} {summary.collateralCount === 1 ? 'Deliverable' : 'Deliverables'}
              </span>
              <span className={reviewDenseChipClass}>
                {summary.totalReferenceCount} {summary.totalReferenceCount === 1 ? 'Reference' : 'References'}
              </span>
              <span className={reviewDenseChipClass}>
                Deadline: {summary.effectiveDeadline ? format(summary.effectiveDeadline, 'dd MMM yyyy') : 'Not set'}
              </span>
            </div>
          </div>
        </div>
        <section className={reviewDenseCardClass}>
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Request Details</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => setCurrentStep('campaign')}
            >
              Edit
            </Button>
          </div>
          <div className="border-t border-[#E8EEFF]/70 px-5 py-4 dark:border-sidebar-border/60">
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {[
                { label: 'Title', value: requestTitle || '-' },
                { label: 'Department', value: department || '-' },
                { label: 'Contact', value: requesterPhone || '-' },
                {
                  label: 'Deadline',
                  value:
                    deadlineMode === 'common'
                      ? commonDeadline
                        ? format(commonDeadline, 'EEE, dd MMM yyyy')
                        : 'Not set'
                      : 'Per item',
                },
              ].map((item) => (
                <div key={item.label} className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-3">
                  <span className={reviewDenseLabelClass}>{item.label}</span>
                  <span className={reviewDenseValueClass}>{item.value}</span>
                </div>
              ))}
              <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-3 md:col-span-2">
                <span className={reviewDenseLabelClass}>Brief</span>
                <p className={reviewDenseValueClass}>{overallBrief || '-'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={reviewDenseCardClass}>
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">References</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => setCurrentStep('timeline')}
            >
              Edit
            </Button>
          </div>
          <div className="border-t border-[#E8EEFF]/70 px-5 py-4 dark:border-sidebar-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className={reviewDenseChipClass}>
                Master: {summary.masterReferenceCount} {summary.masterReferenceCount === 1 ? 'file' : 'files'}
              </span>
              <span className={reviewDenseChipClass}>
                Item: {summary.collateralReferenceCount} {summary.collateralReferenceCount === 1 ? 'file' : 'files'}
              </span>
            </div>
          </div>
        </section>

        <section className={reviewDenseCardClass}>
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">
              Deliverables <span className="font-normal text-muted-foreground">({collaterals.length})</span>
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => setCurrentStep('collaterals')}
            >
              Edit
            </Button>
          </div>
          <div className="hidden border-t border-[#E8EEFF]/70 px-5 py-2.5 md:grid md:grid-cols-[minmax(0,1.8fr)_auto_auto_auto_auto_auto] md:items-center md:gap-3 dark:border-sidebar-border/60">
            <span className={reviewDenseTableHeaderClass}>Name</span>
            <span className={reviewDenseTableHeaderClass}>Status</span>
            <span className={reviewDenseTableHeaderClass}>Size</span>
            <span className={cn(reviewDenseTableHeaderClass, 'text-center')}>Refs</span>
            <span className={reviewDenseTableHeaderClass}>Priority</span>
            <span className={reviewDenseTableHeaderClass}>Date</span>
          </div>
          <div className="divide-y divide-[#E8EEFF]/70 dark:divide-sidebar-border/60">
            {collaterals.map((collateral) => {
              const deadlineLabel =
                deadlineMode === 'common'
                  ? commonDeadline
                    ? format(commonDeadline, 'dd MMM yyyy')
                    : 'No deadline'
                  : collateral.deadline
                    ? format(collateral.deadline, 'dd MMM yyyy')
                    : 'No deadline';
              const referenceCount = getCompletedAttachmentCount(collateral.referenceFiles);

              return (
                <div key={collateral.id} className="px-5 py-3">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1.8fr)_auto_auto_auto_auto_auto] md:items-center md:gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold leading-[1.35] text-foreground">
                        {getCollateralDisplayName(collateral as never)}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] leading-[1.35] text-muted-foreground">
                        {collateral.presetLabel || collateral.collateralType}
                      </p>
                    </div>

                    <div className="md:justify-self-start">
                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium">
                        {formatCollateralStatusLabel(collateral.status)}
                      </Badge>
                    </div>

                    <div className="hidden text-[13px] font-medium text-foreground/90 md:block">
                      {getCollateralSizeSummary(collateral as never)}
                    </div>

                    <div className="hidden text-center text-[13px] font-medium text-foreground/90 md:block">
                      {referenceCount}
                    </div>

                    <div className="hidden md:block">
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium">
                        {formatCollateralPriorityLabel(collateral.priority)}
                      </Badge>
                    </div>

                    <div className="hidden text-[13px] font-medium text-foreground/90 md:block">
                      {deadlineLabel}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
                    <span className={reviewDenseChipClass}>Size: {getCollateralSizeSummary(collateral as never)}</span>
                    <span className={reviewDenseChipClass}>Refs: {referenceCount}</span>
                    <span className={reviewDenseChipClass}>{formatCollateralPriorityLabel(collateral.priority)}</span>
                    <span className={reviewDenseChipClass}>{deadlineLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-[16px] border border-[#DDEAFF]/80 bg-[#F5F9FF]/88 px-4 py-3.5 shadow-none dark:border-sidebar-border dark:bg-sidebar-accent/60 dark:shadow-none">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sidebar/60 dark:text-sidebar-foreground/70">
            <Paperclip className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-sidebar-foreground/60">
              Before you submit
            </p>
            <ul className="mt-2 grid gap-1.5">
              <li className="flex items-start gap-2 text-[13px] leading-[1.4] text-muted-foreground">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                At least one reference is required
              </li>
              <li className="flex items-start gap-2 text-[13px] leading-[1.4] text-muted-foreground">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                Deadline applies to all deliverables when common mode is selected
              </li>
              <li className="flex items-start gap-2 text-[13px] leading-[1.4] text-muted-foreground">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                Status will be updated by the design team after submission
              </li>
            </ul>
            {summary.totalReferenceCount === 0 ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium leading-[1.4] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                No references added yet
              </p>
            ) : null}
          </div>
        </div>
        {/* Request hero */}
        <div className="hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-foreground">
                {requestTitle.trim() || 'Campaign request'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={reviewDenseChipClass}>
                {summary.collateralCount} {summary.collateralCount === 1 ? 'Deliverable' : 'Deliverables'}
              </span>
            <span className="opacity-30">•</span>
            <span>{summary.totalReferenceCount} {summary.totalReferenceCount === 1 ? 'Reference' : 'References'}</span>
            <span className="opacity-30">•</span>
            <span>Deadline: {summary.effectiveDeadline ? format(summary.effectiveDeadline, 'dd MMM yyyy') : 'Not set'}</span>
          </div>
        </div>
        </div>

        {/* Request Details */}
        <section className="hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">Request Details</h3>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentStep('campaign')}>
              Edit
            </Button>
          </div>
          <div className="divide-y divide-[#E8EEFF]/60 dark:divide-sidebar-border/60">
            <div className="flex items-baseline gap-4 px-6 py-2.5">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Title</span>
              <span className="text-sm text-foreground">{requestTitle || '-'}</span>
            </div>
            <div className="flex items-baseline gap-4 px-6 py-2.5">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Department</span>
              <span className="text-sm text-foreground">{department || '-'}</span>
            </div>
            <div className="flex items-baseline gap-4 px-6 py-2.5">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contact</span>
              <span className="text-sm text-foreground">{requesterPhone || '-'}</span>
            </div>
            <div className="flex items-baseline gap-4 px-6 py-2.5">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deadline</span>
              <span className="text-sm text-foreground">
                {deadlineMode === 'common'
                  ? (commonDeadline ? format(commonDeadline, 'EEE, dd MMM yyyy') : 'Not set')
                  : 'Individual per item'}
              </span>
            </div>
            <div className="px-6 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Brief</span>
              <p className="mt-1 text-sm leading-6 text-foreground">{overallBrief || '-'}</p>
            </div>
          </div>
        </section>

        {/* References */}
        <section className="hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">References</h3>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentStep('timeline')}>
              Edit
            </Button>
          </div>
          <div className="divide-y divide-[#E8EEFF]/60 dark:divide-sidebar-border/60">
            <div className="flex items-center gap-4 px-6 py-2.5">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Master</span>
              <span className={cn('text-sm', summary.masterReferenceCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {summary.masterReferenceCount} {summary.masterReferenceCount === 1 ? 'file' : 'files'}
              </span>
            </div>
            <div className="flex items-center gap-4 px-6 py-2.5">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Item</span>
              <span className={cn('text-sm', summary.collateralReferenceCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {summary.collateralReferenceCount} {summary.collateralReferenceCount === 1 ? 'file' : 'files'}
              </span>
            </div>
          </div>
        </section>

        {/* Deliverables */}
        <section className="hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">
              Deliverables{' '}
              <span className="font-normal text-muted-foreground">({collaterals.length})</span>
            </h3>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentStep('collaterals')}>
              Edit
            </Button>
          </div>
          <div className="divide-y divide-[#E8EEFF]/60 dark:divide-sidebar-border/60">
            {collaterals.map((collateral) => (
              <div key={collateral.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {getCollateralDisplayName(collateral as never)}
                    </span>
                    <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10px]">
                      {formatCollateralStatusLabel(collateral.status)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {collateral.presetLabel || collateral.collateralType} • {getCollateralSizeSummary(collateral as never)}
                    {collateral.referenceFiles.length > 0 && ` • ${collateral.referenceFiles.length} references`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[10px]">
                    {formatCollateralPriorityLabel(collateral.priority)}
                  </Badge>
                  <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[10px]">
                    {deadlineMode === 'common'
                      ? commonDeadline ? format(commonDeadline, 'dd MMM yyyy') : 'No deadline'
                      : collateral.deadline ? format(collateral.deadline, 'dd MMM yyyy') : 'No deadline'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Before you submit */}
        <div className="hidden">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sidebar/60 dark:text-sidebar-foreground/70">
            <Paperclip className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-sidebar-foreground/60">
              Before you submit
            </p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                At least one reference is required
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                Deadline applies to all deliverables when common mode is selected
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                Status will be updated by the design team after submission
              </li>
            </ul>
            {summary.totalReferenceCount === 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                No references added yet
              </p>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderStepSidebar = () => {
    if (currentStep === 'review') return null;

    const activeSidebarStep = currentStep as Exclude<BuilderStepId, 'review'>;
    const sidebarContent: Record<
      Exclude<BuilderStepId, 'review'>,
      {
        eyebrow: string;
        title: string;
        body: string;
        quote: string;
      }
    > = {
      campaign: {
        eyebrow: 'Designer Brief',
        title: 'Clear context.\nStronger ideas.\nFewer revisions.',
        body:
          'This is where the designer understands the campaign goal, requester context, and message direction. A clear brief gets the concept closer to approval in the first round.',
        quote:
          "A clear brief doesn't just guide the work. It accelerates great outcomes.",
      },
      timeline: {
        eyebrow: 'Planning',
        title: 'Deadlines and files shape delivery.',
        body:
          'Set a practical timeline and upload the files needed to complete the work without delays.',
        quote:
          'Good inputs support better delivery.',
      },
      collaterals: {
        eyebrow: 'Consistency',
        title: 'Keep each asset aligned to the same campaign.',
        body:
          'Add each collateral with its own brief, format, and references so execution stays consistent.',
        quote:
          'Consistency helps review and execution.',
      },
    };
    const activeContent = sidebarContent[activeSidebarStep];
    const ActiveIcon = BUILDER_STEPS[currentStepIndex]?.icon || BriefcaseBusiness;
    const currentStepLabel = BUILDER_STEPS[currentStepIndex]?.label || '01';
    const footerNote =
      activeSidebarStep === 'campaign'
        ? "A clear brief doesn't just guide the work. It accelerates great outcomes."
        : activeContent.quote;
    const headlineLines = activeContent.title.split('\n');
    return (
      <aside ref={sidebarTourRef} className="self-start space-y-3 xl:sticky xl:top-24">
        <section className="animate-fade-in relative overflow-hidden rounded-[32px] border border-[#243660]/88 bg-[linear-gradient(180deg,#4a62b1_0%,#122045_50%,#00103b_100%)] px-6 pb-8 pt-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(98,132,255,0.2),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
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
            <div className="ml-auto w-fit rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B7C7EC] shadow-[0_18px_42px_-32px_rgba(3,7,18,0.92)] backdrop-blur-xl">
              <ActiveIcon className="mr-2 inline-block h-3.5 w-3.5 align-[-0.2em] text-[#8CB2FF]" />
              <span>{activeContent.eyebrow}</span>
              <span className="mx-2 inline-block h-1 w-1 rounded-full bg-[#607AB8] align-middle" />
              <span>Step {currentStepLabel}</span>
            </div>

            <div className="relative mx-auto mt-8 h-[122px] w-full max-w-[258px]">
              <div className="pointer-events-none absolute inset-x-6 top-10 h-[74px] rounded-full bg-[#5C7BFF]/24 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-12 top-[82px] h-[46px] rounded-full bg-[#A7BCFF]/12 blur-3xl" />
              <div className="relative flex h-full items-start justify-center gap-3">
                {BRIEF_AVATAR_CONFIGS.map((avatarConfig, index) => (
                  <div
                    key={`${activeSidebarStep}-${avatarConfig.key}`}
                    className={cn(
                      'brief-avatar-float relative shrink-0 overflow-hidden rounded-full border border-white/12 bg-white/[0.04] p-[3px] shadow-[0_22px_44px_-30px_rgba(2,8,23,0.9)] backdrop-blur-md',
                      avatarConfig.shellClassName,
                      index % 2 === 1 && 'brief-avatar-float--alt'
                    )}
                    style={{
                      animationDelay: `${index * 180}ms`,
                      animationDuration: `${5.4 + index * 0.45}s`,
                    }}
                  >
                    <BoringAvatar
                      size={avatarConfig.size}
                      name={`${activeSidebarStep}-${avatarConfig.key}`}
                      variant={avatarConfig.variant}
                      colors={avatarConfig.colors}
                      title={false}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 text-left">
              <h3 className="max-w-[19rem] text-[1.82rem] font-medium leading-[2.45rem] tracking-[-0.05em] sm:text-[1.98rem] sm:leading-[2.65rem]">
                {headlineLines.map((line, index) => (
                  <span
                    key={`${activeSidebarStep}-${index}`}
                    className={cn(
                      'block',
                      index === 0 &&
                        'bg-[linear-gradient(90deg,#F2F5FF_0%,#DCE7FF_56%,#BECEFF_100%)] bg-clip-text text-transparent',
                      index === 1 &&
                        'bg-[linear-gradient(90deg,#A9CBFF_0%,#78AEFF_48%,#6E90FF_100%)] bg-clip-text text-transparent',
                      index === 2 &&
                        'bg-[linear-gradient(90deg,#E7EEFF_0%,#A9C4FF_54%,#7C9BFF_100%)] bg-clip-text text-transparent'
                    )}
                  >
                    {line}
                  </span>
                ))}
              </h3>
              <p className="mt-5 max-w-[20.75rem] text-[14.5px] leading-[1.3] text-[#A7B6D6]">
                {activeContent.body}
              </p>
              <div className="relative mt-7 max-w-[21rem] overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]  px-4 py-4 shadow-[0_18px_42px_-32px_rgba(3,7,18,0.92)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(156,186,255,0.18),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#83ABFF]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8EA5D8]">
                      Note
                    </p>
                  </div>
                  <p className="mt-3 max-w-[18.5rem] text-[13.5px] leading-[1.55] text-[#B8C7E4]">
                    {footerNote}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>
      </aside>
    );
  };

  const requestTypeSelectionPanel = (
    <section
      className={cn(
        builderSurfaceClass,
        'animate-fade-in overflow-hidden dark:border-[#253D78]/90 dark:bg-[linear-gradient(180deg,rgba(8,16,39,0.96),rgba(10,22,49,0.94),rgba(12,27,59,0.9))] dark:shadow-[0_28px_70px_-36px_rgba(2,8,23,0.92)] dark:[background-image:none]'
      )}
    >
      <div className="border-b border-border/70 px-8 py-6 dark:border-[#253D78]/90">
        <Badge
          variant="outline"
          className="rounded-full border-border/70 bg-white/80 px-3 py-1 text-primary dark:border-[#314778] dark:bg-[#101B38] dark:text-[#C7D6FF]"
        >
          Request Type
        </Badge>
        <h2 className="mt-3 text-[24px] font-semibold text-foreground dark:text-[#F5F8FF]">
          Select a Request Type
        </h2>
        <p className="mt-1 text-sm text-muted-foreground dark:text-[#9FB0D4]">
          Choose the option that best matches your requirement.
        </p>
      </div>

      <div className="grid gap-5 px-8 py-6 md:grid-cols-2">
        {REQUEST_TYPE_OPTIONS.map((option, index) => {
          const OptionIcon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleRequestTypeSelect(option.value)}
              className={cn(
                'animate-slide-up group relative h-full overflow-hidden rounded-xl border border-[#D9E6FF] bg-white p-5 text-left shadow-[0_12px_28px_-24px_rgba(30,42,90,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-[#F8FBFF] hover:shadow-[0_18px_36px_-22px_rgba(30,42,90,0.22)] dark:border-[#2A427A] dark:bg-[linear-gradient(180deg,rgba(10,18,40,0.98),rgba(11,24,52,0.95),rgba(13,29,63,0.92))] dark:shadow-[0_24px_56px_-32px_rgba(2,8,23,0.92)] dark:hover:border-[#4E6FE0]/55 dark:hover:bg-[linear-gradient(180deg,rgba(11,21,46,0.98),rgba(12,27,58,0.96),rgba(14,33,71,0.94))] dark:hover:shadow-[0_30px_64px_-34px_rgba(2,8,23,0.96)]'
              )}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(143,168,255,0.08),transparent_34%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle_at_top_left,rgba(96,124,255,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />
              <div className="relative flex min-h-[188px] flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DDE7FF] bg-[#F7FAFF] text-primary transition-transform duration-300 group-hover:-translate-y-0.5 dark:border-[#314778] dark:bg-[#101B38] dark:text-[#D9E4FF]">
                    <OptionIcon className="h-5 w-5" />
                  </div>
                  <span className="inline-flex rounded-full border border-[#DCE6FF] bg-[#FAFCFF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5B73B2] dark:border-[#314778] dark:bg-[#0F1935] dark:text-[#C3D1F5]">
                    {option.tag}
                  </span>
                </div>

                <div className="mt-4 flex-1 space-y-2">
                  <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1E2A5A] dark:text-[#F5F8FF]">
                    {option.label}
                  </h3>
                  <p className="text-[14px] font-medium text-foreground/90 dark:text-[#C9D4EE]">
                    {option.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end border-t border-[#E8EEFF] pt-4 dark:border-[#23396E]">
                  <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary dark:text-[#C7D5FF]">
                    {option.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  const singleRequestPanel = (
    <div className="w-full space-y-3">
      <section
        className={cn(
          glassCardClass,
          'overflow-hidden shadow-[0_24px_52px_-40px_rgba(59,99,204,0.084)]'
        )}
      >
        <div className="border-b border-border/70 px-5 py-4 dark:border-[#253D78]/90">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[24px] font-semibold text-foreground">Quick Design</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the details for one design request.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => handleRequestTypeSelect('campaign_request')}
              className="h-11 w-full justify-start gap-3 rounded-[16px] border border-[#D9E6FF] bg-white/88 px-3.5 text-[13px] font-semibold text-[#223067] shadow-none transition-all duration-200 hover:border-[#C7D8FF] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] dark:border-sidebar-border dark:bg-sidebar/60 dark:text-sidebar-foreground dark:hover:border-sidebar-ring/35 dark:hover:bg-sidebar-accent sm:w-auto"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200">
                <Layers3 className="h-4 w-4" />
              </span>
              <span className="truncate">Switch to Campaign Suite</span>
            </Button>
          </div>
        </div>

        <div className="px-5 py-4">
          <section
            className="space-y-5"
            onFocusCapture={() => setSingleRequestActiveStep('details')}
          >
            <div className="grid items-start gap-x-5 gap-y-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
              <div className="space-y-2">
                <Label>Creative Title</Label>
                <div className="relative">
                  <span className={requestFieldIconClass}>
                    <FileText className="h-4 w-4" />
                  </span>
                  <Input
                    value={requestTitle}
                    onChange={(event) => setRequestTitle(event.target.value)}
                    placeholder="Annual Day Poster / Admissions Flyer / Event Banner / Instagram Post"
                    className={requestFieldWithIconClass}
                  />
                </div>
              </div>

              {renderDepartmentRequesterField()}
              {renderPhoneField()}
            </div>

            <div className="grid items-start gap-x-5 gap-y-4 md:w-[80%] md:grid-cols-[minmax(0,0.85fr)_minmax(0,0.55fr)_minmax(0,0.6fr)]">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={singleCategory}
                  onValueChange={(value) => setSingleCategory(value as TaskCategory)}
                >
                  <SelectTrigger className={requestSelectTriggerClass}>
                    <div className="flex min-w-0 items-center">
                      <span className="block truncate font-medium">
                        {selectedSingleCategoryOption?.label || 'Select category'}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className={requestSelectContentClass}>
                    {SINGLE_REQUEST_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className={requestSelectItemClass}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={singleUrgency}
                  onValueChange={(value) => setSingleUrgency(value as TaskUrgency)}
                >
                  <SelectTrigger className={requestSelectTriggerClass}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200">
                        <ListChecks className="h-4 w-4" />
                      </span>
                      <span className="block truncate font-medium">
                        {selectedSingleUrgencyOption?.label || 'Select priority'}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className={requestSelectContentClass}>
                    {SINGLE_REQUEST_URGENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className={requestSelectItemClass}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Deadline</Label>
                <Popover
                  open={singleDeadlineCalendarOpen}
                  onOpenChange={setSingleDeadlineCalendarOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        requestSelectTriggerClass,
                        'w-full justify-between font-medium',
                        !singleDeadline && 'text-muted-foreground'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-primary dark:bg-sidebar/90 dark:text-slate-200">
                          <Calendar className="h-4 w-4" />
                        </span>
                        <span className="truncate">
                          {singleDeadline ? format(singleDeadline, 'PPP') : 'Pick deadline date'}
                        </span>
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-auto border-[#C9D7FF] bg-[#F2F6FF]/95 p-2 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:supports-[backdrop-filter]:bg-slate-900/70"
                  >
                    <DateCalendar
                      mode="single"
                      selected={singleDeadline}
                      onSelect={(date) => {
                        if (!date) return;
                        setSingleDeadline(date);
                        setSingleDeadlineCalendarOpen(false);
                      }}
                      disabled={(date) => startOfDay(date) < minDeadlineDate}
                      initialFocus
                      className="rounded-lg border border-[#D9E6FF] bg-white/75 p-2 dark:border-slate-700/60 dark:bg-slate-900/60"
                    />
                  </PopoverContent>
                </Popover>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground/75">
                  Minimum 3 working days.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Creative Brief</Label>
              <Textarea
                value={overallBrief}
                onChange={(event) => setOverallBrief(event.target.value)}
                className={requestTextareaClass}
                placeholder="Describe the exact output needed, audience, message, mandatory copy, size references, logos, visual tone, language, and approvals."
              />
            </div>

            <div onFocusCapture={() => setSingleRequestActiveStep('files')}>
              <AttachmentUploadField
              label="Attachments & References (Required)"
              description="Upload at least one supporting file to help the designer clearly understand and execute your request — such as logos, brand guidelines, content documents, screenshots, or reference designs."
              attachments={masterAttachments}
              onChange={(next) => {
                setSingleRequestActiveStep('files');
                setMasterAttachments(next);
              }}
              taskTitle={requestTitle || 'Quick Design Request'}
              taskSection="Quick Design References"
              emptyLabel=""
              uploadTitle="Drag and drop files here, or upload from your device"
              uploadDescription="Files will be securely stored and linked to this request."
              buttonLabel="Upload Files"
              />
            </div>
          </section>
        </div>

        <div className={builderFooterClass}>
          {shouldRevealSingleValidation && singleValidationMessage ? (
            <div className={builderValidationClass}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[#D9E6FF]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(236,243,255,0.86))] text-[#4863B7] shadow-[0_12px_24px_-18px_rgba(59,99,204,0.26)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(236,243,255,0.6))] backdrop-blur-sm dark:border-sidebar-border dark:bg-sidebar-accent/76 dark:text-slate-300 dark:shadow-none">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="flex min-h-8 items-center leading-6 text-foreground/90 dark:text-slate-100">
                {singleValidationMessage}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-h-10 items-center">
              <Button
                type="button"
                variant="outline"
                onClick={resetRequestTypeSelection}
                className={cn(builderSecondaryActionClass, 'justify-start gap-2.5')}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" onClick={saveDraft}>
                Save Draft
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
  const stepPanel = (
    <section
      ref={formPanelTourRef}
      className={cn(
        currentStep === 'review'
          ? cn(reviewSurfaceClass, 'overflow-hidden shadow-none xl:flex xl:h-full xl:flex-col')
          : cn(glassCardClass, 'overflow-hidden shadow-[0_24px_52px_-40px_rgba(59,99,204,0.084)] xl:flex xl:h-full xl:flex-col')
      )}
    >
      <div className="border-b border-border/70 px-5 py-3.5 dark:border-[#253D78]/90">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-foreground">
              {BUILDER_STEPS[currentStepIndex]?.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {BUILDER_STEPS[currentStepIndex]?.description}
            </p>
          </div>

          {currentStep === 'collaterals' ? (
            <Button type="button" onClick={() => setIsPresetDialogOpen(true)} className="h-10 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Collateral
            </Button>
          ) : null}
        </div>
      </div>

      <div className="px-5 py-4 xl:flex-1">{renderStepContent()}</div>

      <div ref={footerActionsTourRef} className={builderFooterClass}>
        {currentStepValidationMessage ? (
          <div className={builderValidationClass}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[#D9E6FF]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(236,243,255,0.86))] text-[#4863B7] shadow-[0_12px_24px_-18px_rgba(59,99,204,0.26)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(236,243,255,0.6))] backdrop-blur-sm dark:border-sidebar-border dark:bg-sidebar-accent/76 dark:text-slate-300 dark:shadow-none">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="flex min-h-8 items-center leading-6 text-foreground/90 dark:text-slate-100">
              {currentStepValidationMessage}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center">
            {currentStepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                className={cn(builderSecondaryActionClass, 'justify-start gap-2.5')}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" onClick={saveDraft}>
              Save Draft
            </Button>

            {currentStep === 'review' ? (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleNextStep}>
                Next step
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const headerBadgeText =
    selectedRequestType === 'single_task'
      ? 'Quick Design'
      : selectedRequestType === 'campaign_request'
        ? 'Campaign Suite'
        : '';
  const trimmedRequestTitle = requestTitle.trim();
  const fallbackHeaderTitle =
    selectedRequestType === 'single_task'
      ? 'Create a quick design request'
      : selectedRequestType === 'campaign_request'
        ? 'Create a campaign suite'
        : 'Create a New Design Request';
  const headerTitle =
    trimmedRequestTitle ? truncateHeaderTitle(trimmedRequestTitle) : fallbackHeaderTitle;
  const headerDescription =
    selectedRequestType === 'single_task'
      ? 'Use this flow for one design deliverable.'
      : selectedRequestType === 'campaign_request'
        ? ''
        : 'Choose the type of request to get started.';

  return (
    <DashboardLayout fitContentHeight>
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        <div
          className={cn(
            'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between',
            selectedRequestType === 'single_task' && 'mx-auto w-full max-w-4xl'
          )}
        >
          <div className="max-w-[46rem]">
            {headerBadgeText ? (
              <Badge variant="outline" className="mb-3 rounded-full border-border/70 bg-white/80 px-3 py-1 text-primary dark:border-sidebar-border dark:bg-sidebar-accent/80">
                {headerBadgeText}
              </Badge>
            ) : null}
            <h1 className="max-w-[22ch] text-[30px] font-bold leading-[1.16] tracking-[-0.04em] text-[#1E2A5A] dark:text-primary break-words [overflow-wrap:anywhere] [text-wrap:balance]">
              {headerTitle}
            </h1>
            {headerDescription ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {headerDescription}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedRequestType === 'campaign_request' ? (
              <Button type="button" variant="outline" onClick={() => openTour(0)}>
                <BookOpen className="mr-2 h-4 w-4" />
                Quick tour
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate('/my-requests')}>
              Cancel
            </Button>
          </div>
        </div>

        {selectedRequestType === 'campaign_request' ? (
          <>
            <section ref={stepTrackerTourRef} className="relative overflow-hidden rounded-[22px] border border-[#BDD0FF]/65 bg-gradient-to-br from-white/62 via-[#EBF2FF]/54 to-[#DCE8FF]/46 supports-[backdrop-filter]:from-white/42 supports-[backdrop-filter]:via-[#EBF2FF]/36 supports-[backdrop-filter]:to-[#DCE8FF]/30 backdrop-blur-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.62)] dark:border-sidebar-border/60 dark:bg-sidebar-accent dark:[background-image:none] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(87,118,255,0.10),transparent_48%),radial-gradient(ellipse_at_85%_100%,rgba(56,85,190,0.08),transparent_42%)] dark:bg-[radial-gradient(ellipse_at_15%_0%,rgba(99,124,255,0.12),transparent_45%),radial-gradient(ellipse_at_85%_100%,rgba(67,97,204,0.08),transparent_40%)]" />
              <div className="overflow-x-auto">
                <ol className="relative flex min-w-[760px] items-center px-1.5 py-1.5">
                  {BUILDER_STEPS.map((step, index) => {
                    const isCurrent = step.id === currentStep;
                    const isComplete = index < currentStepIndex && !validationMessages[step.id];
                    const isUnlocked = index <= furthestUnlockedStepIndex;
                    const StepIcon = step.icon;
                    const trackingLabel = isComplete
                      ? 'Completed'
                      : isCurrent
                        ? 'Current step'
                        : 'Upcoming';

                    return (
                      <li key={step.id} className="flex min-w-0 flex-1 items-center">
                        <button
                          type="button"
                          onClick={() => handleStepChange(step.id)}
                          className={cn(
                            'group flex min-w-0 flex-1 items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            isCurrent &&
                              'bg-[linear-gradient(135deg,#4A68D8,#3352BE_55%,#2B47AE)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(255,255,255,0.12)] text-white',
                            isComplete &&
                              'bg-[linear-gradient(135deg,rgba(255,255,255,0.38),rgba(240,246,255,0.44))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)] dark:bg-white/[0.07] dark:[background-image:none] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]',
                            !isCurrent &&
                              !isComplete &&
                              'bg-white/14 dark:bg-transparent',
                            isUnlocked
                              ? isCurrent
                                ? 'hover:brightness-[1.04]'
                                : 'hover:bg-white/32 dark:hover:bg-sidebar-accent/55'
                              : 'cursor-not-allowed opacity-45'
                          )}
                          disabled={!isUnlocked}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-200',
                              isCurrent &&
                                'bg-white/22 text-white ring-1 ring-white/35 backdrop-blur-sm dark:bg-white/14 dark:ring-white/20',
                              isComplete &&
                                'bg-[linear-gradient(135deg,#22c55e,#16a34a)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',
                              !isCurrent &&
                                !isComplete &&
                                'border border-[#C5D6FF]/85 bg-white/65 text-muted-foreground dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground/45'
                            )}
                          >
                            {isComplete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.label}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <StepIcon
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0',
                                  isCurrent
                                    ? 'text-white/85'
                                    : isComplete
                                      ? 'text-muted-foreground/70 dark:text-sidebar-foreground/60'
                                      : 'text-muted-foreground/55 dark:text-sidebar-foreground/45'
                                )}
                              />
                              <p
                                className={cn(
                                  'truncate text-[13px] font-semibold',
                                  isCurrent
                                    ? 'text-white'
                                    : isComplete
                                      ? 'text-foreground dark:text-sidebar-foreground'
                                      : 'text-muted-foreground/80 dark:text-sidebar-foreground/50'
                                )}
                              >
                                {step.title}
                              </p>
                            </div>
                            <p
                              className={cn(
                                'mt-0.5 text-[10.5px] font-medium leading-4',
                                isCurrent
                                  ? 'text-white/75'
                                  : isComplete
                                    ? 'text-muted-foreground/55 dark:text-sidebar-foreground/50'
                                    : 'text-muted-foreground/50 dark:text-sidebar-foreground/38'
                              )}
                            >
                              {trackingLabel}
                            </p>
                          </div>
                        </button>

                        {index < BUILDER_STEPS.length - 1 ? (
                          <div className="relative mx-2 h-[2px] w-10 flex-none overflow-hidden rounded-full lg:w-14">
                            <div className="absolute inset-0 bg-[#D4E2FF]/70 dark:bg-sidebar-border/50" />
                            {index < currentStepIndex && (
                              <div className="absolute inset-0 bg-gradient-to-r from-[#A5BEFF] to-[#C4D4FF] dark:from-sidebar-primary dark:to-sidebar-primary dark:[background-image:none]" />
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>

            {currentStep === 'review' ? (
              stepPanel
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] xl:items-stretch">
                {stepPanel}
                {renderStepSidebar()}
              </div>
            )}
          </>
        ) : selectedRequestType === 'single_task' ? (
          <div className="mx-auto w-full max-w-4xl space-y-3">
            <section className="relative overflow-hidden rounded-[22px] border border-[#BDD0FF]/65 bg-gradient-to-br from-white/62 via-[#EBF2FF]/54 to-[#DCE8FF]/46 supports-[backdrop-filter]:from-white/42 supports-[backdrop-filter]:via-[#EBF2FF]/36 supports-[backdrop-filter]:to-[#DCE8FF]/30 backdrop-blur-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.62)] dark:border-sidebar-border/60 dark:bg-sidebar-accent dark:[background-image:none] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(87,118,255,0.10),transparent_48%),radial-gradient(ellipse_at_85%_100%,rgba(56,85,190,0.08),transparent_42%)] dark:bg-[radial-gradient(ellipse_at_15%_0%,rgba(99,124,255,0.12),transparent_45%),radial-gradient(ellipse_at_85%_100%,rgba(67,97,204,0.08),transparent_40%)]" />
              <div className="overflow-x-auto">
                <ol className="relative flex min-w-[620px] items-center px-1.5 py-1.5">
                  {SINGLE_REQUEST_STEPS.map((step, index) => {
                    const isCurrent = index === singleRequestCurrentStepIndex;
                    const isComplete = !isCurrent && (
                      index === 0
                        ? !singleDetailsValidationMessage
                        : index === 1
                          ? singleFilesStepComplete
                          : false
                    );
                    const StepIcon = step.icon;
                    const trackingLabel = isComplete
                      ? 'Completed'
                      : isCurrent
                        ? 'Current step'
                        : index === 1 && !singleDetailsValidationMessage && !singleFilesValidationMessage
                          ? 'Optional'
                        : 'Upcoming';

                    return (
                      <li key={step.label} className="flex min-w-0 flex-1 items-center">
                        <div
                          className={cn(
                            'group flex min-w-0 flex-1 items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left transition-all duration-200',
                            isCurrent &&
                              'bg-[linear-gradient(135deg,#4A68D8,#3352BE_55%,#2B47AE)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(255,255,255,0.12)] text-white',
                            isComplete &&
                              'bg-[linear-gradient(135deg,rgba(255,255,255,0.38),rgba(240,246,255,0.44))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)] dark:bg-white/[0.07] dark:[background-image:none] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]',
                            !isCurrent && !isComplete && 'bg-white/14 dark:bg-transparent'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-200',
                              isCurrent &&
                                'bg-white/22 text-white ring-1 ring-white/35 backdrop-blur-sm dark:bg-white/14 dark:ring-white/20',
                              isComplete &&
                                'bg-[linear-gradient(135deg,#22c55e,#16a34a)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',
                              !isCurrent &&
                                !isComplete &&
                                'border border-[#C5D6FF]/85 bg-white/65 text-muted-foreground dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground/45'
                            )}
                          >
                            {isComplete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.label}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <StepIcon
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0',
                                  isCurrent
                                    ? 'text-white/85'
                                    : isComplete
                                      ? 'text-muted-foreground/70 dark:text-sidebar-foreground/60'
                                      : 'text-muted-foreground/55 dark:text-sidebar-foreground/45'
                                )}
                              />
                              <p
                                className={cn(
                                  'truncate text-[13px] font-semibold',
                                  isCurrent
                                    ? 'text-white'
                                    : isComplete
                                      ? 'text-foreground dark:text-sidebar-foreground'
                                      : 'text-muted-foreground/80 dark:text-sidebar-foreground/50'
                                )}
                              >
                                {step.title}
                              </p>
                            </div>
                            <p
                              className={cn(
                                'mt-0.5 text-[10.5px] font-medium leading-4',
                                isCurrent
                                  ? 'text-white/75'
                                  : isComplete
                                    ? 'text-muted-foreground/55 dark:text-sidebar-foreground/50'
                                    : 'text-muted-foreground/50 dark:text-sidebar-foreground/38'
                              )}
                            >
                              {trackingLabel}
                            </p>
                          </div>
                        </div>

                        {index < SINGLE_REQUEST_STEPS.length - 1 ? (
                          <div className="relative mx-2 h-[2px] w-10 flex-none overflow-hidden rounded-full lg:w-14">
                            <div className="absolute inset-0 bg-[#D4E2FF]/70 dark:bg-sidebar-border/50" />
                            {((index === 0 && !singleDetailsValidationMessage) ||
                              (index === 1 && singleFilesStepComplete)) && (
                              <div className="absolute inset-0 bg-gradient-to-r from-[#A5BEFF] to-[#C4D4FF] dark:from-sidebar-primary dark:to-sidebar-primary dark:[background-image:none]" />
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>
            {singleRequestPanel}
          </div>
        ) : (
          requestTypeSelectionPanel
        )}

        {isTourOpen && activeTourStep ? createPortal(
          <div className="pointer-events-none z-[120]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, isolation: 'isolate' }}>
            {/* SVG overlay with smooth cutout */}
            <svg
              className="pointer-events-auto tour-overlay-enter"
              style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh' }}
              onClick={completeTour}
            >
              <defs>
                <mask id="tour-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  {tourSpotlight && (
                    <rect
                      className="tour-cutout-morph"
                      x={tourSpotlight.left}
                      y={tourSpotlight.top}
                      width={tourSpotlight.width}
                      height={tourSpotlight.height}
                      rx={tourSpotlight.radius}
                      ry={tourSpotlight.radius}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                x="0" y="0" width="100%" height="100%"
                mask="url(#tour-spotlight-mask)"
                className="fill-[rgba(15,23,42,0.55)] dark:fill-[rgba(2,6,23,0.68)]"
              />
            </svg>

            {/* Spotlight border ring - hugs the element tightly */}
            {tourSpotlight && (
              <div
                className="tour-spotlight-ring pointer-events-none fixed"
                style={{
                  top: `${tourSpotlight.top}px`,
                  left: `${tourSpotlight.left}px`,
                  width: `${tourSpotlight.width}px`,
                  height: `${tourSpotlight.height}px`,
                  borderRadius: `${tourSpotlight.radius}px`,
                }}
              />
            )}

            {/* Tour card - positioned adjacent to spotlight */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
              key={activeTourStep.id}
              onClick={(e) => e.stopPropagation()}
              className="tour-card-enter pointer-events-auto fixed w-[370px]"
              style={tourSpotlight?.card ? {
                top: `${tourSpotlight.card.top}px`,
                left: `${tourSpotlight.card.left}px`,
              } : {
                bottom: '24px',
                right: '24px',
              }}
            >
              {/* Arrow connector */}
              {tourSpotlight?.card && (
                <div
                  className="tour-card-arrow"
                  data-side={tourSpotlight.card.arrowSide}
                  style={{
                    ['--arrow-offset' as string]: `${tourSpotlight.card.arrowOffset}px`,
                  }}
                />
              )}

              <div className="relative overflow-hidden rounded-2xl border border-white/90 bg-white/95 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] backdrop-blur-[40px] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                <div className="p-5">
                  {/* Header with icon */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
                      <activeTourStep.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70 dark:text-primary/80">
                        {activeTourStep.eyebrow}
                      </p>
                      <h3 className="mt-1 text-[17px] font-bold leading-snug tracking-[-0.02em] text-slate-900 dark:text-white">
                        {activeTourStep.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={completeTour}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label="Close tour"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </div>

                  {/* Description */}
                  <p className="mt-3.5 text-[13.5px] leading-[1.65] text-slate-600 dark:text-slate-300">
                    {activeTourStep.description}
                  </p>

                  {/* Tip card */}
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-white/5">
                    <span className="mt-0.5 text-amber-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </span>
                    <p className="text-[12.5px] leading-[1.55] text-slate-500 dark:text-slate-400">
                      {activeTourStep.detail}
                    </p>
                  </div>

                  {/* Progress dots */}
                  <div className="mt-4 flex items-center gap-1.5">
                    {builderTourSteps.map((step, index) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setTourStepIndex(index)}
                        className={cn(
                          'tour-progress-dot rounded-full transition-all duration-300',
                          index === tourStepIndex
                            ? 'h-2.5 w-7 bg-primary'
                            : index < tourStepIndex
                              ? 'h-2.5 w-2.5 bg-primary/40'
                              : 'h-2.5 w-2.5 bg-slate-200 dark:bg-slate-700'
                        )}
                        aria-label={`Go to step ${index + 1}`}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={completeTour}
                      className="text-[13px] font-medium text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {tourStepIndex === 0 ? 'Maybe later' : 'Skip'}
                    </button>

                    <div className="flex items-center gap-2">
                      {tourStepIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => setTourStepIndex((c) => Math.max(c - 1, 0))}
                          className="flex h-9 items-center rounded-lg border border-slate-200 px-3.5 text-[13px] font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          Back
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (tourStepIndex === builderTourSteps.length - 1) {
                            completeTour();
                            return;
                          }
                          setTourStepIndex((c) => Math.min(c + 1, builderTourSteps.length - 1));
                        }}
                        className="tour-next-btn flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_-2px_rgba(59,99,204,0.3)] transition-all hover:brightness-110 active:scale-[0.97]"
                      >
                        {tourStepIndex === builderTourSteps.length - 1 ? 'Got it!' : 'Next'}
                        {tourStepIndex < builderTourSteps.length - 1 && (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        {tourStepIndex === builderTourSteps.length - 1 && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        , document.body) : null}

        <SubmissionSuccessDialog
          open={Boolean(submitSuccessState)}
          onOpenChange={handleSubmitSuccessModalChange}
          title={submitSuccessState?.storedLocally ? 'Request saved locally' : 'Thank you!'}
          description={
            submitSuccessState
              ? submitSuccessState.storedLocally
                ? `Your ${submitSuccessState.requestType === 'campaign_request' ? 'campaign' : 'quick design'} request was saved locally and is available in My Requests.`
                : (
                    <>
                      Your request has been successfully submitted.
                      <br />
                      Our design team will review it shortly.
                    </>
                  )
              : ''
          }
          actionLabel="Close"
          onAction={() => handleSubmitSuccessModalChange(false)}
        />

        <CollateralPresetDialog
          open={isPresetDialogOpen}
          onOpenChange={setIsPresetDialogOpen}
          variant="auto"
          existingCollateralTypes={existingCollateralTypes}
          onSelect={(preset) => {
            const draft = createCollateralDraftFromPreset(preset, deadlineMode, commonDeadline);
            setCollaterals((previous) => [...previous, draft]);
            setExpandedCollateralId(draft.id);
            setIsPresetDialogOpen(false);
            toast.success(`${preset.label} added.`);
          }}
          onSelectMany={(presets) => {
            const drafts = presets.map((preset) =>
              createCollateralDraftFromPreset(preset, deadlineMode, commonDeadline)
            );
            setCollaterals((previous) => [...previous, ...drafts]);
            setExpandedCollateralId(drafts[drafts.length - 1].id);
            setIsPresetDialogOpen(false);
            toast.success(`${presets.length} presets added.`);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

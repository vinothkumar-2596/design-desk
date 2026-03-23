import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { upsertLocalTask } from '@/lib/taskStorage';
import { cn } from '@/lib/utils';
import { addOfficeOpenDays } from '@/lib/officeCalendar';
import type { Task } from '@/types';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  Check,
  ChevronLeft,
  Layers3,
  ListChecks,
  Paperclip,
  Phone,
  Plus,
} from 'lucide-react';

type BuilderStepId = 'campaign' | 'timeline' | 'collaterals' | 'review';

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
    description: 'Set the request basics and campaign brief.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'timeline',
    label: '02',
    title: 'Timeline & Files',
    description: 'Choose deadline mode and upload master references.',
    icon: CalendarRange,
  },
  {
    id: 'collaterals',
    label: '03',
    title: 'Collateral Builder',
    description: 'Add preset-based collateral items and item briefs.',
    icon: Layers3,
  },
  {
    id: 'review',
    label: '04',
    title: 'Review & Submit',
    description: 'Check the full request before sending it to design.',
    icon: ListChecks,
  },
];

const INDIAN_MOBILE_REGEX = /^\+91[6-9]\d{9}$/;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const formatIndianPhoneInput = (value?: string) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const local = digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;
  return `+91 ${local.slice(0, 10)}`.trim();
};

const normalizeIndianPhone = (value?: string) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  const local = digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;
  if (local.length !== 10) return '';
  const normalized = `+91${local}`;
  return INDIAN_MOBILE_REGEX.test(normalized) ? normalized : '';
};

const toDateValue = (value?: Date) => (value ? format(value, 'yyyy-MM-dd') : '');
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
  if (!normalizeIndianPhone(requesterPhone)) return 'Enter a valid contact number in +91 format.';
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
  const navigate = useNavigate();
  const [requestTitle, setRequestTitle] = useState('');
  const [department, setDepartment] = useState(user?.department || '');
  const [requesterPhone, setRequesterPhone] = useState(formatIndianPhoneInput(user?.phone));
  const [overallBrief, setOverallBrief] = useState('');
  const [deadlineMode, setDeadlineMode] = useState<'common' | 'itemized'>('common');
  const [commonDeadline, setCommonDeadline] = useState<Date | undefined>(minDeadlineDate);
  const [masterAttachments, setMasterAttachments] = useState<BuilderAttachment[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralDraft[]>([]);
  const [currentStep, setCurrentStep] = useState<BuilderStepId>('campaign');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);

  useEffect(() => {
    setDepartment((current) => current || user?.department || '');
    setRequesterPhone((current) => current || formatIndianPhoneInput(user?.phone));
  }, [user?.department, user?.phone]);

  useEffect(() => {
    const draft = loadRequestDraft(user);
    if (!draft || draft.requestType !== 'campaign_request') return;

    const draftTitle = draft.title || '';
    const draftDepartment = draft.requesterDepartment || user?.department || '';
    const draftPhone = draft.requesterPhone || formatIndianPhoneInput(user?.phone);
    const draftBrief = draft.description || '';
    const draftDeadlineMode = draft.deadlineMode || 'common';
    const draftCommonDeadline = draft.commonDeadline ? new Date(draft.commonDeadline) : minDeadlineDate;
    const draftAttachments = (draft.files || []).map((file) => ({
      ...file,
      uploading: false,
    }));
    const draftCollaterals = (draft.collaterals || []).map(hydrateDraftCollateral);

    setRequestTitle(draftTitle);
    setDepartment(draftDepartment);
    setRequesterPhone(draftPhone);
    setOverallBrief(draftBrief);
    setDeadlineMode(draftDeadlineMode);
    setCommonDeadline(draftCommonDeadline);
    setMasterAttachments(draftAttachments);
    setCollaterals(draftCollaterals);
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
    toast.message('Draft restored.');
  }, [user?.department, user?.email, user?.id, user?.phone]);

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

  const validationMessages: Record<BuilderStepId, string> = {
    campaign: campaignValidationMessage,
    timeline: timelineValidationMessage,
    collaterals: collateralValidationMessage,
    review: reviewValidationMessage,
  };

  const currentStepIndex = BUILDER_STEPS.findIndex((step) => step.id === currentStep);
  const furthestUnlockedStepIndex = campaignValidationMessage
    ? 0
    : timelineValidationMessage
      ? 1
      : collateralValidationMessage
        ? 2
        : 3;

  const saveDraft = () => {
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

    const blockingStep = BUILDER_STEPS[Math.max(0, targetIndex - 1)].id;
    toast.error(validationMessages[blockingStep] || 'Complete the previous step first.');
  };

  const handleNextStep = () => {
    const validationMessage = validationMessages[currentStep];
    if (validationMessage) {
      toast.error(validationMessage);
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

  const handleSubmit = async () => {
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
      toast.error(validationMessage);
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
      toast.success('Campaign request submitted.');
      navigate('/my-requests');
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
      toast.success(
        error instanceof Error && error.message !== 'API unavailable'
          ? `${error.message} Saved locally instead.`
          : 'API unavailable. Request saved locally instead.'
      );
      navigate('/my-requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const glassInputClass =
    'border-input bg-background shadow-none focus-visible:ring-ring/30 focus-visible:ring-offset-0';
  const glassCardClass =
    'rounded-[24px] border border-[#CEDBFF]/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(243,247,255,0.16),rgba(231,239,255,0.12))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(243,247,255,0.12),rgba(231,239,255,0.08))] backdrop-blur-xl dark:border-sidebar-border dark:bg-sidebar/95 dark:supports-[backdrop-filter]:bg-sidebar/86 dark:backdrop-blur-[24px]';
  const glassStatCardClass =
    'rounded-2xl border border-[#D7E2FF]/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.66),rgba(245,248,255,0.76))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.44),rgba(245,248,255,0.56))] backdrop-blur-md dark:border-sidebar-border dark:bg-sidebar-accent/76 dark:supports-[backdrop-filter]:bg-sidebar-accent/62 dark:backdrop-blur-[24px]';
  const builderSurfaceClass =
    'rounded-[24px] border border-border/70 bg-white dark:border-sidebar-border dark:bg-sidebar/95 dark:supports-[backdrop-filter]:bg-sidebar/86 dark:backdrop-blur-[24px]';
  const builderInsetCardClass =
    'rounded-2xl border border-border/70 bg-background/70 dark:border-sidebar-border dark:bg-sidebar-accent/76 dark:supports-[backdrop-filter]:bg-sidebar-accent/62 dark:backdrop-blur-[24px]';
  const builderFooterClass =
    'relative border-t border-[#D7E3FF]/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(239,245,255,0.56))] px-5 py-3 supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(239,245,255,0.42))] backdrop-blur-md dark:border-sidebar-border dark:bg-sidebar-accent/70 dark:supports-[backdrop-filter]:bg-sidebar-accent/58 dark:backdrop-blur-[24px]';

  const renderStepContent = () => {
    if (currentStep === 'campaign') {
      return (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Campaign Title</Label>
              <Input
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder="Admissions Drive 2026 / Annual Day / Product Launch Campaign"
                className="placeholder:text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Department / Requester</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Marketing / HR / Admin"
                  className="pl-9 placeholder:text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contact Number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={requesterPhone}
                  onChange={(event) => setRequesterPhone(formatIndianPhoneInput(event.target.value))}
                  placeholder="+91 9876543210"
                  className="pl-9 placeholder:text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Overall Brief</Label>
            <Textarea
              value={overallBrief}
              onChange={(event) => setOverallBrief(event.target.value)}
              className="min-h-[152px] placeholder:text-xs"
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
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select deadline mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">One common deadline</SelectItem>
                  <SelectItem value="itemized">Individual item deadlines</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Common Deadline</Label>
              <Input
                type="date"
                min={minDeadlineInputValue}
                value={toDateValue(commonDeadline)}
                className="h-10 text-sm leading-none"
                disabled={deadlineMode !== 'common'}
                onChange={(event) =>
                  setCommonDeadline(
                    event.target.value ? new Date(`${event.target.value}T00:00:00`) : undefined
                  )
                }
              />
            </div>

            <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground md:col-start-2">
              Delivery dates must be at least 3 working days from today.
            </p>
          </div>

          <AttachmentUploadField
            label="Master References / Attachments"
            description="Upload campaign-level references shared across all collateral items: brand assets, approved copy, event brief, logos, prior creatives, or mandatory guidelines."
            attachments={masterAttachments}
            onChange={setMasterAttachments}
            taskTitle={requestTitle || 'Campaign Request'}
            taskSection="Campaign Master References"
            emptyLabel="These files stay at request level and remain visible across the full campaign request."
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
                  useCommonDeadline={deadlineMode === 'common'}
                  commonDeadline={commonDeadline}
                  minDeadline={minDeadlineInputValue}
                  onChange={(next) =>
                    setCollaterals((previous) =>
                      previous.map((item) => (item.id === collateral.id ? next : item))
                    )
                  }
                  onRemove={() =>
                    setCollaterals((previous) => previous.filter((item) => item.id !== collateral.id))
                  }
                />
              ))}
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="space-y-6">
        <section className={cn(glassCardClass, 'p-6')}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-primary">Review Summary</p>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">{requestTitle.trim() || 'Campaign request'}</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                This submission will create one parent campaign request with separate collateral
                items for designers to track and update individually.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
              <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Collaterals</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{summary.collateralCount}</p>
              </div>
              <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">References</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{summary.totalReferenceCount}</p>
              </div>
              <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {summary.effectiveDeadline
                    ? format(summary.effectiveDeadline, 'EEE, dd MMM yyyy')
                    : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className={cn(glassCardClass, 'p-6')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Campaign Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Shared campaign data visible across all collateral items.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep('campaign')}>
                  Edit
                </Button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Title</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{requestTitle || '-'}</p>
                </div>
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Department</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{department || '-'}</p>
                </div>
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contact Number</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{requesterPhone || '-'}</p>
                </div>
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deadline Mode</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {deadlineMode === 'common' ? 'One common deadline' : 'Individual item deadlines'}
                  </p>
                </div>
                <div className={cn(glassStatCardClass, 'px-4 py-3 md:col-span-2')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overall Brief</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{overallBrief || '-'}</p>
                </div>
              </div>
            </section>

            <section className={cn(glassCardClass, 'p-6')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Collateral Queue</h3>
                  <p className="text-sm text-muted-foreground">
                    Designer tracking will happen item by item after submission.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep('collaterals')}>
                  Edit
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {collaterals.map((collateral) => (
                  <div
                    key={collateral.id}
                    className={cn(glassStatCardClass, 'px-4 py-4')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            {getCollateralDisplayName(collateral)}
                          </h4>
                          <Badge variant="secondary">
                            {formatCollateralStatusLabel(collateral.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(collateral.presetLabel || collateral.collateralType) + ' | '}
                          {getCollateralSizeSummary(collateral)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {formatCollateralPriorityLabel(collateral.priority)}
                        </Badge>
                        <Badge variant="outline">
                          {deadlineMode === 'common'
                            ? commonDeadline
                              ? format(commonDeadline, 'dd MMM yyyy')
                              : 'No deadline'
                            : collateral.deadline
                              ? format(collateral.deadline, 'dd MMM yyyy')
                              : 'No deadline'}
                        </Badge>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {collateral.brief || 'No item brief added yet.'}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{collateral.platform || 'No platform'}</span>
                      <span>{collateral.usageType || 'No usage type'}</span>
                      <span>{collateral.referenceFiles.length} item references</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className={cn(glassCardClass, 'p-6')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Files & Timing</h3>
                  <p className="text-sm text-muted-foreground">
                    Shared references and the request timing logic.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep('timeline')}>
                  Edit
                </Button>
              </div>

              <div className="mt-5 grid gap-3">
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Effective Deadline</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {summary.effectiveDeadline
                      ? format(summary.effectiveDeadline, 'EEE, dd MMM yyyy')
                      : 'Not set'}
                  </p>
                </div>
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Master References</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {summary.masterReferenceCount} uploaded
                  </p>
                </div>
                <div className={cn(glassStatCardClass, 'px-4 py-3')}>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Item References</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {summary.collateralReferenceCount} uploaded
                  </p>
                </div>
              </div>
            </section>

            <section className={cn(glassCardClass, 'p-6')}>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="h-4 w-4 text-primary" />
                Final Checks
              </div>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>At least one master or item-level reference must be attached.</li>
                <li>Common deadline applies to every item when selected.</li>
                <li>After submission, designers will update each collateral status separately.</li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    );
  };

  const renderStepSidebar = () => {
    if (currentStep === 'review') return null;

    const stepNotes: Record<Exclude<BuilderStepId, 'review'>, string> = {
      campaign: 'Set the shared request context here. These details will carry across every collateral item.',
      timeline:
        'Choose the deadline model and attach master references that designers should always see.',
      collaterals:
        'Each collateral becomes its own trackable design item after submission, with separate status updates.',
    };

    return (
      <aside className="space-y-4 xl:sticky xl:top-24">
        <section className={cn(builderSurfaceClass, 'p-5')}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {(() => {
                const ActiveIcon = BUILDER_STEPS[currentStepIndex]?.icon || BriefcaseBusiness;
                return <ActiveIcon className="h-4 w-4" />;
              })()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Step</p>
              <h3 className="text-base font-semibold text-foreground">
                {BUILDER_STEPS[currentStepIndex]?.title}
              </h3>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {stepNotes[currentStep as Exclude<BuilderStepId, 'review'>]}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className={cn(builderInsetCardClass, 'px-4 py-3')}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Campaign</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {requestTitle.trim() || 'Untitled request'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{department.trim() || 'Department not set'}</p>
            </div>

            <div className={cn(builderInsetCardClass, 'px-4 py-3')}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Deadline</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {summary.effectiveDeadline
                  ? format(summary.effectiveDeadline, 'dd MMM yyyy')
                  : deadlineMode === 'itemized'
                    ? 'Item-wise dates'
                    : 'Not set'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {deadlineMode === 'common' ? 'One shared deadline' : 'Individual collateral deadlines'}
              </p>
            </div>

            <div className={cn(builderInsetCardClass, 'px-4 py-3')}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Collaterals</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{summary.collateralCount} planned</p>
              <p className="mt-1 text-xs text-muted-foreground">Preset-based items in this request</p>
            </div>

            <div className={cn(builderInsetCardClass, 'px-4 py-3')}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">References</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{summary.totalReferenceCount} uploaded</p>
              <p className="mt-1 text-xs text-muted-foreground">Master and item-level files combined</p>
            </div>
          </div>
        </section>

        <section className={cn(builderSurfaceClass, 'p-5')}>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Workflow Progress</p>
          <div className="mt-4 space-y-3">
            {BUILDER_STEPS.map((step, index) => {
              const isCurrent = step.id === currentStep;
              const isComplete = index < currentStepIndex && !validationMessages[step.id];
              const statusText = isComplete ? 'Completed' : isCurrent ? 'In progress' : 'Upcoming';

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      isCurrent || isComplete
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : step.label}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{statusText}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </aside>
    );
  };

  const stepPanel = (
    <section className={cn(builderSurfaceClass, 'overflow-hidden')}>
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

      <div className="px-5 py-4">{renderStepContent()}</div>

      <div className={builderFooterClass}>
        {validationMessages[currentStep] ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
            {validationMessages[currentStep]}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center">
            {currentStepIndex > 0 ? (
              <Button type="button" variant="ghost" onClick={handlePreviousStep} className="px-2 text-muted-foreground">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" onClick={saveDraft}>
              Save as draft
            </Button>

            {currentStep === 'review' ? (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Campaign Request'}
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-4 pb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-3 rounded-full border-border/70 bg-white/80 px-3 py-1 text-primary dark:border-sidebar-border dark:bg-sidebar-accent/80">
              Campaign Request Builder
            </Badge>
            <h1 className="text-[30px] font-bold tracking-tight text-foreground">
              Build one campaign request with structured collateral items
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Structured internal request flow for campaign details, timelines, collateral items,
              and final review.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/my-requests')}>
              Cancel
            </Button>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[22px] border border-[#C9D8FF]/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.52),rgba(241,246,255,0.62),rgba(224,235,255,0.54))] px-4 py-3 supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(241,246,255,0.42),rgba(224,235,255,0.36))] backdrop-blur-xl dark:border-sidebar-border dark:bg-sidebar dark:[background-image:none] dark:supports-[backdrop-filter]:bg-sidebar/96 dark:backdrop-blur-[24px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(87,118,255,0.07),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,85,190,0.07),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,91,190,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,91,190,0.1),transparent_24%)]" />
          <div className="overflow-x-auto">
            <ol className="relative flex min-w-[760px] items-center">
              {BUILDER_STEPS.map((step, index) => {
                const isCurrent = step.id === currentStep;
                const isComplete = index < currentStepIndex && !validationMessages[step.id];
                const isUnlocked = index <= furthestUnlockedStepIndex;
                const StepIcon = step.icon;
                const trackingLabel = isComplete ? 'Completed' : isCurrent ? 'Current step' : 'Upcoming';

                return (
                  <li key={step.id} className="flex min-w-0 flex-1 items-center">
                    <button
                      type="button"
                      onClick={() => handleStepChange(step.id)}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-3 rounded-[18px] px-3 py-2.5 text-left backdrop-blur-md transition-all duration-150',
                        isCurrent &&
                          'bg-[linear-gradient(135deg,rgba(255,255,255,0.32),rgba(234,241,255,0.42),rgba(212,225,255,0.24))] shadow-[inset_0_0_0_1px_rgba(67,97,204,0.12)] dark:border dark:border-sidebar-ring/40 dark:bg-sidebar-primary dark:[background-image:none] dark:text-sidebar-primary-foreground dark:shadow-[0_18px_40px_-28px_rgba(29,78,216,0.42)]',
                        isComplete &&
                          'bg-[linear-gradient(135deg,rgba(255,255,255,0.26),rgba(240,245,255,0.34))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] dark:border dark:border-sidebar-border dark:bg-sidebar-accent dark:[background-image:none] dark:text-sidebar-foreground',
                        !isCurrent &&
                          !isComplete &&
                          'bg-white/18 dark:border dark:border-sidebar-border dark:bg-sidebar dark:[background-image:none] dark:text-sidebar-foreground',
                        isUnlocked ? 'hover:bg-white/30 dark:hover:border-sidebar-ring/30 dark:hover:bg-sidebar-accent' : 'cursor-not-allowed opacity-70'
                      )}
                      disabled={!isUnlocked}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold backdrop-blur-sm',
                          isCurrent && 'border-primary bg-primary text-primary-foreground dark:border-sidebar-primary dark:bg-sidebar-primary dark:text-sidebar-primary-foreground',
                          isComplete && 'border-primary bg-primary text-primary-foreground dark:border-sidebar-primary dark:bg-sidebar-primary dark:text-sidebar-primary-foreground',
                          !isCurrent &&
                            !isComplete &&
                            'border-white/70 bg-white/70 text-muted-foreground dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground'
                        )}
                      >
                        {isComplete ? <Check className="h-4 w-4" /> : step.label}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <StepIcon
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              isCurrent || isComplete
                                ? 'text-primary dark:text-sidebar-primary-foreground'
                                : 'text-muted-foreground dark:text-sidebar-foreground/70'
                            )}
                          />
                          <p
                            className={cn(
                              'truncate text-[13px] font-semibold text-foreground',
                              isCurrent ? 'dark:text-sidebar-primary-foreground' : 'dark:text-sidebar-foreground'
                            )}
                          >
                            {step.title}
                          </p>
                        </div>
                        <p
                          className={cn(
                            'mt-0.5 text-[10.5px] leading-4 text-muted-foreground',
                            isCurrent ? 'dark:text-sidebar-primary-foreground/75' : 'dark:text-sidebar-foreground/60'
                          )}
                        >
                          {trackingLabel}
                        </p>
                      </div>
                    </button>

                    {index < BUILDER_STEPS.length - 1 ? (
                      <div className="mx-2 h-px w-10 flex-none bg-[#D8E3FF]/90 lg:w-14 dark:bg-sidebar-border">
                        <div
                          className={cn(
                            'h-full w-full',
                            index < currentStepIndex
                              ? 'bg-[linear-gradient(90deg,rgba(56,85,190,0.95),rgba(96,124,255,0.92))] dark:bg-sidebar-primary dark:[background-image:none]'
                              : 'bg-[#D8E3FF]/90 dark:bg-sidebar-border'
                          )}
                        />
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
            {stepPanel}
            {renderStepSidebar()}
          </div>
        )}

        <CollateralPresetDialog
          open={isPresetDialogOpen}
          onOpenChange={setIsPresetDialogOpen}
          variant="dark"
          onSelect={(preset) => {
            setCollaterals((previous) => [
              ...previous,
              createCollateralDraftFromPreset(preset, deadlineMode, commonDeadline),
            ]);
            setIsPresetDialogOpen(false);
            toast.success(`${preset.label} added.`);
          }}
          onSelectMany={(presets) => {
            setCollaterals((previous) => [
              ...previous,
              ...presets.map((preset) =>
                createCollateralDraftFromPreset(preset, deadlineMode, commonDeadline)
              ),
            ]);
            setIsPresetDialogOpen(false);
            toast.success(`${presets.length} presets added.`);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

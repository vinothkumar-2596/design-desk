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

  const footerNote = validationMessages[currentStep]
    ? validationMessages[currentStep]
    : currentStep === 'review'
      ? 'Everything looks ready. Submit the request to create one parent campaign with structured collateral items.'
      : 'Current step is complete. Continue to the next step.';

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

  const renderStepContent = () => {
    if (currentStep === 'campaign') {
      return (
        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Campaign Details</h2>
                  <p className="text-sm text-muted-foreground">
                    Define the shared request context once before adding collateral items.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Campaign Title</Label>
                  <Input
                    value={requestTitle}
                    onChange={(event) => setRequestTitle(event.target.value)}
                    placeholder="Admissions Drive 2026 / Annual Day / Product Launch Campaign"
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
                      className="pl-9"
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
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Overall Brief</Label>
                <Textarea
                  value={overallBrief}
                  onChange={(event) => setOverallBrief(event.target.value)}
                  className="min-h-[180px]"
                  placeholder="Describe the campaign objective, audience, message hierarchy, mandatory copy, visual tone, logos, language, and approval context."
                />
              </div>
            </div>

            <div className="rounded-[30px] border border-[#D7E4FF] bg-gradient-to-br from-[#0F172A] via-[#132042] to-[#1D3260] p-6 text-white shadow-xl">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Step Guidance</p>
              <h3 className="mt-4 text-xl font-semibold">Set the campaign story first</h3>
              <p className="mt-3 text-sm text-white/72">
                This step should answer what the campaign is, who is requesting it, and what the
                design team needs to understand before opening any collateral item.
              </p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Request Mode</p>
                  <p className="mt-1 text-base font-semibold">Campaign Request Builder</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Collaterals</p>
                  <p className="mt-1 text-base font-semibold">{summary.collateralCount || 0} planned</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Required</p>
                  <p className="mt-1 text-sm font-medium text-white/82">
                    Title, department, phone, and one strong brief.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (currentStep === 'timeline') {
      return (
        <section className="space-y-6">
          <section className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Deadline Strategy</h2>
                <p className="text-sm text-muted-foreground">
                  Choose one campaign deadline or switch to individual deadlines per collateral item.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-end">
              <div className="space-y-2">
                <Label>Deadline Mode</Label>
                <Select
                  value={deadlineMode}
                  onValueChange={(value) => setDeadlineMode(value as 'common' | 'itemized')}
                >
                  <SelectTrigger>
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
                  disabled={deadlineMode !== 'common'}
                  onChange={(event) =>
                    setCommonDeadline(
                      event.target.value ? new Date(`${event.target.value}T00:00:00`) : undefined
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Delivery dates must be at least 3 working days from today.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
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
        </section>
      );
    }

    if (currentStep === 'collaterals') {
      return (
        <section className="space-y-6">
          <section className="rounded-[30px] border border-[#D7E4FF] bg-gradient-to-br from-white via-[#FBFDFF] to-[#EEF4FF] p-6 shadow-sm dark:border-border dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Collateral Builder</h2>
                    <p className="text-sm text-muted-foreground">
                      Add preset-based collateral items. Each item keeps its own brief, platform,
                      references, deadline, and status.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="button" onClick={() => setIsPresetDialogOpen(true)} className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Collateral
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {summary.collateralCount} items
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {summary.taskCategory}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {summary.urgency}
              </Badge>
            </div>
          </section>

          {collaterals.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-[#CFE0FF] bg-[#F8FBFF] px-6 py-14 text-center dark:border-border dark:bg-slate-900/40">
              <Layers3 className="mx-auto h-10 w-10 text-primary/70" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No collaterals added yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start with presets like Instagram Post, Standee, Flyer, LED Backdrop, Invitation,
                Certificate, or WhatsApp Creative.
              </p>
              <Button
                type="button"
                onClick={() => setIsPresetDialogOpen(true)}
                className="mt-5 rounded-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Choose First Preset
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
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
        <section className="rounded-[30px] border border-[#D7E4FF] bg-gradient-to-br from-[#0F172A] via-[#132042] to-[#1D3260] p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Review Summary</p>
              <h2 className="mt-3 text-2xl font-semibold">{requestTitle.trim() || 'Campaign request'}</h2>
              <p className="mt-3 text-sm text-white/72">
                This submission will create one parent campaign request with separate collateral
                items for designers to track and update individually.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">Collaterals</p>
                <p className="mt-1 text-xl font-semibold">{summary.collateralCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">References</p>
                <p className="mt-1 text-xl font-semibold">{summary.totalReferenceCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">Deadline</p>
                <p className="mt-1 text-sm font-semibold">
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
            <section className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
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
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Title</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{requestTitle || '-'}</p>
                </div>
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Department</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{department || '-'}</p>
                </div>
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contact Number</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{requesterPhone || '-'}</p>
                </div>
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deadline Mode</p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {deadlineMode === 'common' ? 'One common deadline' : 'Individual item deadlines'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 md:col-span-2 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overall Brief</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{overallBrief || '-'}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
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
                    className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-4 dark:border-border dark:bg-slate-900/50"
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
            <section className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
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
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Effective Deadline</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {summary.effectiveDeadline
                      ? format(summary.effectiveDeadline, 'EEE, dd MMM yyyy')
                      : 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Master References</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {summary.masterReferenceCount} uploaded
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E2EBFF] bg-[#F9FBFF] px-4 py-3 dark:border-border dark:bg-slate-900/50">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Item References</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {summary.collateralReferenceCount} uploaded
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#D7E4FF] bg-white/90 p-6 shadow-sm dark:border-border dark:bg-card/80">
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1">
              Campaign Request Builder
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Build one campaign request with structured collateral items
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Modern step-by-step builder: complete the campaign basics first, then move into
              deadline planning, collateral setup, and final review.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/my-requests')}>
              Cancel
            </Button>
          </div>
        </div>

        <section className="rounded-[32px] border border-[#D7E4FF] bg-white/90 p-5 shadow-sm dark:border-border dark:bg-card/80">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Step {currentStepIndex + 1} of {BUILDER_STEPS.length}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete the current block, then move to the next one.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {summary.collateralCount} collaterals
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {summary.totalReferenceCount} references
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {BUILDER_STEPS.map((step, index) => {
              const isCurrent = step.id === currentStep;
              const isComplete = index < currentStepIndex && !validationMessages[step.id];
              const isUnlocked = index <= furthestUnlockedStepIndex;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="flex flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleStepChange(step.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition',
                      isCurrent &&
                        'border-primary/40 bg-primary/[0.06] shadow-[0_10px_30px_rgba(43,87,255,0.08)]',
                      !isCurrent && isUnlocked && 'border-[#D7E4FF] bg-[#F8FBFF] hover:border-primary/30',
                      !isUnlocked && 'cursor-not-allowed border-[#E8EDF9] bg-[#FAFBFD] opacity-60'
                    )}
                    disabled={!isUnlocked}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                        isCurrent && 'border-primary bg-primary text-white',
                        isComplete && 'border-emerald-500 bg-emerald-500 text-white',
                        !isCurrent && !isComplete && 'border-[#D7E4FF] bg-white text-foreground'
                      )}
                    >
                      {isComplete ? <Check className="h-4 w-4" /> : step.label}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StepIcon className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </button>

                  {index < BUILDER_STEPS.length - 1 ? (
                    <div className="hidden h-px flex-1 bg-[#D7E4FF] xl:block" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-[36px] border border-[#D7E4FF] bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card/95">
          <div className="border-b border-[#E8EEF9] px-6 py-5 dark:border-border">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {BUILDER_STEPS[currentStepIndex]?.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {BUILDER_STEPS[currentStepIndex]?.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {summary.taskCategory}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {summary.urgency}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {summary.effectiveDeadline
                    ? format(summary.effectiveDeadline, 'dd MMM yyyy')
                    : 'Deadline pending'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">{renderStepContent()}</div>

          <div className="border-t border-[#E8EEF9] bg-[#FBFDFF] px-6 py-5 dark:border-border dark:bg-slate-950/30">
            <div
              className={cn(
                'mb-4 rounded-2xl border px-4 py-3 text-sm',
                validationMessages[currentStep]
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200'
              )}
            >
              {footerNote}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={saveDraft}>
                  Save as draft
                </Button>
                {currentStepIndex > 0 ? (
                  <Button type="button" variant="ghost" onClick={handlePreviousStep}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                ) : null}
              </div>

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
        </section>

        <CollateralPresetDialog
          open={isPresetDialogOpen}
          onOpenChange={setIsPresetDialogOpen}
          onSelect={(preset) => {
            setCollaterals((previous) => [
              ...previous,
              createCollateralDraftFromPreset(preset, deadlineMode, commonDeadline),
            ]);
            setIsPresetDialogOpen(false);
            toast.success(`${preset.label} added.`);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

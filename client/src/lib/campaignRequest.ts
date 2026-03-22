import type {
  CampaignRequestDetails,
  CollateralItem,
  CollateralPriority,
  CollateralStatus,
  TaskCategory,
  TaskStatus,
  TaskUrgency,
} from '@/types';

export type CollateralPreset = {
  id: string;
  label: string;
  collateralType: string;
  group: 'social_media' | 'print' | 'event_branding' | 'identity' | 'messaging';
  width?: number;
  height?: number;
  unit?: 'px' | 'mm' | 'cm' | 'in' | 'ft';
  ratioLabel?: string;
  sizeLabel?: string;
  orientation?: 'portrait' | 'landscape' | 'square' | 'custom';
  platform?: string;
  usageType?: string;
  category: TaskCategory;
};

export const COLLATERAL_STATUS_OPTIONS: Array<{ value: CollateralStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'submitted_for_review', label: 'Submitted for Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rework', label: 'Rework' },
  { value: 'completed', label: 'Completed' },
];

export const COLLATERAL_PRIORITY_OPTIONS: Array<{ value: CollateralPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const COLLATERAL_PRESETS: CollateralPreset[] = [
  {
    id: 'instagram-post-4-5',
    label: 'Instagram Post - 1080x1350',
    collateralType: 'Instagram Post',
    group: 'social_media',
    width: 1080,
    height: 1350,
    unit: 'px',
    ratioLabel: '4:5',
    sizeLabel: '1080 x 1350 px',
    orientation: 'portrait',
    platform: 'Instagram',
    usageType: 'Feed Post',
    category: 'social_media_creative',
  },
  {
    id: 'instagram-square',
    label: 'Instagram Square - 1080x1080',
    collateralType: 'Instagram Post',
    group: 'social_media',
    width: 1080,
    height: 1080,
    unit: 'px',
    ratioLabel: '1:1',
    sizeLabel: '1080 x 1080 px',
    orientation: 'square',
    platform: 'Instagram',
    usageType: 'Feed Post',
    category: 'social_media_creative',
  },
  {
    id: 'instagram-story',
    label: 'Instagram Story - 1080x1920',
    collateralType: 'Instagram Story',
    group: 'social_media',
    width: 1080,
    height: 1920,
    unit: 'px',
    ratioLabel: '9:16',
    sizeLabel: '1080 x 1920 px',
    orientation: 'portrait',
    platform: 'Instagram',
    usageType: 'Story',
    category: 'social_media_creative',
  },
  {
    id: 'facebook-post',
    label: 'Facebook Post - 1200x628',
    collateralType: 'Facebook Post',
    group: 'social_media',
    width: 1200,
    height: 628,
    unit: 'px',
    ratioLabel: '1.91:1',
    sizeLabel: '1200 x 628 px',
    orientation: 'landscape',
    platform: 'Facebook',
    usageType: 'Feed Post',
    category: 'social_media_creative',
  },
  {
    id: 'youtube-thumbnail',
    label: 'YouTube Thumbnail - 1280x720',
    collateralType: 'YouTube Thumbnail',
    group: 'social_media',
    width: 1280,
    height: 720,
    unit: 'px',
    ratioLabel: '16:9',
    sizeLabel: '1280 x 720 px',
    orientation: 'landscape',
    platform: 'YouTube',
    usageType: 'Thumbnail',
    category: 'social_media_creative',
  },
  {
    id: 'whatsapp-story',
    label: 'WhatsApp Story - 1080x1920',
    collateralType: 'WhatsApp Creative',
    group: 'social_media',
    width: 1080,
    height: 1920,
    unit: 'px',
    ratioLabel: '9:16',
    sizeLabel: '1080 x 1920 px',
    orientation: 'portrait',
    platform: 'WhatsApp',
    usageType: 'Story',
    category: 'social_media_creative',
  },
  {
    id: 'whatsapp-creative-square',
    label: 'WhatsApp Creative - 1080x1080',
    collateralType: 'WhatsApp Creative',
    group: 'messaging',
    width: 1080,
    height: 1080,
    unit: 'px',
    ratioLabel: '1:1',
    sizeLabel: '1080 x 1080 px',
    orientation: 'square',
    platform: 'WhatsApp',
    usageType: 'Direct Share',
    category: 'social_media_creative',
  },
  {
    id: 'a4-flyer',
    label: 'A4 Flyer',
    collateralType: 'Flyer',
    group: 'print',
    width: 210,
    height: 297,
    unit: 'mm',
    sizeLabel: '210 x 297 mm',
    orientation: 'portrait',
    usageType: 'Print',
    category: 'flyer',
  },
  {
    id: 'a5-flyer',
    label: 'A5 Flyer',
    collateralType: 'Flyer',
    group: 'print',
    width: 148,
    height: 210,
    unit: 'mm',
    sizeLabel: '148 x 210 mm',
    orientation: 'portrait',
    usageType: 'Print',
    category: 'flyer',
  },
  {
    id: 'poster-a3',
    label: 'Poster A3',
    collateralType: 'Poster',
    group: 'print',
    width: 297,
    height: 420,
    unit: 'mm',
    sizeLabel: '297 x 420 mm',
    orientation: 'portrait',
    usageType: 'Print',
    category: 'flyer',
  },
  {
    id: 'poster-a2',
    label: 'Poster A2',
    collateralType: 'Poster',
    group: 'print',
    width: 420,
    height: 594,
    unit: 'mm',
    sizeLabel: '420 x 594 mm',
    orientation: 'portrait',
    usageType: 'Print',
    category: 'flyer',
  },
  {
    id: 'standee-2x5',
    label: 'Standee 2x5 ft',
    collateralType: 'Standee',
    group: 'print',
    width: 2,
    height: 5,
    unit: 'ft',
    sizeLabel: '2 x 5 ft',
    orientation: 'portrait',
    usageType: 'Print',
    category: 'banner',
  },
  {
    id: 'standee-2x6',
    label: 'Standee 2x6 ft',
    collateralType: 'Standee',
    group: 'print',
    width: 2,
    height: 6,
    unit: 'ft',
    sizeLabel: '2 x 6 ft',
    orientation: 'portrait',
    usageType: 'Print',
    category: 'banner',
  },
  {
    id: 'banner-10x4',
    label: 'Banner 10x4 ft',
    collateralType: 'Banner',
    group: 'print',
    width: 10,
    height: 4,
    unit: 'ft',
    sizeLabel: '10 x 4 ft',
    orientation: 'landscape',
    usageType: 'Print',
    category: 'banner',
  },
  {
    id: 'brochure-trifold',
    label: 'Brochure Tri-fold',
    collateralType: 'Brochure',
    group: 'print',
    width: 297,
    height: 210,
    unit: 'mm',
    sizeLabel: '297 x 210 mm',
    orientation: 'landscape',
    usageType: 'Print',
    category: 'brochure',
  },
  {
    id: 'led-backdrop',
    label: 'LED Backdrop - 1920x1080',
    collateralType: 'LED Backdrop',
    group: 'event_branding',
    width: 1920,
    height: 1080,
    unit: 'px',
    ratioLabel: '16:9',
    sizeLabel: '1920 x 1080 px',
    orientation: 'landscape',
    usageType: 'LED Screen',
    category: 'led_backdrop',
  },
  {
    id: 'stage-backdrop-custom',
    label: 'Stage Backdrop - Custom',
    collateralType: 'Stage Backdrop',
    group: 'event_branding',
    orientation: 'landscape',
    usageType: 'Event Branding',
    category: 'led_backdrop',
  },
  {
    id: 'arch-custom',
    label: 'Arch - Custom',
    collateralType: 'Arch',
    group: 'event_branding',
    orientation: 'custom',
    usageType: 'Event Branding',
    category: 'banner',
  },
  {
    id: 'invitation-portrait',
    label: 'Invitation - Portrait',
    collateralType: 'Invitation',
    group: 'event_branding',
    orientation: 'portrait',
    usageType: 'Print / Digital',
    category: 'campaign_or_others',
  },
  {
    id: 'invitation-landscape',
    label: 'Invitation - Landscape',
    collateralType: 'Invitation',
    group: 'event_branding',
    orientation: 'landscape',
    usageType: 'Print / Digital',
    category: 'campaign_or_others',
  },
  {
    id: 'id-card-standard',
    label: 'ID Card - Standard Size',
    collateralType: 'ID Card',
    group: 'identity',
    width: 86,
    height: 54,
    unit: 'mm',
    sizeLabel: '86 x 54 mm',
    orientation: 'landscape',
    usageType: 'Identity',
    category: 'campaign_or_others',
  },
  {
    id: 'certificate-a4-landscape',
    label: 'Certificate - A4 Landscape',
    collateralType: 'Certificate',
    group: 'identity',
    width: 297,
    height: 210,
    unit: 'mm',
    sizeLabel: '297 x 210 mm',
    orientation: 'landscape',
    usageType: 'Print',
    category: 'campaign_or_others',
  },
];

const priorityWeight: Record<CollateralPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

export const formatCollateralStatusLabel = (value?: string) =>
  COLLATERAL_STATUS_OPTIONS.find((option) => option.value === value)?.label || 'Pending';

export const formatCollateralPriorityLabel = (value?: string) =>
  COLLATERAL_PRIORITY_OPTIONS.find((option) => option.value === value)?.label || 'Normal';

export const getCollateralPreset = (presetKey?: string) =>
  COLLATERAL_PRESETS.find((preset) => preset.id === presetKey);

export const getCollateralPresetGroups = () => {
  const groups = new Map<string, CollateralPreset[]>();
  COLLATERAL_PRESETS.forEach((preset) => {
    const collection = groups.get(preset.group) || [];
    collection.push(preset);
    groups.set(preset.group, collection);
  });
  return groups;
};

export const getCollateralDisplayName = (collateral: Partial<CollateralItem>) =>
  collateral.title ||
  collateral.presetLabel ||
  collateral.collateralType ||
  collateral.platform ||
  'Collateral';

export const getCollateralSizeSummary = (collateral: Partial<CollateralItem>) => {
  if (collateral.customSizeLabel) return collateral.customSizeLabel;
  if (collateral.sizeLabel) return collateral.sizeLabel;
  if (collateral.width && collateral.height && collateral.unit) {
    return `${collateral.width} x ${collateral.height} ${collateral.unit}`;
  }
  return 'Custom size';
};

export const buildCampaignDescription = (
  details: Pick<CampaignRequestDetails, 'brief'>,
  collaterals: CollateralItem[]
) => {
  const summaryLines = collaterals.map((collateral, index) => {
    const parts = [
      getCollateralDisplayName(collateral),
      collateral.platform || collateral.usageType || collateral.collateralType,
      getCollateralSizeSummary(collateral),
      collateral.brief,
    ].filter(Boolean);
    return `${index + 1}. ${parts.join(' | ')}`;
  });

  return [details.brief, '', 'Collateral Scope', ...summaryLines].filter(Boolean).join('\n');
};

export const deriveTaskUrgencyFromCollaterals = (collaterals: CollateralItem[]): TaskUrgency => {
  const highest = collaterals.reduce<CollateralPriority>(
    (current, collateral) =>
      priorityWeight[collateral.priority] > priorityWeight[current] ? collateral.priority : current,
    'low'
  );

  if (highest === 'critical') return 'urgent';
  if (highest === 'high') return 'intermediate';
  if (highest === 'normal') return 'normal';
  return 'low';
};

export const deriveTaskCategoryFromCollaterals = (collaterals: CollateralItem[]): TaskCategory => {
  const categoryCounts = new Map<TaskCategory, number>();

  collaterals.forEach((collateral) => {
    const presetCategory = getCollateralPreset(collateral.presetKey)?.category;
    const nextCategory = presetCategory || inferTaskCategoryFromCollateralType(collateral.collateralType);
    categoryCounts.set(nextCategory, (categoryCounts.get(nextCategory) || 0) + 1);
  });

  let selected: TaskCategory = 'campaign_or_others';
  let highestCount = -1;
  categoryCounts.forEach((count, category) => {
    if (count > highestCount) {
      highestCount = count;
      selected = category;
    }
  });

  return selected;
};

export const deriveTaskStatusFromCollaterals = (
  collaterals: Array<Pick<CollateralItem, 'status'>>,
  fallback: TaskStatus = 'pending'
): TaskStatus => {
  if (collaterals.length === 0) return fallback;
  const statuses = collaterals.map((collateral) => collateral.status);

  if (statuses.every((status) => status === 'completed')) return 'completed';
  if (statuses.some((status) => status === 'rework')) return 'clarification_required';
  if (statuses.some((status) => status === 'in_progress' || status === 'approved')) {
    return 'in_progress';
  }
  if (statuses.some((status) => status === 'submitted_for_review')) return 'under_review';
  if (statuses.every((status) => status === 'pending')) return 'pending';
  return fallback;
};

export const deriveEffectiveDeadline = (
  collaterals: Array<Pick<CollateralItem, 'deadline'>>,
  campaign?: Pick<CampaignRequestDetails, 'deadlineMode' | 'commonDeadline'>
) => {
  if (campaign?.deadlineMode === 'common' && campaign.commonDeadline) {
    return campaign.commonDeadline;
  }

  const dates = collaterals
    .map((collateral) => (collateral.deadline ? new Date(collateral.deadline) : null))
    .filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  return dates[0];
};

export const inferTaskCategoryFromCollateralType = (value?: string): TaskCategory => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'campaign_or_others';
  if (
    ['standee', 'banner', 'arch', 'stage backdrop'].some((keyword) => normalized.includes(keyword))
  ) {
    return 'banner';
  }
  if (
    ['instagram', 'social', 'whatsapp', 'youtube', 'facebook', 'poster'].some((keyword) =>
      normalized.includes(keyword)
    )
  ) {
    return 'social_media_creative';
  }
  if (normalized.includes('brochure')) return 'brochure';
  if (normalized.includes('flyer')) return 'flyer';
  if (normalized.includes('led')) return 'led_backdrop';
  return 'campaign_or_others';
};

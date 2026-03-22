import type {
  CollateralOrientation,
  CollateralPriority,
  CollateralSizeMode,
  CollateralStatus,
  CollateralUnit,
  TaskCategory,
  TaskUrgency,
} from '@/types';

type DraftUser = {
  id?: string;
  email?: string;
} | null | undefined;

export type RequestDraftFile = {
  id: string;
  name: string;
  size: number;
  driveId?: string;
  url?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailUrl?: string;
};

export type RequestDraftCollateral = {
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
  deadline?: string;
  priority: CollateralPriority;
  status: CollateralStatus;
  referenceFiles: RequestDraftFile[];
};

export type RequestDraftPayload = {
  title: string;
  description: string;
  category: TaskCategory | '';
  urgency: TaskUrgency;
  deadline: string;
  hasDeadlineInteracted: boolean;
  isEmergency: boolean;
  requesterPhone: string;
  files: RequestDraftFile[];
  requestType?: 'single_task' | 'campaign_request';
  deadlineMode?: 'common' | 'itemized';
  commonDeadline?: string;
  collaterals?: RequestDraftCollateral[];
  requesterDepartment?: string;
  savedAt: string;
};

export const REQUEST_DRAFT_STORAGE_KEY_PREFIX = 'designhub:new-request:draft';
export const REQUEST_DRAFT_UPDATED_EVENT = 'designhub:new-request-draft:updated';

const canUseStorage = () => typeof window !== 'undefined';

const normalizeDraftOwner = (user: DraftUser) =>
  String(user?.id || user?.email || 'guest').trim() || 'guest';

export const getRequestDraftStorageKey = (user: DraftUser) =>
  `${REQUEST_DRAFT_STORAGE_KEY_PREFIX}.${normalizeDraftOwner(user)}`;

const safeParseDraft = (value: string): RequestDraftPayload | null => {
  try {
    const parsed = JSON.parse(value) as RequestDraftPayload;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const emitDraftUpdate = (user: DraftUser, hasDraft: boolean) => {
  if (!canUseStorage()) return;
  window.dispatchEvent(
    new CustomEvent(REQUEST_DRAFT_UPDATED_EVENT, {
      detail: {
        key: getRequestDraftStorageKey(user),
        hasDraft,
      },
    })
  );
};

export const loadRequestDraft = (user: DraftUser): RequestDraftPayload | null => {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(getRequestDraftStorageKey(user));
  if (!raw) return null;
  return safeParseDraft(raw);
};

export const saveRequestDraft = (user: DraftUser, draft: RequestDraftPayload) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(getRequestDraftStorageKey(user), JSON.stringify(draft));
  emitDraftUpdate(user, true);
};

export const clearRequestDraft = (user: DraftUser) => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(getRequestDraftStorageKey(user));
  emitDraftUpdate(user, false);
};

export const hasRequestDraft = (user: DraftUser) => Boolean(loadRequestDraft(user));

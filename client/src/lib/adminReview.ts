import type { TaskChange } from '@/types';

export const ADMIN_REQUESTED_UPDATES_PREFIX = 'Admin requested updates:';

const normalizeMultilineText = (value?: string | null) =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

export const formatAdminRequestedUpdatesNote = (value?: string | null) => {
  const normalized = normalizeMultilineText(value);
  if (!normalized) return '';
  return `${ADMIN_REQUESTED_UPDATES_PREFIX}\n${normalized}`;
};

export const extractAdminRequestedUpdatesNote = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith(ADMIN_REQUESTED_UPDATES_PREFIX)) return '';
  return trimmed.slice(ADMIN_REQUESTED_UPDATES_PREFIX.length).trim();
};

export const getLatestAdminRequestedUpdatesNote = (
  history?: Array<
    Pick<TaskChange, 'field' | 'newValue' | 'note' | 'createdAt' | 'userRole'>
  > | null
) => {
  let latestTimestamp = -1;
  let latestNote = '';

  for (const entry of history || []) {
    if (entry.userRole !== 'admin' || entry.field !== 'admin_review_status') continue;
    if (!String(entry.newValue || '').trim().toLowerCase().includes('need')) continue;

    const extracted = extractAdminRequestedUpdatesNote(entry.note);
    if (!extracted) continue;

    const createdAt =
      entry.createdAt instanceof Date
        ? entry.createdAt.getTime()
        : new Date(entry.createdAt || 0).getTime();

    if (Number.isFinite(createdAt) && createdAt >= latestTimestamp) {
      latestTimestamp = createdAt;
      latestNote = extracted;
    }
  }

  return latestNote;
};

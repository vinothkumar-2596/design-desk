import type { CollateralItem } from '@/types';

export type BuilderAttachment = {
  id: string;
  name: string;
  size: number;
  progress?: number;
  url?: string;
  driveId?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailUrl?: string;
  uploading?: boolean;
  error?: string;
};

export type CollateralDraft = Omit<CollateralItem, 'deadline' | 'referenceFiles'> & {
  deadline?: Date;
  referenceFiles: BuilderAttachment[];
};

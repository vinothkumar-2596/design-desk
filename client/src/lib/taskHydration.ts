import type { CollateralItem, Task } from '@/types';

const toDate = (value?: string | Date | null) => (value ? new Date(value) : undefined);

const hydrateCollateral = (collateral: CollateralItem): CollateralItem => ({
  ...collateral,
  deadline: toDate(collateral.deadline),
  createdAt: toDate(collateral.createdAt),
  updatedAt: toDate(collateral.updatedAt),
  referenceFiles:
    collateral.referenceFiles?.map((file) => ({
      ...file,
      uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
    })) ?? [],
});

export const hydrateTask = (raw: Task): Task => ({
  ...raw,
  deadline: new Date(raw.deadline),
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
  proposedDeadline: toDate(raw.proposedDeadline),
  deadlineApprovedAt: toDate(raw.deadlineApprovedAt),
  approvalDate: toDate(raw.approvalDate),
  emergencyApprovedAt: toDate(raw.emergencyApprovedAt),
  emergencyRequestedAt: toDate(raw.emergencyRequestedAt),
  finalDeliverableReviewedAt: toDate(raw.finalDeliverableReviewedAt),
  campaign: raw.campaign
    ? {
        ...raw.campaign,
        commonDeadline: toDate(raw.campaign.commonDeadline),
      }
    : undefined,
  collaterals: raw.collaterals?.map(hydrateCollateral) ?? [],
  files: raw.files?.map((file) => ({
    ...file,
    uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
  })) ?? [],
  designVersions:
    raw.designVersions?.map((version) => ({
      ...version,
      uploadedAt: version.uploadedAt ? new Date(version.uploadedAt) : new Date(),
    })) ?? [],
  finalDeliverableVersions:
    raw.finalDeliverableVersions?.map((version) => ({
      ...version,
      uploadedAt: version.uploadedAt ? new Date(version.uploadedAt) : new Date(),
      reviewedAt: toDate(version.reviewedAt),
      files:
        version.files?.map((file) => ({
          ...file,
          uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
        })) ?? [],
    })) ?? [],
  comments: raw.comments?.map((comment) => ({
    ...comment,
    createdAt: new Date(comment.createdAt),
    editedAt: toDate(comment.editedAt),
    deletedAt: toDate(comment.deletedAt),
    attachments:
      comment.attachments?.map((file) => ({
        ...file,
        uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
      })) ?? [],
    seenBy:
      comment.seenBy?.map((entry) => ({
        ...entry,
        seenAt: entry.seenAt ? new Date(entry.seenAt) : new Date(),
      })) ?? [],
    reactions:
      comment.reactions?.map((reaction) => ({
        ...reaction,
        createdAt: reaction.createdAt ? new Date(reaction.createdAt) : new Date(),
      })) ?? [],
  })) ?? [],
  changeHistory: raw.changeHistory?.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
  })) ?? [],
});

export const hydrateTasks = (tasks: Task[]) => tasks.map(hydrateTask);

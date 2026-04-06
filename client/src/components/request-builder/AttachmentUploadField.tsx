import { useEffect, useMemo, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  AttachmentPreviewDialog,
  getAttachmentPreviewKind,
  isAttachmentPreviewable,
  type AttachmentPreviewFile,
} from '@/components/tasks/AttachmentPreviewDialog';
import { toast } from '@/components/ui/sonner';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Paperclip,
  RotateCw,
  Upload,
  X,
} from 'lucide-react';
import { API_URL, getAuthToken, openDriveReconnectWindow } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BuilderAttachment } from '@/components/request-builder/types';

type AttachmentUploadFieldProps = {
  label: string;
  description?: string;
  attachments: BuilderAttachment[];
  onChange: (
    next:
      | BuilderAttachment[]
      | ((previous: BuilderAttachment[]) => BuilderAttachment[])
  ) => void;
  taskTitle?: string;
  taskSection: string;
  emptyLabel?: string;
  uploadTitle?: string;
  uploadDescription?: string;
  buttonLabel?: string;
};

const formatFileSize = (bytes?: number) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (fileName: string) => {
  const extension = fileName.split('.').pop()?.trim().toUpperCase();
  return extension ? extension.slice(0, 4) : 'FILE';
};

const buildDriveViewUrl = (driveId?: string) => {
  const normalizedId = String(driveId || '').trim();
  if (!normalizedId) return '';
  return `https://drive.google.com/file/d/${encodeURIComponent(normalizedId)}/view?usp=drivesdk`;
};

const resolveUploadedDriveUrl = (data?: {
  id?: string;
  webViewLink?: string;
  webContentLink?: string;
} | null) => {
  const webViewLink = String(data?.webViewLink || '').trim();
  if (webViewLink) return webViewLink;
  const webContentLink = String(data?.webContentLink || '').trim();
  if (webContentLink) return webContentLink;
  return buildDriveViewUrl(data?.id);
};

const shouldPromptDriveReconnect = (errorMessage?: string) => {
  const normalized = String(errorMessage || '').toLowerCase();
  return (
    normalized.includes('drive oauth not connected') ||
    normalized.includes('must be set for oauth') ||
    normalized.includes('missing oauth code')
  );
};

const revokeLocalPreviewUrl = (url?: string) => {
  const previewUrl = String(url || '').trim();
  if (!previewUrl || !previewUrl.startsWith('blob:')) return;
  URL.revokeObjectURL(previewUrl);
};

const toPreviewFile = (attachment: BuilderAttachment): AttachmentPreviewFile => ({
  id: attachment.id,
  name: attachment.name,
  localPreviewUrl: attachment.localPreviewUrl,
  driveId: attachment.driveId,
  url: attachment.url,
  webViewLink: attachment.webViewLink,
  webContentLink: attachment.webContentLink,
  thumbnailUrl: attachment.thumbnailUrl,
  uploading: attachment.uploading,
  error: attachment.error,
});

let uploadAnimationCache: object | null = null;
let uploadAnimationPromise: Promise<object | null> | null = null;

const loadUploadAnimation = async () => {
  if (uploadAnimationCache) return uploadAnimationCache;
  if (!uploadAnimationPromise) {
    uploadAnimationPromise = fetch('/lottie/upload-file.json')
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as object;
        uploadAnimationCache = data;
        return data;
      })
      .catch(() => null);
  }
  return uploadAnimationPromise;
};

export function AttachmentUploadField({
  label,
  description,
  attachments,
  onChange,
  taskTitle,
  taskSection,
  emptyLabel = 'No files uploaded yet.',
  uploadTitle = 'Drag and drop files here, or upload from your device',
  uploadDescription = 'Files will be securely stored and linked to this request.',
  buttonLabel = 'Upload Files',
}: AttachmentUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadAnimation, setUploadAnimation] = useState<object | null>(uploadAnimationCache);
  const [previewFile, setPreviewFile] = useState<AttachmentPreviewFile | null>(null);
  const [isAttachmentQueueExpanded, setIsAttachmentQueueExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadRequestsRef = useRef(new Map<string, XMLHttpRequest>());
  const cancelledUploadIdsRef = useRef(new Set<string>());
  const latestAttachmentsRef = useRef<BuilderAttachment[]>([]);

  useEffect(() => {
    let mounted = true;

    if (uploadAnimationCache) {
      setUploadAnimation(uploadAnimationCache);
      return () => {
        mounted = false;
      };
    }

    void loadUploadAnimation().then((data) => {
      if (mounted && data) {
        setUploadAnimation(data);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    latestAttachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      activeUploadRequestsRef.current.forEach((xhr) => xhr.abort());
      activeUploadRequestsRef.current.clear();
      cancelledUploadIdsRef.current.clear();
      latestAttachmentsRef.current.forEach((attachment) =>
        revokeLocalPreviewUrl(attachment.localPreviewUrl)
      );
    },
    []
  );

  const updateAttachment = (attachmentId: string, next: Partial<BuilderAttachment>) => {
    onChange((previous) =>
      previous.map((attachment) =>
        attachment.id === attachmentId ? { ...attachment, ...next } : attachment
      )
    );
  };

  const cancelTrackedUpload = (id: string) => {
    const xhr = activeUploadRequestsRef.current.get(id);
    if (!xhr) return false;
    cancelledUploadIdsRef.current.add(id);
    xhr.abort();
    activeUploadRequestsRef.current.delete(id);
    return true;
  };

  const uploadFileWithProgress = (file: File, localId: string) =>
    new Promise<void>((resolve) => {
      if (!API_URL) {
        updateAttachment(localId, { uploading: false, progress: 100 });
        resolve();
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskTitle', taskTitle || 'Campaign Request');
      formData.append('taskSection', taskSection);

      const xhr = new XMLHttpRequest();
      activeUploadRequestsRef.current.set(localId, xhr);
      xhr.open('POST', `${API_URL}/api/files/upload`);
      const token = getAuthToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const nextProgress = Math.round((event.loaded / event.total) * 100);
        updateAttachment(localId, {
          progress: nextProgress,
          uploading: nextProgress < 100,
        });
      };

      xhr.onload = () => {
        activeUploadRequestsRef.current.delete(localId);
        const wasCancelled = cancelledUploadIdsRef.current.has(localId);
        cancelledUploadIdsRef.current.delete(localId);
        if (wasCancelled) {
          resolve();
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          let errorMessage = 'Upload failed';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = errorMessage;
          }

          if (xhr.status === 401 || xhr.status === 403) {
            errorMessage = token
              ? 'Session expired. Please sign in again.'
              : 'Please sign in to upload files.';
          }

          if (errorMessage === 'Upload failed') {
            errorMessage = xhr.status
              ? `Upload failed (HTTP ${xhr.status})`
              : 'Upload failed (Unknown error)';
          }

          updateAttachment(localId, { uploading: false, error: errorMessage });

          if (shouldPromptDriveReconnect(errorMessage)) {
            toast.error('Google Drive Disconnected', {
              description: 'Reconnect Drive access and try uploading again.',
              action: {
                label: 'Connect',
                onClick: async () => {
                  try {
                    await openDriveReconnectWindow();
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : 'Failed to get auth URL';
                    toast.error('Drive reconnect failed', { description: message });
                  }
                },
              },
              duration: 10000,
            });
          } else {
            toast.error('File upload failed', { description: errorMessage });
          }

          resolve();
          return;
        }

        let data: {
          id?: string;
          webViewLink?: string;
          webContentLink?: string;
          size?: number | string;
          thumbnailLink?: string;
          extractedContent?: string;
        } | null = null;

        try {
          data = JSON.parse(xhr.responseText) as {
            id?: string;
            webViewLink?: string;
            webContentLink?: string;
            size?: number | string;
            thumbnailLink?: string;
            extractedContent?: string;
          };
        } catch {
          data = null;
        }

        const resolvedUrl = resolveUploadedDriveUrl(data);
        if (!resolvedUrl) {
          const errorMessage = 'Upload failed: file link missing. Please retry.';
          updateAttachment(localId, { uploading: false, error: errorMessage });
          toast.error('File upload failed', { description: errorMessage });
          resolve();
          return;
        }

        updateAttachment(localId, {
          driveId: data?.id,
          url: resolvedUrl,
          webViewLink: data?.webViewLink,
          webContentLink: data?.webContentLink,
          thumbnailUrl: data?.thumbnailLink,
          uploading: false,
          progress: 100,
        });
        resolve();
      };

      xhr.onerror = () => {
        activeUploadRequestsRef.current.delete(localId);
        const wasCancelled = cancelledUploadIdsRef.current.has(localId);
        cancelledUploadIdsRef.current.delete(localId);
        if (wasCancelled) {
          resolve();
          return;
        }

        const errorMessage = 'Network error. Please check your connection.';
        updateAttachment(localId, { uploading: false, error: errorMessage });
        toast.error('File upload failed', { description: errorMessage });
        resolve();
      };

      xhr.onabort = () => {
        activeUploadRequestsRef.current.delete(localId);
        cancelledUploadIdsRef.current.delete(localId);
        resolve();
      };

      xhr.send(formData);
    });

  const processFiles = async (selected: File[]) => {
    if (selected.length === 0) return;

    if (!API_URL) {
      const newFiles = selected.map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        size: file.size,
        localPreviewUrl:
          getAttachmentPreviewKind(file.name) !== 'none' ? URL.createObjectURL(file) : undefined,
        progress: 100,
      }));
      onChange((previous) => [...previous, ...newFiles]);
      return;
    }

    const pending = selected.map((file) => ({
      id: Math.random().toString(36).slice(2, 11),
      name: file.name,
      size: file.size,
      localPreviewUrl:
        getAttachmentPreviewKind(file.name) !== 'none' ? URL.createObjectURL(file) : undefined,
      uploading: true,
      progress: 0,
    }));
    onChange((previous) => [...previous, ...pending]);
    setIsAttachmentQueueExpanded(true);

    await Promise.all(
      selected.map(async (file, index) => {
        const localId = pending[index].id;
        await uploadFileWithProgress(file, localId);
      })
    );
  };

  const attachmentQueueSummary = useMemo(() => {
    const total = attachments.length;
    const uploading = attachments.filter((attachment) => attachment.uploading).length;
    const failed = attachments.filter((attachment) => attachment.error).length;
    const ready = attachments.filter((attachment) => !attachment.uploading && !attachment.error).length;
    const completedProgress = attachments.reduce((sum, attachment) => {
      if (attachment.error) return sum;
      if (attachment.uploading) {
        const progressValue = Number(attachment.progress ?? 0);
        const normalizedProgress = Math.max(0, Math.min(100, progressValue));
        return sum + normalizedProgress;
      }
      return sum + 100;
    }, 0);
    const overallProgress = total > 0 ? Math.round(completedProgress / total) : 0;

    return { total, uploading, failed, ready, overallProgress };
  }, [attachments]);

  const isAttachmentQueueComplete =
    attachmentQueueSummary.total > 0 &&
    attachmentQueueSummary.uploading === 0 &&
    attachmentQueueSummary.failed === 0 &&
    attachmentQueueSummary.ready === attachmentQueueSummary.total;
  const hasAttachmentQueueIssues = attachmentQueueSummary.failed > 0;
  const attachmentQueueStatusText = isAttachmentQueueComplete
    ? `${attachmentQueueSummary.ready} completed, ready to submit`
    : `${attachmentQueueSummary.uploading} uploading, ${attachmentQueueSummary.ready} ready, ${attachmentQueueSummary.failed} issues`;
  const attachmentQueuePrimaryLabel =
    attachmentQueueSummary.uploading > 0
      ? `Uploading ${attachmentQueueSummary.total} item${attachmentQueueSummary.total === 1 ? '' : 's'} (${attachmentQueueSummary.overallProgress}%)`
      : hasAttachmentQueueIssues
        ? `${attachmentQueueSummary.ready} completed, ${attachmentQueueSummary.failed} issue${attachmentQueueSummary.failed === 1 ? '' : 's'}`
        : `${attachmentQueueSummary.ready} item${attachmentQueueSummary.ready === 1 ? '' : 's'} completed`;
  const attachmentQueueFooterText =
    attachmentQueueSummary.uploading > 0
      ? `Upload in progress: ${attachmentQueueSummary.overallProgress}%`
      : hasAttachmentQueueIssues
        ? `${attachmentQueueSummary.failed} item${attachmentQueueSummary.failed === 1 ? '' : 's'} need attention before submit.`
        : `${attachmentQueueSummary.ready} completed, ready to submit`;
  const isAttachmentQueueUploading = attachmentQueueSummary.uploading > 0;
  const shouldCompactAttachmentQueue = attachments.length > 6;
  const attachmentQueueMaxHeightClass = shouldCompactAttachmentQueue
    ? isAttachmentQueueExpanded
      ? 'max-h-[30rem]'
      : 'max-h-[16rem]'
    : '';

  const queueGlassCardClass =
    'relative overflow-hidden rounded-[22px] border border-[#CBD9FF]/60 bg-gradient-to-br from-white/92 via-[#F8FBFF]/84 to-[#E8F1FF]/86 supports-[backdrop-filter]:from-white/72 supports-[backdrop-filter]:via-[#F8FBFF]/62 supports-[backdrop-filter]:to-[#E8F1FF]/64 backdrop-blur-2xl shadow-none ring-1 ring-white/60 dark:border-border dark:bg-card/78 dark:bg-none dark:ring-0';
  const queuePanelRowClass =
    'rounded-xl border border-[#CFE0FF] bg-white/95 px-3 py-2.5 shadow-none dark:border-border dark:bg-slate-900/70';
  const queueIconButtonClass =
    'shrink-0 rounded-full border border-[#D8E4FF] bg-white/60 p-1.5 text-[#6D7FA8] shadow-none transition-colors hover:border-[#C4D6FF] hover:bg-[#F1F6FF] hover:text-[#223467] dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:border-border dark:hover:bg-muted/80 dark:hover:text-foreground';
  const queueCollapseButtonClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-[#D9E6FF] hover:bg-white dark:hover:border-border dark:hover:bg-muted';

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    await processFiles(Array.from(fileList));
  };

  const removeAttachment = (id: string) => {
    cancelTrackedUpload(id);
    if (previewFile?.id === id) {
      setPreviewFile(null);
    }
    onChange((previous) => {
      const removedAttachment = previous.find((attachment) => attachment.id === id);
      revokeLocalPreviewUrl(removedAttachment?.localPreviewUrl);
      return previous.filter((attachment) => attachment.id !== id);
    });
  };

  const handleCancelActiveUploads = () => {
    const activeUploads = attachments.filter((attachment) => attachment.uploading);
    if (activeUploads.length === 0) return;

    activeUploads.forEach((attachment) => cancelTrackedUpload(attachment.id));
    onChange((previous) => {
      previous
        .filter((attachment) => attachment.uploading)
        .forEach((attachment) => revokeLocalPreviewUrl(attachment.localPreviewUrl));
      return previous.filter((attachment) => !attachment.uploading);
    });
    if (previewFile?.uploading) {
      setPreviewFile(null);
    }
    toast.message(
      activeUploads.length === 1 ? 'Upload cancelled.' : `${activeUploads.length} uploads cancelled.`
    );
  };

  const handleClearAttachmentQueue = () => {
    activeUploadRequestsRef.current.forEach((xhr, id) => {
      cancelledUploadIdsRef.current.add(id);
      xhr.abort();
    });
    activeUploadRequestsRef.current.clear();
    cancelledUploadIdsRef.current.clear();
    attachments.forEach((attachment) => revokeLocalPreviewUrl(attachment.localPreviewUrl));
    setPreviewFile(null);
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      <Input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        className={cn(
          'rounded-[22px] border border-dashed px-4 py-3.5 transition-all duration-200 supports-[backdrop-filter]:backdrop-blur-md',
          isDragging
            ? 'border-primary/55 bg-[linear-gradient(135deg,rgba(239,244,255,0.95),rgba(229,238,255,0.88))] dark:border-sidebar-ring/35 dark:bg-sidebar-primary/16'
            : 'border-[#D9E6FF]/78 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(244,248,255,0.82),rgba(236,243,255,0.76))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(244,248,255,0.62),rgba(236,243,255,0.56))] dark:border-border/60 dark:bg-card/78 dark:[background-image:none]'
        )}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] border border-[#D7E3FF]/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(235,242,255,0.82))] text-[#4362B6] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(235,242,255,0.56))] dark:border-border/60 dark:bg-card/95 dark:[background-image:none] dark:text-foreground/70">
              {uploadAnimation ? (
                <Lottie animationData={uploadAnimation} loop className="h-20 w-20" />
              ) : (
                <Paperclip className="h-8 w-8 text-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-foreground">{uploadTitle}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{uploadDescription}</p>
              {emptyLabel ? (
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{emptyLabel}</p>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
            className="h-10 shrink-0 rounded-[14px] border-[#D7E3FF]/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(242,246,255,0.92))] px-4 text-[13px] font-semibold text-[#223067] shadow-[0_12px_24px_-20px_rgba(59,99,204,0.24)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(242,246,255,0.68))] backdrop-blur-md transition-all duration-200 hover:border-[#C7D8FF] hover:bg-[#EEF4FF]/92 hover:text-[#1E2A5A] hover:shadow-[0_16px_32px_-22px_rgba(59,99,204,0.28)] dark:border-border/70 dark:bg-card/95 dark:[background-image:none] dark:text-foreground dark:shadow-none dark:hover:border-border dark:hover:bg-muted dark:hover:text-foreground"
          >
            <Upload className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </div>
      </div>

      {attachments.length > 0 ? (
        <div className={queueGlassCardClass}>
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/70 dark:bg-white/5" />
          <div className="pointer-events-none absolute -left-8 top-1 h-24 w-24 rounded-full bg-white/55 blur-3xl dark:hidden" />
          <div className="pointer-events-none absolute -right-6 bottom-[-24px] h-28 w-28 rounded-full bg-[#DDE9FF]/80 blur-3xl dark:hidden" />

          <div className="relative px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{attachmentQueuePrimaryLabel}</p>
                <p
                  className={cn(
                    'mt-1 text-xs',
                    hasAttachmentQueueIssues
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-muted-foreground'
                  )}
                >
                  {attachmentQueueStatusText}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {isAttachmentQueueUploading ? (
                  <button
                    type="button"
                    onClick={handleCancelActiveUploads}
                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-primary/80 hover:text-primary dark:text-slate-300 dark:hover:text-slate-100"
                  >
                    Cancel
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsAttachmentQueueExpanded((previous) => !previous)}
                  className={queueCollapseButtonClass}
                  aria-label={
                    isAttachmentQueueExpanded
                      ? 'Hide attachment uploads'
                      : 'Show attachment uploads'
                  }
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isAttachmentQueueExpanded ? 'rotate-180' : ''
                    )}
                  />
                </button>

                {attachmentQueueSummary.uploading === 0 ? (
                  <button
                    type="button"
                    onClick={handleClearAttachmentQueue}
                    className={queueCollapseButtonClass}
                    aria-label="Clear attachment uploads"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {isAttachmentQueueUploading ? (
              <div className="mt-3 rounded-2xl border border-white/50 bg-white/45 px-3.5 py-3 supports-[backdrop-filter]:bg-white/28 backdrop-blur-xl dark:border-border dark:bg-card/80">
                <div className="text-[11px] font-medium text-[#6D7FA8] dark:text-slate-400">
                  <span>Overall progress</span>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                  <Progress
                    value={attachmentQueueSummary.overallProgress}
                    className="h-1.5 rounded-full bg-[#E7EEFF] dark:bg-muted"
                  />
                  <span className="min-w-[3rem] text-right text-[11px] font-semibold tabular-nums text-foreground/90 dark:text-slate-100">
                    {attachmentQueueSummary.overallProgress}%
                  </span>
                </div>
              </div>
            ) : null}

            {isAttachmentQueueExpanded ? (
              <div className="mt-3 space-y-2 border-t border-[#E1E9FF] pt-3 dark:border-border">
                <div
                  className={cn(
                    'space-y-2',
                    attachmentQueueMaxHeightClass && attachmentQueueMaxHeightClass,
                    shouldCompactAttachmentQueue && 'overflow-y-auto pr-1'
                  )}
                >
                  {attachments.map((attachment) => {
                    const extension = getFileExtension(attachment.name);
                    const previewable = isAttachmentPreviewable(toPreviewFile(attachment));
                    const isUploading = Boolean(attachment.uploading);
                    const hasUploadError = Boolean(attachment.error);
                    const uploadProgress = Math.max(
                      0,
                      Math.min(100, Number(attachment.progress ?? 0))
                    );

                    return (
                      <div
                        key={attachment.id}
                        className={cn(
                          queuePanelRowClass,
                          previewable &&
                            'cursor-pointer transition-colors hover:border-[#C9D9FF] hover:bg-white dark:hover:border-border dark:hover:bg-muted/80'
                        )}
                        onClick={() => {
                          if (!previewable) return;
                          setPreviewFile(toPreviewFile(attachment));
                        }}
                        onKeyDown={(event) => {
                          if (!previewable) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setPreviewFile(toPreviewFile(attachment));
                          }
                        }}
                        role={previewable ? 'button' : undefined}
                        tabIndex={previewable ? 0 : -1}
                        aria-label={previewable ? `Preview ${attachment.name}` : undefined}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF3FF] text-[10px] font-semibold text-[#4B57A6] dark:border dark:border-border dark:bg-muted dark:text-foreground">
                              {extension}
                            </div>

                            <div className="min-w-0">
                              <span className="block truncate text-xs font-medium text-foreground">
                                {attachment.name}
                              </span>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                                <span
                                  className={
                                    hasUploadError ? 'text-destructive' : 'text-muted-foreground'
                                  }
                                >
                                  {isUploading
                                    ? 'Uploading'
                                    : hasUploadError
                                      ? 'Needs attention'
                                      : 'Completed'}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatFileSize(attachment.size)}
                                </span>
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
                                  <RotateCw className="h-4 w-4 animate-spin text-[#7D8FB8] dark:text-slate-300" />
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

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeAttachment(attachment.id);
                              }}
                              className={queueIconButtonClass}
                              aria-label={`Remove ${attachment.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {hasUploadError ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="text-xs text-destructive">{attachment.error}</p>
                            {shouldPromptDriveReconnect(attachment.error) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 border-destructive px-2 text-xs text-destructive hover:bg-destructive hover:text-white"
                                onClick={async (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
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

                <p className="text-xs text-muted-foreground">{attachmentQueueFooterText}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <AttachmentPreviewDialog
        file={previewFile}
        open={Boolean(previewFile)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewFile(null);
          }
        }}
        description="Previewing uploaded attachment"
      />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { API_URL, authFetch } from '@/lib/api';
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
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadRequestsRef = useRef(new Map<string, XMLHttpRequest>());

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
    return () => {
      activeUploadRequestsRef.current.forEach((xhr) => xhr.abort());
      activeUploadRequestsRef.current.clear();
    };
  }, []);

  const updateAttachment = (attachmentId: string, next: Partial<BuilderAttachment>) => {
    onChange((previous) =>
      previous.map((attachment) =>
        attachment.id === attachmentId ? { ...attachment, ...next } : attachment
      )
    );
  };

  const uploadSingleFile = async (file: File) => {
    const tempId = crypto.randomUUID();
    const draft: BuilderAttachment = {
      id: tempId,
      name: file.name,
      size: file.size,
      uploading: true,
      progress: 0,
    };
    onChange((previous) => [...previous, draft]);

    if (!API_URL) {
      updateAttachment(tempId, {
        uploading: false,
        progress: 100,
        url: URL.createObjectURL(file),
      });
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const payload = new FormData();
        payload.append('file', file);
        payload.append('taskTitle', taskTitle || 'Campaign Request');
        payload.append('taskSection', taskSection);

        const xhr = new XMLHttpRequest();
        activeUploadRequestsRef.current.set(tempId, xhr);

        xhr.open('POST', `${API_URL}/api/files/upload`);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const nextProgress = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
          updateAttachment(tempId, {
            progress: nextProgress,
            uploading: nextProgress < 100,
          });
        };

        xhr.onload = () => {
          activeUploadRequestsRef.current.delete(tempId);

          let data: any = null;
          try {
            data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            data = null;
          }

          if (xhr.status < 200 || xhr.status >= 300) {
            const errorMessage =
              data && typeof data.error === 'string' && data.error.trim()
                ? data.error.trim()
                : xhr.status === 401
                  ? 'Please sign in to upload files.'
                  : `Upload failed (HTTP ${xhr.status}).`;
            reject(new Error(errorMessage));
            return;
          }

          updateAttachment(tempId, {
            id: String(data?.id || tempId),
            uploading: false,
            progress: 100,
            url: String(data?.webViewLink || ''),
            driveId: String(data?.id || ''),
            webViewLink: String(data?.webViewLink || ''),
            webContentLink: String(data?.webContentLink || ''),
            thumbnailUrl: String(data?.thumbnailLink || ''),
          });
          resolve();
        };

        xhr.onerror = () => {
          activeUploadRequestsRef.current.delete(tempId);
          reject(new Error('Network error while uploading the file.'));
        };

        xhr.onabort = () => {
          activeUploadRequestsRef.current.delete(tempId);
          reject(new Error('Upload cancelled.'));
        };

        xhr.send(payload);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      if (message === 'Upload cancelled.') {
        onChange((previous) => previous.filter((item) => item.id !== tempId));
        return;
      }
      updateAttachment(tempId, {
        uploading: false,
        progress: 0,
        error: message,
      });
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const selectedFiles = Array.from(fileList);
    for (const file of selectedFiles) {
      await uploadSingleFile(file);
    }
  };

  const readyCount = attachments.filter((attachment) => !attachment.uploading && !attachment.error).length;
  const uploadingCount = attachments.filter((attachment) => attachment.uploading).length;
  const failedCount = attachments.filter((attachment) => attachment.error).length;
  const removeAttachment = (attachmentId: string) => {
    const xhr = activeUploadRequestsRef.current.get(attachmentId);
    if (xhr) {
      xhr.abort();
      activeUploadRequestsRef.current.delete(attachmentId);
    }
    onChange((previous) => previous.filter((item) => item.id !== attachmentId));
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
            ? 'border-primary/55 bg-[linear-gradient(135deg,rgba(239,244,255,0.95),rgba(229,238,255,0.88))] shadow-[0_18px_40px_-28px_rgba(59,99,204,0.28)] dark:border-sidebar-ring/35 dark:bg-sidebar-primary/16'
            : 'border-[#D9E6FF]/78 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(244,248,255,0.82),rgba(236,243,255,0.76))] shadow-[0_18px_38px_-30px_rgba(59,99,204,0.18)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(244,248,255,0.62),rgba(236,243,255,0.56))] dark:border-sidebar-border dark:bg-sidebar/96 dark:shadow-[0_18px_40px_-30px_rgba(2,8,23,0.75)]'
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
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] border border-[#D7E3FF]/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(235,242,255,0.82))] text-[#4362B6] shadow-[0_14px_26px_-22px_rgba(59,99,204,0.34)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(235,242,255,0.56))] dark:border-sidebar-border dark:bg-sidebar-primary/38 dark:text-sidebar-primary-foreground">
              {uploadAnimation ? (
                <Lottie animationData={uploadAnimation} loop className="h-20 w-20" />
              ) : (
                <Paperclip className="h-8 w-8 text-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-foreground">
                {uploadTitle}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {uploadDescription}
              </p>
              {emptyLabel ? (
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  {emptyLabel}
                </p>
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
            className="h-10 shrink-0 rounded-[14px] border-[#D7E3FF]/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(242,246,255,0.92))] px-4 text-[13px] font-semibold text-[#223067] shadow-[0_12px_24px_-20px_rgba(59,99,204,0.24)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(242,246,255,0.68))] backdrop-blur-md transition-all duration-200 hover:border-[#C7D8FF] hover:bg-[#EEF4FF]/92 hover:text-[#1E2A5A] hover:shadow-[0_16px_32px_-22px_rgba(59,99,204,0.28)] dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground dark:hover:border-sidebar-ring/35 dark:hover:bg-sidebar-primary/38 dark:hover:text-white"
          >
            <Upload className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </div>

        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-foreground dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground">
              {readyCount} ready
            </span>
            <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-foreground dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground">
              {uploadingCount} uploading
            </span>
            <span className="rounded-full border border-border/70 bg-white px-2.5 py-1 text-foreground dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground">
              {failedCount} issues
            </span>
          </div>
        ) : null}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const fileUrl = attachment.webViewLink || attachment.url || attachment.webContentLink || '';
            const uploadProgress = Math.max(0, Math.min(100, Number(attachment.progress ?? 0)));

            return (
              <div
                key={attachment.id}
                className="rounded-xl border border-border/70 bg-white px-4 py-3 dark:border-sidebar-border dark:bg-sidebar-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF3FF] text-primary dark:bg-sidebar/96">
                      {attachment.uploading ? (
                        <RotateCw className="h-4 w-4 animate-spin" />
                      ) : attachment.error ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium leading-5 text-foreground">
                          {attachment.name}
                        </p>
                        {attachment.uploading ? (
                          <Badge variant="secondary" className="gap-1">
                            <RotateCw className="h-3 w-3 animate-spin" />
                            Uploading
                          </Badge>
                        ) : attachment.error ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </Badge>
                        ) : (
                          <Badge variant="outline">Stored in Drive</Badge>
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-4 text-muted-foreground">
                        {[
                          formatFileSize(attachment.size),
                          attachment.uploading ? `${uploadProgress}% uploaded` : '',
                          attachment.error,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {fileUrl && !attachment.uploading && !attachment.error ? (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          'inline-flex h-8 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-medium text-muted-foreground transition-colors',
                          'hover:border-primary/40 hover:text-primary dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground dark:hover:border-sidebar-ring/40 dark:hover:bg-sidebar-primary/38 dark:hover:text-white'
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeAttachment(attachment.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {attachment.uploading ? (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted dark:bg-sidebar/88">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Paperclip, Trash2, Upload, AlertTriangle, Loader2 } from 'lucide-react';
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
};

const formatFileSize = (bytes?: number) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};

export function AttachmentUploadField({
  label,
  description,
  attachments,
  onChange,
  taskTitle,
  taskSection,
  emptyLabel = 'No files uploaded yet.',
}: AttachmentUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    };
    onChange((previous) => [...previous, draft]);

    if (!API_URL) {
      updateAttachment(tempId, {
        uploading: false,
        url: URL.createObjectURL(file),
      });
      return;
    }

    const payload = new FormData();
    payload.append('file', file);
    payload.append('taskTitle', taskTitle || 'Campaign Request');
    payload.append('taskSection', taskSection);

    try {
      const response = await authFetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        body: payload,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data && typeof data.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'Upload failed.'
        );
      }

      updateAttachment(tempId, {
        id: String(data?.id || tempId),
        uploading: false,
        url: String(data?.webViewLink || ''),
        driveId: String(data?.id || ''),
        webViewLink: String(data?.webViewLink || ''),
        webContentLink: String(data?.webContentLink || ''),
        thumbnailUrl: String(data?.thumbnailLink || ''),
      });
    } catch (error) {
      updateAttachment(tempId, {
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed.',
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

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="rounded-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
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
          'rounded-2xl border border-dashed px-4 py-5 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-[#CFE0FF] bg-[#F8FBFF] dark:border-border dark:bg-card/60'
        )}
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
        {attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-muted">
              <Paperclip className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">Drop files here or upload from device</p>
            <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/90 px-3 py-2.5 shadow-sm dark:border-border dark:bg-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                    {attachment.uploading ? (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading
                      </Badge>
                    ) : attachment.error ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Ready</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[formatFileSize(attachment.size), attachment.error].filter(Boolean).join(' • ')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() =>
                    onChange((previous) => previous.filter((item) => item.id !== attachment.id))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

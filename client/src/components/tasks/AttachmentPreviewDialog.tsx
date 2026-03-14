import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Minus, Move, Plus, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { API_URL, authFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export type AttachmentPreviewFile = {
  id?: string;
  name: string;
  localPreviewUrl?: string;
  driveId?: string;
  url?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailUrl?: string;
  uploading?: boolean;
  error?: string;
};

type Props = {
  file: AttachmentPreviewFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: string;
};

const imageMimeByExt: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const getWindowOrigin = () =>
  typeof window !== 'undefined' ? String(window.location.origin || '').trim() : '';

const getDriveFileId = (rawValue?: string) => {
  const source = String(rawValue || '').trim();
  if (!source) return '';
  try {
    const parsed = new URL(source, getWindowOrigin() || 'http://localhost');
    const idFromQuery = parsed.searchParams.get('id');
    if (idFromQuery) return idFromQuery;

    const decodedPath = decodeURIComponent(parsed.pathname || '');
    const pathPatterns = [
      /\/file(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
      /\/document(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
      /\/spreadsheets(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
      /\/presentation(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
      /\/forms(?:\/u\/\d+)?\/d\/([^/?#]+)/i,
      /\/d\/([^/?#]+)/i,
      /\/api\/files\/download\/([^/?#]+)/i,
    ];
    for (const pattern of pathPatterns) {
      const match = decodedPath.match(pattern);
      if (match?.[1]) return match[1];
    }
  } catch {
    // Fall back to regex-only extraction below.
  }

  const rawPatterns = [
    /[?&]id=([A-Za-z0-9_-]{10,})/i,
    /\/file(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/document(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/spreadsheets(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/presentation(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/forms(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/api\/files\/download\/([A-Za-z0-9_-]{10,})/i,
  ];
  for (const pattern of rawPatterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
};

const buildDrivePreviewUrl = (driveId?: string) => {
  const normalizedId = String(driveId || '').trim();
  if (!normalizedId) return '';
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(normalizedId)}`;
};

export const getAttachmentPreviewKind = (fileName: string): 'image' | 'pdf' | 'none' => {
  const ext = String(fileName || '').split('.').pop()?.trim().toLowerCase();
  if (!ext) return 'none';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'none';
};

const inferPreviewMimeType = (fileName: string) => {
  const ext = String(fileName || '').split('.').pop()?.trim().toLowerCase();
  if (!ext) return '';
  if (ext === 'pdf') return 'application/pdf';
  return imageMimeByExt[ext] || '';
};

const getAttachmentPreviewCandidates = (
  file?: AttachmentPreviewFile | null,
  apiBaseUrl?: string
) => {
  if (!file || getAttachmentPreviewKind(file.name) === 'none' || file.uploading || file.error) {
    return [] as string[];
  }

  const normalizedApiBase = String(apiBaseUrl || API_URL || getWindowOrigin()).replace(/\/$/, '');
  const localPreviewUrl = String(file.localPreviewUrl || '').trim();
  const driveId =
    String(file.driveId || '').trim() ||
    getDriveFileId(file.webContentLink) ||
    getDriveFileId(file.url) ||
    getDriveFileId(file.webViewLink);
  const apiDownloadUrl =
    driveId && normalizedApiBase
      ? `${normalizedApiBase}/api/files/download/${encodeURIComponent(driveId)}`
      : '';
  const webContentLink = String(file.webContentLink || '').trim();
  const url = String(file.url || '').trim();
  const thumbnailUrl = String(file.thumbnailUrl || '').trim();
  const drivePreviewUrl =
    driveId
      ? buildDrivePreviewUrl(driveId) ||
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`
      : '';

  return Array.from(
    new Set(
      [localPreviewUrl, apiDownloadUrl, webContentLink, url, drivePreviewUrl, thumbnailUrl]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
};

export const isAttachmentPreviewable = (
  file?: AttachmentPreviewFile | null,
  apiBaseUrl?: string
) => getAttachmentPreviewCandidates(file, apiBaseUrl).length > 0;

export function AttachmentPreviewDialog({
  file,
  open,
  onOpenChange,
  description = 'Previewing uploaded attachment',
}: Props) {
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const previewKind = useMemo(
    () => (file ? getAttachmentPreviewKind(file.name) : 'none'),
    [file?.name]
  );

  const resetTransform = () => {
    dragRef.current = null;
    setIsDragging(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const clampPan = (nextPan: { x: number; y: number }, nextZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport || nextZoom <= 1) return { x: 0, y: 0 };
    const limitX = Math.max(0, ((nextZoom - 1) * viewport.clientWidth) / 2);
    const limitY = Math.max(0, ((nextZoom - 1) * viewport.clientHeight) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, nextPan.x)),
      y: Math.max(-limitY, Math.min(limitY, nextPan.y)),
    };
  };

  const updateZoom = (nextZoom: number) => {
    const normalizedZoom = Math.max(1, Math.min(5, Number(nextZoom.toFixed(2))));
    setZoom(normalizedZoom);
    setPan((currentPan) =>
      normalizedZoom <= 1 ? { x: 0, y: 0 } : clampPan(currentPan, normalizedZoom)
    );
    if (normalizedZoom <= 1) {
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!resolvedUrl || previewKind !== 'image') return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.2 : -0.2;
    updateZoom(zoom + delta);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewKind !== 'image' || zoom <= 1) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextPan = {
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    };
    setPan(clampPan(nextPan, zoom));
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    resetTransform();
  }, [file?.id, resolvedUrl]);

  useEffect(() => {
    const revokePreviewObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    const activeFile = file;
    const candidates = getAttachmentPreviewCandidates(activeFile);
    if (!open || !activeFile || candidates.length === 0) {
      revokePreviewObjectUrl();
      setResolvedUrl('');
      setPreviewState(activeFile && open ? 'error' : 'idle');
      return;
    }

    let cancelled = false;
    setPreviewState('loading');
    setResolvedUrl('');

    const expectedMime = inferPreviewMimeType(activeFile.name);

    const loadImageElement = (src: string, timeoutMs = 8000) =>
      new Promise<string>((resolve, reject) => {
        let settled = false;
        const image = new window.Image();

        const cleanup = () => {
          image.onload = null;
          image.onerror = null;
          window.clearTimeout(timeoutId);
        };

        const settle = (callback: () => void) => {
          if (settled) return;
          settled = true;
          cleanup();
          callback();
        };

        const timeoutId = window.setTimeout(() => {
          settle(() => reject(new Error(`Image load timed out for ${src}`)));
        }, timeoutMs);

        image.onload = () => settle(() => resolve(src));
        image.onerror = () => settle(() => reject(new Error(`Image load failed for ${src}`)));
        image.src = src;
      });

    const shouldAttemptAuthenticatedFetch = (src: string) => {
      if (!src) return false;
      try {
        const parsed = new URL(src, getWindowOrigin() || 'http://localhost');
        const isSameOrigin = parsed.origin === getWindowOrigin();
        const isApiDownloadPath = parsed.pathname.includes('/api/files/download/');
        return isSameOrigin || isApiDownloadPath;
      } catch {
        return src.startsWith('/') || src.includes('/api/files/download/');
      }
    };

    const resolvePreview = async () => {
      revokePreviewObjectUrl();
      for (const candidate of candidates) {
        if (shouldAttemptAuthenticatedFetch(candidate)) {
          try {
            const response = await authFetch(candidate);
            if (response.ok) {
              const contentType = String(response.headers.get('content-type') || '').toLowerCase();
              if (
                contentType.includes('text/html') ||
                contentType.includes('application/json')
              ) {
                continue;
              }
              const rawBlob = await response.blob();
              if (rawBlob && rawBlob.size > 0) {
                const blob =
                  expectedMime && (!rawBlob.type || rawBlob.type === 'application/octet-stream')
                    ? new Blob([rawBlob], { type: expectedMime })
                    : rawBlob;
                const objectUrl = URL.createObjectURL(blob);
                objectUrlRef.current = objectUrl;
                if (previewKind === 'image') {
                  await loadImageElement(objectUrl);
                }
                if (cancelled) return;
                setResolvedUrl(objectUrl);
                setPreviewState('ready');
                return;
              }
            }
          } catch {
            // Fall through to direct candidate loading.
          }
        }

        if (previewKind === 'image') {
          try {
            await loadImageElement(candidate);
            if (cancelled) return;
            setResolvedUrl(candidate);
            setPreviewState('ready');
            return;
          } catch {
            // Try the next candidate.
          }
        }

        if (previewKind === 'pdf') {
          if (cancelled) return;
          setResolvedUrl(candidate);
          setPreviewState('ready');
          return;
        }
      }

      if (cancelled) return;
      revokePreviewObjectUrl();
      setResolvedUrl('');
      setPreviewState('error');
    };

    void resolvePreview();

    return () => {
      cancelled = true;
      revokePreviewObjectUrl();
    };
  }, [file, open, previewKind]);

  const controlButtonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-white/85 text-[#4A5EA1] transition hover:bg-[#EEF4FF] hover:text-[#223467] dark:border-border dark:bg-card/90 dark:text-slate-200 dark:hover:bg-muted';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetTransform();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="w-[92vw] max-w-[78rem] overflow-hidden border-[#D9E6FF] bg-white/95 p-0 shadow-none dark:border-border dark:bg-card">
        <div className="border-b border-[#E7EEFF] px-5 py-4 dark:border-border">
          <DialogHeader>
            <DialogTitle className="truncate text-left text-base font-semibold text-foreground">
              {file?.name || 'Attachment preview'}
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="h-[76vh] overflow-hidden bg-[#F8FBFF] p-4 sm:p-5 dark:bg-slate-950/40">
          {previewState === 'loading' ? (
            <div className="flex min-h-full items-center justify-center rounded-[1.5rem] border border-[#D9E6FF] bg-white/85 px-4 py-10 text-center text-sm text-muted-foreground dark:border-border dark:bg-card/80">
              Loading preview...
            </div>
          ) : resolvedUrl ? (
            <div className="relative flex h-full min-h-0 flex-col rounded-[1.5rem] border border-[#D9E6FF] bg-white/80 p-3 dark:border-border dark:bg-card/80">
              {previewKind === 'image' ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[#E1E9FF] bg-white/80 px-3 py-2 dark:border-border dark:bg-card/85">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Move className="h-3.5 w-3.5" />
                      <span>Scroll to zoom. Drag to pan.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateZoom(zoom - 0.2)}
                        className={controlButtonClass}
                        aria-label="Zoom out"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="min-w-[4.5rem] rounded-full border border-[#E1E9FF] bg-[#F8FBFF] px-3 py-1 text-center text-[11px] font-semibold tabular-nums text-[#223467] dark:border-border dark:bg-muted dark:text-foreground">
                        {Math.round(zoom * 100)}%
                      </div>
                      <button
                        type="button"
                        onClick={() => updateZoom(zoom + 0.2)}
                        className={controlButtonClass}
                        aria-label="Zoom in"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={resetTransform}
                        className={controlButtonClass}
                        aria-label="Reset zoom"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={viewportRef}
                    className={cn(
                      'relative min-h-0 flex-1 overflow-hidden rounded-[1.2rem] border border-[#E1E9FF] bg-white dark:border-border dark:bg-slate-950',
                      zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
                    )}
                    onWheel={handleWheel}
                    onDoubleClick={() => updateZoom(zoom > 1 ? 1 : 2)}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                  >
                    <div
                      className="flex h-full w-full touch-none select-none items-center justify-center p-6"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 160ms ease-out',
                      }}
                    >
                      <div className="flex max-h-full max-w-full items-center justify-center rounded-[22px] border border-[#E5EAF7] bg-white p-4 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-950">
                        <img
                          src={resolvedUrl}
                          alt={file?.name || 'Attachment preview'}
                          className="block max-h-[calc(76vh-12rem)] max-w-[calc(92vw-12rem)] select-none rounded-xl border border-[#D9E6FF] bg-white object-contain shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-950"
                          draggable={false}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden rounded-[1.2rem] border border-[#E1E9FF] bg-white dark:border-border dark:bg-card">
                  <iframe
                    src={resolvedUrl}
                    title={file?.name || 'PDF preview'}
                    className="h-full w-full border-0"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center rounded-[1.5rem] border border-dashed border-[#D9E6FF] bg-white/85 px-4 py-10 text-center text-sm text-muted-foreground dark:border-border dark:bg-card/80">
              {previewState === 'error'
                ? 'Unable to load preview for this file.'
                : 'Preview is not available for this file.'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

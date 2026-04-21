import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { toast } from 'sonner';
import { authFetch, openDriveReconnectWindow } from '@/lib/api';

export const shouldPromptDriveReconnect = (errorMessage?: string) => {
  const normalized = String(errorMessage || '').toLowerCase();
  return (
    normalized.includes('drive oauth not connected') ||
    normalized.includes('must be set for oauth') ||
    normalized.includes('missing oauth code') ||
    normalized.includes('google drive authentication failed') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('token has been expired or revoked')
  );
};

export type DriveFolderPreviewItem = {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  modifiedTime?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  webContentLink?: string;
  isFolder?: boolean;
};

export type DriveFolderPreviewPayload = {
  id: string;
  itemCount: number;
  truncated?: boolean;
  items: DriveFolderPreviewItem[];
};

const driveFolderPreviewCache = new Map<string, DriveFolderPreviewPayload>();
const driveFolderPreviewPendingCache = new Map<string, Promise<DriveFolderPreviewPayload>>();
const driveFolderPreviewImageCache = new Map<string, 'ready' | 'error'>();
const driveFolderPreviewImagePendingCache = new Map<string, Promise<void>>();

export const buildDriveFolderLink = (folderId?: string) => {
  const normalizedId = String(folderId || '').trim();
  if (!normalizedId) return '';
  return `https://drive.google.com/drive/folders/${encodeURIComponent(normalizedId)}`;
};

export const buildDriveThumbnailUrl = (fileId?: string, size = 'w320-h320') => {
  const normalizedId = String(fileId || '').trim();
  if (!normalizedId) return '';
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(normalizedId)}&sz=${size}`;
};

export const normalizeGoogleDriveUrl = (value?: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(?:www\.)?(?:drive|docs)\.google\.com\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
};

export const extractDriveFolderId = (url: string) => {
  const match = String(url || '').match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
};

const isImageMimeType = (mimeType?: string) =>
  String(mimeType || '').trim().toLowerCase().startsWith('image/');

export const formatFolderPreviewFileSize = (bytes?: number) => {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '';
  const normalized = Number(bytes);
  if (normalized < 1024) return `${normalized} B`;
  if (normalized < 1024 * 1024) return `${Math.max(1, Math.round(normalized / 1024))} KB`;
  return `${(normalized / (1024 * 1024)).toFixed(1)} MB`;
};

export const getDriveFolderPreviewItemUrl = (item: DriveFolderPreviewItem) =>
  String(item.thumbnailUrl || '').trim() ||
  (item.isFolder || !isImageMimeType(item.mimeType) ? '' : buildDriveThumbnailUrl(item.id));

export const preloadDriveFolderPreviewImage = (value?: string) => {
  const url = String(value || '').trim();
  if (!url) return Promise.resolve();

  const cachedStatus = driveFolderPreviewImageCache.get(url);
  if (cachedStatus === 'ready') return Promise.resolve();
  if (cachedStatus === 'error') {
    return Promise.reject(new Error('Preview image unavailable.'));
  }

  const pending = driveFolderPreviewImagePendingCache.get(url);
  if (pending) return pending;

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  const request = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      driveFolderPreviewImageCache.set(url, 'ready');
      resolve();
    };
    image.onerror = () => {
      driveFolderPreviewImageCache.set(url, 'error');
      reject(new Error('Preview image unavailable.'));
    };
    image.src = url;
  }).finally(() => {
    driveFolderPreviewImagePendingCache.delete(url);
  });

  driveFolderPreviewImagePendingCache.set(url, request);
  return request;
};

function DriveFolderPreviewVisual({
  item,
  previewUrl,
  metaLabel,
}: {
  item: DriveFolderPreviewItem;
  previewUrl: string;
  metaLabel: string;
}) {
  const normalizedPreviewUrl = String(previewUrl || '').trim();
  const [loadState, setLoadState] = useState<'fallback' | 'loading' | 'ready' | 'error'>(() => {
    if (!normalizedPreviewUrl) return 'fallback';
    const cachedStatus = driveFolderPreviewImageCache.get(normalizedPreviewUrl);
    if (cachedStatus === 'ready') return 'ready';
    if (cachedStatus === 'error') return 'error';
    return 'loading';
  });

  useEffect(() => {
    if (!normalizedPreviewUrl) {
      setLoadState('fallback');
      return;
    }

    const cachedStatus = driveFolderPreviewImageCache.get(normalizedPreviewUrl);
    if (cachedStatus === 'ready') {
      setLoadState('ready');
      return;
    }
    if (cachedStatus === 'error') {
      setLoadState('error');
      return;
    }

    let cancelled = false;
    setLoadState('loading');
    preloadDriveFolderPreviewImage(normalizedPreviewUrl)
      .then(() => {
        if (!cancelled) {
          setLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedPreviewUrl]);

  const showPreview = Boolean(normalizedPreviewUrl) && loadState === 'ready';
  const showFallback = !showPreview;

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-[#D9E6FF] bg-[radial-gradient(circle_at_top_left,_rgba(191,214,255,0.55),_transparent_58%),linear-gradient(160deg,_rgba(245,248,255,0.96),_rgba(225,235,255,0.82))] dark:border-border dark:bg-[linear-gradient(160deg,_rgba(30,41,59,0.95),_rgba(51,65,85,0.82))]">
      {showFallback ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1 text-center">
            {item.isFolder ? (
              <img
                src="/icons/drive-folder.svg"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 object-contain"
              />
            ) : (
              <img
                src="/google-drive.ico"
                alt=""
                aria-hidden="true"
                className="h-7 w-7 object-contain opacity-85"
              />
            )}
            <span className="px-2 text-[10px] font-medium text-[#536482] dark:text-slate-200">
              {metaLabel}
            </span>
            {loadState === 'loading' && normalizedPreviewUrl ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#4C63B7] dark:text-slate-200" />
            ) : null}
          </div>
        </div>
      ) : null}
      {showPreview ? (
        <img
          src={normalizedPreviewUrl}
          alt={item.name}
          className="relative z-10 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          loading="eager"
          fetchPriority="high"
          referrerPolicy="no-referrer"
          onError={() => {
            driveFolderPreviewImageCache.set(normalizedPreviewUrl, 'error');
            setLoadState('error');
          }}
        />
      ) : null}
    </div>
  );
}

export const fetchDriveFolderPreview = async (folderId: string, apiUrl?: string) => {
  const normalizedFolderId = String(folderId || '').trim();
  if (!normalizedFolderId) {
    throw new Error('Folder link is missing.');
  }

  const cached = driveFolderPreviewCache.get(normalizedFolderId);
  if (cached) return cached;

  if (!apiUrl) {
    throw new Error('Backend is required for folder preview.');
  }

  const pending = driveFolderPreviewPendingCache.get(normalizedFolderId);
  if (pending) return pending;

  const request = authFetch(`${apiUrl}/api/files/folder-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId: normalizedFolderId }),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load folder preview.');
      }
      const payload = data as DriveFolderPreviewPayload;
      driveFolderPreviewCache.set(normalizedFolderId, payload);
      payload.items.slice(0, 12).forEach((item) => {
        const previewUrl = getDriveFolderPreviewItemUrl(item);
        if (previewUrl) {
          void preloadDriveFolderPreviewImage(previewUrl);
        }
      });
      return payload;
    })
    .finally(() => {
      driveFolderPreviewPendingCache.delete(normalizedFolderId);
    });

  driveFolderPreviewPendingCache.set(normalizedFolderId, request);
  return request;
};

export const prefetchDriveFolderPreview = (folderId: string, apiUrl?: string) => {
  void fetchDriveFolderPreview(folderId, apiUrl).catch(() => {});
};

export function DriveFolderHoverPreview({
  folderId,
  apiUrl,
  depth = 0,
}: {
  folderId: string;
  apiUrl?: string;
  depth?: number;
}) {
  const normalizedFolderId = String(folderId || '').trim();
  const isNestedPreview = depth > 0;
  const previewGridClass = isNestedPreview ? 'grid-cols-2' : 'grid-cols-3';
  const skeletonCount = isNestedPreview ? 4 : 6;
  const [previewState, setPreviewState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: DriveFolderPreviewPayload | null;
    error: string;
  }>(() => {
    const cached = normalizedFolderId ? driveFolderPreviewCache.get(normalizedFolderId) : null;
    return cached
      ? { status: 'ready', data: cached, error: '' }
      : { status: 'idle', data: null, error: '' };
  });

  useEffect(() => {
    if (!normalizedFolderId) {
      setPreviewState({ status: 'error', data: null, error: 'Folder link is missing.' });
      return;
    }

    const cached = driveFolderPreviewCache.get(normalizedFolderId);
    if (cached) {
      setPreviewState({ status: 'ready', data: cached, error: '' });
      return;
    }

    if (!apiUrl) {
      setPreviewState({ status: 'error', data: null, error: 'Backend is required for folder preview.' });
      return;
    }

    let cancelled = false;
    setPreviewState({ status: 'loading', data: null, error: '' });

    fetchDriveFolderPreview(normalizedFolderId, apiUrl)
      .then((data) => {
        if (cancelled) return;
        setPreviewState({ status: 'ready', data, error: '' });
      })
      .catch((error) => {
        if (cancelled) return;
        setPreviewState({
          status: 'error',
          data: null,
          error: String(error?.message || 'Failed to load folder preview.'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, normalizedFolderId]);

  useEffect(() => {
    if (!apiUrl || depth > 0 || previewState.status !== 'ready') return;
    const folderItems = (previewState.data?.items || [])
      .filter((item) => item.isFolder && item.id && item.id !== normalizedFolderId)
      .slice(0, 6);
    folderItems.forEach((item) => prefetchDriveFolderPreview(item.id, apiUrl));
  }, [apiUrl, depth, normalizedFolderId, previewState.data, previewState.status]);

  useEffect(() => {
    if (previewState.status !== 'ready') return;
    (previewState.data?.items || []).slice(0, 12).forEach((item) => {
      const previewUrl = getDriveFolderPreviewItemUrl(item);
      if (previewUrl) {
        void preloadDriveFolderPreviewImage(previewUrl);
      }
    });
  }, [previewState.data, previewState.status]);

  if (previewState.status === 'loading' || previewState.status === 'idle') {
    return (
      <div className="rounded-xl border border-[#D9E6FF] bg-white/70 p-3 dark:border-border dark:bg-muted/20">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Folder Items
            </p>
            <p className="text-xs text-muted-foreground">Loading preview...</p>
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-[#3D5A9E] dark:text-slate-200" />
        </div>
        <div className={cn('grid gap-2', previewGridClass)}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <div key={`folder-preview-skeleton-${index}`} className="space-y-2">
              <div className="aspect-square rounded-lg bg-[#EEF4FF] dark:bg-white/10" />
              <div className="h-3 rounded bg-[#EEF4FF] dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (previewState.status === 'error') {
    const folderHref = buildDriveFolderLink(normalizedFolderId);
    const shouldReconnect = shouldPromptDriveReconnect(previewState.error);
    return (
      <div className="rounded-xl border border-[#F0D4D4] bg-[#FFF7F7] p-4 dark:border-red-500/35 dark:bg-red-950/15">
        <p className="text-sm font-medium text-[#8E3A3A] dark:text-red-200">
          {previewState.error}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {shouldReconnect ? (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await openDriveReconnectWindow();
                } catch (error) {
                  const message =
                    error instanceof Error && error.message
                      ? error.message
                      : 'Failed to get Drive reconnect URL.';
                  toast.error('Drive reconnect failed', { description: message });
                }
              }}
              className="h-8 rounded-lg border-[#E2B4B4] bg-white px-3 text-xs font-semibold text-[#8E3A3A] hover:bg-[#FFF1F1] dark:border-red-400/40 dark:bg-red-950/20 dark:text-red-100 dark:hover:bg-red-950/30"
            >
              Reconnect Drive
            </Button>
          ) : null}
          {folderHref ? (
            <a
              href={folderHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E2B4B4] bg-white px-3 text-xs font-semibold text-[#8E3A3A] transition-colors hover:bg-[#FFF1F1] dark:border-red-400/40 dark:bg-red-950/20 dark:text-red-100 dark:hover:bg-red-950/30"
            >
              Open folder
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const previewData = previewState.data;
  const items = previewData?.items || [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[#D9E6FF] bg-white/70 p-3 dark:border-border dark:bg-muted/20">
        <p className="text-sm font-medium text-foreground">This folder is empty.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D9E6FF] bg-white/70 p-3 dark:border-border dark:bg-muted/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Folder Items
          </p>
          <p className="text-xs text-muted-foreground">
            {previewData?.itemCount || items.length} item
            {(previewData?.itemCount || items.length) === 1 ? '' : 's'}
            {previewData?.truncated ? ' shown from this folder' : ''}
          </p>
        </div>
      </div>
      <div className={cn('overflow-y-auto pr-1 scrollbar-thin', isNestedPreview ? 'max-h-[13rem]' : 'max-h-[16rem]')}>
        <div className={cn('grid gap-2', previewGridClass)}>
          {items.map((item) => {
            const href =
              String(item.webViewLink || '').trim() ||
              (item.isFolder ? buildDriveFolderLink(item.id) : '');
            const previewUrl = getDriveFolderPreviewItemUrl(item);
            const metaLabel = item.isFolder
              ? 'Folder'
              : formatFolderPreviewFileSize(item.size) || 'Drive file';
            const tile = (
              <>
                <DriveFolderPreviewVisual
                  item={item}
                  previewUrl={previewUrl}
                  metaLabel={metaLabel}
                />
                <p className="mt-1 truncate text-[10px] font-medium text-foreground">
                  {item.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{metaLabel}</p>
              </>
            );

            if (!item.isFolder) {
              return (
                <a
                  key={item.id}
                  href={href || undefined}
                  target={href ? '_blank' : undefined}
                  rel={href ? 'noreferrer' : undefined}
                  className="group block"
                >
                  {tile}
                </a>
              );
            }

            return (
              <HoverCard key={item.id} openDelay={80} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <a
                    href={href || undefined}
                    target={href ? '_blank' : undefined}
                    rel={href ? 'noreferrer' : undefined}
                    className="group block"
                    onMouseEnter={() => prefetchDriveFolderPreview(item.id, apiUrl)}
                    onFocus={() => prefetchDriveFolderPreview(item.id, apiUrl)}
                  >
                    {tile}
                  </a>
                </HoverCardTrigger>
                <HoverCardContent
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="w-[20rem] max-w-[calc(100vw-2rem)] border-[#D9E6FF] bg-white/95 p-3 dark:border-border dark:bg-card"
                >
                  <div className="space-y-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Subfolder Preview
                      </p>
                    </div>
                    <DriveFolderHoverPreview folderId={item.id} apiUrl={apiUrl} depth={depth + 1} />
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

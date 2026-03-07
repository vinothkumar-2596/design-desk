
import { useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Circle as KonvaCircle, Ellipse as KonvaEllipse, Image as KonvaImage, Layer, Line, Rect as KonvaRect, Stage, Text as KonvaText } from 'react-konva';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  ArrowUpRight,
  Circle,
  Highlighter,
  Loader2,
  MessageSquarePlus,
  MousePointer2,
  PencilLine,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  Trash2,
} from 'lucide-react';
import { API_URL, authFetch } from '@/lib/api';
import {
  FinalDeliverableAnnotationComment,
  FinalDeliverableAnnotationShape,
  FinalDeliverableAnnotationStroke,
  FinalDeliverableAnnotationThreadMessage,
  FinalDeliverableReviewAnnotation,
} from '@/types';
import { toast } from 'sonner';

type AnnotatableFile = {
  id: string;
  name: string;
  url: string;
  previewUrl: string;
};

type AnnotationTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'blur_rect'
  | 'highlight_rect'
  | 'comment';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: AnnotatableFile | null;
  initialAnnotation?: FinalDeliverableReviewAnnotation | null;
  readOnly?: boolean;
  actorName?: string;
  onSave?: (annotation: FinalDeliverableReviewAnnotation) => void;
};

type EditorState = {
  shapes: FinalDeliverableAnnotationShape[];
  comments: FinalDeliverableAnnotationComment[];
};

const colorPalette = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#111827',
  '#ffffff',
];

const clampUnit = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(4));
};

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const toThreadMessages = (
  comment?: FinalDeliverableAnnotationComment | null
): FinalDeliverableAnnotationThreadMessage[] => {
  const rawThread = Array.isArray(comment?.thread) ? comment?.thread : [];
  const normalizedThread = rawThread
    .map((message, index) => ({
      id: String(message.id || `thread-${index}`),
      text: String(message.text || '').trim(),
      author: String(message.author || '').trim(),
      createdAt: String(message.createdAt || ''),
    }))
    .filter((message) => Boolean(message.text));

  if (normalizedThread.length > 0) return normalizedThread;
  const fallbackText = String(comment?.text || '').trim();
  if (!fallbackText) return [];
  return [
    {
      id: 'thread-0',
      text: fallbackText,
      author: '',
      createdAt: '',
    },
  ];
};

const normalizeIncomingShapes = (
  annotation?: FinalDeliverableReviewAnnotation | null
): FinalDeliverableAnnotationShape[] => {
  if (Array.isArray(annotation?.shapes) && annotation.shapes.length > 0) {
    return annotation.shapes.map((shape, index) => ({
      ...shape,
      id: String(shape.id || `shape-${index}`),
      kind: (String(shape.kind || 'pen').trim().toLowerCase() || 'pen') as
        | 'pen'
        | 'highlighter'
        | 'arrow'
        | 'rect'
        | 'ellipse'
        | 'text'
        | 'blur_rect'
        | 'highlight_rect',
      color: String(shape.color || '#ef4444'),
      width: Number(shape.width ?? 2),
      opacity: Number(shape.opacity ?? 1),
      points:
        shape.points?.map((point) => ({
          x: clampUnit(Number(point.x ?? 0)),
          y: clampUnit(Number(point.y ?? 0)),
        })) ?? [],
      startX: clampUnit(Number(shape.startX ?? 0)),
      startY: clampUnit(Number(shape.startY ?? 0)),
      endX: clampUnit(Number(shape.endX ?? 0)),
      endY: clampUnit(Number(shape.endY ?? 0)),
      x: clampUnit(Number(shape.x ?? 0)),
      y: clampUnit(Number(shape.y ?? 0)),
      text: String(shape.text || ''),
      fontSize: Number(shape.fontSize ?? 24),
      fillColor: String(shape.fillColor || ''),
    }));
  }

  if (!Array.isArray(annotation?.strokes)) return [];
  return annotation.strokes
    .map((stroke, index) => ({
      id: String(stroke.id || `stroke-shape-${index}`),
      kind: 'pen' as const,
      color: String(stroke.color || '#ef4444'),
      width: Number(stroke.width ?? 2),
      opacity: 1,
      points:
        stroke.points?.map((point) => ({
          x: clampUnit(Number(point.x ?? 0)),
          y: clampUnit(Number(point.y ?? 0)),
        })) ?? [],
    }))
    .filter((shape) => Array.isArray(shape.points) && shape.points.length >= 2);
};

const normalizeIncomingComments = (
  annotation?: FinalDeliverableReviewAnnotation | null
): FinalDeliverableAnnotationComment[] =>
  Array.isArray(annotation?.comments)
    ? annotation.comments.map((comment, index) => {
        const thread = toThreadMessages(comment);
        return {
          ...comment,
          id: String(comment.id || `comment-${index}`),
          x: clampUnit(Number(comment.x ?? 0)),
          y: clampUnit(Number(comment.y ?? 0)),
          text: thread[thread.length - 1]?.text || String(comment.text || ''),
          thread,
        };
      })
    : [];

const hasAnnotationContent = (state: EditorState) =>
  state.shapes.length > 0 || state.comments.length > 0;

const imageMimeByExt: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const inferImageMimeType = (fileName: string) => {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase();
  if (!ext) return '';
  return imageMimeByExt[ext] || '';
};

const extractDriveIdFromUrl = (rawUrl: string) => {
  const source = String(rawUrl || '').trim();
  if (!source) return '';
  try {
    const parsed = new URL(source, typeof window !== 'undefined' ? window.location.origin : undefined);
    const idFromQuery = parsed.searchParams.get('id');
    if (idFromQuery) return idFromQuery;

    const decodedPath = decodeURIComponent(parsed.pathname || '');
    const pathPatterns = [
      /\/file\/d\/([^/?#]+)/i,
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
    /\/file\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/d\/([A-Za-z0-9_-]{10,})/i,
    /\/api\/files\/download\/([A-Za-z0-9_-]{10,})/i,
  ];
  for (const pattern of rawPatterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
};

export function ImageAnnotationDialog({
  open,
  onOpenChange,
  file,
  initialAnnotation,
  readOnly = false,
  actorName = '',
  onSave,
}: Props) {
  const [tool, setTool] = useState<AnnotationTool>('select');
  const [strokeColor, setStrokeColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [textDraft, setTextDraft] = useState('Label');
  const [editorState, setEditorState] = useState<EditorState>({ shapes: [], comments: [] });
  const [undoStack, setUndoStack] = useState<EditorState[]>([]);
  const [redoStack, setRedoStack] = useState<EditorState[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 900, height: 560 });
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const activeShapeIdRef = useRef<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const normalizedShapes = normalizeIncomingShapes(initialAnnotation);
    const normalizedComments = normalizeIncomingComments(initialAnnotation);
    setEditorState({
      shapes: normalizedShapes,
      comments: normalizedComments,
    });
    setUndoStack([]);
    setRedoStack([]);
    setSelectedShapeId('');
    setSelectedCommentId('');
    setCommentDraft('');
    setReplyDraft('');
    setTextDraft('Label');
    setTool(readOnly ? 'select' : 'pen');
  }, [open, initialAnnotation, readOnly]);

  useEffect(() => {
    const revokePreviewObjectUrl = () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };

    const previewUrl = String(file?.previewUrl || '').trim();
    const fileUrl = String(file?.url || '').trim();
    const fileName = String(file?.name || '').trim();

    if (!open || (!previewUrl && !fileUrl)) {
      revokePreviewObjectUrl();
      setImageObj(null);
      setImageNaturalSize({ width: 0, height: 0 });
      setPreviewState('idle');
      return;
    }

    let cancelled = false;
    setPreviewState('loading');
    const driveId = extractDriveIdFromUrl(fileUrl) || extractDriveIdFromUrl(previewUrl);
    const normalizedApiBase = String(API_URL || window.location.origin || '').replace(/\/$/, '');
    const driveProxyUrl =
      driveId && normalizedApiBase
        ? `${normalizedApiBase}/api/files/download/${encodeURIComponent(driveId)}`
        : '';
    const previewCandidates = Array.from(
      new Set([previewUrl, fileUrl, driveProxyUrl].filter(Boolean))
    );
    const expectedMime = inferImageMimeType(fileName);

    const loadImageElement = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Image load failed for ${src}`));
        image.src = src;
      });

    const shouldAttemptAuthenticatedFetch = (src: string) => {
      if (!src) return false;
      try {
        const parsed = new URL(src, window.location.origin);
        const isSameOrigin = parsed.origin === window.location.origin;
        const isApiDownloadPath = parsed.pathname.includes('/api/files/download/');
        return isSameOrigin || isApiDownloadPath;
      } catch {
        return src.startsWith('/') || src.includes('/api/files/download/');
      }
    };

    const setLoadedImage = (image: HTMLImageElement) => {
      if (cancelled) return;
      setImageObj(image);
      setImageNaturalSize({
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0,
      });
      setPreviewState('ready');
    };

    const resolvePreview = async () => {
      revokePreviewObjectUrl();
      for (const candidate of previewCandidates) {
        try {
          const image = await loadImageElement(candidate);
          setLoadedImage(image);
          return;
        } catch {
          // Try authenticated fetch for protected backend file endpoints.
        }

        if (!shouldAttemptAuthenticatedFetch(candidate)) continue;
        try {
          const response = await authFetch(candidate);
          if (!response.ok) continue;
          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('text/html') || contentType.includes('application/json')) {
            continue;
          }
          const rawBlob = await response.blob();
          const blob =
            expectedMime && (!rawBlob.type || rawBlob.type === 'application/octet-stream')
              ? new Blob([rawBlob], { type: expectedMime })
              : rawBlob;
          if (!blob || blob.size <= 0) continue;
          const objectUrl = URL.createObjectURL(blob);
          previewObjectUrlRef.current = objectUrl;
          const image = await loadImageElement(objectUrl);
          setLoadedImage(image);
          return;
        } catch {
          continue;
        }
      }

      if (cancelled) return;
      setImageObj(null);
      setImageNaturalSize({ width: 0, height: 0 });
      setPreviewState('error');
    };

    resolvePreview();

    return () => {
      cancelled = true;
      revokePreviewObjectUrl();
    };
  }, [open, file?.previewUrl, file?.url, file?.name]);

  useEffect(() => {
    if (!open) return;
    const computeSize = () => {
      const containerWidth = stageHostRef.current?.clientWidth || 900;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
      const nextHeight = Math.max(380, Math.min(700, Math.round(viewportHeight * 0.62)));
      setStageSize({
        width: Math.max(320, Math.round(containerWidth)),
        height: nextHeight,
      });
    };
    computeSize();
    const observer = new ResizeObserver(() => computeSize());
    if (stageHostRef.current) observer.observe(stageHostRef.current);
    window.addEventListener('resize', computeSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeSize);
    };
  }, [open]);

  const imageRect = useMemo(() => {
    if (!imageObj || !imageObj.naturalWidth || !imageObj.naturalHeight) {
      return {
        x: 0,
        y: 0,
        width: stageSize.width,
        height: stageSize.height,
      };
    }
    const widthRatio = stageSize.width / imageObj.naturalWidth;
    const heightRatio = stageSize.height / imageObj.naturalHeight;
    const scale = Math.min(widthRatio, heightRatio);
    const width = imageObj.naturalWidth * scale;
    const height = imageObj.naturalHeight * scale;
    return {
      x: (stageSize.width - width) / 2,
      y: (stageSize.height - height) / 2,
      width,
      height,
    };
  }, [imageObj, stageSize.height, stageSize.width]);

  const selectedShape = useMemo(
    () => editorState.shapes.find((shape) => shape.id === selectedShapeId),
    [editorState.shapes, selectedShapeId]
  );
  const selectedComment = useMemo(
    () => editorState.comments.find((comment) => comment.id === selectedCommentId),
    [editorState.comments, selectedCommentId]
  );
  const selectedCommentThread = useMemo(() => toThreadMessages(selectedComment), [selectedComment]);
  const isPreviewReady = Boolean(imageObj) && previewState === 'ready';

  const pushUndoSnapshot = () => {
    setUndoStack((prev) => [...prev.slice(-79), deepClone(editorState)]);
    setRedoStack([]);
  };

  const toNormalizedPoint = (stageX: number, stageY: number) => {
    if (imageRect.width <= 0 || imageRect.height <= 0) return null;
    const relativeX = (stageX - imageRect.x) / imageRect.width;
    const relativeY = (stageY - imageRect.y) / imageRect.height;
    if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) return null;
    return {
      x: clampUnit(relativeX),
      y: clampUnit(relativeY),
    };
  };

  const toStagePoint = (point?: { x?: number; y?: number } | null) => {
    if (!point) return null;
    return {
      x: imageRect.x + clampUnit(Number(point.x ?? 0)) * imageRect.width,
      y: imageRect.y + clampUnit(Number(point.y ?? 0)) * imageRect.height,
    };
  };

  const handlePointerDown = (event: any) => {
    if (readOnly || !stageRef.current) return;
    if (!isPreviewReady) return;
    const position = stageRef.current.getPointerPosition();
    if (!position) return;
    const normalizedPoint = toNormalizedPoint(position.x, position.y);

    if (tool === 'select') {
      if (!normalizedPoint) {
        setSelectedShapeId('');
        setSelectedCommentId('');
      }
      return;
    }
    if (!normalizedPoint) return;

    if (tool === 'comment') {
      const text = commentDraft.trim();
      if (!text) {
        toast.error('Type a marker comment before placing it.');
        return;
      }
      pushUndoSnapshot();
      const now = new Date().toISOString();
      setEditorState((prev) => ({
        ...prev,
        comments: [
          ...prev.comments,
          {
            id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            x: normalizedPoint.x,
            y: normalizedPoint.y,
            text,
            thread: [
              {
                id: `thread-${Date.now()}-0`,
                text,
                author: actorName,
                createdAt: now,
              },
            ],
          },
        ],
      }));
      setCommentDraft('');
      return;
    }

    if (tool === 'text') {
      const label = textDraft.trim();
      if (!label) {
        toast.error('Type label text first.');
        return;
      }
      pushUndoSnapshot();
      const shapeId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setEditorState((prev) => ({
        ...prev,
        shapes: [
          ...prev.shapes,
          {
            id: shapeId,
            kind: 'text',
            x: normalizedPoint.x,
            y: normalizedPoint.y,
            text: label.slice(0, 120),
            fontSize: Math.max(12, Math.min(72, strokeWidth * 4)),
            color: strokeColor,
            fillColor: '',
            opacity: 1,
          },
        ],
      }));
      setSelectedShapeId(shapeId);
      setSelectedCommentId('');
      return;
    }

    pushUndoSnapshot();
    const shapeId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeShapeIdRef.current = shapeId;
    setIsDrawing(true);
    setSelectedShapeId(shapeId);
    setSelectedCommentId('');
    const isBrush = tool === 'pen' || tool === 'highlighter';
    const width = tool === 'highlighter' ? Math.max(8, strokeWidth + 4) : strokeWidth;
    const opacity =
      tool === 'highlighter'
        ? 0.35
        : tool === 'highlight_rect'
          ? 0.25
          : tool === 'blur_rect'
            ? 0.5
            : 1;

    setEditorState((prev) => ({
      ...prev,
      shapes: [
        ...prev.shapes,
        isBrush
          ? {
              id: shapeId,
              kind: tool,
              color: strokeColor,
              width,
              opacity,
              points: [normalizedPoint, normalizedPoint],
            }
          : {
              id: shapeId,
              kind: tool as 'arrow' | 'rect' | 'ellipse' | 'blur_rect' | 'highlight_rect',
              color: strokeColor,
              width,
              opacity,
              startX: normalizedPoint.x,
              startY: normalizedPoint.y,
              endX: normalizedPoint.x,
              endY: normalizedPoint.y,
            },
      ],
    }));
  };

  const handlePointerMove = () => {
    if (!isPreviewReady) return;
    if (readOnly || !isDrawing || !activeShapeIdRef.current || !stageRef.current) return;
    const position = stageRef.current.getPointerPosition();
    if (!position) return;
    const normalizedPoint = toNormalizedPoint(position.x, position.y);
    if (!normalizedPoint) return;
    const activeShapeId = activeShapeIdRef.current;

    setEditorState((prev) => ({
      ...prev,
      shapes: prev.shapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;
        if (shape.kind === 'pen' || shape.kind === 'highlighter') {
          const previousPoints = Array.isArray(shape.points) ? shape.points : [];
          const lastPoint = previousPoints[previousPoints.length - 1];
          if (
            lastPoint &&
            Math.abs(lastPoint.x - normalizedPoint.x) < 0.0015 &&
            Math.abs(lastPoint.y - normalizedPoint.y) < 0.0015
          ) {
            return shape;
          }
          return {
            ...shape,
            points: [...previousPoints, normalizedPoint],
          };
        }
        return {
          ...shape,
          endX: normalizedPoint.x,
          endY: normalizedPoint.y,
        };
      }),
    }));
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    activeShapeIdRef.current = null;
  };

  const handleUndo = () => {
    if (readOnly || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-79), deepClone(editorState)]);
    setEditorState(deepClone(previous));
    setSelectedShapeId('');
    setSelectedCommentId('');
  };

  const handleRedo = () => {
    if (readOnly || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-79), deepClone(editorState)]);
    setEditorState(deepClone(next));
    setSelectedShapeId('');
    setSelectedCommentId('');
  };

  const handleClearAll = () => {
    if (readOnly || !hasAnnotationContent(editorState)) return;
    pushUndoSnapshot();
    setEditorState({ shapes: [], comments: [] });
    setSelectedShapeId('');
    setSelectedCommentId('');
  };

  const handleDeleteSelectedShape = () => {
    if (readOnly || !selectedShapeId) return;
    if (!editorState.shapes.some((shape) => shape.id === selectedShapeId)) return;
    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      shapes: prev.shapes.filter((shape) => shape.id !== selectedShapeId),
    }));
    setSelectedShapeId('');
  };

  const handleDeleteComment = (commentId: string) => {
    if (readOnly) return;
    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      comments: prev.comments.filter((comment) => comment.id !== commentId),
    }));
    if (selectedCommentId === commentId) {
      setSelectedCommentId('');
      setReplyDraft('');
    }
  };

  const addReplyToSelectedComment = () => {
    if (readOnly || !selectedCommentId) return;
    const text = replyDraft.trim();
    if (!text) return;
    pushUndoSnapshot();
    const now = new Date().toISOString();
    setEditorState((prev) => ({
      ...prev,
      comments: prev.comments.map((comment) => {
        if (comment.id !== selectedCommentId) return comment;
        const thread = toThreadMessages(comment);
        const nextThread = [
          ...thread,
          {
            id: `thread-${Date.now()}-${thread.length}`,
            text: text.slice(0, 300),
            author: actorName,
            createdAt: now,
          },
        ];
        return {
          ...comment,
          text: nextThread[nextThread.length - 1]?.text || comment.text,
          thread: nextThread,
        };
      }),
    }));
    setReplyDraft('');
  };

  const updateSelectedTextShape = (updates: Partial<FinalDeliverableAnnotationShape>) => {
    if (readOnly || !selectedShape || selectedShape.kind !== 'text') return;
    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      shapes: prev.shapes.map((shape) =>
        shape.id === selectedShape.id
          ? {
              ...shape,
              ...updates,
            }
          : shape
      ),
    }));
  };

  const saveAnnotation = () => {
    if (!file || !onSave) return;
    if (!hasAnnotationContent(editorState)) {
      toast.error('Add at least one annotation before saving.');
      return;
    }
    const derivedStrokes: FinalDeliverableAnnotationStroke[] = editorState.shapes
      .filter(
        (shape) =>
          (shape.kind === 'pen' || shape.kind === 'highlighter') &&
          Array.isArray(shape.points) &&
          shape.points.length >= 2
      )
      .map((shape, index) => ({
        id: shape.id || `stroke-${index}`,
        color: shape.color || '#ef4444',
        width: Number(shape.width ?? 2),
        points:
          shape.points?.map((point) => ({
            x: clampUnit(Number(point.x ?? 0)),
            y: clampUnit(Number(point.y ?? 0)),
          })) ?? [],
      }));

    const payload: FinalDeliverableReviewAnnotation = {
      id: initialAnnotation?.id || `annotation-${Date.now()}`,
      fileId: file.id || '',
      fileName: file.name || '',
      fileUrl: file.url || '',
      imageWidth: imageNaturalSize.width || undefined,
      imageHeight: imageNaturalSize.height || undefined,
      shapes: deepClone(editorState.shapes),
      comments: deepClone(editorState.comments).map((comment) => ({
        ...comment,
        text: toThreadMessages(comment).slice(-1)[0]?.text || String(comment.text || '').trim(),
        thread: toThreadMessages(comment),
      })),
      strokes: derivedStrokes,
      createdAt: new Date().toISOString(),
      createdBy: actorName,
    };

    onSave(payload);
    onOpenChange(false);
  };

  const toolButtons: Array<{
    id: AnnotationTool;
    label: string;
    icon: typeof MousePointer2;
  }> = [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'pen', label: 'Pen', icon: PencilLine },
    { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
    { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
    { id: 'rect', label: 'Rectangle', icon: Square },
    { id: 'ellipse', label: 'Ellipse', icon: Circle },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'blur_rect', label: 'Blur Box', icon: Square },
    { id: 'highlight_rect', label: 'Highlight Box', icon: Square },
    { id: 'comment', label: 'Comment', icon: MessageSquarePlus },
  ];

  const annotationCount = editorState.shapes.length + editorState.comments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl overflow-hidden p-0">
        <div className="border-b border-border/70 px-5 py-4">
          <DialogHeader>
            <DialogTitle>{readOnly ? 'Review Feedback' : 'Design Review Canvas'}</DialogTitle>
            <DialogDescription>
              {file?.name || 'Image'} {readOnly ? 'feedback' : 'with figma-like tools'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{annotationCount} mark(s)</Badge>
            {!readOnly && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={handleUndo} disabled={undoStack.length === 0}>
                  <Undo2 className="mr-1 h-4 w-4" />
                  Undo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleRedo} disabled={redoStack.length === 0}>
                  <Redo2 className="mr-1 h-4 w-4" />
                  Redo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleDeleteSelectedShape} disabled={!selectedShapeId}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete Shape
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleClearAll} disabled={!hasAnnotationContent(editorState)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[2.2fr,1fr]">
          <div className="space-y-3">
            {!readOnly && (
              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                <div className="flex flex-wrap gap-2">
                  {toolButtons.map((toolItem) => {
                    const ToolIcon = toolItem.icon;
                    return (
                      <Button
                        key={toolItem.id}
                        type="button"
                        size="sm"
                        variant={tool === toolItem.id ? 'default' : 'outline'}
                        onClick={() => setTool(toolItem.id)}
                      >
                        <ToolIcon className="mr-1 h-4 w-4" />
                        {toolItem.label}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr,2fr]">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Color
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`h-6 w-6 rounded-full border ${strokeColor === color ? 'ring-2 ring-primary ring-offset-1' : 'border-border/70'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setStrokeColor(color)}
                          aria-label={`Set color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Stroke Width: {strokeWidth}px
                    </p>
                    <Slider value={[strokeWidth]} min={1} max={18} step={1} onValueChange={(value) => setStrokeWidth(value[0] || 1)} />
                  </div>
                </div>
                {tool === 'comment' && (
                  <div className="mt-3">
                    <Textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={2}
                      maxLength={300}
                      placeholder="Type marker comment, then click on image."
                    />
                  </div>
                )}
                {tool === 'text' && (
                  <div className="mt-3">
                    <Textarea
                      value={textDraft}
                      onChange={(event) => setTextDraft(event.target.value)}
                      rows={2}
                      maxLength={120}
                      placeholder="Type label text, then click on image."
                    />
                  </div>
                )}
              </div>
            )}

            <div
              ref={stageHostRef}
              className="relative overflow-hidden rounded-lg border border-border/70 bg-black/5"
              style={{ minHeight: 380 }}
            >
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              >
                <Layer>
                  {imageObj ? (
                    <KonvaImage
                      image={imageObj}
                      x={imageRect.x}
                      y={imageRect.y}
                      width={imageRect.width}
                      height={imageRect.height}
                      listening={false}
                    />
                  ) : (
                    <KonvaRect
                      x={0}
                      y={0}
                      width={stageSize.width}
                      height={stageSize.height}
                      fill="#0f172a"
                      opacity={0.08}
                    />
                  )}
                </Layer>
                {isPreviewReady && (
                  <Layer>
                    {editorState.shapes.map((shape) => {
                    const isSelected = selectedShapeId === shape.id;
                    const color = shape.color || '#ef4444';
                    const width = Math.max(1, Number(shape.width ?? 2));
                    const opacity = Math.max(0.1, Math.min(1, Number(shape.opacity ?? 1)));
                    const commonProps = {
                      key: shape.id,
                      opacity,
                      onClick: (event: any) => {
                        event.cancelBubble = true;
                        if (readOnly) return;
                        setSelectedShapeId(shape.id);
                        setSelectedCommentId('');
                      },
                    };

                    if (shape.kind === 'pen' || shape.kind === 'highlighter') {
                      const points = (shape.points || [])
                        .map((point) => toStagePoint(point))
                        .filter((point): point is { x: number; y: number } => Boolean(point))
                        .flatMap((point) => [point.x, point.y]);
                      if (points.length < 4) return null;
                      return (
                        <Line
                          {...commonProps}
                          points={points}
                          stroke={color}
                          strokeWidth={width}
                          lineCap="round"
                          lineJoin="round"
                          tension={0.15}
                          shadowColor={isSelected ? '#0f172a' : undefined}
                          shadowBlur={isSelected ? 8 : 0}
                        />
                      );
                    }

                    if (shape.kind === 'text') {
                      const point = toStagePoint({ x: shape.x, y: shape.y });
                      if (!point) return null;
                      return (
                        <KonvaText
                          {...commonProps}
                          x={point.x}
                          y={point.y}
                          text={String(shape.text || '')}
                          fontSize={Math.max(10, Number(shape.fontSize ?? 24))}
                          fill={shape.color || '#ef4444'}
                          fontStyle="600"
                          shadowColor={isSelected ? '#0f172a' : undefined}
                          shadowBlur={isSelected ? 6 : 0}
                        />
                      );
                    }

                    const start = toStagePoint({
                      x: Number(shape.startX ?? 0),
                      y: Number(shape.startY ?? 0),
                    });
                    const end = toStagePoint({
                      x: Number(shape.endX ?? 0),
                      y: Number(shape.endY ?? 0),
                    });
                    if (!start || !end) return null;

                    if (shape.kind === 'arrow') {
                      return (
                        <Arrow
                          {...commonProps}
                          points={[start.x, start.y, end.x, end.y]}
                          stroke={color}
                          fill={color}
                          strokeWidth={width}
                          pointerLength={12}
                          pointerWidth={12}
                          dash={isSelected ? [8, 6] : []}
                        />
                      );
                    }

                    if (shape.kind === 'rect' || shape.kind === 'highlight_rect' || shape.kind === 'blur_rect') {
                      const rectX = Math.min(start.x, end.x);
                      const rectY = Math.min(start.y, end.y);
                      const rectWidth = Math.abs(end.x - start.x);
                      const rectHeight = Math.abs(end.y - start.y);
                      const fill =
                        shape.kind === 'highlight_rect'
                          ? color
                          : shape.kind === 'blur_rect'
                            ? '#94a3b8'
                            : 'transparent';
                      const appliedOpacity =
                        shape.kind === 'rect'
                          ? opacity
                          : shape.kind === 'highlight_rect'
                            ? Math.min(0.28, opacity)
                            : Math.min(0.5, opacity);
                      return (
                        <KonvaRect
                          {...commonProps}
                          x={rectX}
                          y={rectY}
                          width={rectWidth}
                          height={rectHeight}
                          stroke={color}
                          strokeWidth={width}
                          fill={fill}
                          opacity={appliedOpacity}
                          dash={isSelected || shape.kind === 'blur_rect' ? [8, 6] : []}
                        />
                      );
                    }

                    const centerX = (start.x + end.x) / 2;
                    const centerY = (start.y + end.y) / 2;
                    const radiusX = Math.abs(end.x - start.x) / 2;
                    const radiusY = Math.abs(end.y - start.y) / 2;
                    return (
                      <KonvaEllipse
                        {...commonProps}
                        x={centerX}
                        y={centerY}
                        radiusX={radiusX}
                        radiusY={radiusY}
                        stroke={color}
                        strokeWidth={width}
                        fill="transparent"
                        dash={isSelected ? [8, 6] : []}
                      />
                    );
                    })}
                  </Layer>
                )}
                {isPreviewReady && (
                  <Layer>
                    {editorState.comments.map((comment, index) => {
                    const stagePoint = toStagePoint(comment);
                    if (!stagePoint) return null;
                    const selected = comment.id === selectedCommentId;
                    return (
                      <KonvaCircle
                        key={`comment-marker-${comment.id}`}
                        x={stagePoint.x}
                        y={stagePoint.y}
                        radius={selected ? 14 : 12}
                        fill={selected ? '#1d4ed8' : '#3349a9'}
                        stroke="#ffffff"
                        strokeWidth={2}
                        shadowColor="#0f172a"
                        shadowBlur={8}
                        onClick={(event) => {
                          event.cancelBubble = true;
                          setSelectedCommentId(comment.id);
                          if (!readOnly) setTool('select');
                        }}
                      />
                    );
                    })}
                    {editorState.comments.map((comment, index) => {
                    const stagePoint = toStagePoint(comment);
                    if (!stagePoint) return null;
                    return (
                      <KonvaText
                        key={`comment-label-${comment.id}`}
                        x={stagePoint.x - 6}
                        y={stagePoint.y - 7}
                        text={`${index + 1}`}
                        fontSize={12}
                        fontStyle="bold"
                        fill="#ffffff"
                        listening={false}
                      />
                    );
                    })}
                  </Layer>
                )}
              </Stage>
              {!isPreviewReady && previewState === 'loading' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading image and annotations...
                    </span>
                  </div>
                </div>
              )}
              {!isPreviewReady && previewState === 'error' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Preview unavailable for this file.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {selectedShape?.kind === 'text' && !readOnly && (
              <div className="rounded-md border border-border/70 bg-secondary/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Selected Text Label
                </p>
                <Textarea
                  value={String(selectedShape.text || '')}
                  onChange={(event) =>
                    updateSelectedTextShape({
                      text: event.target.value.slice(0, 120),
                    })
                  }
                  rows={2}
                  maxLength={120}
                  className="mt-2"
                />
                <div className="mt-2">
                  <p className="text-[11px] text-muted-foreground">
                    Font Size: {Math.round(Number(selectedShape.fontSize ?? 24))}
                  </p>
                  <Slider
                    value={[Math.max(10, Math.min(96, Number(selectedShape.fontSize ?? 24)))]}
                    min={10}
                    max={96}
                    step={1}
                    onValueChange={(value) =>
                      updateSelectedTextShape({
                        fontSize: value[0] || 24,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div className="rounded-md border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Marker Threads
              </p>
              {editorState.comments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No markers yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {editorState.comments.map((comment, index) => {
                    const thread = toThreadMessages(comment);
                    const latest = thread[thread.length - 1];
                    const selected = selectedCommentId === comment.id;
                    return (
                      <button
                        key={comment.id}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left ${selected ? 'border-primary/60 bg-primary/5' : 'border-border/60 bg-background/90'}`}
                        onClick={() => setSelectedCommentId(comment.id)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-muted-foreground">Marker {index + 1}</p>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteComment(comment.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-foreground line-clamp-2">
                          {latest?.text || comment.text}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {thread.length} message(s)
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedComment && (
              <div className="rounded-md border border-border/70 bg-secondary/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Thread Conversation
                </p>
                <div className="mt-2 max-h-52 space-y-2 overflow-auto pr-1">
                  {selectedCommentThread.map((message) => (
                    <div key={message.id} className="rounded-md border border-border/60 bg-background/90 px-2 py-1.5 text-xs">
                      <p className="text-foreground">{message.text}</p>
                      {(message.author || message.createdAt) && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {message.author || 'Reviewer'}
                          {message.createdAt ? ` • ${new Date(message.createdAt).toLocaleString()}` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <div className="mt-2">
                    <Textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      rows={2}
                      maxLength={300}
                      placeholder="Reply to this marker thread..."
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2"
                      disabled={!replyDraft.trim()}
                      onClick={addReplyToSelectedComment}
                    >
                      Add Reply
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-md border border-border/70 bg-secondary/30 p-3 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-[0.12em]">Tools</p>
              <p className="mt-2">
                Pen/highlighter, arrows, shapes, text labels, blur/highlight boxes, and threaded marker comments.
              </p>
            </div>

            {!readOnly && (
              <Button type="button" className="w-full" disabled={!hasAnnotationContent(editorState)} onClick={saveAnnotation}>
                <Save className="mr-1 h-4 w-4" />
                Save Feedback
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


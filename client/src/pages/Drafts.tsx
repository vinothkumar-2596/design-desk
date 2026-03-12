import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarClock,
  FileText,
  FolderOpen,
  Paperclip,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { matchesSearch } from '@/lib/search';
import {
  REQUEST_DRAFT_UPDATED_EVENT,
  clearRequestDraft,
  getRequestDraftStorageKey,
  loadRequestDraft,
  type RequestDraftPayload,
} from '@/lib/requestDrafts';
import { toast } from 'sonner';

const humanize = (value?: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

export default function Drafts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const [draft, setDraft] = useState<RequestDraftPayload | null>(() => loadRequestDraft(user));

  useEffect(() => {
    setDraft(loadRequestDraft(user));
  }, [user?.id, user?.email]);

  useEffect(() => {
    setScopeLabel('Drafts');
    setItems(
      draft
        ? [
            {
              id: 'draft:new-request',
              label: draft.title?.trim() || 'Untitled request draft',
              description: draft.description || 'Saved design request draft',
              meta: draft.savedAt
                ? `Saved ${format(new Date(draft.savedAt), 'd MMM, h:mm a')}`
                : 'Saved draft',
              href: '/drafts',
              kind: 'other',
            },
          ]
        : []
    );
  }, [draft, setItems, setScopeLabel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draftKey = getRequestDraftStorageKey(user);
    const syncDraft = () => {
      setDraft(loadRequestDraft(user));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== draftKey) return;
      syncDraft();
    };
    const handleDraftUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key !== draftKey) return;
      syncDraft();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(REQUEST_DRAFT_UPDATED_EVENT, handleDraftUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(REQUEST_DRAFT_UPDATED_EVENT, handleDraftUpdated);
    };
  }, [user]);

  const matchesDraftSearch = useMemo(() => {
    if (!draft) return false;
    return matchesSearch(query, [
      draft.title,
      draft.description,
      draft.category,
      draft.urgency,
      draft.isEmergency ? 'emergency' : '',
    ]);
  }, [draft, query]);

  const handleDeleteDraft = () => {
    clearRequestDraft(user);
    setDraft(null);
    toast.success('Draft removed.');
  };

  const attachmentCount = draft?.files?.length || 0;
  const draftTitle = draft?.title?.trim() || 'Untitled request draft';
  const draftDescription = draft?.description?.trim() || 'Continue this saved design request when ready.';
  const savedAtLabel =
    draft?.savedAt && !Number.isNaN(new Date(draft.savedAt).getTime())
      ? format(new Date(draft.savedAt), 'd MMM yyyy, h:mm a')
      : 'Recently saved';

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 pt-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-2xl font-bold text-foreground premium-headline">Drafts</h1>
            <p className="mt-1 text-sm text-muted-foreground premium-body">
              Saved request drafts live here until you continue or discard them.
            </p>
          </div>
          <Button
            asChild
            size="default"
            className="bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-[0_20px_40px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-xl hover:bg-primary/85 hover:shadow-[0_22px_44px_-22px_hsl(var(--primary)/0.6)] transition-all duration-200"
          >
            <Link to="/new-request">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Link>
          </Button>
        </div>

        {!draft ? (
          <div className="rounded-[28px] border border-[#D9E6FF]/70 bg-gradient-to-br from-white/88 via-[#F7FAFF]/82 to-[#EAF2FF]/76 p-8 text-center shadow-none dark:border-border dark:bg-card/90 dark:bg-none">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#D7E3FF] bg-white/80 text-[#233A71] dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-100">
              <FolderOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">No drafts yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Save a request draft from the new request form and it will appear here.
            </p>
            <Button
              className="mt-5"
              onClick={() => navigate('/new-request')}
            >
              Create New Request
            </Button>
          </div>
        ) : !matchesDraftSearch ? (
          <div className="rounded-[28px] border border-[#D9E6FF]/70 bg-gradient-to-br from-white/88 via-[#F7FAFF]/82 to-[#EAF2FF]/76 p-8 text-center shadow-none dark:border-border dark:bg-card/90 dark:bg-none">
            <h2 className="text-lg font-semibold text-foreground">No matching drafts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term or clear the search box.
            </p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[28px] border border-[#D9E6FF]/70 bg-gradient-to-br from-white/88 via-[#F7FAFF]/82 to-[#EAF2FF]/76 p-6 shadow-none dark:border-border dark:bg-card/90 dark:bg-none">
            <div className="pointer-events-none absolute -right-12 top-[-20px] h-36 w-36 rounded-full bg-[#DEE9FF]/80 blur-3xl dark:bg-[#274A92]/20" />
            <div className="pointer-events-none absolute -left-10 bottom-[-32px] h-40 w-40 rounded-full bg-white/70 blur-3xl dark:bg-slate-200/5" />
            <div className="relative space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E3FF] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#50648E] dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-300">
                    <PenLine className="h-3.5 w-3.5" />
                    Saved Draft
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{draftTitle}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      {draftDescription}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={handleDeleteDraft}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => navigate('/new-request')}
                  >
                    Continue Draft
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#D7E3FF]/70 bg-white/72 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D7FA8] dark:text-slate-400">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Saved
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{savedAtLabel}</p>
                </div>
                <div className="rounded-2xl border border-[#D7E3FF]/70 bg-white/72 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D7FA8] dark:text-slate-400">
                    <FileText className="h-3.5 w-3.5" />
                    Category
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {humanize(draft.category) || 'Not selected'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#D7E3FF]/70 bg-white/72 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D7FA8] dark:text-slate-400">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

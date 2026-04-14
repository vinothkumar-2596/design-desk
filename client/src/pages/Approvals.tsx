import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  FileCheck,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import {
  formatAdminRequestedUpdatesNote,
  getLatestAdminRequestedUpdatesNote,
} from '@/lib/adminReview';
import { DESIGN_GOVERNANCE_NOTICE_POLICY } from '@/lib/designGovernance';
import { hydrateTask, inferTaskRequestType } from '@/lib/taskHydration';
import {
  getModificationApprovalActorLabel,
  isDesignLeadRole,
} from '@/lib/roleRules';
import { API_URL, authFetch } from '@/lib/api';

type ReviewDecision = 'approved' | 'needs_info' | 'rejected';

const REQUEST_CHANGE_TEMPLATES = [
  {
    label: 'Brief',
    text: 'Clarify the brief outcome and the exact deliverable expected.',
  },
  {
    label: 'Copy',
    text: 'Replace placeholder copy with the approved content and messaging.',
  },
  {
    label: 'Files',
    text: 'Attach the missing source files, references, logos, or brand assets.',
  },
  {
    label: 'Specs',
    text: 'Confirm the final dimensions, format, and usage/platform requirements.',
  },
  {
    label: 'Deadline',
    text: 'Review and correct the requested deadline or delivery expectation.',
  },
] as const;

export default function Approvals() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<typeof mockTasks>(API_URL ? [] : mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const [requestChangesTaskId, setRequestChangesTaskId] = useState<string | null>(null);
  const [requestChangesNote, setRequestChangesNote] = useState('');
  const apiUrl = API_URL;
  const isAdminReviewMode = user?.role === 'admin';
  const isDesignLeadReviewMode = isDesignLeadRole(user);

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        const hydrated = data.map((task: any) => hydrateTask({ ...task, id: task.id || task._id }));
        setTasks(hydrated);
      } catch {
        toast.error('Failed to load approvals');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  const pendingApprovals = useMemo(() => {
    if (isAdminReviewMode) {
      return tasks.filter(
        (task) => task.adminReviewStatus === 'pending' || task.adminReviewStatus === 'needs_info'
      );
    }
    if (isDesignLeadReviewMode) {
      return tasks.filter((task) => task.approvalStatus === 'pending');
    }
    return [];
  }, [isAdminReviewMode, isDesignLeadReviewMode, tasks]);

  useEffect(() => {
    setScopeLabel('Approvals');
    setItems(buildSearchItemsFromTasks(pendingApprovals));
  }, [pendingApprovals, setItems, setScopeLabel]);

  const filteredApprovals = useMemo(
    () =>
      pendingApprovals.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.requesterDepartment,
          task.category,
          task.status,
        ])
      ),
    [pendingApprovals, query]
  );
  const requestChangesTask = useMemo(
    () => tasks.find((task) => task.id === requestChangesTaskId) ?? null,
    [requestChangesTaskId, tasks]
  );
  const isRequestChangesSubmitting =
    Boolean(requestChangesTaskId) && processingId === requestChangesTaskId;

  const getStaffUpdatePreview = (task: (typeof tasks)[number]) => {
    const history = [...(task.changeHistory || [])].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    for (const entry of history) {
      if (entry.userRole !== 'staff') continue;
      if (
        entry.field === 'approval_status' ||
        entry.field === 'admin_review_status' ||
        entry.field === 'admin_review_response_status'
      ) {
        continue;
      }
      if (entry.field === 'staff_note' && entry.newValue) return entry.newValue;
      if (entry.field === 'description' && entry.newValue) return entry.newValue;
      if (entry.note) return entry.note;
      if (entry.newValue) return entry.newValue;
    }
    return '';
  };

  const formatTaskText = (value?: string) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const formatCategoryLabel = (value?: string) =>
    String(value || '')
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const resetRequestChangesModal = () => {
    setRequestChangesTaskId(null);
    setRequestChangesNote('');
  };

  const handleRequestChangesModalChange = (open: boolean) => {
    if (!open) {
      if (isRequestChangesSubmitting) return;
      resetRequestChangesModal();
    }
  };

  const openRequestChangesModal = (task: (typeof tasks)[number]) => {
    setRequestChangesTaskId(task.id);
    setRequestChangesNote(getLatestAdminRequestedUpdatesNote(task.changeHistory));
  };

  const appendRequestChangeTemplate = (value: string) => {
    setRequestChangesNote((current) => {
      const nextLine = `- ${value}`;
      const trimmed = current.trim();
      if (!trimmed) return nextLine;
      if (trimmed.includes(nextLine)) return current;
      return `${trimmed}\n${nextLine}`;
    });
  };

  const openTaskBriefEditor = (task: (typeof tasks)[number]) => {
    const requestType = inferTaskRequestType(task);
    navigate(
      requestType === 'campaign_request'
        ? '/new-request/campaign-suite'
        : '/new-request/quick-design',
      {
        state: {
          editTaskId: task.id,
          editTaskSnapshot: task,
          returnTo: `${location.pathname}${location.search}`,
        },
      }
    );
  };

  const getRequestSummary = (task: (typeof tasks)[number]) => {
    const title = String(task.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const description = String(task.description || '').replace(/\s+/g, ' ').trim();
    if (!description) return 'No additional request details were provided.';
    if (description.toLowerCase() === title) {
      return 'Details were not added beyond the request title.';
    }
    return description;
  };

  const updateReviewStatus = async (
    taskId: string,
    decision: ReviewDecision,
    feedbackNote?: string
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    const actorLabel = isAdminReviewMode ? 'Admin' : getModificationApprovalActorLabel();
    const oldValue = isAdminReviewMode
      ? currentTask?.adminReviewStatus ?? 'pending'
      : currentTask?.approvalStatus ?? 'pending';
    const newValue =
      decision === 'approved'
        ? 'Approved'
        : decision === 'needs_info'
          ? 'Need Info'
          : 'Rejected';
    const reviewNote =
      isAdminReviewMode && decision === 'needs_info' && feedbackNote?.trim()
        ? formatAdminRequestedUpdatesNote(feedbackNote)
        : isAdminReviewMode
          ? `Admin review ${decision.replace('_', ' ')} by ${user?.name || actorLabel}`
          : `Approval ${decision} by ${user?.name || actorLabel}`;

    if (apiUrl) {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: isAdminReviewMode
            ? {
                adminReviewStatus: decision,
                adminReviewedBy: user?.name || '',
                adminReviewedAt: new Date(),
                ...(decision === 'needs_info'
                  ? {
                      adminReviewResponseStatus: 'draft',
                      adminReviewResponseSubmittedBy: '',
                      adminReviewResponseSubmittedAt: null,
                    }
                  : {}),
              }
            : {
                approvalStatus: decision,
                approvedBy: user?.name || '',
                approvalDate: new Date(),
              },
          changes: [
            {
              type: 'status',
              field: isAdminReviewMode ? 'admin_review_status' : 'approval_status',
              oldValue,
              newValue,
              note: reviewNote,
            },
          ],
          userId: user?.id || '',
          userName: user?.name || '',
          userRole: user?.role || '',
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to update review');
      }
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...(isAdminReviewMode
                ? {
                    adminReviewStatus: decision,
                    adminReviewedBy: user?.name || '',
                    adminReviewedAt: new Date(),
                    ...(decision === 'needs_info'
                      ? {
                          adminReviewResponseStatus: 'draft' as const,
                          adminReviewResponseSubmittedBy: '',
                          adminReviewResponseSubmittedAt: undefined,
                        }
                      : {}),
                  }
                : {
                    approvalStatus: decision,
                    approvedBy: user?.name || '',
                    approvalDate: new Date(),
                  }),
              updatedAt: new Date(),
              changeHistory: [
                {
                  id: `ch-${Date.now()}-0`,
                  type: 'status',
                  field: isAdminReviewMode ? 'admin_review_status' : 'approval_status',
                  oldValue,
                  newValue,
                  note: reviewNote,
                  userId: user?.id || '',
                  userName: user?.name || actorLabel,
                  userRole: user?.role || (isAdminReviewMode ? 'admin' : 'designer'),
                  createdAt: new Date(),
                },
                ...(task.changeHistory || []),
              ],
            }
          : task
      )
    );
  };

  const submitDecision = async (
    taskId: string,
    decision: ReviewDecision,
    options?: { feedbackNote?: string }
  ) => {
    if (processingId) return false;
    setProcessingId(taskId);
    try {
      await updateReviewStatus(taskId, decision, options?.feedbackNote);
      toast.success(
        decision === 'approved'
          ? isAdminReviewMode
            ? 'Task approved for design intake'
            : 'Request approved'
          : decision === 'needs_info'
            ? 'Request changes sent to staff'
            : 'Request rejected',
        {
          description:
            decision === 'needs_info'
              ? 'The requested updates were saved with the admin review.'
              : 'The requester has been notified.',
        }
      );
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to update request';
      toast.error(message);
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecision = async (taskId: string, decision: ReviewDecision) => {
    await submitDecision(taskId, decision);
  };

  const handleRequestChangesSubmit = async () => {
    if (!requestChangesTaskId) return;
    const feedbackNote = requestChangesNote.trim();
    if (!feedbackNote) {
      toast.message('Specify what staff needs to update before sending the request.');
      return;
    }

    const applied = await submitDecision(requestChangesTaskId, 'needs_info', { feedbackNote });
    if (applied) {
      resetRequestChangesModal();
    }
  };

  const headerTitle = isAdminReviewMode
    ? 'Admin Review Queue'
    : 'Pending Modification Approvals';
  const headerDescription = isAdminReviewMode
    ? 'Validate staff submissions before they reach the design team'
    : `${getModificationApprovalActorLabel()} review for data edit and modification requests`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {!isAdminReviewMode && !isDesignLeadReviewMode ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-semibold text-foreground">Approvals</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Admin reviews staff submissions here, and Design Lead reviews modification requests.
            </p>
          </div>
        ) : null}

        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground premium-headline">{headerTitle}</h1>
          <p className="text-muted-foreground mt-1 premium-body">{headerDescription}</p>
        </div>

        <div className="rounded-lg border border-border/45 bg-card p-4 shadow-none animate-slide-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground">Approval Guidelines</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdminReviewMode
                  ? 'Review incoming requests for completeness, clarity, files, and realistic deadlines before routing them forward.'
                  : 'Review incoming modification requests before approving to ensure the requested changes still align with the approved brief.'}
              </p>
              <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                {DESIGN_GOVERNANCE_NOTICE_POLICY}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredApprovals.length} pending {isAdminReviewMode ? 'review' : 'approval'}
          {filteredApprovals.length !== 1 ? 's' : ''}
        </p>

        {isLoading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-muted-foreground">Loading approvals...</p>
          </div>
        ) : filteredApprovals.length > 0 ? (
          <div className="space-y-3">
            {filteredApprovals.map((task, index) => {
              const staffPreview = getStaffUpdatePreview(task);
              const headline = formatTaskText(task.title) || 'Untitled request';
              const summary = getRequestSummary(task);
              const categoryLabel = formatCategoryLabel(task.category) || 'General';
              const requesterInitials =
                task.requesterName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('') || 'AP';

              return (
                <div
                  key={task.id}
                  className="relative overflow-hidden rounded-[22px] border border-[#D5E2FF]/55 bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 p-3.5 backdrop-blur-2xl ring-1 ring-[#E3ECFF]/45 animate-slide-up dark:border-[#2F4F8F]/45 dark:ring-[#3C5FA0]/20 dark:bg-card dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#DCE8FF]/60 blur-3xl dark:bg-[#2C56B7]/20" />
                  <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-[#EAF1FF]/65 blur-3xl dark:bg-[#2A49A6]/18" />
                  <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/50 dark:ring-white/5" />

                  <div className="relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_11.5rem] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="pending"
                          className="h-6 border border-border bg-card/90 px-2.5 text-[11px] text-muted-foreground"
                        >
                          {isAdminReviewMode ? 'Awaiting Admin Review' : 'Awaiting Approval'}
                        </Badge>
                        {task.urgency === 'urgent' ? (
                          <Badge variant="urgent" className="h-6 px-2.5 text-[11px]">
                            Urgent
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className="h-6 border-[#D7E3FF] bg-white/75 px-2.5 text-[11px] text-[#5B6E95] dark:border-[#3E5F9F]/55 dark:bg-[#10234F]/70 dark:text-[#DCE7FF]"
                        >
                          {categoryLabel}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/96 to-[#ECF3FF]/92 text-[13px] font-semibold text-[#2D3F73] ring-1 ring-white/70 dark:bg-[linear-gradient(145deg,rgba(68,99,165,0.95),rgba(33,58,112,0.92))] dark:text-[#EAF0FF] dark:ring-white/10">
                          {requesterInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="truncate text-[1.2rem] font-semibold leading-tight text-foreground dark:text-slate-100 premium-headline">
                              {headline}
                            </h3>
                            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8092B2] dark:text-[#AFC2EA]">
                              {String(task.id || '').trim() ? `Task ${String(task.id).slice(-6).toUpperCase()}` : 'Draft'}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground dark:text-[#A0B4DE] premium-body">
                            {summary}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6E83A8] dark:text-[#AFC2EA]">
                            <span>{task.requesterName || 'Unknown requester'}</span>
                            <span className="h-1 w-1 rounded-full bg-[#CAD7EF] dark:bg-[#4868A7]" />
                            <span>{task.requesterDepartment || 'No department'}</span>
                            <span className="h-1 w-1 rounded-full bg-[#CAD7EF] dark:bg-[#4868A7]" />
                            <span>{task.changeCount} change{task.changeCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                      </div>

                      {staffPreview ? (
                        <div className="mt-3 rounded-xl border border-border/45 bg-card/80 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Staff update
                          </p>
                          <p className="mt-1 line-clamp-1 text-[13px] text-foreground/85">
                            {staffPreview}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(244,248,255,0.8))] px-3.5 py-3 supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(244,248,255,0.68))] backdrop-blur-xl dark:border-[#35548F]/50 dark:bg-[linear-gradient(180deg,rgba(12,28,67,0.88),rgba(16,35,79,0.82))]">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8092B2] dark:text-[#AFC2EA]">
                          Submitted
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground dark:text-slate-100">
                          {format(task.createdAt, 'MMM d, yyyy')}
                        </p>
                        <p className="text-[12px] text-[#6E83A8] dark:text-[#B6C7EA]">
                          {format(task.createdAt, 'h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8092B2] dark:text-[#AFC2EA]">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground dark:text-slate-100">
                          {isAdminReviewMode ? 'Intake Review' : 'Lead Approval'}
                        </p>
                        <p className="text-[12px] text-[#6E83A8] dark:text-[#B6C7EA]">
                          {task.urgency === 'urgent' ? 'High attention' : 'Standard queue'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#D9E6FF]/45 pt-3 dark:border-[#2F4F8E]/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg px-3.5 border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-none hover:bg-primary/85 dark:border-transparent"
                        onClick={() => handleDecision(task.id, 'approved')}
                        disabled={processingId === task.id}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {processingId === task.id ? 'Processing...' : 'Approve'}
                      </Button>
                      {isAdminReviewMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg border-transparent px-3 text-foreground hover:bg-muted/60 dark:border-transparent dark:bg-[#0D1C45]/75 dark:text-slate-100 dark:hover:bg-[#173267]/80"
                          onClick={() => openRequestChangesModal(task)}
                          disabled={processingId === task.id}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Request Changes
                        </Button>
                      ) : null}
                      {isAdminReviewMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg border-transparent px-3 text-foreground hover:bg-muted/60 dark:border-transparent dark:bg-[#0D1C45]/75 dark:text-slate-100 dark:hover:bg-[#173267]/80"
                          onClick={() => openTaskBriefEditor(task)}
                          disabled={processingId === task.id}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit Brief
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg border-transparent px-3 text-foreground hover:bg-muted/60 dark:border-transparent dark:bg-[#0D1C45]/75 dark:text-slate-100 dark:hover:bg-[#173267]/80"
                        onClick={() => handleDecision(task.id, 'rejected')}
                        disabled={processingId === task.id}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="group h-8 rounded-full border border-[#CADBFF]/55 bg-[#F5F8FF]/85 px-3.5 text-[#233A71] shadow-none transition-all duration-200 hover:border-[#AEC6FF]/70 hover:bg-[#EEF4FF] hover:text-[#162A5D] dark:border-[#3E5F9F]/55 dark:bg-[#10234F]/70 dark:text-[#DCE7FF] dark:hover:border-[#5D7EC0]/65 dark:hover:bg-[#17356B]/78"
                    >
                      <Link
                        to={`/task/${task.id}`}
                        state={{ task, focusSection: 'change-history' }}
                        className="inline-flex items-center gap-1.5 font-medium"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review Details
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <FileCheck className="h-12 w-12 text-status-completed mx-auto mb-3" />
            <h3 className="font-medium text-foreground">All caught up!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No pending {isAdminReviewMode ? 'reviews' : 'approvals'} at the moment
            </p>
          </div>
        )}
      </div>

      <Dialog open={Boolean(requestChangesTask)} onOpenChange={handleRequestChangesModalChange}>
        <DialogContent className="gap-0 overflow-hidden border-[#DDE5F2] bg-white p-0 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] sm:max-w-xl dark:border-border dark:bg-card">
          <DialogHeader className="space-y-1 border-b border-border/60 px-5 py-4">
            <DialogTitle className="text-[20px] font-semibold leading-6 text-foreground">
              Request changes
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-5 text-muted-foreground">
              Tell staff what needs to be updated before approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <p className="text-[12px] font-medium leading-4 text-muted-foreground">
                Quick tags
              </p>
              <div className="flex flex-wrap gap-2">
                {REQUEST_CHANGE_TEMPLATES.map((template) => (
                  <Button
                    key={template.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-border/80 bg-transparent px-2.5 text-[12px] font-normal text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground dark:bg-transparent"
                    onClick={() => appendRequestChangeTemplate(template.text)}
                    disabled={isRequestChangesSubmitting}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="request-changes-note"
                className="text-[13px] font-medium leading-5 text-foreground"
              >
                Revision note
              </Label>
              <Textarea
                id="request-changes-note"
                value={requestChangesNote}
                onChange={(event) => setRequestChangesNote(event.target.value)}
                placeholder="Example: Upload the missing reference files and confirm the final brochure size."
                className="min-h-[156px] resize-y rounded-lg border-border/80 px-3.5 py-3 text-[14px] leading-6 shadow-none focus-visible:ring-1 focus-visible:ring-[#C8D7FF] dark:border-border"
                disabled={isRequestChangesSubmitting}
              />
              <p className="text-[12px] leading-4 text-muted-foreground">Visible to staff.</p>
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 px-5 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleRequestChangesModalChange(false)}
              disabled={isRequestChangesSubmitting}
              className="h-9 px-4 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRequestChangesSubmit()}
              disabled={isRequestChangesSubmitting || !requestChangesNote.trim()}
              className="h-9 px-4 text-sm font-medium"
            >
              {isRequestChangesSubmitting ? 'Sending...' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

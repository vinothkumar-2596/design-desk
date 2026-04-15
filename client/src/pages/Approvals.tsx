import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  CheckCircle2,
  MinusCircle,
  Eye,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  CheckSquare2,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { mockTasks } from '@/data/mockTasks';
import { API_URL, authFetch } from '@/lib/api';
import { DESIGN_GOVERNANCE_NOTICE_POLICY } from '@/lib/designGovernance';
import { resolveAdminReviewStatus } from '@/lib/roleRules';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import { hydrateTask } from '@/lib/taskHydration';
import { cn } from '@/lib/utils';

type ApprovalTask = (typeof mockTasks)[number];
type SortOrder = 'recent' | 'oldest' | 'requester';

const approvalSurfaceClass =
  'rounded-[18px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors duration-200 dark:border-border dark:bg-card dark:shadow-none';
const approvalFieldClass =
  'rounded-xl border border-[#E4E7EC] bg-white shadow-none dark:border-border dark:bg-card';
const approvalInlineInfoClass =
  'flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-[12.5px] text-[#475467] dark:bg-muted/35 dark:text-muted-foreground';
const approvalBadgeBaseClass =
  'inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium leading-none';
const approvalActionBaseClass =
  'inline-flex h-9 min-w-[108px] items-center justify-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60';
const approvalPrimaryActionClass =
  'border-[#2F5AA8] bg-[#2F5AA8] text-white hover:border-[#274C8D] hover:bg-[#274C8D] focus-visible:ring-[#2F5AA8]/25 dark:border-primary dark:bg-primary dark:hover:bg-primary/90';
const approvalRejectActionClass =
  'border-[#F1D4D6] bg-white text-[#B42318] hover:border-[#E7B4B8] hover:bg-[#FEF3F2] focus-visible:ring-[#DC2626]/15 dark:border-[#6A2A2A] dark:bg-card dark:text-[#F87171] dark:hover:bg-[#2A1414]';
const approvalNeutralActionClass =
  'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#C7CDD4] hover:bg-[#F8FAFC] focus-visible:ring-[#2F5AA8]/15 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted/40';

type ApprovalCardProps = {
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  processing: boolean;
  requestId: string;
  staffUpdate: string;
  summary: string;
  task: ApprovalTask;
};

function formatDateLabel(value: Date | string | undefined) {
  if (!value) return { date: 'Unknown date', time: '' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: 'Unknown date', time: '' };
  }
  return {
    date: format(parsed, 'MMM d, yyyy'),
    time: format(parsed, 'h:mm a'),
  };
}

function formatRelativeTime(value: Date | string | undefined) {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
}

function getRequesterInitials(name?: string) {
  return (
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'AP'
  );
}

function formatRequestId(task: ApprovalTask) {
  const rawId = String(task.id || (task as { _id?: string })._id || '').trim();
  if (!rawId) return 'ID unavailable';
  return `ID ${rawId.slice(-10).toUpperCase()}`;
}

function formatRequestTypeLabel(value?: string) {
  const normalized = String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return normalized || 'General';
}

function getTaskTimestamp(task: ApprovalTask) {
  const parsed = new Date(task.createdAt ?? task.updatedAt ?? 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ApprovalCard({
  task,
  summary,
  requestId,
  staffUpdate,
  processing,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const submitted = formatDateLabel(task.createdAt);
  const relativeSubmitted = formatRelativeTime(task.createdAt);
  const title = String(task.title || '').replace(/\s+/g, ' ').trim() || 'Untitled request';
  const requestTypeLabel = formatRequestTypeLabel(task.category);
  const requesterLabel = String(task.requesterName || '').trim() || 'Unknown requester';
  const departmentLabel = String(task.requesterDepartment || '').trim() || 'Internal request';
  const staffUpdateLabel =
    staffUpdate || 'No staff update provided for this approval request.';
  const submissionLabel = submitted.time ? `${submitted.date}, ${submitted.time}` : submitted.date;

  return (
    <div
      className={cn(
        approvalSurfaceClass,
        'px-4 py-4 md:px-5',
        'hover:border-[#D0D5DD] dark:hover:border-border'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#2F5AA8] text-[13px] font-semibold text-white">
            {getRequesterInitials(requesterLabel)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3 xl:hidden">
                  <h3 className="line-clamp-2 text-[17px] font-semibold leading-tight text-[#101828] dark:text-foreground">
                    {title}
                  </h3>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium text-[#667085] dark:text-muted-foreground">
                      {relativeSubmitted}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#98A2B3] dark:text-muted-foreground">
                      {submissionLabel}
                    </p>
                  </div>
                </div>

                <h3 className="hidden text-[17px] font-semibold leading-tight text-[#101828] dark:text-foreground xl:block">
                  {title}
                </h3>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#667085] dark:text-muted-foreground">
                  <span className="font-medium text-[#475467] dark:text-foreground/85">
                    {requesterLabel}
                  </span>
                  <span className="text-[#D0D5DD] dark:text-border">&bull;</span>
                  <span>{departmentLabel}</span>
                  <span className="text-[#D0D5DD] dark:text-border">&bull;</span>
                  <span>{requestTypeLabel}</span>
                  <span className="text-[#D0D5DD] dark:text-border">&bull;</span>
                  <span className="font-mono text-[11px]" title={requestId}>
                    {requestId}
                  </span>
                </div>

                <p className="mt-2 line-clamp-1 text-[13px] leading-5 text-[#475467] dark:text-muted-foreground">
                  {summary}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      approvalBadgeBaseClass,
                      'border-[#D7E3F4] bg-[#F6F9FC] text-[#2F5AA8] dark:border-primary/20 dark:bg-primary/10 dark:text-primary'
                    )}
                  >
                    Awaiting approval
                  </span>
                  <span
                    className={cn(
                      approvalBadgeBaseClass,
                      'border-[#E4E7EC] bg-white text-[#344054] dark:border-border dark:bg-muted/30 dark:text-muted-foreground'
                    )}
                  >
                    {requestTypeLabel}
                  </span>
                  <span
                    className={cn(
                      approvalBadgeBaseClass,
                      'border-[#E4E7EC] bg-[#F8FAFC] text-[#475467] dark:border-border dark:bg-muted/35 dark:text-muted-foreground'
                    )}
                  >
                    {departmentLabel}
                  </span>
                </div>

                <div className={cn(approvalInlineInfoClass, 'mt-2')}>
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF4E8] text-[#B54708] dark:bg-[#34281E] dark:text-[#F0C287]">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-[#667085] dark:text-muted-foreground">
                    Latest update
                  </span>
                  <p className="min-w-0 flex-1 truncate">
                    {staffUpdateLabel}
                  </p>
                </div>
              </div>

              <div className="hidden shrink-0 text-right xl:block">
                <p className="text-[11px] font-medium text-[#667085] dark:text-muted-foreground">
                  {relativeSubmitted}
                </p>
                <p className="mt-0.5 text-[11px] text-[#98A2B3] dark:text-muted-foreground">
                  {submissionLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:w-[112px] lg:flex-col lg:items-stretch">
          <button
            type="button"
            onClick={() => onApprove(task.id)}
            disabled={processing}
            className={cn(
              approvalActionBaseClass,
              approvalPrimaryActionClass
            )}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {processing ? 'Processing...' : 'Approve'}
          </button>

          <button
            type="button"
            onClick={() => onReject(task.id)}
            disabled={processing}
            className={cn(
              approvalActionBaseClass,
              approvalRejectActionClass
            )}
          >
            <MinusCircle className="h-4 w-4" />
            Reject
          </button>

          <RouterLink
            to={`/task/${task.id}`}
            state={{ task, focusSection: 'change-history' }}
            className={cn(
              approvalActionBaseClass,
              approvalNeutralActionClass
            )}
          >
            <Eye className="h-4 w-4" />
            Review
          </RouterLink>
        </div>
      </div>
    </div>
  );
}

export default function Approvals() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [tasks, setTasks] = useState<ApprovalTask[]>(API_URL ? [] : mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = API_URL;

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
        if (!response.ok) throw new Error('Failed to load tasks');
        const data = await response.json();
        const hydrated = data.map((task: any) =>
          hydrateTask({ ...task, id: task.id || task._id })
        );
        setTasks(hydrated);
      } catch {
        toast.error('Failed to load approvals');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  const pendingApprovals = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.approvalStatus === 'pending' || resolveAdminReviewStatus(task) === 'pending'
      ),
    [tasks]
  );

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

  const displayedApprovals = useMemo(() => {
    const sorted = [...filteredApprovals];

    if (sortOrder === 'oldest') {
      sorted.sort((a, b) => getTaskTimestamp(a) - getTaskTimestamp(b));
      return sorted;
    }

    if (sortOrder === 'requester') {
      sorted.sort((a, b) =>
        String(a.requesterName || '').localeCompare(String(b.requesterName || ''))
      );
      return sorted;
    }

    sorted.sort((a, b) => getTaskTimestamp(b) - getTaskTimestamp(a));
    return sorted;
  }, [filteredApprovals, sortOrder]);

  const getStaffUpdatePreview = (task: ApprovalTask) => {
    const history = [...(task.changeHistory || [])].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    for (const entry of history) {
      if (entry.userRole !== 'staff') continue;
      if (entry.field === 'approval_status') continue;
      if (entry.field === 'staff_note' && entry.newValue) return entry.newValue;
      if (entry.field === 'description' && entry.newValue) return entry.newValue;
      if (entry.note) return entry.note;
      if (entry.newValue) return entry.newValue;
    }
    return '';
  };

  const getRequestSummary = (task: ApprovalTask) => {
    const title = String(task.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const description = String(task.description || '').replace(/\s+/g, ' ').trim();
    if (!description) return 'No additional request details were provided.';
    if (description.toLowerCase() === title)
      return 'Details were not added beyond the request title.';
    return description;
  };

  const updateApprovalStatus = async (
    taskId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    const oldValue = currentTask?.approvalStatus ?? 'pending';
    const newValue = decision === 'approved' ? 'Approved' : 'Rejected';
    const approvalNote = `Approval ${decision} by ${user?.name || 'Treasurer'}`;

    if (apiUrl) {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            approvalStatus: decision,
            approvedBy: user?.name || '',
            approvalDate: new Date(),
          },
          changes: [
            {
              type: 'status',
              field: 'approval_status',
              oldValue,
              newValue,
              note: approvalNote,
            },
          ],
          userId: user?.id || '',
          userName: user?.name || '',
          userRole: user?.role || '',
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to update approval');
      }
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              approvalStatus: decision,
              approvedBy: user?.name || '',
              approvalDate: new Date(),
              updatedAt: new Date(),
              changeHistory: [
                {
                  id: `ch-${Date.now()}-0`,
                  type: 'status',
                  field: 'approval_status',
                  oldValue,
                  newValue,
                  note: approvalNote,
                  userId: user?.id || '',
                  userName: user?.name || 'Treasurer',
                  userRole: user?.role || 'treasurer',
                  createdAt: new Date(),
                },
                ...(task.changeHistory || []),
              ],
            }
          : task
      )
    );
  };

  const handleApprove = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await updateApprovalStatus(taskId, 'approved');
      toast.success('Request approved', { description: 'The requester has been notified.' });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to approve request';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await updateApprovalStatus(taskId, 'rejected');
      toast.success('Request rejected', { description: 'The requester has been notified.' });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to reject request';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-full py-6 md:py-8">
        <div className="mx-auto w-full max-w-[1120px] px-4 md:px-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 border-b border-[#EEF2F7] pb-5 dark:border-border sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[24px] font-semibold tracking-tight text-[#182033] dark:text-foreground sm:text-[28px]">
                  {filteredApprovals.length.toLocaleString()} approvals
                </p>
                <p className="mt-1 text-[13px] text-slate-500 dark:text-muted-foreground">
                  Pending staff requests awaiting treasurer review.
                </p>
              </div>

              <label
                className={cn(
                  approvalFieldClass,
                  'inline-flex items-center gap-2 self-start px-3 py-2 text-[13px] font-medium text-[#314570] dark:text-muted-foreground'
                )}
              >
                <ArrowUpDown className="h-4 w-4" />
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  className="bg-transparent outline-none"
                  aria-label="Sort approvals"
                >
                  <option value="recent">Most recent</option>
                  <option value="oldest">Oldest</option>
                  <option value="requester">Requester A-Z</option>
                </select>
              </label>
            </div>

            <div className={cn(approvalSurfaceClass, 'px-4 py-3 md:px-5')}>
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    approvalFieldClass,
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center text-[#3555A4] dark:text-primary'
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="pt-0.5 text-[12.5px] leading-6 text-[#52627F] dark:text-muted-foreground">
                  <span className="font-semibold text-[#1F315C] dark:text-foreground">
                    Approval guidelines.
                  </span>{' '}
                  {DESIGN_GOVERNANCE_NOTICE_POLICY}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className={cn(approvalSurfaceClass, 'flex flex-col items-center justify-center gap-3 px-6 py-20 text-center')}>
                <div
                  className={cn(
                    approvalFieldClass,
                    'flex h-14 w-14 items-center justify-center text-[#3555A4] dark:text-primary'
                  )}
                >
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <p className="text-[14px] text-[#52627F] dark:text-muted-foreground">
                  Loading approvals...
                </p>
              </div>
            ) : displayedApprovals.length > 0 ? (
              <div className="space-y-2.5">
                {displayedApprovals.map((task) => (
                  <ApprovalCard
                    key={task.id}
                    task={task}
                    summary={getRequestSummary(task)}
                    requestId={formatRequestId(task)}
                    staffUpdate={getStaffUpdatePreview(task)}
                    processing={processingId === task.id}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            ) : (
              <div className={cn(approvalSurfaceClass, 'flex flex-col items-center justify-center gap-4 px-6 py-20 text-center')}>
                <div
                  className={cn(
                    approvalFieldClass,
                    'flex h-14 w-14 items-center justify-center text-[#3555A4] dark:text-primary'
                  )}
                >
                  <CheckSquare2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[18px] font-semibold text-[#182033] dark:text-foreground">
                    All caught up
                  </p>
                  <p className="mt-1 text-[14px] text-[#52627F] dark:text-muted-foreground">
                    No pending approvals are waiting for review right now.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
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
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck,
  Info,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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

const REJECTION_TEMPLATES: Array<{
  group: string;
  items: Array<{ label: string; text: string }>;
}> = [
  {
    group: 'Request Information',
    items: [
      {
        label: 'Incomplete Brief',
        text: 'Required request details are missing. Kindly update the brief with complete information and resubmit.',
      },
      {
        label: 'Missing Content',
        text: 'Required content, references, or supporting files were not attached. Please upload the necessary materials and submit again.',
      },
    ],
  },
  {
    group: 'Planning & Capacity',
    items: [
      {
        label: 'Capacity Constraint',
        text: 'Current production bandwidth is allocated to higher-priority deliverables. Kindly resubmit with revised priority or timeline.',
      },
      {
        label: 'Deadline Issue',
        text: 'The requested deadline cannot be accommodated within current workload and production timelines. Please revise the schedule and resubmit.',
      },
    ],
  },
  {
    group: 'Workflow & Governance',
    items: [
      {
        label: 'Duplicate Request',
        text: 'A similar request has already been submitted. Kindly refer to the existing request to avoid duplication.',
      },
      {
        label: 'Approval Required',
        text: 'This request requires prior approval before execution. Kindly obtain the necessary approval and resubmit.',
      },
    ],
  },
  {
    group: 'Scope & Eligibility',
    items: [
      {
        label: 'Outside Scope',
        text: 'The request falls outside the supported design scope or current workflow process.',
      },
      {
        label: 'Insufficient Resources',
        text: 'Additional inputs, assets, or resources are required to proceed with this request.',
      },
    ],
  },
];

const APPROVALS_PAGE_SIZE = 8;

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
  const [rejectTaskId, setRejectTaskId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRejectionLabels, setSelectedRejectionLabels] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'most_changes'>('newest');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
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

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    pendingApprovals.forEach((task) => {
      if (task.category) set.add(String(task.category));
    });
    return Array.from(set).sort();
  }, [pendingApprovals]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    pendingApprovals.forEach((task) => {
      const dept = String(task.requesterDepartment || '').trim();
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [pendingApprovals]);

  const filteredApprovals = useMemo(() => {
    const combinedQuery = `${query || ''} ${filterQuery || ''}`.trim();
    const filtered = pendingApprovals.filter((task) => {
      if (
        !matchesSearch(combinedQuery, [
          task.title,
          task.description,
          task.requesterName,
          task.requesterDepartment,
          task.category,
          task.status,
        ])
      ) {
        return false;
      }
      if (filterCategory !== 'all' && String(task.category) !== filterCategory) return false;
      if (filterUrgency !== 'all' && String(task.urgency) !== filterUrgency) return false;
      if (
        filterDepartment !== 'all' &&
        String(task.requesterDepartment || '').trim() !== filterDepartment
      )
        return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortOrder === 'most_changes') {
        return (b.changeCount || 0) - (a.changeCount || 0);
      }
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
    });
    return sorted;
  }, [pendingApprovals, query, filterQuery, filterCategory, filterUrgency, filterDepartment, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, filterCategory, filterUrgency, filterDepartment, sortOrder, query]);

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / APPROVALS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedApprovals = useMemo(
    () =>
      filteredApprovals.slice(
        (safePage - 1) * APPROVALS_PAGE_SIZE,
        safePage * APPROVALS_PAGE_SIZE
      ),
    [filteredApprovals, safePage]
  );
  const hasActiveFilters =
    Boolean(filterQuery.trim()) ||
    filterCategory !== 'all' ||
    filterUrgency !== 'all' ||
    filterDepartment !== 'all' ||
    sortOrder !== 'newest';
  const resetFilters = () => {
    setFilterQuery('');
    setFilterCategory('all');
    setFilterUrgency('all');
    setFilterDepartment('all');
    setSortOrder('newest');
  };
  const requestChangesTask = useMemo(
    () => tasks.find((task) => task.id === requestChangesTaskId) ?? null,
    [requestChangesTaskId, tasks]
  );
  const isRequestChangesSubmitting =
    Boolean(requestChangesTaskId) && processingId === requestChangesTaskId;
  const rejectTask = useMemo(
    () => tasks.find((task) => task.id === rejectTaskId) ?? null,
    [rejectTaskId, tasks]
  );
  const isRejectSubmitting =
    Boolean(rejectTaskId) && processingId === rejectTaskId;

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

  const resetRejectModal = () => {
    setRejectTaskId(null);
    setRejectReason('');
    setSelectedRejectionLabels([]);
  };

  const handleRejectModalChange = (open: boolean) => {
    if (!open) {
      if (isRejectSubmitting) return;
      resetRejectModal();
    }
  };

  const openRejectModal = (task: (typeof tasks)[number]) => {
    setRejectTaskId(task.id);
    setRejectReason('');
    setSelectedRejectionLabels([]);
  };

  const buildReasonFromLabels = (labels: string[]) => {
    const allItems = REJECTION_TEMPLATES.flatMap((g) => g.items);
    return labels
      .map((label) => allItems.find((item) => item.label === label)?.text)
      .filter((text): text is string => Boolean(text))
      .join('\n\n');
  };

  const toggleRejectionTemplate = (label: string) => {
    setSelectedRejectionLabels((prev) => {
      const isSelected = prev.includes(label);
      const next = isSelected ? prev.filter((value) => value !== label) : [...prev, label];
      setRejectReason(buildReasonFromLabels(next));
      return next;
    });
  };

  const handleRejectReasonChange = (value: string) => {
    setRejectReason(value);
    if (selectedRejectionLabels.length === 0) return;
    const allItems = REJECTION_TEMPLATES.flatMap((g) => g.items);
    const remaining = selectedRejectionLabels.filter((label) => {
      const tpl = allItems.find((item) => item.label === label);
      return tpl ? value.includes(tpl.text) : false;
    });
    if (remaining.length !== selectedRejectionLabels.length) {
      setSelectedRejectionLabels(remaining);
    }
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
    const trimmedFeedback = feedbackNote?.trim() || '';
    const reviewNote =
      isAdminReviewMode && decision === 'needs_info' && trimmedFeedback
        ? formatAdminRequestedUpdatesNote(trimmedFeedback)
        : !isAdminReviewMode && decision === 'rejected' && trimmedFeedback
          ? `Approval rejected by ${user?.name || actorLabel}: ${trimmedFeedback}`
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
      const actorLabel = isAdminReviewMode ? 'Admin' : 'Design Lead';
      const toastTitle =
        decision === 'approved'
          ? isAdminReviewMode
            ? 'Intake approved'
            : 'Approved by Design Lead'
          : decision === 'needs_info'
            ? 'Changes requested from staff'
            : isAdminReviewMode
              ? 'Intake rejected'
              : 'Rejected by Design Lead';
      const toastDescription =
        decision === 'needs_info'
          ? 'The requested updates were saved with the admin review.'
          : decision === 'approved'
            ? isAdminReviewMode
              ? 'Brief moved to the design lead queue. Staff has been notified.'
              : 'Modification approved and staff has been notified.'
            : `Staff has been notified of the ${actorLabel.toLowerCase()} decision.`;
      toast.success(toastTitle, { description: toastDescription });
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

  const handleRejectSubmit = async () => {
    if (!rejectTaskId) return;
    const feedbackNote = rejectReason.trim();
    if (!feedbackNote) {
      toast.message('Please provide a reason for rejecting this request.');
      return;
    }

    const applied = await submitDecision(rejectTaskId, 'rejected', { feedbackNote });
    if (applied) {
      resetRejectModal();
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

        <div className="rounded-lg border border-[#E5ECFA] bg-white px-4 py-3 animate-slide-up dark:border-[#2F4F8F]/45 dark:bg-card">
          <div className="flex items-start gap-2.5">
            <Info className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#3657C9] dark:text-[#8FA7E6]" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[12.5px] font-semibold leading-tight tracking-[-0.005em] text-[#1E2A5A] dark:text-slate-100">
                Approval Guidelines
              </h3>
              <ul className="mt-1.5 space-y-1 text-[12px] leading-5 text-[#5B6E95] dark:text-[#A0B4DE]">
                <li className="flex gap-2">
                  <span className="select-none text-[#C9D7FF] dark:text-[#4868A7]">•</span>
                  <span>
                    {isAdminReviewMode
                      ? 'Review incoming requests for completeness, clarity, files, and realistic deadlines before routing them forward.'
                      : 'Review incoming modification requests before approval to ensure alignment with the approved brief.'}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="select-none text-[#C9D7FF] dark:text-[#4868A7]">•</span>
                  <span>
                    Approved designs must remain aligned with official design guidelines and standardized language. Additional revisions require formal Treasurer review and authorization.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9AA7BF] dark:text-[#7E8DAB]" />
            <Input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Search by title, requester, department..."
              className="h-8 rounded-md border border-[#E5ECFA] bg-white pl-8 pr-2.5 text-[12.5px] text-[#1E2A5A] placeholder:text-[#9AA7BF] shadow-none focus-visible:border-[#4A68D8] focus-visible:ring-1 focus-visible:ring-[#C9D7FF] dark:border-[#2F4F8F]/45 dark:bg-card dark:text-slate-100 dark:placeholder:text-[#7E8DAB]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-[136px] rounded-md border border-[#E5ECFA] bg-white px-2.5 text-[12px] text-[#3D4A6E] shadow-none focus:ring-1 focus:ring-[#C9D7FF] dark:border-[#2F4F8F]/45 dark:bg-card dark:text-slate-200">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatCategoryLabel(option) || option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUrgency} onValueChange={setFilterUrgency}>
              <SelectTrigger className="h-8 w-[124px] rounded-md border border-[#E5ECFA] bg-white px-2.5 text-[12px] text-[#3D4A6E] shadow-none focus:ring-1 focus:ring-[#C9D7FF] dark:border-[#2F4F8F]/45 dark:bg-card dark:text-slate-200">
                <SelectValue placeholder="All urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgency</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {departmentOptions.length > 0 ? (
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="h-8 w-[148px] rounded-md border border-[#E5ECFA] bg-white px-2.5 text-[12px] text-[#3D4A6E] shadow-none focus:ring-1 focus:ring-[#C9D7FF] dark:border-[#2F4F8F]/45 dark:bg-card dark:text-slate-200">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={sortOrder}
              onValueChange={(value) => setSortOrder(value as typeof sortOrder)}
            >
              <SelectTrigger className="h-8 w-[132px] rounded-md border border-[#E5ECFA] bg-white px-2.5 text-[12px] text-[#3D4A6E] shadow-none focus:ring-1 focus:ring-[#C9D7FF] dark:border-[#2F4F8F]/45 dark:bg-card dark:text-slate-200">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="most_changes">Most changes</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 rounded-md px-2.5 text-[12px] font-medium text-[#5B6E95] hover:bg-[#F5F8FF] hover:text-[#1E2A5A] dark:text-[#A0B4DE] dark:hover:bg-[#10234F]/60"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredApprovals.length} pending {isAdminReviewMode ? 'review' : 'approval'}
            {filteredApprovals.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' · filtered' : ''}
          </p>
          {filteredApprovals.length > APPROVALS_PAGE_SIZE ? (
            <p className="text-[12px] text-muted-foreground">
              Showing {(safePage - 1) * APPROVALS_PAGE_SIZE + 1}–
              {Math.min(safePage * APPROVALS_PAGE_SIZE, filteredApprovals.length)} of{' '}
              {filteredApprovals.length}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-muted-foreground">Loading approvals...</p>
          </div>
        ) : filteredApprovals.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 items-stretch">
            {paginatedApprovals.map((task, index) => {
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
                  className="group relative flex h-full flex-col gap-3 rounded-xl border border-[#E5ECFA] bg-white p-4 [transition:transform_220ms_cubic-bezier(0.22,0.61,0.36,1),border-color_180ms_ease-out] will-change-transform animate-slide-up hover:-translate-y-[2px] hover:border-[#C9D7FF] dark:border-[#2F4F8F]/40 dark:bg-card dark:hover:border-[#5D7EC0]/55"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {/* TOP ROW: status / type tag · submitted */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 font-medium text-[#5B6E95] dark:text-[#A0B4DE]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#F5A623]" />
                        {isAdminReviewMode ? 'Awaiting Admin Review' : 'Awaiting Approval'}
                      </span>
                      <span className="text-[#CAD7EF] dark:text-[#4868A7]">·</span>
                      <span className="text-[#5B6E95] dark:text-[#A0B4DE]">{categoryLabel}</span>
                      {task.urgency === 'urgent' ? (
                        <>
                          <span className="text-[#CAD7EF] dark:text-[#4868A7]">·</span>
                          <span className="font-medium text-[#C5443A]">Urgent</span>
                        </>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[11px] text-[#7E8DAB] dark:text-[#8FA7E6]/80">
                      {format(task.createdAt, 'MMM d · h:mm a')}
                    </p>
                  </div>

                  {/* IDENTITY ROW: avatar · title · stage */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[12px] font-semibold text-[#3657C9] dark:bg-[#10234F]/70 dark:text-[#8FA7E6]">
                      {requesterInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 className="truncate text-[15px] font-semibold leading-tight text-[#1E2A5A] dark:text-slate-100">
                          {headline}
                        </h3>
                        <span className="text-[11px] font-mono text-[#8092B2] dark:text-[#AFC2EA]">
                          {String(task.id || '').trim()
                            ? String(task.id).slice(-6).toUpperCase()
                            : 'DRAFT'}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-5 text-[#6E83A8] dark:text-[#A0B4DE]">
                        {summary}
                      </p>
                    </div>
                    <span className="shrink-0 self-start text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#7E8DAB] dark:text-[#AFC2EA]">
                      {isAdminReviewMode ? 'Intake' : 'Lead'}
                    </span>
                  </div>

                  {/* META ROW: subtle inline meta */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[#7E8DAB] dark:text-[#8FA7E6]/85">
                    <span className="text-[#5B6E95] dark:text-[#A0B4DE]">
                      {task.requesterName || 'Unknown requester'}
                    </span>
                    <span className="text-[#CAD7EF] dark:text-[#4868A7]">·</span>
                    <span>{task.requesterDepartment || 'No department'}</span>
                    <span className="text-[#CAD7EF] dark:text-[#4868A7]">·</span>
                    <span>
                      {task.changeCount} change{task.changeCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* STAFF UPDATE PREVIEW */}
                  {staffPreview ? (
                    <div className="rounded-md bg-[#F8FBFF] px-3 py-2 dark:bg-[#0F1D39]/50">
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7E8DAB] dark:text-[#AFC2EA]">
                        Staff update
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-5 text-[#3D4A6E] dark:text-slate-300">
                        {staffPreview}
                      </p>
                    </div>
                  ) : null}

                  {/* FOOTER ACTIONS */}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1.5 rounded-md px-3 bg-[linear-gradient(135deg,#4A68D8,#3352BE_55%,#2B47AE)] text-[12px] font-semibold text-white shadow-none transition-colors hover:brightness-[1.04] active:translate-y-[1px] dark:bg-[linear-gradient(135deg,#4E6FE0,#3E5FD6_55%,#3150C8)]"
                        onClick={() => handleDecision(task.id, 'approved')}
                        disabled={processingId === task.id}
                      >
                        {processingId === task.id ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-md px-2.5 text-[12px] font-medium text-[#5B6E95] hover:bg-[#F5F8FF] hover:text-[#1E2A5A] dark:text-[#A0B4DE] dark:hover:bg-[#10234F]/60 dark:hover:text-slate-100"
                        onClick={() =>
                          isDesignLeadReviewMode
                            ? openRejectModal(task)
                            : handleDecision(task.id, 'rejected')
                        }
                        disabled={processingId === task.id}
                      >
                        Reject
                      </Button>
                      {isAdminReviewMode ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-md px-2.5 text-[12px] font-medium text-[#5B6E95] hover:bg-[#F5F8FF] hover:text-[#1E2A5A] dark:text-[#A0B4DE] dark:hover:bg-[#10234F]/60 dark:hover:text-slate-100"
                          onClick={() => openRequestChangesModal(task)}
                          disabled={processingId === task.id}
                        >
                          Request Changes
                        </Button>
                      ) : null}
                      {isAdminReviewMode ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-md px-2.5 text-[12px] font-medium text-[#5B6E95] hover:bg-[#F5F8FF] hover:text-[#1E2A5A] dark:text-[#A0B4DE] dark:hover:bg-[#10234F]/60 dark:hover:text-slate-100"
                          onClick={() => openTaskBriefEditor(task)}
                          disabled={processingId === task.id}
                        >
                          Edit Brief
                        </Button>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-[#3657C9] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] dark:text-[#8FA7E6] dark:hover:bg-[#17356B]/60"
                    >
                      <Link
                        to={`/task/${task.id}`}
                        state={{ task, focusSection: 'change-history' }}
                        className="inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
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
            <h3 className="font-medium text-foreground">
              {hasActiveFilters ? 'No matches' : 'All caught up!'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters
                ? 'No requests match the current filters.'
                : `No pending ${isAdminReviewMode ? 'reviews' : 'approvals'} at the moment`}
            </p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 h-9 rounded-lg px-3 text-[12.5px]"
                onClick={resetFilters}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#D9E6FF] bg-white px-3 py-2 dark:border-[#2F4F8F]/45 dark:bg-card">
            <p className="text-[12px] text-muted-foreground">
              Page {safePage} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="h-8 gap-1 rounded-lg border-[#D9E6FF] bg-white px-2 text-[12px] shadow-none hover:bg-[#EEF4FF] disabled:opacity-50 dark:border-[#2F4F8F]/45 dark:bg-card"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  type="button"
                  variant={page === safePage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'h-8 min-w-[32px] rounded-lg px-2 text-[12px] font-medium shadow-none',
                    page === safePage
                      ? 'bg-[linear-gradient(135deg,#4A68D8,#3352BE_55%,#2B47AE)] text-white hover:brightness-[1.05] dark:bg-[linear-gradient(135deg,#4E6FE0,#3E5FD6_55%,#3150C8)]'
                      : 'border-[#D9E6FF] bg-white hover:bg-[#EEF4FF] dark:border-[#2F4F8F]/45 dark:bg-card'
                  )}
                >
                  {page}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="h-8 gap-1 rounded-lg border-[#D9E6FF] bg-white px-2 text-[12px] shadow-none hover:bg-[#EEF4FF] disabled:opacity-50 dark:border-[#2F4F8F]/45 dark:bg-card"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
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

      <Dialog open={Boolean(rejectTask)} onOpenChange={handleRejectModalChange}>
        <DialogContent
          className="grid max-h-[88vh] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-xl border border-[#E5ECFA] bg-white p-0 shadow-[0_18px_48px_-24px_rgba(31,53,114,0.18)] sm:max-w-[560px] dark:border-[#2F4F8F]/45 dark:bg-card"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !(event.metaKey || event.ctrlKey)) {
              const target = event.target as HTMLElement | null;
              if (target?.tagName !== 'TEXTAREA') {
                event.preventDefault();
              }
            }
          }}
        >
          <DialogHeader className="space-y-1 px-6 pb-4 pt-5 text-left sm:text-left">
            <DialogTitle className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[#1E2A5A] dark:text-slate-100">
              Reject Request
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-5 text-[#6E83A8] dark:text-[#A0B4DE]">
              Select a reason or enter a custom explanation visible to the requester.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto px-6 pb-5 space-y-5">
            <div className="space-y-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7E8DAB] dark:text-[#AFC2EA]">
                Quick Select Reasons
              </p>
              <div className="space-y-3">
                {REJECTION_TEMPLATES.map((group) => (
                  <div key={group.group} className="space-y-1.5">
                    <p className="text-[11px] font-medium text-[#5B6E95] dark:text-[#A0B4DE]">
                      {group.group}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {group.items.map((item) => {
                        const isSelected = selectedRejectionLabels.includes(item.label);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            onClick={() => toggleRejectionTemplate(item.label)}
                            disabled={isRejectSubmitting}
                            className={cn(
                              'flex h-9 items-center gap-2 rounded-md border px-3 text-left text-[12.5px] font-medium transition-colors disabled:opacity-60',
                              isSelected
                                ? 'border-[#4A68D8] bg-[#EEF4FF] text-[#1E2A5A] dark:border-[#5D7EC0] dark:bg-[#17356B]/70 dark:text-[#DCE7FF]'
                                : 'border-[#E5ECFA] bg-white text-[#5B6E95] hover:border-[#C9D7FF] hover:bg-[#F5F8FF] hover:text-[#1E2A5A] dark:border-[#2F4F8F]/45 dark:bg-card dark:text-[#A0B4DE] dark:hover:bg-[#10234F]/60 dark:hover:text-slate-100'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                                isSelected
                                  ? 'border-[#4A68D8] bg-[#4A68D8] text-white dark:border-[#5D7EC0] dark:bg-[#5D7EC0]'
                                  : 'border-[#C9D7FF] bg-white dark:border-[#2F4F8F]/55 dark:bg-transparent'
                              )}
                              aria-hidden="true"
                            >
                              {isSelected ? (
                                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2.5 6.2L4.7 8.4L9.5 3.6" />
                                </svg>
                              ) : null}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="reject-reason-note"
                className="text-[13px] font-medium leading-5 text-[#1E2A5A] dark:text-slate-100"
              >
                Rejection Reason
              </Label>
              <p className="text-[11.5px] leading-4 text-[#7E8DAB] dark:text-[#A0B4DE]">
                {selectedRejectionLabels.length === 0
                  ? 'Type a custom message or pick one or more reasons above.'
                  : selectedRejectionLabels.length === 1
                    ? `Using "${selectedRejectionLabels[0]}" — edit the text below if needed.`
                    : `${selectedRejectionLabels.length} reasons selected — edit or combine the text below.`}
              </p>
              <Textarea
                id="reject-reason-note"
                value={rejectReason}
                onChange={(event) => handleRejectReasonChange(event.target.value)}
                placeholder="Select a reason above or type a custom rejection note."
                className="min-h-[130px] resize-y rounded-md border-[#E5ECFA] px-3 py-2.5 text-[13.5px] leading-6 text-[#1E2A5A] placeholder:text-[#9AA7BF] shadow-none focus-visible:border-[#4A68D8] focus-visible:ring-1 focus-visible:ring-[#C9D7FF] dark:border-[#2F4F8F]/45 dark:text-slate-100"
                disabled={isRejectSubmitting}
                maxLength={500}
              />
              <p className="text-[11.5px] leading-4 text-[#7E8DAB] dark:text-[#A0B4DE]">
                Visible to the requester.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-[#E5ECFA] bg-white px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#2F4F8F]/45 dark:bg-card">
            <p className="text-[11.5px] text-[#7E8DAB] dark:text-[#A0B4DE]">
              {rejectReason.trim().length}/500
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleRejectModalChange(false)}
                disabled={isRejectSubmitting}
                className="h-9 rounded-md px-3.5 text-[13px] font-medium text-[#5B6E95] hover:bg-[#F5F8FF] hover:text-[#1E2A5A] dark:text-[#A0B4DE] dark:hover:bg-[#10234F]/60 dark:hover:text-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleRejectSubmit()}
                disabled={isRejectSubmitting || !rejectReason.trim()}
                className="h-9 rounded-md px-3.5 bg-[linear-gradient(135deg,#4A68D8,#3352BE_55%,#2B47AE)] text-[13px] font-semibold text-white shadow-none transition-colors hover:brightness-[1.04] active:translate-y-[1px] dark:bg-[linear-gradient(135deg,#4E6FE0,#3E5FD6_55%,#3150C8)]"
              >
                {isRejectSubmitting ? 'Rejecting...' : 'Reject Request'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

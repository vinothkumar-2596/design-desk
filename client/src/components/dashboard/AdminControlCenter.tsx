import { useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { resolveAdminReviewedAt, resolveAdminReviewStatus } from '@/lib/roleRules';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

type AdminControlCenterProps = { tasks: Task[] };
type QueueKey = 'new_requests' | 'returned_to_staff' | 'ready_to_route';
type SortKey = 'latest' | 'oldest' | 'requester';
type QueueCategoryFilter = 'all' | Task['category'];
type QueueUrgencyFilter = 'all' | Task['urgency'];
type QueueActionFilter = 'all' | 'admin_next' | 'staff_next';

type QueueMeta = {
  key: QueueKey;
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
  icon: LucideIcon;
  iconClassName: string;
};

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  relativeTime: string;
  href: string;
  icon: LucideIcon;
  iconClassName: string;
};

const panelClass =
  'relative overflow-hidden rounded-[24px] border border-[#D5E2FF]/55 bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl ring-1 ring-[#E3ECFF]/45 shadow-none dark:border-[#2F4F8F]/45 dark:ring-[#3C5FA0]/20 dark:bg-card dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent';
const sectionClass =
  'relative overflow-hidden rounded-[22px] border border-[#D5E2FF]/50 bg-gradient-to-br from-white/82 via-white/68 to-[#EDF4FF]/70 supports-[backdrop-filter]:from-white/62 supports-[backdrop-filter]:via-white/50 supports-[backdrop-filter]:to-[#EDF4FF]/58 backdrop-blur-2xl ring-1 ring-white/55 shadow-none dark:border-[#2F4F8F]/40 dark:ring-[#3C5FA0]/15 dark:bg-card/95 dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent';
const badgeBase =
  'inline-flex items-center rounded-lg border px-2 text-[11px] font-medium';
const glassFieldClass =
  'border-[#D9E6FF] bg-white/72 backdrop-blur-xl shadow-none focus-visible:ring-2 focus-visible:ring-[#C7D8FF] dark:border-border dark:bg-card/80';
const recentActivityVisibleCount = 3;
const queueSnapshotVisibleCount = 6;
const queueUrgencyOptions: Array<{
  value: Exclude<QueueUrgencyFilter, 'all'>;
  label: string;
}> = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'normal', label: 'Normal' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'low', label: 'Low' },
];

const queueMetaMap: Record<QueueKey, QueueMeta> = {
  new_requests: {
    key: 'new_requests',
    title: 'New Staff Requests',
    subtitle: 'Requests submitted by staff and waiting for admin intake review',
    href: '/approvals',
    actionLabel: 'Open approvals',
    icon: Inbox,
    iconClassName:
      'border-[#D6E2FF] bg-[#EEF4FF] text-[#3A63D7] dark:border-[#334A7A] dark:bg-[#1A294D] dark:text-[#A8BEFF]',
  },
  returned_to_staff: {
    key: 'returned_to_staff',
    title: 'Returned to Staff',
    subtitle: 'Requests sent back to staff and waiting for updated details',
    href: '/approvals',
    actionLabel: 'Review updates',
    icon: AlertTriangle,
    iconClassName:
      'border-[#F1DEC6] bg-[#FFF6EB] text-[#AD6A28] dark:border-[#6B563F] dark:bg-[#34281E] dark:text-[#F0C287]',
  },
  ready_to_route: {
    key: 'ready_to_route',
    title: 'Ready to Route',
    subtitle: 'Approved requests that are ready to move into design assignment',
    href: '/tasks',
    actionLabel: 'Open routing',
    icon: Send,
    iconClassName:
      'border-[#D8E9DD] bg-[#EFF9F1] text-[#2E7A4F] dark:border-[#44624F] dark:bg-[#1D3126] dark:text-[#9FD2B0]',
  },
};

const parseDate = (value?: Date | string | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTaskTime = (value?: Date | string | null) => parseDate(value)?.getTime() || 0;
const formatTaskDate = (value?: Date | string | null) =>
  parseDate(value) ? format(parseDate(value) as Date, 'dd MMM') : '--';
const formatRelativeDate = (value?: Date | string | null) =>
  parseDate(value)
    ? formatDistanceToNowStrict(parseDate(value) as Date, { addSuffix: true })
    : 'No activity';
const formatCount = (value: number) => value.toLocaleString();
const formatCategory = (value?: string | null) =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const formatTaskId = (task: Task) => {
  const value = String(task.id || task._id || '').trim();
  return value ? `Task ${value.slice(-6).toUpperCase()}` : 'No ID';
};

const hasAssignedDesigner = (task: Task) =>
  Boolean(String(task.assignedToName || task.assignedToId || task.assignedTo || '').trim());

const hasStaffFollowUp = (task: Task) => {
  const checkpoint = getTaskTime(resolveAdminReviewedAt(task) || task.updatedAt || task.createdAt);
  const submittedUpdate =
    task.adminReviewResponseStatus === 'submitted' &&
    getTaskTime(task.adminReviewResponseSubmittedAt) > checkpoint;
  const recentStaffComment = (task.comments || []).some(
    (comment) => comment.userRole === 'staff' && getTaskTime(comment.createdAt) > checkpoint
  );
  const recentStaffChange = (task.changeHistory || []).some(
    (entry) => entry.userRole === 'staff' && getTaskTime(entry.createdAt) > checkpoint
  );

  return submittedUpdate || recentStaffComment || recentStaffChange;
};

const isReadyToRouteTask = (task: Task) =>
  resolveAdminReviewStatus(task) === 'approved' &&
  !hasAssignedDesigner(task) &&
  task.status === 'pending' &&
  task.deadlineApprovalStatus !== 'pending';

const matchesSearch = (task: Task, term: string) => {
  const query = term.trim().toLowerCase();
  if (!query) return true;

  return [
    task.title,
    task.description,
    task.requesterName,
    task.requesterDepartment,
    task.requesterEmail,
    formatCategory(task.category),
    formatTaskId(task),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
};

const sortTasks = (tasks: Task[], sortKey: SortKey) => {
  const source = [...tasks];
  if (sortKey === 'oldest') {
    return source.sort(
      (left, right) =>
        getTaskTime(left.updatedAt || left.createdAt) - getTaskTime(right.updatedAt || right.createdAt)
    );
  }
  if (sortKey === 'requester') {
    return source.sort((left, right) =>
      String(left.requesterName || '').localeCompare(String(right.requesterName || ''))
    );
  }
  return source.sort(
    (left, right) =>
      getTaskTime(right.updatedAt || right.createdAt) - getTaskTime(left.updatedAt || left.createdAt)
  );
};

const getRequesterMeta = (task: Task) =>
  task.requesterDepartment || task.requesterEmail || formatCategory(task.category) || 'Requester';

const getNextActionKey = (
  queueKey: QueueKey,
  task: Task
): Exclude<QueueActionFilter, 'all'> =>
  queueKey === 'returned_to_staff' && !hasStaffFollowUp(task) ? 'staff_next' : 'admin_next';

const getNextAction = (queueKey: QueueKey, task: Task) => {
  const nextActionKey = getNextActionKey(queueKey, task);

  if (queueKey === 'new_requests') {
    return {
      label: 'Admin next',
      detail: 'Review the request and decide whether it can move forward.',
      className:
        'border-[#D6E2FF] bg-[#EEF4FF] text-[#31519B] dark:border-[#334A7A] dark:bg-[#1A294D] dark:text-[#B6C7FF]',
    };
  }
  if (queueKey === 'returned_to_staff') {
    return nextActionKey === 'admin_next'
      ? {
          label: 'Admin next',
          detail: 'Staff has responded. Review the updated brief or files.',
          className:
            'border-[#D6E2FF] bg-[#EEF4FF] text-[#31519B] dark:border-[#334A7A] dark:bg-[#1A294D] dark:text-[#B6C7FF]',
        }
      : {
          label: 'Staff next',
          detail: 'Waiting for the requested brief, files, or corrections.',
          className:
            'border-[#F1DEC6] bg-[#FFF6EB] text-[#8C5C20] dark:border-[#6B563F] dark:bg-[#34281E] dark:text-[#F0C287]',
        };
  }
  return {
    label: 'Admin next',
    detail: 'Assign this approved request into the design workflow.',
    className:
      'border-[#D8E9DD] bg-[#EFF9F1] text-[#2F6D49] dark:border-[#44624F] dark:bg-[#1D3126] dark:text-[#9FD2B0]',
  };
};

const buildActivityItem = (task: Task): ActivityItem => {
  const reviewStatus = resolveAdminReviewStatus(task);

  if (reviewStatus === 'pending') {
    return {
      id: `activity-${task.id}`,
      title: task.title,
      subtitle: `New request from ${task.requesterName || 'staff'} awaiting intake review`,
      relativeTime: formatRelativeDate(task.createdAt),
      href: `/task/${task.id}`,
      icon: Inbox,
      iconClassName: queueMetaMap.new_requests.iconClassName,
    };
  }
  if (reviewStatus === 'needs_info') {
    return {
      id: `activity-${task.id}`,
      title: task.title,
      subtitle: hasStaffFollowUp(task)
        ? 'Staff responded and the request is ready for admin review'
        : 'Waiting for staff to send the requested update',
      relativeTime: formatRelativeDate(task.updatedAt || task.createdAt),
      href: `/task/${task.id}`,
      icon: AlertTriangle,
      iconClassName: queueMetaMap.returned_to_staff.iconClassName,
    };
  }
  return {
    id: `activity-${task.id}`,
    title: task.title,
    subtitle: 'Approved request is ready to be assigned into design',
    relativeTime: formatRelativeDate(task.updatedAt || task.createdAt),
    href: `/task/${task.id}`,
    icon: Send,
    iconClassName: queueMetaMap.ready_to_route.iconClassName,
  };
};

export function AdminControlCenter({ tasks }: AdminControlCenterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [activeQueue, setActiveQueue] = useState<QueueKey>('new_requests');
  const [queueCategoryFilter, setQueueCategoryFilter] = useState<QueueCategoryFilter>('all');
  const [queueUrgencyFilter, setQueueUrgencyFilter] = useState<QueueUrgencyFilter>('all');
  const [queueActionFilter, setQueueActionFilter] = useState<QueueActionFilter>('all');

  const queueData = useMemo(() => {
    const newRequests = tasks.filter((task) => resolveAdminReviewStatus(task) === 'pending');
    const returnedToStaff = tasks.filter((task) => resolveAdminReviewStatus(task) === 'needs_info');
    const readyToRoute = tasks.filter(isReadyToRouteTask);

    return {
      new_requests: sortTasks(newRequests, 'latest'),
      returned_to_staff: sortTasks(returnedToStaff, 'latest'),
      ready_to_route: sortTasks(readyToRoute, 'latest'),
    };
  }, [tasks]);

  const activeQueueMeta = queueMetaMap[activeQueue];
  const activeQueueSourceTasks = queueData[activeQueue];
  const queueFilterSource = useMemo(
    () => [...queueData.new_requests, ...queueData.returned_to_staff, ...queueData.ready_to_route],
    [queueData]
  );
  const queueCategoryOptions = useMemo(
    () =>
      Array.from(new Set(queueFilterSource.map((task) => task.category)))
        .filter(Boolean)
        .sort((left, right) => formatCategory(left).localeCompare(formatCategory(right))),
    [queueFilterSource]
  );
  const activeQueueTasks = useMemo(() => {
    const filtered = activeQueueSourceTasks.filter(
      (task) =>
        matchesSearch(task, searchTerm) &&
        (queueCategoryFilter === 'all' || task.category === queueCategoryFilter) &&
        (queueUrgencyFilter === 'all' || task.urgency === queueUrgencyFilter) &&
        (queueActionFilter === 'all' || getNextActionKey(activeQueue, task) === queueActionFilter)
    );

    return sortTasks(filtered, sortKey);
  }, [
    activeQueue,
    activeQueueSourceTasks,
    queueActionFilter,
    queueCategoryFilter,
    queueUrgencyFilter,
    searchTerm,
    sortKey,
  ]);
  const hasAdvancedQueueFilters =
    queueCategoryFilter !== 'all' || queueUrgencyFilter !== 'all' || queueActionFilter !== 'all';

  const totalOpenQueues =
    queueData.new_requests.length +
    queueData.returned_to_staff.length +
    queueData.ready_to_route.length;

  const reviewedThisWeek = useMemo(() => {
    const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
    return tasks.filter((task) => {
      const reviewedAt = parseDate(resolveAdminReviewedAt(task));
      return Boolean(reviewedAt && reviewedAt >= sevenDaysAgo);
    }).length;
  }, [tasks]);

  const currentWeekStart = startOfDay(subDays(new Date(), 6));
  const previousWeekStart = startOfDay(subDays(currentWeekStart, 7));
  const previousWeekEnd = subDays(currentWeekStart, 1);
  const countCreatedInRange = (start: Date, end: Date) =>
    tasks.filter((task) => {
      const createdAt = parseDate(task.createdAt);
      return Boolean(createdAt && createdAt >= start && createdAt <= end);
    }).length;

  const currentWeekSubmitted = countCreatedInRange(currentWeekStart, new Date());
  const previousWeekSubmitted = countCreatedInRange(previousWeekStart, previousWeekEnd);
  const submittedDelta = currentWeekSubmitted - previousWeekSubmitted;

  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    return eachDayOfInterval({ start: subDays(today, 6), end: today }).map((date) => ({
      day: format(date, 'EEE'),
      submitted: tasks.filter((task) => {
        const createdAt = parseDate(task.createdAt);
        return Boolean(createdAt && isSameDay(createdAt, date));
      }).length,
      reviewed: tasks.filter((task) => {
        const reviewedAt = parseDate(resolveAdminReviewedAt(task));
        return Boolean(reviewedAt && isSameDay(reviewedAt, date));
      }).length,
    }));
  }, [tasks]);

  const activityItems = useMemo(() => {
    const relevant = tasks
      .filter(
        (task) =>
          resolveAdminReviewStatus(task) === 'pending' ||
          resolveAdminReviewStatus(task) === 'needs_info' ||
          isReadyToRouteTask(task)
      )
      .filter((task) => matchesSearch(task, searchTerm))
      .sort(
        (left, right) =>
          getTaskTime(right.updatedAt || right.createdAt) - getTaskTime(left.updatedAt || left.createdAt)
      );

    return relevant.map(buildActivityItem);
  }, [searchTerm, tasks]);

  const alert = queueData.new_requests.length
    ? {
        eyebrow: 'Intake review',
        title: `${queueData.new_requests.length} staff request${queueData.new_requests.length === 1 ? '' : 's'} waiting for review`,
        subtitle: 'Clear the intake queue first so new requests do not stall before design assignment.',
        href: '/approvals',
        actionLabel: 'Open approvals',
        toneClassName:
          'border-[#DCE7FF] bg-[linear-gradient(90deg,rgba(238,244,255,0.96),rgba(228,237,255,0.88))] text-[#243C72] dark:border-[#334A7A] dark:bg-[#132346] dark:text-[#D9E4FF]',
        icon: Inbox,
      }
    : queueData.returned_to_staff.length
      ? {
          eyebrow: 'Staff follow-up',
          title: `${queueData.returned_to_staff.length} request${queueData.returned_to_staff.length === 1 ? '' : 's'} still waiting on staff updates`,
          subtitle: 'Monitor whether staff has replied and move updated requests back into review quickly.',
          href: '/approvals',
          actionLabel: 'Review updates',
          toneClassName:
            'border-[#F1DEC6] bg-[linear-gradient(90deg,rgba(255,246,235,0.96),rgba(255,241,224,0.88))] text-[#6F4818] dark:border-[#6B563F] dark:bg-[#31261D] dark:text-[#F0C287]',
          icon: AlertTriangle,
        }
      : queueData.ready_to_route.length
        ? {
            eyebrow: 'Routing',
            title: `${queueData.ready_to_route.length} approved request${queueData.ready_to_route.length === 1 ? '' : 's'} ready to move into design`,
            subtitle: 'These requests are clear for assignment and should be routed to the design team.',
            href: '/tasks',
            actionLabel: 'Open routing',
            toneClassName:
              'border-[#D8E9DD] bg-[linear-gradient(90deg,rgba(239,249,241,0.96),rgba(231,246,235,0.88))] text-[#24583B] dark:border-[#44624F] dark:bg-[#1D3126] dark:text-[#B6E0C2]',
            icon: Send,
          }
        : {
            eyebrow: 'Queue status',
            title: 'Admin intake queues are clear',
            subtitle: 'No requests are currently waiting for review, follow-up, or routing.',
            href: '/tasks',
            actionLabel: 'View all tasks',
            toneClassName:
              'border-[#DCE6F6] bg-[linear-gradient(90deg,rgba(247,250,253,0.96),rgba(241,245,250,0.88))] text-[#304766] dark:border-border dark:bg-card dark:text-foreground',
            icon: Sparkles,
          };

  const metricCards = [
    {
      label: 'Open admin items',
      value: totalOpenQueues,
      helper: 'Across intake, follow-up, and routing queues',
      icon: ClipboardList,
      iconClassName:
        'border-[#DCE6F6] bg-white/62 text-[#4562A6] backdrop-blur-xl dark:border-border dark:bg-muted dark:text-foreground',
    },
    {
      label: 'New requests',
      value: queueData.new_requests.length,
      helper: queueData.new_requests.length ? 'Need intake review now' : 'No intake backlog',
      icon: Inbox,
      iconClassName: queueMetaMap.new_requests.iconClassName,
    },
    {
      label: 'Waiting on staff',
      value: queueData.returned_to_staff.length,
      helper: queueData.returned_to_staff.length ? 'Follow-up requests are still open' : 'No pending staff updates',
      icon: AlertTriangle,
      iconClassName: queueMetaMap.returned_to_staff.iconClassName,
    },
    {
      label: 'Reviewed this week',
      value: reviewedThisWeek,
      helper: submittedDelta === 0 ? 'Same intake volume as last week' : `${submittedDelta > 0 ? '+' : ''}${submittedDelta} vs last week`,
      icon: CheckCircle2,
      iconClassName: queueMetaMap.ready_to_route.iconClassName,
    },
  ];

  const emptyStateText =
    activeQueue === 'new_requests'
      ? 'No new staff requests are waiting for admin review.'
      : activeQueue === 'returned_to_staff'
        ? 'No requests are currently waiting on staff updates.'
        : 'No approved requests are waiting to be routed into design.';

  const chartConfig = {
    submitted: { label: 'Submitted', color: '#4F6EF7' },
    reviewed: { label: 'Reviewed', color: '#9DB2FF' },
  };

  const AlertIcon = alert.icon;

  return (
    <div className="space-y-4">
      <section className={cn(panelClass, 'px-5 py-5')}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(135,176,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.7),transparent_28%)] dark:hidden" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4B5F7A] dark:text-muted-foreground">
              Admin Overview
            </p>
            <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] dark:text-foreground">
              Overview
            </h1>
            <p className="max-w-2xl text-[13px] leading-6 text-[#3F5168] dark:text-muted-foreground">
              Monitor intake review, staff follow-ups, and routing from one page.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search requests"
                className={cn('h-10 rounded-xl pl-9 pr-3 text-[13px]', glassFieldClass)}
              />
            </div>

            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger className={cn('h-10 w-[150px] rounded-xl text-[13px]', glassFieldClass)}>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="requester">Requester</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className={cn(panelClass, 'px-4 py-4', alert.toneClassName)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/10 bg-white/60 dark:bg-white/5">
              <AlertIcon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                {alert.eyebrow}
              </p>
              <p className="text-[15px] font-semibold">{alert.title}</p>
              <p className="max-w-3xl text-[13px] leading-5 opacity-80">{alert.subtitle}</p>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-9 rounded-xl border-current/15 bg-white/55 px-3 text-[13px] font-medium text-current backdrop-blur-xl shadow-none hover:bg-white/78 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <Link to={alert.href} className="inline-flex items-center gap-1.5">
              <span>{alert.actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className={cn(sectionClass, 'min-h-[124px] px-4 py-4')}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.82),transparent_34%)] dark:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[12px] font-medium text-[#7B8698] dark:text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-[30px] font-semibold tracking-tight text-[#111827] dark:text-foreground">
                    {card.value}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-xl border',
                    card.iconClassName
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-[12px] leading-5 text-[#6B7280] dark:text-muted-foreground">
                {card.helper}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr,1fr]">
        <div className={cn(sectionClass, 'px-4 py-4')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8090A8] dark:text-muted-foreground">
                Request Flow
              </p>
              <h2 className="mt-1 text-[20px] font-semibold text-[#111827] dark:text-foreground">
                Submitted vs reviewed
              </h2>
              <p className="mt-1 text-[12.5px] leading-5 text-[#6B7280] dark:text-muted-foreground">
                Daily request volume across the last 7 days.
              </p>
            </div>

            <div className="rounded-xl border border-[#E4EBF5] bg-white/58 px-3 py-2 text-right backdrop-blur-xl dark:border-border dark:bg-muted/50">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8090A8] dark:text-muted-foreground">
                This week
              </p>
              <p className="mt-1 text-[18px] font-semibold text-[#111827] dark:text-foreground">
                {currentWeekSubmitted}
              </p>
            </div>
          </div>

          <div className="mt-5 h-[270px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="submittedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-submitted)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-submitted)" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="reviewedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-reviewed)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--color-reviewed)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  type="monotone"
                  dataKey="reviewed"
                  stroke="var(--color-reviewed)"
                  fill="url(#reviewedFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  stroke="var(--color-submitted)"
                  fill="url(#submittedFill)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
        <div className={cn(sectionClass, 'px-4 py-4')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8090A8] dark:text-muted-foreground">
                Recent Activity
              </p>
              <h2 className="mt-1 text-[20px] font-semibold text-[#111827] dark:text-foreground">
                Intake updates
              </h2>
            </div>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-[#E4EBF5] bg-white/58 px-2 text-[11px] font-medium text-[#6B7280] backdrop-blur-xl dark:border-border dark:bg-muted/50 dark:text-muted-foreground">
              {activityItems.length}
            </span>
          </div>

          <div
            className={cn(
              'mt-5 space-y-3',
              activityItems.length > recentActivityVisibleCount &&
                'max-h-[calc(3*5.75rem+1.5rem)] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin'
            )}
          >
            {activityItems.length > 0 ? (
              activityItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className="flex min-h-[5.75rem] items-start gap-3 rounded-2xl border border-[#D9E6FF]/60 bg-white/55 px-3 py-3 backdrop-blur-xl transition-colors hover:bg-white/72 dark:border-border dark:bg-muted/30 dark:hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                        item.iconClassName
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#111827] dark:text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#6B7280] dark:text-muted-foreground">
                        {item.subtitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[#94A3B8] dark:text-muted-foreground">
                      {item.relativeTime}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[#DCE6F6] bg-white/45 px-4 py-8 text-center text-[13px] text-[#6B7280] backdrop-blur-xl dark:border-border dark:bg-muted/20 dark:text-muted-foreground">
                No recent intake activity matches your current search.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={cn(panelClass, 'px-4 py-4')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8090A8] dark:text-muted-foreground">
              Queue Snapshot
            </p>
            <h2 className="mt-1 text-[22px] font-semibold text-[#111827] dark:text-foreground">
              Current admin queues
            </h2>
            <p className="mt-1 text-[12.5px] leading-5 text-[#6B7280] dark:text-muted-foreground">
              Focus on the queue you need to clear next.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-10 rounded-xl border-[#DCE6F6] bg-white/58 px-3 text-[13px] font-medium backdrop-blur-xl shadow-none hover:bg-white/76 dark:border-border dark:bg-card dark:hover:bg-muted"
          >
            <Link to={activeQueueMeta.href} className="inline-flex items-center gap-1.5">
              <span>{activeQueueMeta.actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.values(queueMetaMap) as QueueMeta[]).map((queue) => {
            const isActive = queue.key === activeQueue;
            const Icon = queue.icon;
            const count = queueData[queue.key].length;

            return (
              <button
                key={queue.key}
                type="button"
                onClick={() => setActiveQueue(queue.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left backdrop-blur-xl transition-colors',
                  isActive
                    ? 'border-[#C8D8FF] bg-[linear-gradient(135deg,rgba(238,244,255,0.88),rgba(226,236,255,0.7))] text-[#23418A] dark:border-[#334A7A] dark:bg-[#1A294D] dark:text-[#D6E1FF]'
                    : 'border-[#E4EBF5] bg-white/55 text-[#475569] hover:bg-white/72 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border',
                    queue.iconClassName
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-[13px] font-medium">{queue.title}</span>
                  <span className="text-[11px] text-current/70">{count} item{count === 1 ? '' : 's'}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[20px] border border-[#E4EBF5] bg-white/50 px-3 py-3 backdrop-blur-2xl dark:border-border dark:bg-card/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A8AA5] dark:text-muted-foreground">
                Advanced Filters
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[#607086] dark:text-muted-foreground">
                Refine the active queue by category, urgency, and who acts next.
              </p>
            </div>
            <div className="inline-flex h-8 items-center rounded-lg border border-[#DCE6F6] bg-white/65 px-3 text-[12px] font-medium text-[#52627A] backdrop-blur-xl dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
              Showing {formatCount(activeQueueTasks.length)} of {formatCount(activeQueueSourceTasks.length)} items
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select
              value={queueCategoryFilter}
              onValueChange={(value) => setQueueCategoryFilter(value as QueueCategoryFilter)}
            >
              <SelectTrigger className={cn('h-10 rounded-xl text-[13px]', glassFieldClass)}>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {queueCategoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {formatCategory(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={queueUrgencyFilter}
              onValueChange={(value) => setQueueUrgencyFilter(value as QueueUrgencyFilter)}
            >
              <SelectTrigger className={cn('h-10 rounded-xl text-[13px]', glassFieldClass)}>
                <SelectValue placeholder="All urgency levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgency levels</SelectItem>
                {queueUrgencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={queueActionFilter}
              onValueChange={(value) => setQueueActionFilter(value as QueueActionFilter)}
            >
              <SelectTrigger className={cn('h-10 rounded-xl text-[13px]', glassFieldClass)}>
                <SelectValue placeholder="All next actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All next actions</SelectItem>
                <SelectItem value="admin_next">Admin next</SelectItem>
                <SelectItem value="staff_next">Staff next</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQueueCategoryFilter('all');
                setQueueUrgencyFilter('all');
                setQueueActionFilter('all');
              }}
              disabled={!hasAdvancedQueueFilters}
              className="h-10 rounded-xl border-[#DCE6F6] bg-white/58 px-3 text-[13px] font-medium backdrop-blur-xl shadow-none hover:bg-white/76 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-card dark:hover:bg-muted"
            >
              Clear filters
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[#E4EBF5] bg-white/52 backdrop-blur-2xl dark:border-border dark:bg-card">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_120px] gap-3 border-b border-[#E7EDF7] bg-white/38 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8090A8] backdrop-blur-xl dark:border-border dark:bg-muted/30 dark:text-muted-foreground md:grid">
            <div>Request</div>
            <div>Submitted by</div>
            <div>Who acts next</div>
            <div className="text-right">Updated</div>
          </div>

          <div
            className={cn(
              'divide-y divide-[#E7EDF7] dark:divide-border',
              activeQueueTasks.length > queueSnapshotVisibleCount &&
                'max-h-[42rem] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin'
            )}
          >
            {activeQueueTasks.length > 0 ? (
              activeQueueTasks.map((task) => {
                const nextAction = getNextAction(activeQueue, task);

                return (
                  <Link
                    key={task.id}
                    to={`/task/${task.id}`}
                    className="group grid min-h-[7rem] gap-3 px-4 py-3 transition-all duration-200 hover:bg-[linear-gradient(90deg,rgba(238,244,255,0.92),rgba(255,255,255,0.6))] hover:shadow-[inset_3px_0_0_0_rgba(79,110,247,0.72)] dark:hover:bg-muted/35 dark:hover:shadow-[inset_3px_0_0_0_rgba(146,171,238,0.55)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_120px]"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#23418A] dark:text-foreground dark:group-hover:text-[#D6E1FF]">
                        {task.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#6B7280] dark:text-muted-foreground">
                        {task.description || 'No request description provided.'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#94A3B8] dark:text-muted-foreground">
                        <span>{formatCategory(task.category) || 'General'}</span>
                        <span className="h-1 w-1 rounded-full bg-[#CBD5E1] dark:bg-muted-foreground/50" />
                        <span>{formatTaskId(task)}</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8090A8] dark:text-muted-foreground md:hidden">
                        Submitted by
                      </p>
                      <p className="text-[13px] font-medium text-[#111827] transition-colors duration-200 group-hover:text-[#23418A] dark:text-foreground dark:group-hover:text-[#D6E1FF]">
                        {task.requesterName || '--'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-[#6B7280] dark:text-muted-foreground">
                        {getRequesterMeta(task)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8090A8] dark:text-muted-foreground md:hidden">
                        Who acts next
                      </p>
                      <span className={cn(badgeBase, nextAction.className)}>{nextAction.label}</span>
                      <p className="mt-1 line-clamp-2 text-[12px] text-[#6B7280] dark:text-muted-foreground">
                        {nextAction.detail}
                      </p>
                    </div>

                    <div className="min-w-0 md:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8090A8] dark:text-muted-foreground md:hidden">
                        Updated
                      </p>
                      <p className="text-[13px] font-medium text-[#111827] transition-colors duration-200 group-hover:text-[#23418A] dark:text-foreground dark:group-hover:text-[#D6E1FF]">
                        {formatTaskDate(task.updatedAt || task.createdAt)}
                      </p>
                      <p className="mt-1 text-[12px] text-[#6B7280] dark:text-muted-foreground">
                        {formatRelativeDate(task.updatedAt || task.createdAt)}
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E4EBF5] bg-white/55 backdrop-blur-xl dark:border-border dark:bg-muted/40">
                  <activeQueueMeta.icon className="h-4 w-4 text-[#7C8AA5] dark:text-muted-foreground" />
                </span>
                <div className="space-y-1">
                  <p className="text-[14px] font-medium text-[#111827] dark:text-foreground">
                    {emptyStateText}
                  </p>
                  <p className="text-[12px] text-[#6B7280] dark:text-muted-foreground">
                    Try a different queue or clear the current search and advanced filters.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

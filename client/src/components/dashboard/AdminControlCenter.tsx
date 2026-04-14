import { useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Inbox,
  MessageSquare,
  Package,
  PauseCircle,
  RotateCcw,
  Send,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

type AdminControlCenterProps = {
  tasks: Task[];
};

type QueueKey =
  | 'submitted'
  | 'need_info'
  | 'deadline'
  | 'clarification'
  | 'delivery';

type QueueItem = {
  key: QueueKey;
  title: string;
  subtitle: string;
  href: string;
  tasks: Task[];
};

type ActionItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: number;
  primary?: boolean;
};

const sidebarShellClass =
  'relative overflow-hidden rounded-[22px] border border-[#D5E2FF]/55 bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl ring-1 ring-[#E3ECFF]/45 shadow-none dark:border-[#2F4F8F]/45 dark:ring-[#3C5FA0]/20 dark:bg-card dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent';
const workspaceShellClass =
  'relative overflow-hidden rounded-[22px] border border-[#D5E2FF]/55 bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl ring-1 ring-[#E3ECFF]/45 shadow-none dark:border-[#2F4F8F]/45 dark:ring-[#3C5FA0]/20 dark:bg-card dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent';
const sidebarItemClass =
  'relative overflow-hidden rounded-[14px] border border-[#D8E4FF]/82 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,249,255,0.88))] supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,249,255,0.72))] backdrop-blur-md ring-1 ring-white/65 shadow-none dark:border-border dark:bg-card/78 dark:[background-image:none] dark:ring-0';
const iconBaseClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border backdrop-blur-sm ring-1 ring-white/55 shadow-[0_12px_24px_-18px_rgba(59,99,204,0.18)] dark:border-border dark:bg-card/95 dark:[background-image:none] dark:text-foreground/70 dark:shadow-none dark:ring-0';
const countBadgeClass =
  'inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-[#D7E4FF]/85 bg-white/78 px-1.5 text-[11px] font-medium leading-none text-[#162955] supports-[backdrop-filter]:bg-white/58 backdrop-blur-md ring-1 ring-white/60 dark:border-border/70 dark:bg-card/85 dark:text-foreground dark:ring-0';
const tableShellClass =
  'overflow-hidden rounded-[16px] border border-[#D9E6FF]/82 bg-white/76 supports-[backdrop-filter]:bg-white/56 backdrop-blur-xl ring-1 ring-white/65 shadow-none dark:border-border dark:bg-card/82 dark:[background-image:none] dark:ring-0';
const eyebrowClass =
  'text-[11px] font-medium uppercase tracking-[0.08em] text-[#748197] dark:text-muted-foreground';
const primaryActionClass =
  'h-8 rounded-md border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 px-3 text-[13px] font-medium text-white shadow-none backdrop-blur-xl hover:bg-primary/85 hover:text-white dark:border-transparent dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]';
const secondaryActionClass =
  'h-8 rounded-md border border-[#D7E3FF]/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(242,246,255,0.92))] px-3 text-[13px] font-medium text-[#223067] shadow-[0_12px_24px_-20px_rgba(59,99,204,0.18)] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(242,246,255,0.68))] backdrop-blur-md transition-all duration-200 hover:border-[#C7D8FF] hover:bg-[#EEF4FF]/92 hover:text-[#1E2A5A] hover:shadow-[0_16px_32px_-22px_rgba(59,99,204,0.22)] dark:border-border/70 dark:bg-card/95 dark:[background-image:none] dark:text-foreground dark:shadow-none dark:hover:border-border dark:hover:bg-muted dark:hover:text-foreground';
const utilityButtonClass =
  'h-8 rounded-md border border-[#D7E3FF]/78 bg-white/72 px-3 text-[13px] font-medium text-[#52637E] shadow-none supports-[backdrop-filter]:bg-white/52 backdrop-blur-md hover:border-[#C7D8FF] hover:bg-white/86 hover:text-[#1E2A5A] dark:border-border/70 dark:bg-card/85 dark:text-muted-foreground dark:hover:bg-card dark:hover:text-foreground';
const dropdownItemClass =
  'flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium text-[#223067] focus:bg-white/72 focus:text-[#1E2A5A] data-[highlighted]:bg-white/72 data-[highlighted]:text-[#1E2A5A] dark:text-foreground dark:focus:bg-card dark:data-[highlighted]:bg-card';

const queueAppearance: Record<
  QueueKey,
  {
    icon: LucideIcon;
    iconWrapClass: string;
    activeClass: string;
  }
> = {
  submitted: {
    icon: Inbox,
    iconWrapClass: 'border-[#C9D7FF]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(236,243,255,0.86))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(236,243,255,0.6))] text-[#4863B7]',
    activeClass: 'border-[#BFD2FF]/88 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(237,244,255,0.9),rgba(226,236,255,0.82))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(237,244,255,0.72),rgba(226,236,255,0.62))] ring-1 ring-white/75 dark:border-[#49617E] dark:bg-card/86 dark:[background-image:none] dark:ring-0',
  },
  need_info: {
    icon: AlertTriangle,
    iconWrapClass: 'border-[#E6D6C0]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(252,246,238,0.88))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(252,246,238,0.62))] text-[#A0652B]',
    activeClass: 'border-[#E0C9AF]/88 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(253,248,241,0.9),rgba(249,240,228,0.82))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(253,248,241,0.72),rgba(249,240,228,0.62))] ring-1 ring-white/75 dark:border-[#6E5842] dark:bg-card/86 dark:[background-image:none] dark:ring-0',
  },
  deadline: {
    icon: Clock,
    iconWrapClass: 'border-[#D4DBF3]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,244,255,0.88))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(240,244,255,0.62))] text-[#55628C]',
    activeClass: 'border-[#C6D0EE]/88 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(243,246,255,0.9),rgba(233,239,255,0.82))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(243,246,255,0.72),rgba(233,239,255,0.62))] ring-1 ring-white/75 dark:border-[#52627E] dark:bg-card/86 dark:[background-image:none] dark:ring-0',
  },
  clarification: {
    icon: MessageSquare,
    iconWrapClass: 'border-[#D5E3EF]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,247,252,0.88))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(239,247,252,0.62))] text-[#43627E]',
    activeClass: 'border-[#C5D9E7]/88 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,250,253,0.9),rgba(231,243,248,0.82))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(244,250,253,0.72),rgba(231,243,248,0.62))] ring-1 ring-white/75 dark:border-[#4E687D] dark:bg-card/86 dark:[background-image:none] dark:ring-0',
  },
  delivery: {
    icon: Package,
    iconWrapClass: 'border-[#D3E5D9]/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,248,242,0.88))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(239,248,242,0.62))] text-[#3F7650]',
    activeClass: 'border-[#C6DDCD]/88 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,251,246,0.9),rgba(233,244,236,0.82))] supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(244,251,246,0.72),rgba(233,244,236,0.62))] ring-1 ring-white/75 dark:border-[#4C6D57] dark:bg-card/86 dark:[background-image:none] dark:ring-0',
  },
};

const parseDate = (value?: Date | string | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTaskTime = (value?: Date | string | null) => parseDate(value)?.getTime() || 0;

const formatTaskDate = (value?: Date | string | null) => {
  const parsed = parseDate(value);
  return parsed ? format(parsed, 'dd MMM') : '--';
};

const formatRelativeDate = (value?: Date | string | null) => {
  const parsed = parseDate(value);
  return parsed ? formatDistanceToNowStrict(parsed, { addSuffix: true }) : 'No activity';
};

const sortTasks = (
  source: Task[],
  field: 'createdAt' | 'updatedAt' | 'deadline' = 'createdAt'
) => [...source].sort((left, right) => getTaskTime(right[field]) - getTaskTime(left[field]));

const formatCount = (value: number) => value.toLocaleString();

const formatCategory = (value?: string | null) =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatTaskId = (task: Task) => {
  const value = String(task.id || task._id || '').trim();
  if (!value) return 'No ID';
  return `Task ${value.slice(-6).toUpperCase()}`;
};

const hasDeliveryAssets = (task: Task) => {
  const hasOutputFiles = (task.files || []).some((file) => file.type === 'output');
  const hasDeliverableVersions = (task.finalDeliverableVersions || []).some(
    (version) => (version.files || []).length > 0
  );
  return hasOutputFiles || hasDeliverableVersions;
};

const getRowState = (queueKey: QueueKey) => {
  switch (queueKey) {
    case 'submitted':
      return 'Review pending';
    case 'need_info':
      return 'Waiting on staff';
    case 'deadline':
      return 'Lead response pending';
    case 'clarification':
      return 'Clarification open';
    case 'delivery':
      return 'Delivery pending';
    default:
      return 'Pending';
  }
};

const getRowStateDetail = (queueKey: QueueKey, task: Task) => {
  switch (queueKey) {
    case 'submitted':
      return task.requesterDepartment || formatCategory(task.category) || 'New request';
    case 'need_info':
      return task.description || 'Staff update required';
    case 'deadline':
      return task.proposedDeadline
        ? `Requested ${formatTaskDate(task.proposedDeadline)}`
        : `Target ${formatTaskDate(task.deadline)}`;
    case 'clarification':
      return `${(task.comments || []).length} comment${task.comments?.length === 1 ? '' : 's'}`;
    case 'delivery':
      return task.assignedToName || 'Awaiting final handoff';
    default:
      return task.urgency === 'urgent' ? 'Urgent' : 'Normal priority';
  }
};

const getRowDate = (queueKey: QueueKey, task: Task) => {
  switch (queueKey) {
    case 'submitted':
      return formatTaskDate(task.createdAt);
    case 'deadline':
      return formatTaskDate(task.proposedDeadline || task.deadline);
    default:
      return formatTaskDate(task.updatedAt || task.createdAt);
  }
};

const getRowOwnerLine = (task: Task) => {
  if (task.assignedToName) return `Assigned to ${task.assignedToName}`;
  if (task.requesterDepartment) return task.requesterDepartment;
  return formatCategory(task.category) || 'Unassigned';
};

const buildQueueActions = (
  queueKey: QueueKey,
  activeCount: number,
  readyToRouteCount: number
): ActionItem[] => {
  switch (queueKey) {
    case 'submitted':
      return [
        { label: 'Approve Task', href: '/approvals', icon: CheckCircle2, count: activeCount, primary: true },
        { label: 'Request Info', href: '/approvals', icon: AlertTriangle, count: activeCount },
        { label: 'Set Deadline', href: '/tasks', icon: Clock },
      ];
    case 'need_info':
      return [
        { label: 'Follow Up with Staff', href: '/approvals', icon: MessageSquare, count: activeCount, primary: true },
        { label: 'Mark Updated', href: '/approvals', icon: CheckCircle2, count: activeCount },
        { label: 'Approve Task', href: '/approvals', icon: CheckCircle2 },
      ];
    case 'deadline':
      return [
        { label: 'Confirm Deadline', href: '/tasks', icon: CheckCircle2, count: activeCount, primary: true },
        { label: 'Revise Deadline', href: '/tasks', icon: Clock },
        { label: 'Route to Lead', href: '/tasks', icon: Send, count: readyToRouteCount },
      ];
    case 'clarification':
      return [
        { label: 'Reply to Clarification', href: '/tasks', icon: MessageSquare, count: activeCount, primary: true },
        { label: 'Mark Updated', href: '/tasks', icon: CheckCircle2 },
      ];
    case 'delivery':
      return [
        { label: 'Deliver', href: '/tasks', icon: Package, count: activeCount, primary: true },
        { label: 'Add Delivery Note', href: '/tasks', icon: MessageSquare },
      ];
    default:
      return [];
  }
};

const moreActions: ActionItem[] = [
  { label: 'Override Priority', href: '/tasks', icon: AlertTriangle },
  { label: 'Reopen Task', href: '/tasks', icon: RotateCcw },
  { label: 'Pause Task', href: '/tasks', icon: PauseCircle },
  { label: 'Escalate', href: '/tasks', icon: Shield },
  { label: 'Internal Note', href: '/tasks', icon: MessageSquare },
  { label: 'Export Files', href: '/tasks', icon: Download },
];

export function AdminControlCenter({ tasks }: AdminControlCenterProps) {
  const navigate = useNavigate();

  const queueItems = useMemo<QueueItem[]>(() => {
    const submitted = sortTasks(
      tasks.filter((task) => task.adminReviewStatus === 'pending'),
      'createdAt'
    );
    const needInfo = sortTasks(
      tasks.filter((task) => task.adminReviewStatus === 'needs_info'),
      'updatedAt'
    );
    const waitingDeadline = sortTasks(
      tasks.filter(
        (task) =>
          task.adminReviewStatus === 'approved' &&
          (task.deadlineApprovalStatus === 'pending' ||
            (Boolean(task.proposedDeadline) && !task.deadlineApprovalStatus))
      ),
      'deadline'
    );
    const clarification = sortTasks(
      tasks.filter((task) => task.status === 'clarification_required'),
      'updatedAt'
    );
    const readyForDelivery = sortTasks(
      tasks.filter((task) => {
        const leadCleared =
          task.finalDeliverableReviewStatus === 'approved' ||
          task.status === 'under_review' ||
          task.status === 'completed';
        return leadCleared && hasDeliveryAssets(task);
      }),
      'updatedAt'
    );

    return [
      {
        key: 'submitted',
        title: 'Submitted',
        subtitle: 'Requests waiting for admin intake review',
        href: '/approvals',
        tasks: submitted,
      },
      {
        key: 'need_info',
        title: 'Need Info',
        subtitle: 'Requests sent back for missing details',
        href: '/approvals',
        tasks: needInfo,
      },
      {
        key: 'deadline',
        title: 'Deadline Acceptance',
        subtitle: 'Approved work waiting on lead timeline signoff',
        href: '/tasks',
        tasks: waitingDeadline,
      },
      {
        key: 'clarification',
        title: 'Clarifications',
        subtitle: 'Open back-and-forth that needs an admin response',
        href: '/tasks',
        tasks: clarification,
      },
      {
        key: 'delivery',
        title: 'Ready for Delivery',
        subtitle: 'Handoff-ready work with final files available',
        href: '/tasks',
        tasks: readyForDelivery,
      },
    ];
  }, [tasks]);

  const [activeQueue, setActiveQueue] = useState<QueueKey>('submitted');
  const activeQueueItem = queueItems.find((item) => item.key === activeQueue) || queueItems[0];
  const activeItemCount = activeQueueItem?.tasks.length || 0;

  const readyToRouteCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.adminReviewStatus === 'approved' &&
          task.deadlineApprovalStatus === 'approved' &&
          !task.assignedToName &&
          task.status !== 'completed'
      ).length,
    [tasks]
  );

  const contextualActions = useMemo(
    () => buildQueueActions(activeQueue, activeItemCount, readyToRouteCount),
    [activeItemCount, activeQueue, readyToRouteCount]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[260px,minmax(0,1fr)]">
      <aside className={cn(sidebarShellClass, 'p-3')}>
        <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-[#EAF2FF]/75 blur-3xl dark:bg-[#23458F]/20" />
        <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/55 dark:ring-white/5" />
        <div className="pb-1">
          <p className={eyebrowClass}>Queues</p>
        </div>

        <div className="mt-2 space-y-2">
          {queueItems.map((item) => {
            const isActive = item.key === activeQueue;
            const { icon: Icon, iconWrapClass, activeClass } = queueAppearance[item.key];

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveQueue(item.key)}
                className={cn(
                  sidebarItemClass,
                  'w-full p-3 text-left transition-all duration-200 hover:border-[#C9D7FF] hover:bg-white/88 dark:hover:border-border dark:hover:bg-card/85',
                  isActive && activeClass
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      iconBaseClass,
                      iconWrapClass
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold leading-5 text-[#1F2937] dark:text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-[#6B7280] dark:text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>
                      <span className={countBadgeClass}>
                        {formatCount(item.tasks.length)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={cn(workspaceShellClass, 'overflow-hidden')}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#E3ECFF]/72 blur-3xl dark:bg-[#2B55B5]/18" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-[#EEF4FF]/60 blur-3xl dark:bg-[#213E80]/14" />
        <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/55 dark:ring-white/5" />
        <div className="border-b border-[#D9E6FF]/65 px-4 py-4 dark:border-border">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[23px] font-semibold leading-7 text-[#111827] dark:text-foreground">
                  {activeQueueItem?.title || 'Queue'}
                </h1>
                <span className="inline-flex h-6 items-center rounded-md border border-[#D7E4FF]/85 bg-white/74 px-2 text-[11px] font-medium leading-none text-[#4B5563] supports-[backdrop-filter]:bg-white/54 backdrop-blur-md ring-1 ring-white/60 dark:border-border/70 dark:bg-card/85 dark:text-muted-foreground dark:ring-0">
                  {formatCount(activeItemCount)} items
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-5 text-[#6B7280] dark:text-muted-foreground">
                {activeQueueItem?.subtitle || 'Admin queue workspace'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-[#D9E6FF]/65 px-4 py-3 dark:border-border">
          <div className="flex flex-wrap items-center gap-2">
            {contextualActions.map((action) => {
              const Icon = action.icon;
              const actionClass = action.primary ? primaryActionClass : secondaryActionClass;

              return (
                <Button
                  key={action.label}
                  asChild
                  variant={action.primary ? 'default' : 'outline'}
                  className={actionClass}
                >
                  <Link to={action.href} className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{action.label}</span>
                    {action.count ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-current/20 px-1 text-[10px] font-semibold leading-none">
                        {formatCount(action.count)}
                      </span>
                    ) : null}
                  </Link>
                </Button>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={utilityButtonClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>More Actions</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl border border-[#D9E6FF]/78 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,255,0.94))] p-1.5 shadow-[0_24px_54px_-30px_rgba(59,99,204,0.24)] supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,248,255,0.88))] backdrop-blur-[22px] ring-1 ring-white/72 dark:border-border dark:bg-card/95 dark:[background-image:none] dark:ring-0 dark:shadow-[0_24px_60px_-34px_rgba(2,8,23,0.95)]"
              >
                {moreActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem
                      key={action.label}
                      onSelect={() => navigate(action.href)}
                      className={dropdownItemClass}
                    >
                      <Icon className="h-3.5 w-3.5 text-[#64748B] dark:text-muted-foreground" />
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="px-3 py-3">
          <div className={tableShellClass}>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_108px] gap-3 border-b border-[#D9E6FF]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(244,248,255,0.74))] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#748197] supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.56),rgba(244,248,255,0.6))] backdrop-blur-md dark:border-border dark:bg-card/90 dark:[background-image:none] dark:text-muted-foreground md:grid">
              <div>Request</div>
              <div>Owner</div>
              <div>State</div>
              <div className="text-right">Timeline</div>
            </div>

            <div className="divide-y divide-[#D9E6FF]/55 dark:divide-border">
              {activeItemCount > 0 ? (
                activeQueueItem.tasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/task/${task.id}`}
                    className="grid gap-3 px-3 py-2.5 transition-colors hover:bg-white/62 supports-[backdrop-filter]:hover:bg-white/48 dark:hover:bg-card md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_108px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold leading-5 text-[#111827] dark:text-foreground">
                        {task.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[12px] leading-4 text-[#6B7280] dark:text-muted-foreground">
                        {task.description || 'No request description provided.'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-[#7A8699] dark:text-muted-foreground">
                        <span>{formatCategory(task.category) || 'General'}</span>
                        <span className="h-1 w-1 rounded-full bg-[#C5CED8] dark:bg-muted-foreground/40" />
                        <span>{formatTaskId(task)}</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#748197] dark:text-muted-foreground md:hidden">
                        Owner
                      </p>
                      <p className="truncate text-[13px] font-medium leading-5 text-[#1F2937] dark:text-foreground">
                        {task.requesterName || '--'}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] leading-4 text-[#6B7280] dark:text-muted-foreground">
                        {getRowOwnerLine(task)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#748197] dark:text-muted-foreground md:hidden">
                        State
                      </p>
                      <p className="truncate text-[13px] font-medium leading-5 text-[#1F2937] dark:text-foreground">
                        {getRowState(activeQueueItem.key)}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] leading-4 text-[#6B7280] dark:text-muted-foreground">
                        {getRowStateDetail(activeQueueItem.key, task)}
                      </p>
                    </div>

                    <div className="min-w-0 md:text-right">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#748197] dark:text-muted-foreground md:hidden">
                        Timeline
                      </p>
                      <p className="text-[13px] font-medium leading-5 text-[#1F2937] dark:text-foreground">
                        {getRowDate(activeQueueItem.key, task)}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-4 text-[#6B7280] dark:text-muted-foreground">
                        {formatRelativeDate(task.updatedAt || task.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex items-center gap-3 px-4 py-6">
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border backdrop-blur-md ring-1 ring-white/55 shadow-[0_12px_24px_-18px_rgba(59,99,204,0.16)] dark:border-border dark:bg-card/95 dark:[background-image:none] dark:ring-0 dark:shadow-none',
                      queueAppearance[activeQueue].iconWrapClass
                    )}
                  >
                    {(() => {
                      const ActiveIcon = queueAppearance[activeQueue].icon;
                      return <ActiveIcon className="h-4 w-4" />;
                    })()}
                  </span>
                  <p className="text-[13px] leading-5 text-[#6B7280] dark:text-muted-foreground">
                    No items in this queue.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

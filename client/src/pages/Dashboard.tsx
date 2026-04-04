import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { ActivityFeed, type ActivityItem } from '@/components/dashboard/ActivityFeed';
import { useAuth } from '@/contexts/AuthContext';
import { mockTasks, calculateStats } from '@/data/mockTasks';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DateRangeOption, getDateRange, isWithinRange } from '@/lib/dateRange';
import { DESIGN_GOVERNANCE_NOTICE_MINIMAL } from '@/lib/designGovernance';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ListTodo,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  X,
  XCircle,
  Eye,
  User,
  Calendar,
  Paperclip,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { useTasksContext } from '@/contexts/TasksContext';
import { hydrateTask } from '@/lib/taskHydration';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import { filterTasksForUser } from '@/lib/taskVisibility';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { getDesignerScopeLabel, isMainDesigner } from '@/lib/designerAccess';

import { API_URL, authFetch } from '@/lib/api';

const roleLabels: Record<string, string> = {
  designer: 'Designer',
  staff: 'Staff',
  treasurer: 'Treasurer',
  other: 'Member',
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const toDateInputValue = (value?: Date | string | null) => {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'yyyy-MM-dd');
};

const toTimeInputValue = (value?: Date | string | null) => {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'HH:mm');
};

const DEADLINE_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const DEADLINE_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const DEADLINE_PERIODS = ['AM', 'PM'] as const;
const assignPanelClassName =
  'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border-0 ring-1 ring-black/5 shadow-none dark:from-slate-950/70 dark:via-slate-900/60 dark:to-slate-900/45 dark:supports-[backdrop-filter]:from-slate-950/60 dark:supports-[backdrop-filter]:via-slate-900/50 dark:supports-[backdrop-filter]:to-slate-900/40 dark:ring-white/5';
const assignFieldClassName =
  'bg-white/75 border border-[#D9E6FF] backdrop-blur-lg font-semibold text-foreground/90 placeholder:text-[#9CA3AF] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF] shadow-none dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:ring-primary/40 dark:focus-visible:border-slate-500/60';
const assignSelectContentClassName =
  'border border-[#C9D7FF] bg-[#F2F6FF]/95 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-100 dark:supports-[backdrop-filter]:bg-slate-900/70';

const parseTimeParts = (value?: string | null) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return { hour: '06', minute: '00', period: 'PM' as const };
  }

  const rawHour = Number(match[1]);
  const minute = match[2];
  const period = rawHour >= 12 ? 'PM' : 'AM';
  const hour12 = rawHour % 12 || 12;

  return {
    hour: String(hour12).padStart(2, '0'),
    minute,
    period,
  };
};

const toTwentyFourHourTime = (
  hour: string,
  minute: string,
  period: (typeof DEADLINE_PERIODS)[number]
) => {
  const normalizedHour = Number(hour);
  if (!Number.isFinite(normalizedHour) || normalizedHour < 1 || normalizedHour > 12) {
    return '';
  }

  const safeMinute = /^\d{2}$/.test(minute) ? minute : '00';
  let hours24 = normalizedHour % 12;
  if (period === 'PM') hours24 += 12;
  return `${String(hours24).padStart(2, '0')}:${safeMinute}`;
};

type DesignerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  designerScope?: 'main' | 'junior';
  portalId?: string;
};

const isDebugOrDemoDesigner = (option?: Partial<DesignerOption> | null) => {
  const haystack = `${option?.name || ''} ${option?.email || ''}`.trim().toLowerCase();
  return haystack.includes('demo') || haystack.includes('debug');
};

const sanitizeDesignerOptions = (options: DesignerOption[]) => {
  const uniqueOptions = new Map<string, DesignerOption>();

  options.forEach((option) => {
    const id = String(option.id || '').trim();
    const name = String(option.name || '').trim();
    const email = String(option.email || '').trim().toLowerCase();
    if (!id || !name) return;
    if (isDebugOrDemoDesigner({ ...option, email, name })) return;

    const key = email || `${name.toLowerCase()}::${option.designerScope || 'junior'}`;
    if (uniqueOptions.has(key)) return;

    uniqueOptions.set(key, {
      ...option,
      id,
      name,
      email,
    });
  });

  return Array.from(uniqueOptions.values()).sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.email.localeCompare(right.email) ||
      left.id.localeCompare(right.id)
  );
};

const buildFallbackDesigners = (
  tasks: typeof mockTasks,
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    designerScope?: 'main' | 'junior';
    portalId?: string;
  } | null
): DesignerOption[] => {
  const fromTasks = Array.from(
    new Map(
      tasks
        .map((task) => {
          const id =
            (task as { assignedToId?: string }).assignedToId ||
            (task as { assignedTo?: string }).assignedTo ||
            '';
          const name = task.assignedToName || '';
          return id && name
            ? [id, { id, name, email: '', role: 'designer' as const, designerScope: 'junior' as const, portalId: `JD-${id.slice(-6).toUpperCase()}` }]
            : null;
        })
        .filter(Boolean) as Array<
          [string, { id: string; name: string; email: string; role: 'designer' }]
        >
    ).values()
  );

  const currentRole = String(currentUser?.role || '').toLowerCase();
  const currentId = String(currentUser?.id || '').trim();
  if (currentRole === 'designer' && currentId) {
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
    const fallbackName =
      String(currentUser?.name || '').trim() ||
      (currentEmail ? currentEmail.split('@')[0] : 'Designer');
    const existingIndex = fromTasks.findIndex((entry) => entry.id === currentId);
    const selfOption = {
      id: currentId,
      name: fallbackName,
      email: currentEmail,
      role: 'designer',
      designerScope: currentUser?.designerScope === 'main' ? 'main' : 'junior',
      portalId: currentUser?.portalId || `JD-${currentId.slice(-6).toUpperCase()}`,
    };
    if (existingIndex === -1) {
      fromTasks.unshift(selfOption);
    } else {
      fromTasks[existingIndex] = {
        ...fromTasks[existingIndex],
        ...selfOption,
      };
    }
  }

  return sanitizeDesignerOptions(fromTasks);
};

const EmptyState = () => (
  <div className="text-center py-10 bg-white rounded-[32px] border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center dark:bg-card dark:border-border dark:shadow-card">
    <DotLottieReact
      src="https://lottie.host/0e85a89f-d869-4f1e-a9c0-6b12a6d53c58/H4LEyOPsA3.lottie"
      loop
      autoplay
      className="h-40 w-40 mb-3 dark:hidden"
    />
    <div className="hidden dark:flex items-center justify-center h-20 w-20 mb-3">
      <ListTodo className="h-12 w-12 text-slate-500" />
    </div>
    <h3 className="font-semibold text-slate-900 dark:text-slate-100">No recent activity</h3>
    <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto dark:text-slate-400">
      New requests and tasks will appear here once you get started.
    </p>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const { tasks: hydratedTasks, isLoading, setTasks } = useTasksContext();
  const apiUrl = API_URL;
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showNotifications, setShowNotifications] = useState(true);
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningTask, setAssigningTask] = useState<(typeof mockTasks)[number] | null>(null);
  const [designerOptions, setDesignerOptions] = useState<DesignerOption[]>([]);
  const [designersLoaded, setDesignersLoaded] = useState(false);
  const [isLoadingDesigners, setIsLoadingDesigners] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignmentDeadline, setAssignmentDeadline] = useState('');
  const [assignmentDeadlineTime, setAssignmentDeadlineTime] = useState('18:00');
  const [deadlineCalendarOpen, setDeadlineCalendarOpen] = useState(false);
  const [isAssigningDesigner, setIsAssigningDesigner] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [assignSuccessInfo, setAssignSuccessInfo] = useState<{
    taskTitle: string;
    designerName: string;
    ccCount: number;
  } | null>(null);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="py-6" />
      </DashboardLayout>
    );
  }
  const canAssignDesigner = isMainDesigner(user);
  const deadlineTimeParts = parseTimeParts(assignmentDeadlineTime);

  const resetAssignDesignerModal = () => {
    setAssigningTask(null);
    setSelectedDesignerId('');
    setCcInput('');
    setCcEmails([]);
    setAssignmentMessage('');
    setAssignmentDeadline('');
    setAssignmentDeadlineTime('18:00');
    setDeadlineCalendarOpen(false);
    setIsAssigningDesigner(false);
    setAssignSuccessInfo(null);
  };

  const handleAssignModalChange = (open: boolean) => {
    setIsAssignModalOpen(open);
    if (!open) {
      resetAssignDesignerModal();
    }
  };

  const openAssignDesignerModal = (task: typeof mockTasks[number]) => {
    const assignedId =
      (task as { assignedToId?: string }).assignedToId ||
      (task as { assignedTo?: string }).assignedTo ||
      '';
    setAssigningTask(task);
    setSelectedDesignerId(assignedId);
    setCcInput('');
    setCcEmails([]);
    setAssignmentMessage('');
    setAssignmentDeadline(toDateInputValue(task.deadline));
    setAssignmentDeadlineTime(toTimeInputValue(task.deadline) || '18:00');
    setDeadlineCalendarOpen(false);
    setAssignSuccessInfo(null);
    setIsAssignModalOpen(true);
  };

  const addCcEmail = (rawValue: string) => {
    const normalizedEmail = rawValue.trim().toLowerCase();
    if (!normalizedEmail) return;
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast.error('Enter a valid CC email address.');
      return;
    }
    setCcEmails((prev) => (prev.includes(normalizedEmail) ? prev : [...prev, normalizedEmail]));
    setCcInput('');
  };

  const removeCcEmail = (email: string) => {
    setCcEmails((prev) => prev.filter((value) => value !== email));
  };

  const handleCcInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    addCcEmail(ccInput);
  };

  useEffect(() => {
    if (!isAssignModalOpen || !canAssignDesigner || designersLoaded) return;

    const loadDesigners = async () => {
      if (!apiUrl) {
        const fallbackDesigners = buildFallbackDesigners(hydratedTasks, user);
        setDesignerOptions(sanitizeDesignerOptions(fallbackDesigners));
        setDesignersLoaded(true);
        return;
      }

      setIsLoadingDesigners(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks/designers`);
        const payload = await response.json();
        if (!response.ok) {
          const errorMessage =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error.trim()
              : 'Failed to load designers';
          throw new Error(errorMessage);
        }
        const source = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.designers)
            ? payload.designers
            : [];
        const mapped = source
          .map((designer: any) => {
            const id = String(designer?.id || designer?._id || '').trim();
            const email = String(designer?.email || '').trim().toLowerCase();
            const name =
              String(designer?.name || '').trim() ||
              (email ? email.split('@')[0] : '');
            const designerScope =
              String(designer?.designerScope || '').trim().toLowerCase() === 'main'
                ? 'main'
                : 'junior';
            if (!id || !name) return null;
            return {
              id,
              name,
              email,
              role: String(designer?.role || 'designer').trim().toLowerCase(),
              designerScope,
              portalId:
                String(designer?.portalId || '').trim() ||
                `${designerScope === 'main' ? 'MD' : 'JD'}-${id.slice(-6).toUpperCase()}`,
            } as DesignerOption;
          })
          .filter(Boolean) as DesignerOption[];
        setDesignerOptions(sanitizeDesignerOptions(mapped));
        setDesignersLoaded(true);
      } catch (error) {
        const fallbackDesigners = buildFallbackDesigners(hydratedTasks, user);
        if (fallbackDesigners.length > 0) {
          setDesignerOptions(sanitizeDesignerOptions(fallbackDesigners));
          setDesignersLoaded(true);
        }
        const message =
          error instanceof Error && error.message ? error.message : 'Failed to load designers';
        toast.error(message);
      } finally {
        setIsLoadingDesigners(false);
      }
    };

    loadDesigners();
  }, [
    apiUrl,
    canAssignDesigner,
    designersLoaded,
    hydratedTasks,
    isAssignModalOpen,
    user,
  ]);

  const submitAssignDesigner = async () => {
    const taskId = assigningTask?.id || (assigningTask as { _id?: string } | null)?._id || '';
    if (!taskId) {
      toast.error('Task not found.');
      return;
    }
    if (!selectedDesignerId) {
      toast.error('Select a designer to continue.');
      return;
    }
    if (!apiUrl) {
      toast.error('Assignment API is not configured.');
      return;
    }
    if (!assignmentDeadline) {
      toast.error('Select a deadline before assigning.');
      return;
    }
    if (!assignmentDeadlineTime) {
      toast.error('Select deadline time before assigning.');
      return;
    }

    const deadlinePayload = `${assignmentDeadline}T${assignmentDeadlineTime}:00`;
    const parsedDeadlinePayload = new Date(deadlinePayload);
    if (Number.isNaN(parsedDeadlinePayload.getTime())) {
      toast.error('Invalid deadline date and time.');
      return;
    }

    setIsAssigningDesigner(true);
    try {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/assign-designer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_designer_id: selectedDesignerId,
          cc_emails: ccEmails,
          message: assignmentMessage.trim(),
          deadline: deadlinePayload,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to assign designer.');
      }

      const updatedTaskRaw = (payload?.task || payload) as any;
      const updatedTaskId = updatedTaskRaw?.id || updatedTaskRaw?._id;
      if (updatedTaskId) {
        setTasks((prev) =>
          prev.map((task) => {
            if ((task.id || (task as { _id?: string })._id) !== updatedTaskId) {
              return task;
            }
            return hydrateTask({
              ...updatedTaskRaw,
              id: updatedTaskId,
              viewerReadAt: updatedTaskRaw?.viewerReadAt ?? task.viewerReadAt,
            } as typeof mockTasks[number]);
          })
        );
      }

      const selectedDesigner = designerOptions.find((designer) => designer.id === selectedDesignerId);
      setAssignSuccessInfo({
        taskTitle: updatedTaskRaw?.title || assigningTask?.title || 'Task',
        designerName: selectedDesigner?.name || updatedTaskRaw?.assignedToName || 'Designer',
        ccCount: ccEmails.length,
      });
      toast.success('Task assigned. Email notification is being sent.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to assign designer.';
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.includes('only designers can assign designers') ||
        normalizedMessage.includes('only designer or admin accounts can assign designers') ||
        normalizedMessage.includes('only designer, treasurer, or admin accounts can assign designers') ||
        normalizedMessage.includes('only the main designer can assign designers') ||
        normalizedMessage.includes('only the design lead can assign designers')
      ) {
        toast.error(
          'Your signed-in account is not authorized to assign designers. Demo role switch changes view only.'
        );
      } else {
        toast.error(message);
      }
    } finally {
      setIsAssigningDesigner(false);
    }
  };

  const activeRange = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  const dateFilteredTasks = useMemo(
    () => hydratedTasks.filter((task) => isWithinRange(task.createdAt, activeRange)),
    [activeRange, hydratedTasks]
  );

  const stats = calculateStats(filterTasksForUser(dateFilteredTasks, user), user.id, user.role);

  const visibleTasks = useMemo(
    () => filterTasksForUser(dateFilteredTasks, user),
    [dateFilteredTasks, user]
  );

  const relevantTasks = useMemo(() => {
    if (user.role === 'treasurer') {
      return visibleTasks.filter((t) => t.approvalStatus === 'pending');
    }
    return visibleTasks;
  }, [user.role, visibleTasks]);
  const searchFilteredTasks = useMemo(
    () =>
      relevantTasks.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.assignedToName,
          task.category,
          task.status,
        ])
      ),
    [query, relevantTasks]
  );
  const recentTasks = searchFilteredTasks.slice(0, 4);
  const treasurerRecentTasks = useMemo(() => {
    if (user.role !== 'treasurer') return [];
    return [...dateFilteredTasks]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.category,
          task.status,
        ])
      )
      .slice(0, 4);
  }, [dateFilteredTasks, query, user.role]);
  const showViewAll = useMemo(() => {
    if (user.role === 'treasurer') {
      const total = [...dateFilteredTasks].filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.category,
          task.status,
        ])
      ).length;
      return total > 4;
    }
    return searchFilteredTasks.length > 4;
  }, [dateFilteredTasks, query, searchFilteredTasks.length, user.role]);
  const pendingApprovals = useMemo(() => {
    return hydratedTasks.filter((task) => task.approvalStatus === 'pending');
  }, [hydratedTasks]);
  const filteredApprovals = useMemo(
    () =>
      pendingApprovals.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.category,
          task.status,
        ])
      ),
    [pendingApprovals, query]
  );
  useEffect(() => {
    setScopeLabel('Dashboard');
    setItems(buildSearchItemsFromTasks(relevantTasks));
  }, [relevantTasks, setItems, setScopeLabel]);

  useEffect(() => {
    const scrollContainer = document.querySelector('[data-app-scroll-container="true"]') as HTMLElement | null;
    const target = scrollContainer ?? window;
    const getScrollTop = () =>
      scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    const handleScroll = () => {
      setShowStickyHeader(getScrollTop() > 8);
    };

    handleScroll();
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const getLatestEntry = (entries: any[]) => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, current) => {
      const latestTime = new Date(latest.createdAt ?? 0).getTime();
      const currentTime = new Date(current.createdAt ?? 0).getTime();
      return currentTime > latestTime ? current : latest;
    }, entries[0]);
  };

  const staffNotifications = useMemo(() => {
    if (user.role !== 'staff') return [];
    return hydratedTasks
      .filter((task) => task.requesterId === user.id)
      .flatMap((task) =>
        (task.changeHistory || [])
          .filter(
            (entry) => {
              const isDesignerCompletion =
                entry.userRole === 'designer' &&
                entry.field === 'status' &&
                (entry.newValue === 'Completed' || entry.newValue === 'completed');
              const isDesignerDeadlineApproval =
                entry.userRole === 'designer' &&
                entry.field === 'deadline_request' &&
                entry.newValue === 'Approved';
              const isTreasurerApproval =
                entry.userRole === 'treasurer' && entry.field === 'approval_status';
              const isEmergencyApproval =
                entry.userRole === 'designer' && entry.field === 'emergency_approval';
              return (
                isDesignerCompletion ||
                isDesignerDeadlineApproval ||
                isTreasurerApproval ||
                isEmergencyApproval
              );
            }
          )
          .map((entry) => ({ ...entry, taskId: task.id, taskTitle: task.title, task }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [hydratedTasks, user.role]);

  const designerNotifications = useMemo(() => {
    if (user.role !== 'designer') return [];
    return hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const treasurerEntries = history.filter(
          (entry) => entry.userRole === 'treasurer' && entry.field === 'approval_status'
        );
        if (treasurerEntries.length > 0) {
          const latestTreasurer = getLatestEntry(treasurerEntries);
          return latestTreasurer
            ? [{ ...latestTreasurer, taskId: task.id, taskTitle: task.title, task }]
            : [];
        }
        const staffEntries = history.filter(
          (entry) =>
            entry.userRole === 'staff' &&
            [
              'description',
              'files',
              'deadline_request',
              'status',
              'staff_note',
              'created',
            ].includes(entry.field)
        );
        const latestStaff = getLatestEntry(staffEntries);
        return latestStaff
          ? [{ ...latestStaff, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [hydratedTasks, user.role]);

  const treasurerNotifications = useMemo(() => {
    if (user.role !== 'treasurer') return [];
    return hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const createdEntries = history.filter((entry) => entry.field === 'created');
        if (createdEntries.length === 0) {
          return [];
        }
        const latestCreated = getLatestEntry(createdEntries);
        return latestCreated
          ? [{ ...latestCreated, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [hydratedTasks, user.role]);

  const activeNotifications =
    user.role === 'staff'
      ? staffNotifications
      : user.role === 'designer'
        ? designerNotifications
        : user.role === 'treasurer'
          ? treasurerNotifications
          : [];

  const getNotificationTitle = (entry: any) => {
    if (entry.field === 'created') {
      return `New request: ${entry.taskTitle}`;
    }
    if (user.role === 'staff') {
      if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return `Treasurer ${decision} ${entry.taskTitle}`;
      }
      return `Designer completed ${entry.taskTitle}`;
    }
    if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return `Treasurer ${decision} ${entry.taskTitle}`;
    }
    return `Staff updated ${entry.taskTitle}`;
  };

  const getNotificationNote = (entry: any) => {
    if (entry.field === 'created') {
      return entry.note || `Submitted by ${entry.userName}`;
    }
    if (user.role === 'staff') {
      if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return entry.note || `Approval ${decision}`;
      }
      return entry.note || 'Status updated to completed';
    }
    if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return entry.note || `Approval ${decision}`;
    }
    return entry.note || `${entry.userName} updated ${entry.field}`;
  };

  const getStaffUpdatePreview = (task: typeof hydratedTasks[number]) => {
    const history = [...(task.changeHistory || [])].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    for (const entry of history) {
      if (entry.userRole !== 'staff') continue;
      if (entry.field === 'approval_status') continue;
      if (entry.field === 'staff_note' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.field === 'description' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.note) {
        return entry.note;
      }
      if (entry.newValue) {
        return entry.newValue;
      }
    }
    return '';
  };

  const updateApprovalStatus = async (
    taskId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const currentTask = hydratedTasks.find((task) => task.id === taskId);
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
      const updated = await response.json();
      setTasks((prev) =>
        prev.map((task) =>
          task.id === (updated.id || updated._id)
            ? hydrateTask({
                ...updated,
                id: updated.id || updated._id,
                viewerReadAt: updated.viewerReadAt ?? task.viewerReadAt,
              })
            : task
        )
      );
      return;
    }

    if (!currentTask) return;
    const entry = {
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
    };
    const updated = {
      ...currentTask,
      approvalStatus: decision,
      approvedBy: user?.name || '',
      approvalDate: new Date(),
      updatedAt: new Date(),
      changeHistory: [entry, ...(currentTask.changeHistory || [])],
    };
    localStorage.setItem(`designhub.task.${taskId}`, JSON.stringify(updated));
    setStorageTick((prev) => prev + 1);
  };

  const handleApprove = async (taskId: string) => {
    setProcessingApprovalId(taskId);
    try {
      await updateApprovalStatus(taskId, 'approved');
      toast.success('Request approved', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to approve request';
      toast.error(message);
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setProcessingApprovalId(taskId);
    try {
      await updateApprovalStatus(taskId, 'rejected');
      toast.success('Request rejected', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to reject request';
      toast.error(message);
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const getWelcomeMessage = () => {
    switch (user.role) {
      case 'designer':
        return 'View and complete assigned design tasks';
      case 'staff':
        return 'Submit and track your design requests';
      case 'treasurer':
        return 'Review and approve modification requests';
      default:
        return 'Welcome to DesignDesk';
    }
  };

  const summaryItems = [
    {
      label: 'Open requests',
      value: stats.pendingTasks + stats.inProgressTasks,
    },
    {
      label: 'Completed this cycle',
      value: stats.completedTasks,
    },
  ];

  if (user.role === 'treasurer') {
    summaryItems.push({
      label: 'Pending approvals',
      value: stats.pendingApprovals,
    });
  }

  if (stats.urgentTasks > 0) {
    summaryItems.push({
      label: 'Urgent tasks',
      value: stats.urgentTasks,
    });
  }

  return (
    <DashboardLayout
      background={
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[32px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(106,140,255,0.22),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,251,255,0.96))] dark:bg-[linear-gradient(180deg,#070C1D_0%,#08122A_100%)]" />
        </div>
      }
    >
      <div className="space-y-8 relative z-10 pt-2">
        <div
          className={`sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-1.5 border-b transition-all duration-200 ${showStickyHeader
              ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,251,255,0.94))] supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,251,255,0.84))] backdrop-blur-xl backdrop-saturate-125 border-white/30 dark:bg-[linear-gradient(180deg,rgba(8,16,39,0.94),rgba(8,16,39,0.9))] dark:supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(8,16,39,0.84),rgba(8,16,39,0.8))] dark:border-white/10'
              : 'bg-transparent border-transparent backdrop-blur-0 shadow-none'
            }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#647898] dark:text-[#C6D6FF]">
                Dashboard Overview
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                startDate={customStart}
                endDate={customEnd}
                onStartDateChange={setCustomStart}
                onEndDateChange={setCustomEnd}
                showLabel={false}
                compact
              />
            </div>
          </div>
        </div>

        {/* Hero + Notice */}
        <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
          <div className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl ring-1 ring-black/5 shadow-none dark:bg-card dark:border-border dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent p-5 min-h-[242px] lg:min-h-[264px]">
            <div className="relative z-10 flex h-full flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex w-fit items-center rounded-full border border-border/70 bg-secondary/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {roleLabels[user.role] || 'Member'}
                </span>
                <div>
                  <h1 className="text-3xl font-semibold text-foreground premium-headline">
                    Welcome back,{' '}
                    <span className="login-dynamic-word gradient-name bg-gradient-to-r from-sky-300 via-indigo-400 to-pink-300 dark:from-sky-200 dark:via-indigo-400 dark:to-pink-300 bg-clip-text text-transparent">
                      {user.name.split(' ')[0]}!
                    </span>
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground premium-body">{getWelcomeMessage()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="default"
                  className="bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-[0_20px_40px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-xl hover:bg-primary/85 hover:shadow-[0_22px_44px_-22px_hsl(var(--primary)/0.6)] transition-all duration-200"
                >
                  <Link to="/new-request">
                    <Plus className="h-4 w-4 mr-2" />
                    New Request
                  </Link>
                </Button>
                <Button
                  asChild
                  className="border border-[#D9E6FF] bg-[#F8FBFF] text-[#1E2A5A] shadow-none hover:shadow-none hover:bg-[#EEF4FF] transition-all duration-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:ring-white/10 dark:hover:bg-slate-900/80 dark:transition-none"
                >
                  <Link to="/tasks">Dashboard Overview</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[#D9E6FF] bg-white dark:bg-card dark:border-border p-5 min-h-[242px] lg:min-h-[264px]">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#E9F1FF] dark:bg-muted/60 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] dark:bg-muted text-primary ring-1 ring-[#D9E6FF] dark:ring-border">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Important Notice
                </p>
                <h3 className="text-base font-semibold text-foreground premium-heading">Submission standards</h3>
                <p className="text-[12.5px] leading-6 text-muted-foreground premium-body">
                  All design requests must include complete data and associated files. {DESIGN_GOVERNANCE_NOTICE_MINIMAL}
                </p>
              </div>
            </div>
            <div className="mt-5 hidden" aria-hidden="true">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-[#D9E6FF] bg-[#F9FBFF] dark:bg-card/80 dark:border-border px-4 py-3 opacity-0 pointer-events-none select-none"
                >
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-lg font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-flow-col auto-cols-fr gap-4">
          <StatsCard
            title="Total Tasks"
            value={stats.totalTasks}
            icon={<ListTodo className="h-5 w-5" />}
            variant="default"
          />
          <StatsCard
            title="Pending"
            value={stats.pendingTasks}
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgressTasks}
            icon={<Loader2 className="h-5 w-5" />}
            variant="primary"
          />
          <StatsCard
            title="Completed"
            value={stats.completedTasks}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
          />
          {user.role === 'treasurer' && (
            <StatsCard
              title="Pending Approvals"
              value={stats.pendingApprovals}
              icon={<FileCheck className="h-5 w-5" />}
              variant="urgent"
            />
          )}
          {stats.urgentTasks > 0 && (
            <StatsCard
              title="Urgent Tasks"
              value={stats.urgentTasks}
              icon={<AlertTriangle className="h-5 w-5" />}
              variant="urgent"
            />
          )}
        </div>



        {/* Activity Feed Section */}
        <div className="mb-8 flex flex-col items-start gap-4 lg:flex-row">
          <div className="w-full shrink-0 self-start lg:w-[32%] lg:max-w-[26rem]">
            <ActivityFeed
              notifications={activeNotifications.map(entry => {
                let type: 'attachment' | 'message' | 'request' | 'approval' | 'deadline' | 'system' = 'system';
                const field = String(entry.field || '').toLowerCase();
                if (field === 'files') type = 'attachment';
                else if (field === 'comment' || field === 'staff_note') type = 'message';
                else if (field === 'created') type = 'request';
                else if (field === 'approval_status' || field === 'emergency_approval') type = 'approval';
                else if (field === 'deadline_request' || field === 'deadline') type = 'deadline';

                return {
                  id: entry.id || Math.random().toString(),
                  title: getNotificationTitle(entry),
                  subtitle: getNotificationNote(entry),
                  time: format(new Date(entry.createdAt), 'h:mm a'),
                  type,
                  link: `/task/${entry.taskId}`
                };
              })}
            />
          </div>

          <div className="w-full lg:flex-1">
            {isLoading ? (
              <div className="text-center py-12 bg-card rounded-[32px] border border-border shadow-card h-full flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading tasks...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {user.role === 'staff' ? 'Your Requests' : 'Recent Tasks'}
                    </p>
                  </div>
                  {showViewAll && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="rounded-full hover:bg-slate-100"
                    >
                      <Link to={user.role === 'staff' ? '/my-requests' : '/tasks'}>
                        View All <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>

                {user.role === 'treasurer' ? (
                  treasurerRecentTasks.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {treasurerRecentTasks.map((task, index) => (
                        <div key={task.id} style={{ animationDelay: `${index * 50}ms` }} className="h-full">
                          <TaskCard
                            task={task}
                            showRequester
                            showAssignee
                            showAssignDesignerButton={canAssignDesigner}
                            onAssignDesigner={() => openAssignDesignerModal(task)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState />
                  )
                ) : (
                  /* Reusing standard recent tasks logic if not treasurer (e.g. staff/designer/other) */
                  recentTasks.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {recentTasks.map((task, index) => (
                        <div key={task.id} style={{ animationDelay: `${index * 50}ms` }} className="h-full">
                          <TaskCard
                            task={task}
                            showRequester={user.role !== 'staff'}
                            showAssignee={user.role !== 'designer' || canAssignDesigner}
                            showAssignDesignerButton={canAssignDesigner}
                            onAssignDesigner={() => openAssignDesignerModal(task)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState />
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clean up old sections if needed, but for now just fitting into the layout. 
              The original structure had 'Recent Activity' title then 'Notifications' list then 'Loading/Grid'.
              I've replaced that block with a Grid: Left Col (ActivityFeed), Right Col (Task Grid).
          */}

      </div>
      <Dialog open={isAssignModalOpen} onOpenChange={handleAssignModalChange}>
        <DialogContent className={`sm:max-w-xl ${assignPanelClassName} dark:border-0`}>
          <DialogHeader>
            <DialogTitle>Assign Designer</DialogTitle>
            <DialogDescription>
              {assignSuccessInfo
                ? `Assignment submitted for "${assignSuccessInfo.taskTitle}".`
                : assigningTask
                  ? `Assign a designer for "${assigningTask.title}" and notify everyone in CC.`
                  : 'Assign a designer and send an email notification.'}
            </DialogDescription>
          </DialogHeader>

          {assignSuccessInfo ? (
            <div className="rounded-xl border border-[#D9E6FF] bg-[#F5F8FF] p-4 dark:border-[#2A3C6B]/70 dark:bg-[#0F1D39]/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-[#EAF0FF] p-1.5 text-[#34429D] dark:bg-[#1A315E] dark:text-[#AFC5FF]">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1E2A5A] dark:text-[#E8EEFF]">
                    Assignment confirmed
                  </p>
                  <p className="text-sm text-[#2B3F86] dark:text-[#C4D3FF]">
                    <span className="font-medium">{assignSuccessInfo.taskTitle}</span> has been assigned to{' '}
                    <span className="font-medium">{assignSuccessInfo.designerName}</span>.
                  </p>
                  <p className="text-xs text-[#4B5FA8] dark:text-[#94A9E8]">
                    Email notification sent{assignSuccessInfo.ccCount > 0 ? ` to ${assignSuccessInfo.ccCount} CC recipient(s).` : '.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="assign-designer-select">Assign Designer</Label>
                <Select
                  value={selectedDesignerId}
                  onValueChange={setSelectedDesignerId}
                  disabled={isLoadingDesigners || isAssigningDesigner}
                >
                  <SelectTrigger id="assign-designer-select" className={assignFieldClassName}>
                    <SelectValue
                      placeholder={isLoadingDesigners ? 'Loading designers...' : 'Select designer'}
                    />
                  </SelectTrigger>
                  <SelectContent className={assignSelectContentClassName}>
                    {designerOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No designers available.
                      </div>
                    ) : (
                      designerOptions.map((designer) => (
                        <SelectItem key={designer.id} value={designer.id}>
                          {designer.name} ({getDesignerScopeLabel(designer.designerScope)}{designer.portalId ? ` • ${designer.portalId}` : ''})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-cc-input">CC Email(s)</Label>
                <Input
                  id="assign-cc-input"
                  type="email"
                  value={ccInput}
                  onChange={(event) => setCcInput(event.target.value)}
                  onKeyDown={handleCcInputKeyDown}
                  onBlur={() => addCcEmail(ccInput)}
                  placeholder="Type email and press Enter"
                  disabled={isAssigningDesigner}
                  className={assignFieldClassName}
                />
                {ccEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ccEmails.map((email) => (
                      <Badge key={email} variant="secondary" className="flex items-center gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => removeCcEmail(email)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted/70"
                          aria-label={`Remove ${email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-message">Message (optional)</Label>
                <Textarea
                  id="assign-message"
                  value={assignmentMessage}
                  onChange={(event) => setAssignmentMessage(event.target.value)}
                  placeholder="Add an optional assignment note"
                  rows={4}
                  disabled={isAssigningDesigner}
                  className={`resize-none ${assignFieldClassName}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-deadline">Deadline</Label>
                <div className="grid gap-3 md:grid-cols-[1.45fr,1fr] md:items-center">
                  <Popover open={deadlineCalendarOpen} onOpenChange={setDeadlineCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="assign-deadline"
                        type="button"
                        variant="outline"
                        disabled={isAssigningDesigner}
                        className={`h-10 justify-start text-left font-medium ${assignFieldClassName}`}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-[#4863B7] dark:text-[#9FB4FF]" />
                        {assignmentDeadline ? format(new Date(`${assignmentDeadline}T00:00:00`), 'PPP') : 'Pick deadline date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto border-[#C9D7FF] bg-[#F2F6FF]/95 p-2 supports-[backdrop-filter]:bg-[#F2F6FF]/70 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/90 dark:supports-[backdrop-filter]:bg-slate-900/70"
                    >
                      <DateCalendar
                        mode="single"
                        selected={assignmentDeadline ? new Date(`${assignmentDeadline}T00:00:00`) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          setAssignmentDeadline(format(date, 'yyyy-MM-dd'));
                          setDeadlineCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className="rounded-lg border border-[#D9E6FF] bg-white/75 p-2 dark:border-slate-700/60 dark:bg-slate-900/60"
                        classNames={{
                          caption_label: 'text-sm font-semibold text-[#253977] dark:text-[#C8D7FF]',
                          head_cell: 'w-9 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#5D75B9] dark:text-[#9CB3EE]',
                          cell: 'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
                          day: 'h-9 w-9 rounded-md border border-transparent p-0 font-medium text-[#223067] hover:bg-[#EAF1FF] hover:text-[#223067] aria-selected:opacity-100 dark:text-[#D6E2FF] dark:hover:bg-[#1A315E] dark:hover:text-[#D6E2FF]',
                          nav_button:
                            'h-7 w-7 border border-[#C7D9FF] bg-white text-[#3B54A6] hover:bg-[#EEF4FF] dark:border-[#33508A] dark:bg-[#15274F] dark:text-[#B4C7FF] dark:hover:bg-[#1B315F]',
                          day_selected:
                            'bg-[#3550A8] text-white hover:bg-[#2C4391] focus:bg-[#2C4391] focus:text-white',
                          day_today:
                            'bg-[#E1EBFF] text-[#1E2E66] dark:bg-[#29447D] dark:text-[#D9E4FF]',
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="rounded-xl border border-[#D9E6FF] bg-white/75 px-3 py-2 backdrop-blur-lg dark:border-slate-700/60 dark:bg-slate-900/60">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6B82C3] dark:text-[#8FA7E6]">
                          Time
                        </p>
                        <p className="mt-0.5 text-sm font-semibold tracking-tight text-[#223067] dark:text-[#D6E2FF]">
                          {deadlineTimeParts.hour}:{deadlineTimeParts.minute} {deadlineTimeParts.period}
                        </p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-[#4863B7] ring-1 ring-[#D7E2FF] dark:bg-slate-800/70 dark:text-slate-200 dark:ring-slate-700/60">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={deadlineTimeParts.hour}
                        onValueChange={(value) =>
                          setAssignmentDeadlineTime(
                            toTwentyFourHourTime(value, deadlineTimeParts.minute, deadlineTimeParts.period)
                          )
                        }
                        disabled={isAssigningDesigner}
                      >
                        <SelectTrigger className={`h-9 rounded-lg font-semibold ${assignFieldClassName}`}>
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent className={assignSelectContentClassName}>
                          {DEADLINE_HOURS.map((hour) => (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={deadlineTimeParts.minute}
                        onValueChange={(value) =>
                          setAssignmentDeadlineTime(
                            toTwentyFourHourTime(deadlineTimeParts.hour, value, deadlineTimeParts.period)
                          )
                        }
                        disabled={isAssigningDesigner}
                      >
                        <SelectTrigger className={`h-9 rounded-lg font-semibold ${assignFieldClassName}`}>
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent className={`max-h-72 ${assignSelectContentClassName}`}>
                          {DEADLINE_MINUTES.map((minute) => (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={deadlineTimeParts.period}
                        onValueChange={(value: (typeof DEADLINE_PERIODS)[number]) =>
                          setAssignmentDeadlineTime(
                            toTwentyFourHourTime(deadlineTimeParts.hour, deadlineTimeParts.minute, value)
                          )
                        }
                        disabled={isAssigningDesigner}
                      >
                        <SelectTrigger className={`h-9 rounded-lg font-semibold ${assignFieldClassName}`}>
                          <SelectValue placeholder="AM/PM" />
                        </SelectTrigger>
                        <SelectContent className={assignSelectContentClassName}>
                          {DEADLINE_PERIODS.map((period) => (
                            <SelectItem key={period} value={period}>
                              {period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set exact deadline date and time for the assigned junior designer.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {assignSuccessInfo ? (
              <Button type="button" onClick={() => handleAssignModalChange(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAssignModalChange(false)}
                  disabled={isAssigningDesigner}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitAssignDesigner}
                  disabled={
                    !selectedDesignerId ||
                    !assignmentDeadline ||
                    !assignmentDeadlineTime ||
                    isAssigningDesigner ||
                    isLoadingDesigners
                  }
                >
                  {isAssigningDesigner ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign & Notify'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout >
  );
}




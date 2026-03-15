import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  ListTodo,
  CheckSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  UserPen,
  Shield,
  Calendar,
  LayoutGrid,
  Mail,
  Bell,
  SlidersHorizontal,
  Plus,
  HelpCircle,
  Sparkles,
  Search,
  FileText,
  Database,
  Clock,
  PenLine,
  X,
  PhoneCall,
  QrCode,
  Copy,
  Share2,
  MessageCircle,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { toast } from '@/components/ui/sonner';
import { useTheme } from 'next-themes';
import { DESIGN_GOVERNANCE_EMAIL_LINES } from '@/lib/designGovernance';
import {
  REQUEST_DRAFT_UPDATED_EVENT,
  getRequestDraftStorageKey,
  hasRequestDraft,
} from '@/lib/requestDrafts';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: number;
}

const EMAIL_DRAFT_MAILTO_STORAGE_KEY = 'designhub:email-draft-mailto';
const EMAIL_SEND_PENDING_KEY = 'designhub:gmail-send-pending';
const EMAIL_COMPOSE_OPENED_EVENT = 'designhub:gmail-compose-opened';
const PORTAL_SHARE_URL = 'https://designdesk.vercel.app';
const PORTAL_DISPLAY_URL = 'designdesk.vercel.app';
const PORTAL_SHARE_TEXT = 'Open the DesignDesk portal';
const PORTAL_QR_LIGHT_IMAGE_SRC = '/portal-qr-light.svg';
const PORTAL_QR_DARK_IMAGE_SRC = '/portal-qr-dark.svg';
const APP_VERSION_LABEL = `v${String(__APP_VERSION__ || '0.0.0').replace(/^v/i, '')}`;
const decodeValue = (value: string) => {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return value || '';
  }
};

const getFallbackEmailDraft = () => {
  const to = 'design@smvec.ac.in';
  const subject = 'Design Request - New Design Request';
  const timestamp = new Date().toLocaleString();
  const sectionDivider = '----------------------------------------';
  const body = [
    sectionDivider,
    'SUBMISSION GUIDELINES',
    sectionDivider,
    '',
    'Data Requirements',
    '- All final text content',
    '- Images / photographs',
    '- Logos (high resolution)',
    '- Reference designs or samples',
    '',
    'Timeline',
    '- Minimum 3 working days for standard requests',
    '- Urgent requests require proper justification',
    '',
    'Design Governance',
    ...DESIGN_GOVERNANCE_EMAIL_LINES.map((line) => `- ${line}`),
    '',
    'Attachments Required',
    '- Screenshot of the requirement screen (MANDATORY)',
    '- Reference images',
    '- Logos',
    '- Text content',
    '- Any supporting files',
    '',
  ].join('\n');
  return { to, subject, body };
};

const parseMailtoDraft = (mailtoUrl: string) => {
  if (!mailtoUrl || !mailtoUrl.startsWith('mailto:')) return null;
  const withoutScheme = mailtoUrl.slice('mailto:'.length);
  const [toPart, queryPart = ''] = withoutScheme.split('?');
  const params = new URLSearchParams(queryPart);
  return {
    to: decodeValue(toPart),
    subject: decodeValue(params.get('subject') || ''),
    body: decodeValue(params.get('body') || ''),
  };
};

const createGmailComposeUrl = (to: string, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    roles: ['designer', 'staff', 'treasurer'],
  },
  {
    title: 'New Request',
    href: '/new-request',
    icon: PlusCircle,
    roles: ['treasurer'],
  },
  {
    title: 'All Tasks',
    href: '/tasks',
    icon: ListTodo,
    roles: ['designer'],
  },
  {
    title: 'Designer Availability',
    href: '/designer-availability',
    icon: Calendar,
    roles: ['designer', 'treasurer', 'admin'],
  },
  {
    title: 'My Requests',
    href: '/my-requests',
    icon: ListTodo,
    roles: ['staff', 'treasurer'],
  },
  {
    title: 'Pending Approvals',
    href: '/approvals',
    icon: CheckSquare,
    roles: ['treasurer'],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme = 'light', resolvedTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(() => hasRequestDraft(user));
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [portalLinkCopied, setPortalLinkCopied] = useState(false);
  const portalCopyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDarkTheme = (resolvedTheme || theme) === 'dark';
  const portalQrImageSrc = isDarkTheme ? PORTAL_QR_DARK_IMAGE_SRC : PORTAL_QR_LIGHT_IMAGE_SRC;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!user) {
      document.documentElement.style.removeProperty('--app-sidebar-width');
      return;
    }
    const width = collapsed ? '4rem' : '14.95rem';
    document.documentElement.style.setProperty('--app-sidebar-width', width);
    return () => {
      document.documentElement.style.removeProperty('--app-sidebar-width');
    };
  }, [collapsed, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [user]);

  useEffect(() => {
    return () => {
      if (portalCopyResetTimerRef.current) {
        clearTimeout(portalCopyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setHasSavedDraft(hasRequestDraft(user));
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    [PORTAL_QR_LIGHT_IMAGE_SRC, PORTAL_QR_DARK_IMAGE_SRC].forEach((src) => {
      const image = new window.Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleGuidelinesOpen = () => setActiveQuickAction('open-guidelines');
    const handleGuidelinesClose = () => setActiveQuickAction((current) => (
      current === 'open-guidelines' ? null : current
    ));

    window.addEventListener('designhub:open-guidelines', handleGuidelinesOpen as EventListener);
    window.addEventListener('designhub:close-guidelines', handleGuidelinesClose as EventListener);
    return () => {
      window.removeEventListener('designhub:open-guidelines', handleGuidelinesOpen as EventListener);
      window.removeEventListener('designhub:close-guidelines', handleGuidelinesClose as EventListener);
    };
  }, []);

  if (!user) return null;

  const quickAccessItems = [
    { label: 'Submission Guidelines', icon: FileText, action: 'open-guidelines' as const },
    { label: 'Edit Profile', icon: UserPen, href: '/settings#profile' },
    { label: 'Search', icon: Search, action: 'open-search' as const },
    { label: 'Email Design Request', icon: Mail, action: 'email-design-request' as const },
    { label: 'Contact Design Coordinate Executive', icon: PhoneCall, href: 'tel:+919003776002' },
  ];

  const filteredNavItems = useMemo(() => {
    const items = navItems.filter((item) => item.roles.includes(user.role));
    const shouldShowDraftNav =
      (hasSavedDraft || location.pathname === '/drafts') &&
      (user.role === 'staff' || user.role === 'treasurer');
    if (!shouldShowDraftNav) {
      return items;
    }

    const draftNavItem: NavItem = {
      title: 'Drafts',
      href: '/drafts',
      icon: PenLine,
      roles: ['staff', 'treasurer'],
    };
    const myRequestsIndex = items.findIndex((item) => item.href === '/my-requests');
    const insertIndex = myRequestsIndex >= 0 ? myRequestsIndex + 1 : items.length;
    items.splice(insertIndex, 0, draftNavItem);
    return items;
  }, [hasSavedDraft, location.pathname, user.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draftKey = getRequestDraftStorageKey(user);
    const syncDraftState = () => {
      setHasSavedDraft(hasRequestDraft(user));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== draftKey) return;
      syncDraftState();
    };
    const handleDraftUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key !== draftKey) return;
      syncDraftState();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(REQUEST_DRAFT_UPDATED_EVENT, handleDraftUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(REQUEST_DRAFT_UPDATED_EVENT, handleDraftUpdated);
    };
  }, [user]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      designer: 'Designer',
      staff: 'Staff',
      treasurer: 'Treasurer',
    };
    return labels[role] || role;
  };

  const getRoleIcon = (role: string) => {
    if (role === 'treasurer') {
      return <Shield className="h-3 w-3" />;
    }
    return <User className="h-3 w-3" />;
  };

  const getNavLinkClass = (path: string | null) => {
    const isActive = path ? location.pathname === path : false;
    return cn(
      'flex w-full items-center gap-[0.66rem] rounded-[1rem] px-[0.66rem] py-[0.525rem] transition-colors duration-150',
      isActive
        ? 'border-none bg-primary/75 bg-gradient-to-br from-white/20 via-primary/80 to-primary/90 text-primary-foreground backdrop-blur-2xl dark:bg-primary/70 dark:text-primary-foreground'
        : 'border border-transparent text-[#475569] hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:backdrop-blur-xl dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground dark:hover:border-border',
      collapsed && 'justify-center px-[0.4rem]'
    );
  };

  const renderCollapsedTooltip = (label: string) => {
    if (!collapsed) return null;
    return (
      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-[120] -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 max-w-[220px] overflow-hidden text-ellipsis">
        {label}
      </span>
    );
  };

  const openEmailDesignRequest = () => {
    if (typeof window === 'undefined') return;
    const storedMailto = window.localStorage.getItem(EMAIL_DRAFT_MAILTO_STORAGE_KEY) || '';
    const draft = parseMailtoDraft(storedMailto) || getFallbackEmailDraft();
    window.localStorage.setItem(
      EMAIL_SEND_PENDING_KEY,
      JSON.stringify({ openedAt: Date.now() })
    );
    window.dispatchEvent(new CustomEvent(EMAIL_COMPOSE_OPENED_EVENT));
    const gmailUrl = createGmailComposeUrl(draft.to, draft.subject, draft.body);
    const popup = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      const fallbackLink = window.document.createElement('a');
      fallbackLink.href = gmailUrl;
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noopener noreferrer';
      fallbackLink.style.display = 'none';
      window.document.body.appendChild(fallbackLink);
      fallbackLink.click();
      fallbackLink.remove();
    }
  };

  const copyPortalLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      if (!window.navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await window.navigator.clipboard.writeText(PORTAL_SHARE_URL);
      setPortalLinkCopied(true);
      if (portalCopyResetTimerRef.current) {
        clearTimeout(portalCopyResetTimerRef.current);
      }
      portalCopyResetTimerRef.current = setTimeout(() => {
        setPortalLinkCopied(false);
      }, 1200);
      toast.success('Portal link copied');
    } catch {
      window.prompt('Copy DesignDesk portal link', PORTAL_SHARE_URL);
    }
  };

  const sharePortalLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      if (typeof window.navigator.share === 'function') {
        await window.navigator.share({
          title: 'DesignDesk',
          text: PORTAL_SHARE_TEXT,
          url: PORTAL_SHARE_URL,
        });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }

    await copyPortalLink();
  };

  const sharePortalLinkOnWhatsApp = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(
      `${PORTAL_SHARE_TEXT} ${PORTAL_SHARE_URL}`
    )}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const sharePortalLinkByEmail = () => {
    if (typeof window === 'undefined') return;
    const subject = encodeURIComponent('DesignDesk Portal');
    const body = encodeURIComponent(`${PORTAL_SHARE_TEXT}\n${PORTAL_SHARE_URL}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const getQuickAccessButtonClass = (isActive = false) =>
    cn(
      "group flex items-center justify-center rounded-full border transition",
      isActive
        ? "border-primary/35 bg-primary/12 text-primary shadow-[0_12px_24px_-18px_rgba(53,80,168,0.45)] dark:border-primary/40 dark:bg-primary/20 dark:text-primary"
        : "border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
    );

  return (
    <>
      <aside
        className={cn(
          'group/sidebar z-[90] flex flex-col rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-[#475569] dark:bg-card/95 dark:bg-none dark:text-foreground dark:border-border shadow-none h-full fixed top-4 md:top-6 left-4 md:left-6 h-auto',
          collapsed ? 'w-16' : 'w-[14.95rem]'
        )}
      >
      {/* Header */}
      <div
        className={cn(
          'group/sidebar-header border-b border-[#D9E6FF]/70 dark:border-border',
          collapsed
            ? 'relative flex items-center justify-center px-2 py-2.5'
            : 'flex items-center justify-between px-[0.92rem] py-[0.8rem]'
        )}
      >
        <button
          type="button"
          onClick={() => {
            navigate('/dashboard');
          }}
          className={cn(
            "flex items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-md",
            collapsed
              ? "justify-center transition-opacity duration-150 group-hover/sidebar:opacity-0 group-hover/sidebar:pointer-events-none group-focus-within/sidebar:opacity-0 group-focus-within/sidebar:pointer-events-none"
              : "min-w-0 flex-1 gap-[0.66rem]"
          )}
          aria-label="Go to dashboard"
        >
          <span
            className={cn(
              'inline-flex items-center justify-center border border-[#C9D7FF] bg-gradient-to-br from-white/85 via-[#EAF2FF]/80 to-[#DDE9FF]/70 backdrop-blur dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-700/80 dark:shadow-none',
              collapsed ? 'h-8 w-8 rounded-[0.9rem]' : 'h-[2.35rem] w-[2.35rem] rounded-[1rem]'
            )}
          >
            <img
              src="/favicon.png"
              alt="DesignDesk"
              className={cn(
                'rounded-lg object-contain p-0.5',
                collapsed ? 'h-6 w-6' : 'h-[1.85rem] w-[1.85rem]'
              )}
            />
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <h1 className="text-[0.95rem] font-bold tracking-[-0.01em] text-[#1E2A5A] dark:text-foreground premium-headline">
                DesignDesk
              </h1>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6B7A99] dark:text-muted-foreground premium-muted">
                Task Portal
              </p>
            </div>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((current) => !current)}
          className={cn(
            'text-[#6B7A99] dark:text-muted-foreground hover:bg-white/70 dark:hover:bg-muted hover:text-[#1E2A5A] dark:hover:text-foreground',
            collapsed
              ? 'pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-[0.9rem] border border-[#C9D7FF] bg-white/80 opacity-0 shadow-none transition-opacity duration-150 group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100 group-focus-within/sidebar:pointer-events-auto group-focus-within/sidebar:opacity-100 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700/70 dark:bg-slate-900/80'
              : 'ml-2 h-[2.35rem] w-[2.35rem] opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100 group-hover/sidebar-header:opacity-100 group-focus-within/sidebar-header:opacity-100'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-[0.92rem] py-[0.8rem] border-b border-[#D9E6FF]/70 dark:border-border">
          <div className="flex items-center gap-[0.66rem]">
            <UserAvatar
              name={user.name}
              avatar={user.avatar}
              className="h-[2.35rem] w-[2.35rem] border border-white/10"
              fallbackClassName="text-xs"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#1E2A5A] dark:text-foreground truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-[#6B7A99] dark:text-muted-foreground">
                {getRoleIcon(user.role)}
                <span>{getRoleLabel(user.role)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 px-[0.66rem] py-[0.525rem] space-y-[0.3rem] scrollbar-thin",
          collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
        )}
      >
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.href} className="relative group hover:z-20">
              {renderCollapsedTooltip(item.title)}
              <Link
                to={item.href}
                aria-label={item.title}
                className={cn(
                  getNavLinkClass(item.href)
                )}
              >
                <item.icon className="h-[1.16rem] w-[1.16rem] flex-shrink-0" />
                {!collapsed && (
                  <span className="text-[13px] font-medium">
                    {item.title}
                  </span>
                )}
                {!collapsed && item.badge && item.badge > 0 && (
                  <Badge variant="urgent" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-[0.66rem] pb-[0.66rem]">
          <div className="rounded-[1.26rem] border border-[#D9E6FF] bg-white/72 dark:bg-card/78 dark:border-border px-[0.66rem] py-[0.525rem] shadow-none">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A97B2] dark:text-muted-foreground">
              Quick Access
            </p>
            <div className="mt-[0.4rem] flex items-center gap-[0.4rem]">
              {quickAccessItems.map((item) => {
                const tooltip = (
                  <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-[120] -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border pl-4 pr-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 max-w-[220px] overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                );

                if (item.href) {
                  const isExternal = item.href.startsWith('tel:') || item.href.startsWith('http');
                  return (
                    <div key={item.label} className="relative group hover:z-20">
                      {tooltip}
                      {isExternal ? (
                        <a
                          href={item.href}
                          aria-label={item.label}
                          className="group flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                        >
                          <item.icon className="h-[0.92rem] w-[0.92rem]" />
                        </a>
                      ) : (
                        <Link
                          to={item.href}
                          aria-label={item.label}
                          className="group flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                        >
                          <item.icon className="h-[0.92rem] w-[0.92rem]" />
                        </Link>
                      )}
                    </div>
                  );
                }

                if (item.action === 'open-search') {
                  return (
                    <div key={item.label} className="relative group hover:z-20">
                      {tooltip}
                      <button
                        type="button"
                        aria-label={item.label}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('designhub:open-search'));
                        }}
                        className="group flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-[0.92rem] w-[0.92rem]" />
                      </button>
                    </div>
                  );
                }

                if (item.action === 'open-guidelines') {
                  const isActive = activeQuickAction === item.action;
                  return (
                    <div key={item.label} className="relative group hover:z-20">
                      {tooltip}
                      <button
                        type="button"
                        aria-label={item.label}
                        onClick={() => {
                          setActiveQuickAction(item.action);
                          window.dispatchEvent(new CustomEvent('designhub:open-guidelines'));
                        }}
                        className={cn(getQuickAccessButtonClass(isActive), "h-[2.1rem] w-[2.1rem]")}
                      >
                        <item.icon className="h-[0.92rem] w-[0.92rem]" />
                      </button>
                    </div>
                  );
                }

                if (item.action === 'email-design-request') {
                  return (
                    <div key={item.label} className="relative group hover:z-20">
                      {tooltip}
                      <button
                        type="button"
                        aria-label={item.label}
                        onClick={openEmailDesignRequest}
                        className="group flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-[0.92rem] w-[0.92rem]" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={item.label} className="relative group hover:z-20">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      className="group flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                    >
                      <item.icon className="h-[0.92rem] w-[0.92rem]" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {(user.role === 'staff' || user.role === 'treasurer') && (
            <div className="relative group hover:z-20">
              <span className="pointer-events-none absolute -top-9 left-1/2 z-[120] -translate-x-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:-translate-y-0.5">
                Create New Request
              </span>
              <Link
                to="/new-request"
                className="mt-2.5 flex flex-col items-center gap-1.5 rounded-[1.2rem] border border-[#D9E6FF] bg-white/72 dark:bg-card/78 dark:border-border px-2.5 py-3 text-center shadow-none transition dark:transition-none"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-primary-foreground shadow-none">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#1E2A5A] dark:text-foreground">Create New Request</p>
                  <p className="text-[11px] text-[#6B7A99] dark:text-muted-foreground">Turn your idea into a design</p>
                </div>
              </Link>
            </div>
          )}
        </div>
      )}

      {collapsed && (
        <div className="px-[0.525rem] pb-[0.66rem] space-y-[0.66rem]">
          <div className="rounded-[1.2rem] border border-[#D9E6FF] bg-white/85 dark:bg-card/85 dark:border-border px-[0.4rem] py-[0.4rem] shadow-none">
            {quickAccessItems.map((item) => {
              const tooltip = (
                <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-[120] -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 max-w-[220px] overflow-hidden text-ellipsis">
                  {item.label}
                </span>
              );

              if (item.href) {
                const isExternal = item.href.startsWith('tel:') || item.href.startsWith('http');
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                    {tooltip}
                    {isExternal ? (
                      <a
                        href={item.href}
                        aria-label={item.label}
                        className="group mx-auto my-1 flex h-[1.85rem] w-[1.85rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                      >
                        <item.icon className="h-[0.92rem] w-[0.92rem]" />
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        aria-label={item.label}
                        className="group mx-auto my-1 flex h-[1.85rem] w-[1.85rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                      >
                        <item.icon className="h-[0.92rem] w-[0.92rem]" />
                      </Link>
                    )}
                  </div>
                );
              }

              if (item.action === 'open-search') {
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('designhub:open-search'));
                      }}
                      className="group mx-auto my-1 flex h-[1.85rem] w-[1.85rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-[0.92rem] w-[0.92rem]" />
                    </button>
                  </div>
                );
              }

              if (item.action === 'open-guidelines') {
                const isActive = activeQuickAction === item.action;
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        setActiveQuickAction(item.action);
                        window.dispatchEvent(new CustomEvent('designhub:open-guidelines'));
                      }}
                      className={cn(getQuickAccessButtonClass(isActive), "mx-auto my-1 h-[1.85rem] w-[1.85rem]")}
                    >
                      <item.icon className="h-[0.92rem] w-[0.92rem]" />
                    </button>
                  </div>
                );
              }

              if (item.action === 'email-design-request') {
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={openEmailDesignRequest}
                      className="group mx-auto my-1 flex h-[1.85rem] w-[1.85rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-[0.92rem] w-[0.92rem]" />
                    </button>
                  </div>
                );
              }

              return (
                <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                  {tooltip}
                  <div className="group mx-auto my-1 flex h-[1.85rem] w-[1.85rem] items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground">
                    <item.icon className="h-[0.92rem] w-[0.92rem]" />
                  </div>
                </div>
              );
            })}
          </div>
          {(user.role === 'staff' || user.role === 'treasurer') && (
            <div className="relative group hover:z-20">
              <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-[120] -translate-y-1/2 whitespace-nowrap rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-card dark:border-border px-3 py-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 max-w-[220px] overflow-hidden text-ellipsis">
                Create New Request
              </span>
              <Link
                to="/new-request"
                className="flex h-10 w-full items-center justify-center rounded-[1rem] bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-primary-foreground shadow-none"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-2.5 py-2.5 border-t border-[#D9E6FF]/70 dark:border-transparent space-y-0.5">
        <div className="relative group hover:z-20">
          {renderCollapsedTooltip('Settings')}
          <Link
            to="/settings"
            aria-label="Settings"
            className={cn(
              getNavLinkClass('/settings'),
              "group"
            )}
          >
            <Settings className="h-[1.1rem] w-[1.1rem]" />
            {!collapsed && <span className="text-[13px] font-medium">Settings</span>}
          </Link>
        </div>
        <div className="relative group hover:z-20">
          {renderCollapsedTooltip('Help Center')}
          <Link
            to="/help"
            aria-label="Help Center"
            className={cn(
              getNavLinkClass('/help'),
              "group"
            )}
          >
            <HelpCircle className="h-[1.1rem] w-[1.1rem]" />
            {!collapsed && <span className="text-[13px] font-medium">Help Center</span>}
          </Link>
        </div>
        <div className="relative group hover:z-20">
          {renderCollapsedTooltip('Logout')}
          <button
            onClick={() => {
              logout();
              navigate('/', { replace: true });
            }}
            aria-label="Logout"
            className={cn(
              getNavLinkClass(null),
              "group"
            )}
          >
            <LogOut className="h-[1.1rem] w-[1.1rem]" />
            {!collapsed && <span className="text-[13px] font-medium">Logout</span>}
          </button>
        </div>
        {!collapsed ? (
          <div className="mt-2.5 rounded-[1rem] border border-[#D9E6FF] bg-white/72 dark:bg-card/78 dark:border-border px-3 py-2 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A97B2] dark:text-muted-foreground">
                Version
              </p>
              <span className="inline-flex items-center rounded-full border border-[#D9E6FF] bg-[#F5F8FF] dark:bg-muted dark:border-border px-2 py-[0.15rem] text-[10px] font-semibold text-[#23396F] dark:text-foreground">
                {APP_VERSION_LABEL}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-[1.15rem] text-[#6B7A99] dark:text-muted-foreground">
              DesignDesk client release
            </p>
          </div>
        ) : null}
      </div>
      </aside>

      <HoverCard openDelay={100} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label="Show DesignDesk QR code"
            className="fixed bottom-4 left-4 z-30 hidden h-16 w-16 items-center justify-center rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] px-0 py-3 text-[#475569] shadow-none transition-colors duration-200 ease-out md:bottom-6 md:left-6 md:flex dark:border-border dark:bg-card/95 dark:bg-none dark:text-foreground"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.15rem] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-[#23396F] shadow-none dark:border-border dark:bg-card/95 dark:bg-none dark:text-slate-100">
              <QrCode className="h-[1.1rem] w-[1.1rem]" />
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          sideOffset={14}
          className="hidden w-[14.95rem] origin-bottom-left border-none bg-transparent p-0 text-[#475569] shadow-none data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[side=top]:slide-in-from-bottom-4 md:block dark:text-foreground"
        >
          <div className="rounded-[24px] border border-[#D9E6FF] bg-white/86 shadow-[0_18px_40px_-24px_rgba(30,42,90,0.45)] dark:border-border dark:bg-card/95 dark:bg-none dark:p-0 dark:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]">
            <div className="rounded-[23px] bg-white/86 px-2.5 py-2 dark:bg-transparent">
              <div className="grid grid-cols-[3.95rem_minmax(0,1fr)] items-center gap-2">
                <img
                  src={portalQrImageSrc}
                  alt="QR code to open the DesignDesk portal"
                  className="ml-1 h-[3.65rem] w-[3.65rem] rounded-none border border-[#E3EBFF] bg-white p-[0.35rem] object-contain dark:border-transparent dark:bg-[#081530]"
                  loading="eager"
                  decoding="async"
                />

              <div className="ml-1 min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-[#1E2A5A] dark:text-foreground">
                    Scan DesignDesk
                  </p>
                </div>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={sharePortalLink}
                    className="icon-action-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
                    title="Share"
                    aria-label="Share DesignDesk portal"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={sharePortalLinkOnWhatsApp}
                    className="icon-action-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
                    title="Share via WhatsApp"
                    aria-label="Share DesignDesk portal via WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={sharePortalLinkByEmail}
                    className="icon-action-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
                    title="Share via Email"
                    aria-label="Share DesignDesk portal via Email"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-success={portalLinkCopied}
                    onClick={copyPortalLink}
                    className={cn(
                      'icon-action-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none',
                      portalLinkCopied && 'border-primary/50 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/20 dark:text-primary'
                    )}
                    title={portalLinkCopied ? 'Copied' : 'Copy link'}
                    aria-label={portalLinkCopied ? 'Portal link copied' : 'Copy DesignDesk portal link'}
                  >
                    {portalLinkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </>
  );
}

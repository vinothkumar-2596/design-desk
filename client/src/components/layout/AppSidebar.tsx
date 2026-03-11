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
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { toast } from '@/components/ui/sonner';
import { useTheme } from 'next-themes';

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
const PORTAL_SHARE_URL = 'https://designdesk.vercel.app/';
const PORTAL_DISPLAY_URL = 'designdesk.vercel.app';
const PORTAL_SHARE_TEXT = 'Open the DesignDesk portal';
const PORTAL_QR_LIGHT_IMAGE_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&bgcolor=F7FAFF&color=1E2A5A&data=${encodeURIComponent(
  PORTAL_SHARE_URL
)}`;
const PORTAL_QR_DARK_IMAGE_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&bgcolor=081530&color=F3F7FF&data=${encodeURIComponent(
  PORTAL_SHARE_URL
)}`;
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
    'Modifications',
    '- Any changes after design approval require Treasurer approval',
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
    roles: ['designer', 'staff', 'treasurer', 'admin'],
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
    const width = collapsed ? '5rem' : '18rem';
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

  if (!user) return null;

  const quickAccessItems = [
    { label: 'Submission Guidelines', icon: FileText, action: 'open-guidelines' as const },
    { label: 'Edit Profile', icon: UserPen, href: '/settings#profile' },
    { label: 'Search', icon: Search, action: 'open-search' as const },
    { label: 'Email Design Request', icon: Mail, action: 'email-design-request' as const },
    { label: 'Contact Design Coordinate Executive', icon: PhoneCall, href: 'tel:+919003776002' },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

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
      'flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
      isActive
        ? 'border-none bg-primary/75 bg-gradient-to-br from-white/20 via-primary/80 to-primary/90 text-primary-foreground backdrop-blur-2xl dark:bg-primary/70 dark:text-primary-foreground'
        : 'border border-transparent text-[#475569] hover:border-[#CFE0FF] hover:bg-[#EEF4FF]/90 hover:text-[#1E2A5A] hover:backdrop-blur-xl dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground dark:hover:border-border',
      collapsed && 'justify-center px-2'
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
      window.location.href = gmailUrl;
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

  return (
    <>
      <aside
        className={cn(
          'group/sidebar z-40 flex flex-col rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-[#475569] dark:bg-card/95 dark:bg-none dark:text-foreground dark:border-border shadow-none transition-all duration-300 h-full fixed top-4 md:top-6 left-4 md:left-6 h-auto',
          collapsed ? 'w-20' : 'w-72'
        )}
      >
      {/* Header */}
      <div className="group/sidebar-header flex items-center justify-between px-4 py-3.5 border-b border-[#D9E6FF]/70 dark:border-border">
        <button
          type="button"
          onClick={() => {
            navigate('/dashboard');
          }}
          className={cn(
            "animate-fade-in flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-md",
            collapsed ? "justify-center" : "min-w-0 flex-1"
          )}
          aria-label="Go to dashboard"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-white/85 via-[#EAF2FF]/80 to-[#DDE9FF]/70 border border-[#C9D7FF] backdrop-blur dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-700/80 dark:shadow-none">
            <img
              src="/favicon.png"
              alt="DesignDesk"
              className="h-8 w-8 rounded-lg object-contain p-0.5"
            />
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <h1 className="text-[1.05rem] font-bold tracking-[-0.01em] text-[#1E2A5A] dark:text-foreground premium-headline">
                DesignDesk
              </h1>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7A99] dark:text-muted-foreground premium-muted">
                Task Portal
              </p>
            </div>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100 group-hover/sidebar-header:opacity-100 group-focus-within/sidebar-header:opacity-100 text-[#6B7A99] dark:text-muted-foreground hover:bg-white/70 dark:hover:bg-muted hover:text-[#1E2A5A] dark:hover:text-foreground",
            collapsed ? "ml-0" : "ml-2"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-[#D9E6FF]/70 dark:border-border animate-fade-in">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={user.name}
              avatar={user.avatar}
              className="h-10 w-10 border border-white/10"
              fallbackClassName="text-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1E2A5A] dark:text-foreground truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-[#6B7A99] dark:text-muted-foreground">
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
          "flex-1 p-3 space-y-1.5 scrollbar-thin",
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
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium animate-fade-in">
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
        <div className="px-3 pb-3">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/72 dark:bg-card/78 dark:border-border px-3 py-2 shadow-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A97B2] dark:text-muted-foreground">
              Quick Access
            </p>
            <div className="mt-2 flex items-center gap-2">
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
                          className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                        >
                          <item.icon className="h-4 w-4" />
                        </a>
                      ) : (
                        <Link
                          to={item.href}
                          aria-label={item.label}
                          className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                        >
                          <item.icon className="h-4 w-4" />
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
                        className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }

                if (item.action === 'open-guidelines') {
                  return (
                    <div key={item.label} className="relative group hover:z-20">
                      {tooltip}
                      <button
                        type="button"
                        aria-label={item.label}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('designhub:open-guidelines'));
                        }}
                        className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
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
                        className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
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
                      className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground transition hover:border-[#C8D7FF] hover:text-[#1E2A5A] dark:hover:text-foreground"
                    >
                      <item.icon className="h-4 w-4" />
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
                className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-[#D9E6FF] bg-white/72 dark:bg-card/78 dark:border-border px-3 py-4 text-center shadow-none transition dark:transition-none"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-primary-foreground shadow-none">
                  <Plus className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#1E2A5A] dark:text-foreground">Create New Request</p>
                  <p className="text-xs text-[#6B7A99] dark:text-muted-foreground">Turn your idea into a design</p>
                </div>
              </Link>
            </div>
          )}
        </div>
      )}

      {collapsed && (
        <div className="px-3 pb-3 space-y-3">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/85 dark:bg-card/85 dark:border-border px-2 py-2 shadow-none">
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
                        className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        aria-label={item.label}
                        className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                      >
                        <item.icon className="h-4 w-4" />
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
                      className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  </div>
                );
              }

              if (item.action === 'open-guidelines') {
                return (
                  <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                    {tooltip}
                    <button
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('designhub:open-guidelines'));
                      }}
                      className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4" />
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
                      className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  </div>
                );
              }

              return (
                <div key={`quick-collapsed-${item.label}`} className="relative group hover:z-20">
                  {tooltip}
                  <div className="group mx-auto my-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#E1E9FF] bg-[#F5F8FF] dark:bg-muted dark:border-border text-[#6B7A99] dark:text-muted-foreground">
                    <item.icon className="h-4 w-4" />
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
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-primary-foreground shadow-none"
              >
                <Plus className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-[#D9E6FF]/70 dark:border-transparent space-y-1">
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
            <Settings className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
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
            <HelpCircle className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-medium">Help Center</span>}
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
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>
      </aside>

      <HoverCard openDelay={100} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label="Show DesignDesk QR code"
            className={cn(
              'fixed bottom-4 left-4 z-30 hidden items-center rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-left text-[#475569] shadow-none transition-all duration-300 md:bottom-6 md:left-6 md:flex dark:border-border dark:bg-card/95 dark:bg-none dark:text-foreground',
              collapsed ? 'w-20 justify-center px-3 py-3' : 'w-72 gap-3 px-4 py-3'
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#C9D7FF]/80 bg-white/72 supports-[backdrop-filter]:bg-white/56 backdrop-blur-xl text-[#1E2A5A] dark:border-[#33548E]/72 dark:bg-[rgba(12,27,61,0.68)] dark:text-slate-100">
              <QrCode className="h-5 w-5" />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1E2A5A] dark:text-foreground">
                  Scan DesignDesk
                </p>
                <p className="mt-1 text-xs leading-5 text-[#6B7A99] dark:text-muted-foreground">
                  Hover to show the portal QR for mobile scan or sharing.
                </p>
              </div>
            )}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          sideOffset={14}
          className="hidden w-72 border-none bg-transparent p-0 text-[#475569] shadow-none md:block dark:text-foreground"
        >
          <div className="rounded-[24px] border border-[#D9E6FF] bg-white/86 px-3 py-3.5 dark:border-border dark:bg-slate-900/75">
            <div className="grid grid-cols-[5.6rem_minmax(0,1fr)] items-center gap-2.5">
              <div className="shrink-0 rounded-none bg-[#F7FAFF] p-1.5 dark:bg-slate-950/60">
                <img
                  src={portalQrImageSrc}
                  alt="QR code to open the DesignDesk portal"
                  className="h-[5.1rem] w-[5.1rem] rounded-none border border-[#E3EBFF] bg-white p-1 object-contain dark:border-[#223A70] dark:bg-[#081530]"
                  loading="lazy"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1E2A5A] dark:text-foreground">
                    Scan DesignDesk
                  </p>
                </div>

                <div className="mt-3 rounded-2xl border border-[#D9E6FF] bg-[#F7FAFF] px-3 py-2 dark:border-border dark:bg-slate-950/40">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A97B2] dark:text-muted-foreground">
                    Portal Link
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-[#1E2A5A] dark:text-foreground">
                    {PORTAL_DISPLAY_URL}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={sharePortalLink}
                    className="icon-action-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
                    title="Share"
                    aria-label="Share DesignDesk portal"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={sharePortalLinkOnWhatsApp}
                    className="icon-action-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
                    title="Share via WhatsApp"
                    aria-label="Share DesignDesk portal via WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={sharePortalLinkByEmail}
                    className="icon-action-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
                    title="Share via Email"
                    aria-label="Share DesignDesk portal via Email"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    data-success={portalLinkCopied}
                    onClick={copyPortalLink}
                    className={cn(
                      'icon-action-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none',
                      portalLinkCopied && 'border-primary/50 bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/20 dark:text-primary'
                    )}
                    title={portalLinkCopied ? 'Copied' : 'Copy link'}
                    aria-label={portalLinkCopied ? 'Portal link copied' : 'Copy DesignDesk portal link'}
                  >
                    {portalLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </>
  );
}

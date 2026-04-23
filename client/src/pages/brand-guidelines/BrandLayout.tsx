import { ReactNode, useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  ArrowLeft,
  Moon,
  Sun,
  Download,
  Home as HomeIcon,
  Info,
  Compass,
  Bookmark,
  Palette as PaletteIcon,
  Type as TypeIcon,
  LayoutGrid,
  Ruler,
  Square,
  BookOpen,
  Check,
  Mail,
  Sparkles,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react';
import { BRAND_NAVIGATION, BRAND_ASSETS, type BrandNavIcon } from './assets';

const NAV_ICON_MAP: Record<BrandNavIcon, LucideIcon> = {
  home: HomeIcon,
  info: Info,
  compass: Compass,
  logo: Bookmark,
  palette: PaletteIcon,
  type: TypeIcon,
  components: LayoutGrid,
  ruler: Ruler,
  image: Square,
  download: Download,
  blog: BookOpen,
  workflow: Check,
  mail: Mail,
  review: Sparkles,
  designdesk: MonitorSmartphone,
};
import { cn } from '@/lib/utils';
import './fonts.css';
import './tokens.css';

type BrandLayoutProps = {
  children: ReactNode;
};

export function BrandLayout({ children }: BrandLayoutProps) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const isDark = theme === 'dark';

  return (
    <div className="brand-root min-h-screen">
      {/* BRAND COLOR STRIPE */}
      <div className="flex h-2 w-full" aria-hidden="true">
        <span style={{ width: '60%', background: 'var(--smvec-blue)' }} />
        <span style={{ width: '25%', background: 'var(--smvec-gold)' }} />
        <span style={{ width: '10%', background: '#5A6376' }} />
        <span style={{ width: '5%', background: 'var(--smvec-blue-100)' }} />
      </div>

      {/* TOP BAR */}
      <header className="brand-layout-header sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 lg:pl-4 lg:pr-10">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="brand-layout-back-btn"
              title="Back to DesignDesk"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/brand-guidelines" className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm p-1" style={{ background: 'var(--bg-1)' }}>
                <img
                  src={BRAND_ASSETS.svg.frame42}
                  alt="SMVEC emblem"
                  className="h-full w-full object-contain"
                />
              </span>
              <div className="flex flex-col leading-tight">
                <p className="brand-header-wordmark text-[13px] font-semibold tracking-[-0.01em]">
                  SMVEC
                  <span aria-hidden="true" className="mx-1.5 font-normal" style={{ color: 'var(--fg-3)', opacity: 0.55 }}>×</span>
                  DesignDesk
                </p>
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.22em]"
                  style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-display)' }}
                >
                  BrandDesk · Studio
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink
                to="/brand-guidelines/designdesk"
                className={({ isActive }) =>
                  cn('brand-topnav-link', isActive ? 'brand-topnav-link--active' : '')
                }
              >
                DesignDesk
              </NavLink>
              <NavLink
                to="/brand-guidelines/review"
                className={({ isActive }) =>
                  cn('brand-analyser-pill', isActive ? 'brand-analyser-pill--active' : '')
                }
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--smvec-gold)' }} strokeWidth={2} />
                Brand Compliance Analyser
              </NavLink>
            </nav>

            {mounted && (
              <button
                type="button"
                className="brand-layout-theme-btn"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label="Toggle theme"
              >
                {isDark
                  ? <Sun className="h-4 w-4" />
                  : <Moon className="h-4 w-4" />
                }
              </button>
            )}

          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-8 px-4 py-10 lg:gap-20 lg:pl-4 lg:pr-10">
        {/* SIDE NAV */}
        <aside
          className={cn(
            'shrink-0 lg:block',
            mobileNavOpen
              ? 'brand-mobile-sidebar fixed inset-x-0 top-14 z-30 block max-h-[calc(100vh-3.5rem)] overflow-y-auto p-5 shadow-lg lg:relative lg:inset-auto lg:max-h-none lg:overflow-visible lg:border-0 lg:p-0 lg:shadow-none lg:background-none'
              : 'hidden'
          )}
        >
          <nav
            className="lg:sticky lg:top-20 lg:w-60"
            aria-label="Brand guidelines"
          >
            <div className="space-y-5">
              {BRAND_NAVIGATION.map((group, groupIdx) => (
                <div key={group.group} className="space-y-2">
                  <div className="px-3">
                    <p
                      className="brand-nav-group-label text-[9.5px] font-medium uppercase tracking-[0.26em]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      <span aria-hidden="true" className="brand-nav-group-number mr-2">
                        {String(groupIdx + 1).padStart(2, '0')}
                      </span>
                      {group.group}
                    </p>
                    {group.caption ? (
                      <p
                        className="brand-nav-group-caption mt-0.5 text-[10.5px]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {group.caption}
                      </p>
                    ) : null}
                  </div>
                  <ul className="space-y-px">
                    {group.items.map((item) => {
                      const Icon = item.icon ? NAV_ICON_MAP[item.icon] : null;
                      return (
                        <li key={item.href}>
                          <NavLink
                            to={item.href}
                            end={item.href === '/brand-guidelines'}
                            className={({ isActive }) =>
                              cn('brand-nav-link', isActive ? 'brand-nav-link--active' : '')
                            }
                          >
                            {Icon ? (
                              <Icon
                                className="h-3.5 w-3.5 shrink-0"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                            ) : null}
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* FOOTER */}
      <footer className="brand-layout-footer">
        <div className="mx-auto max-w-[1440px] px-4 py-5 lg:pl-[calc(15rem+5rem+1rem)] lg:pr-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={BRAND_ASSETS.svg.frame42}
                alt="SMVEC emblem"
                className="h-6 w-6 object-contain"
              />
              <p className="brand-footer-copy text-[12px]">
                &copy; {new Date().getFullYear()} Sri Manakula Vinayagar Engineering College. Brand guidelines for internal teams and partner agencies.
              </p>
            </div>
            <p className="brand-footer-version text-[11px] font-medium">
              Brand Manual · v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

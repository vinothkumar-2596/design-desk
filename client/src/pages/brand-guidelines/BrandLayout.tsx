import { ReactNode, useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Menu,
  X,
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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
      <header className="sticky top-0 z-40 border-b border-[#E4E7F1] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 lg:pl-4 lg:pr-10">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E7F1] text-[#48506B] transition-colors hover:border-[#36429B]/40 hover:text-[#36429B]"
              title="Back to DesignDesk"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/brand-guidelines" className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-white p-1">
                <img
                  src={BRAND_ASSETS.svg.frame42}
                  alt="SMVEC emblem"
                  className="h-full w-full object-contain"
                />
              </span>
              <div className="flex flex-col leading-tight">
                <p
                  className="text-[13px] font-semibold tracking-[-0.01em]"
                  style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
                >
                  SMVEC
                  <span aria-hidden="true" className="mx-1.5 font-normal text-[#C4C9DC]">×</span>
                  DesignDesk
                </p>
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.22em]"
                  style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-display)' }}
                >
                  Brand Guidelines
                </p>
              </div>
            </Link>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              to="/brand-guidelines/logo"
              className={({ isActive }) =>
                cn(
                  'rounded px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  isActive
                    ? 'text-[#36429B]'
                    : 'text-[#48506B] hover:text-[#0B1024]'
                )
              }
            >
              Logo
            </NavLink>
            <NavLink
              to="/brand-guidelines/colors"
              className={({ isActive }) =>
                cn(
                  'rounded px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  isActive ? 'text-[#36429B]' : 'text-[#48506B] hover:text-[#0B1024]'
                )
              }
            >
              Colors
            </NavLink>
            <NavLink
              to="/brand-guidelines/typography"
              className={({ isActive }) =>
                cn(
                  'rounded px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  isActive ? 'text-[#36429B]' : 'text-[#48506B] hover:text-[#0B1024]'
                )
              }
            >
              Typography
            </NavLink>
            <NavLink
              to="/brand-guidelines/applications"
              className={({ isActive }) =>
                cn(
                  'rounded px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  isActive ? 'text-[#36429B]' : 'text-[#48506B] hover:text-[#0B1024]'
                )
              }
            >
              Applications
            </NavLink>
            <Link
              to="/brand-guidelines/downloads"
              className="ml-2 inline-flex items-center gap-1.5 rounded-sm bg-[#36429B] px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2C3680]"
            >
              <Download className="h-3.5 w-3.5" />
              Downloads
            </Link>
          </nav>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E7F1] text-[#48506B] md:hidden"
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-8 px-4 py-10 lg:gap-20 lg:pl-4 lg:pr-10">
        {/* SIDE NAV */}
        <aside
          className={cn(
            'shrink-0 lg:block',
            mobileNavOpen
              ? 'fixed inset-x-0 top-14 z-30 block max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-[#E4E7F1] bg-white p-5 shadow-lg lg:relative lg:inset-auto lg:max-h-none lg:overflow-visible lg:border-0 lg:p-0 lg:shadow-none'
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
                      className="text-[9.5px] font-medium uppercase tracking-[0.26em] text-[#A8AEC4]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      <span aria-hidden="true" className="mr-2 text-[#CFD3E2]">
                        {String(groupIdx + 1).padStart(2, '0')}
                      </span>
                      {group.group}
                    </p>
                    {group.caption ? (
                      <p
                        className="mt-0.5 text-[10.5px]"
                        style={{ color: '#9AA0BC', fontFamily: 'var(--font-display)' }}
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
                              cn(
                                'flex items-center gap-2.5 rounded-md py-2 px-3 text-[13px] leading-5 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#36429B]/25',
                                isActive
                                  ? 'bg-[#EEF1FB] font-semibold text-[#36429B]'
                                  : 'font-semibold text-[#3D4A6E] transition-colors duration-150 ease-out hover:bg-[#EEF1FB]/60 hover:text-[#0B1024]'
                              )
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
      <footer className="border-t border-[#E4E7F1] bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-5 lg:pl-[calc(15rem+5rem+1rem)] lg:pr-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={BRAND_ASSETS.svg.frame42}
                alt="SMVEC emblem"
                className="h-6 w-6 object-contain"
              />
              <p className="text-[12px] text-[#7A8299]">
                &copy; {new Date().getFullYear()} Sri Manakula Vinayagar Engineering College. Brand guidelines for internal teams and partner agencies.
              </p>
            </div>
            <p className="text-[11px] font-medium text-[#C4C9DC]">
              Brand Manual · v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

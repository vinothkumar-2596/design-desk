import { ReactNode, useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, X, Download } from 'lucide-react';
import { BRAND_NAVIGATION } from './assets';
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
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-[#E4E7F1] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E7F1] text-[#48506B] transition-colors hover:border-[#36429B]/40 hover:text-[#36429B]"
              title="Back to DesignDesk"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/brand-guidelines" className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#36429B] text-[12px] font-semibold text-white">
                S
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#0B1024]">SMVEC</p>
                <p className="text-[10.5px] uppercase tracking-[0.18em] text-[#7A8299]">Brand Guidelines</p>
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

      <div className="mx-auto flex max-w-[1320px] gap-8 px-5 py-8 lg:gap-12">
        {/* SIDE NAV */}
        <aside
          className={cn(
            'shrink-0 lg:block',
            mobileNavOpen
              ? 'fixed inset-x-0 top-14 z-30 block max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-[#E4E7F1] bg-white p-5 shadow-lg lg:relative lg:inset-auto lg:max-h-none lg:overflow-visible lg:border-0 lg:p-0 lg:shadow-none'
              : 'hidden'
          )}
        >
          <nav className="space-y-5 lg:sticky lg:top-20 lg:w-56">
            {BRAND_NAVIGATION.map((group) => (
              <div key={group.group} className="space-y-1.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#7A8299]">
                  {group.group}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        end={item.href === '/brand-guidelines'}
                        className={({ isActive }) =>
                          cn(
                            'block rounded px-2 py-1.5 text-[13px] leading-5 transition-colors',
                            isActive
                              ? 'bg-[#F2F4FB] font-medium text-[#36429B]'
                              : 'text-[#48506B] hover:bg-[#F8F9FE] hover:text-[#0B1024]'
                          )
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-[#E4E7F1] bg-[#F8F9FE]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-6 text-[12px] text-[#7A8299] md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Sri Manakula Vinayagar Engineering College. Brand
            guidelines for internal teams and partner agencies.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/brand-guidelines/contact" className="hover:text-[#36429B]">
              Contact brand team
            </Link>
            <Link to="/brand-guidelines/approval" className="hover:text-[#36429B]">
              Approval workflow
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

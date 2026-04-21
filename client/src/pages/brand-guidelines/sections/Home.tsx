import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Download, Mail } from 'lucide-react';
import { BRAND_ASSETS } from '../assets';
import { SectionTitle } from '../components/SectionTitle';

const QUICK_LINKS = [
  { label: 'Logo & marks', href: '/brand-guidelines/logo' },
  { label: 'Color palette', href: '/brand-guidelines/colors' },
  { label: 'Typography', href: '/brand-guidelines/typography' },
  { label: 'Collateral applications', href: '/brand-guidelines/applications' },
  { label: 'Downloads', href: '/brand-guidelines/downloads' },
  { label: 'Approval workflow', href: '/brand-guidelines/approval' },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-[1.1fr,1fr] lg:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#36429B]/80">
            SMVEC · Brand Reference
          </p>
          <h1
            className="mt-3 text-[44px] font-normal leading-[1.05] tracking-[-0.015em] text-[var(--smvec-ink)] md:text-[56px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            The official reference for{' '}
            <span className="relative inline-block">
              <span className="relative z-10">consistent</span>
              <span className="absolute inset-x-0 -bottom-1 h-[4px] bg-[#DBA328]" aria-hidden="true" />
            </span>{' '}
            SMVEC collateral.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#48506B]">
            A single source of truth for staff, internal teams, freelancers, printers, and external
            agencies. Use these guidelines whenever you create posters, brochures, social posts,
            event banners, certificates, presentations, or any other communication on behalf of
            the college.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/brand-guidelines/logo"
              className="inline-flex h-10 items-center gap-2 rounded-sm bg-[#36429B] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2C3680]"
            >
              <BookOpen className="h-4 w-4" />
              View Guidelines
            </Link>
            <Link
              to="/brand-guidelines/downloads"
              className="inline-flex h-10 items-center gap-2 rounded-sm border border-[#E4E7F1] bg-white px-4 text-[13px] font-medium text-[#0B1024] transition-colors hover:border-[#36429B]/40 hover:text-[#36429B]"
            >
              <Download className="h-4 w-4" />
              Download Brand Assets
            </Link>
            <Link
              to="/brand-guidelines/contact"
              className="inline-flex h-10 items-center gap-2 px-2 text-[13px] font-medium text-[#48506B] hover:text-[#36429B]"
            >
              <Mail className="h-4 w-4" />
              Contact Brand Team
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-md bg-[#F8F9FE]" aria-hidden="true" />
          <div className="relative grid grid-cols-2 gap-3">
            <img
              src={BRAND_ASSETS.svg.frame42}
              alt="SMVEC brand sample"
              className="h-44 w-full rounded-sm border border-[#E4E7F1] bg-white object-contain p-3"
              loading="lazy"
            />
            <img
              src={BRAND_ASSETS.svg.frame55}
              alt="SMVEC brand sample"
              className="h-44 w-full rounded-sm border border-[#E4E7F1] bg-white object-contain p-3"
              loading="lazy"
            />
            <img
              src={BRAND_ASSETS.svg.frame57}
              alt="SMVEC brand sample"
              className="h-44 w-full rounded-sm border border-[#E4E7F1] bg-white object-contain p-3"
              loading="lazy"
            />
            <img
              src={BRAND_ASSETS.svg.group}
              alt="SMVEC brand sample"
              className="h-44 w-full rounded-sm border border-[#E4E7F1] bg-white object-contain p-3"
              loading="lazy"
            />
          </div>
          <div className="absolute -bottom-3 left-6 h-[3px] w-24 bg-[#DBA328]" aria-hidden="true" />
        </div>
      </section>

      <section className="border-y border-[#E4E7F1] py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#36429B]">
              01 · Identity
            </p>
            <h3 className="mt-2 text-[18px] font-medium text-[#0B1024]">A defined visual system</h3>
            <p className="mt-2 text-[13.5px] leading-6 text-[#48506B]">
              Royal Blue, Golden Age, Google Sans typography, and a structured grid form the
              backbone of every SMVEC communication.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#36429B]">
              02 · Consistency
            </p>
            <h3 className="mt-2 text-[18px] font-medium text-[#0B1024]">One college, one voice</h3>
            <p className="mt-2 text-[13.5px] leading-6 text-[#48506B]">
              Every brochure, social post, admission poster, departmental banner, and presentation
              should align with this reference before going live.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#36429B]">
              03 · Speed
            </p>
            <h3 className="mt-2 text-[18px] font-medium text-[#0B1024]">Fewer revisions</h3>
            <p className="mt-2 text-[13.5px] leading-6 text-[#48506B]">
              Following these guidelines reduces back-and-forth between requesters, designers, and
              the brand approval team.
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow="Quick Access"
          title="Jump to a"
          emphasis="section"
          description="Every section explains what the rule is, why it exists, and how to apply it on real collateral."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="group flex items-center justify-between rounded-sm border border-[#E4E7F1] bg-white px-4 py-3.5 text-[13.5px] font-medium text-[#0B1024] transition-colors hover:border-[#36429B]/35 hover:bg-[#F8F9FE]"
            >
              {link.label}
              <ArrowRight className="h-3.5 w-3.5 text-[#7A8299] transition-transform group-hover:translate-x-0.5 group-hover:text-[#36429B]" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  Mail,
  ShieldCheck,
  Sparkles,
  Layers,
  Zap,
} from 'lucide-react';
import { BRAND_ASSETS } from '../assets';
import { SectionTitle } from '../components/SectionTitle';

type HeadlinePhrase = { emphasis: string; trailing: string };

const HEADLINE_PHRASES: HeadlinePhrase[] = [
  { emphasis: 'branding', trailing: 'collateral!' },
  { emphasis: 'brand', trailing: 'governance!' },
  { emphasis: 'visual', trailing: 'identity!' },
];

const HEADLINE_INTERVAL_MS = 3200;


const QUICK_LINKS = [
  { label: 'Logo & marks', href: '/brand-guidelines/logo' },
  { label: 'Color palette', href: '/brand-guidelines/colors' },
  { label: 'Typography', href: '/brand-guidelines/typography' },
  { label: 'Logo usage guidelines', href: '/brand-guidelines/applications' },
  { label: 'Downloads', href: '/brand-guidelines/downloads' },
  { label: 'Approval workflow', href: '/brand-guidelines/approval' },
];

export default function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phrasePhase, setPhrasePhase] = useState<'in' | 'out'>('in');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced) return;
    let swapTimer: number | null = null;
    const intervalId = window.setInterval(() => {
      setPhrasePhase('out');
      swapTimer = window.setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % HEADLINE_PHRASES.length);
        setPhrasePhase('in');
      }, 400);
    }, HEADLINE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      if (swapTimer !== null) window.clearTimeout(swapTimer);
    };
  }, []);


  const activePhrase = HEADLINE_PHRASES[phraseIndex];

  const handleStageMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    stage.style.setProperty('--brand-px', String(px.toFixed(3)));
    stage.style.setProperty('--brand-py', String(py.toFixed(3)));
  };

  const handleStageLeave = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty('--brand-px', '0');
    stage.style.setProperty('--brand-py', '0');
  };

  return (
    <div className="space-y-14">
      <section className="space-y-8 pt-10 lg:pt-16">
        {/* FULL-WIDTH HEADLINE */}
        <div className="brand-hero-card" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-[2px] w-7"
              style={{ background: isDark ? 'rgba(255,255,255,0.22)' : 'var(--smvec-gold)' }}
            />
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
            >
              SMVEC · Brand Reference
            </p>
          </div>

          <h1
            className="mt-6 leading-[1.04] tracking-[-0.025em]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(33px, 4.8vw, 63px)',
              color: 'var(--smvec-ink)',
              fontWeight: 500,
            }}
          >
            <span className="block">The official system for</span>
            <span className="block">
              SMVEC{' '}
              <span
                className="brand-phrase"
                data-phase={phrasePhase}
                style={{ color: isDark ? 'var(--smvec-gold)' : 'var(--smvec-blue)' }}
              >
                {activePhrase.emphasis} {activePhrase.trailing}
              </span>
            </span>
          </h1>
          <span className="sr-only" aria-live="polite">
            The official system for SMVEC {activePhrase.emphasis} {activePhrase.trailing}
          </span>
        </div>

        {/* GRID: LEFT body+CTAs · RIGHT showcase */}
        <div className="grid items-start gap-12 lg:grid-cols-[0.95fr,1.05fr] lg:gap-20">
          <div className="brand-hero-card" style={{ animationDelay: '160ms' }}>
            <p
              className="max-w-[34rem] text-[16px] leading-[1.7]"
              style={{ color: 'var(--fg-2)' }}
            >
              Ensuring every communication reflects consistent quality, clarity, and a unified
              SMVEC brand identity across print, digital, events, and institutional touchpoints.
            </p>

            <div className="mt-8 grid max-w-[32rem] grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                to="/brand-guidelines/downloads"
                className="group inline-flex h-12 w-full items-center justify-center gap-3 whitespace-nowrap rounded-[6px] px-5 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-14px_rgba(54,66,155,0.55)] outline-none transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_16px_32px_-14px_rgba(54,66,155,0.65)] focus-visible:ring-2 focus-visible:ring-[var(--smvec-blue-300)] focus-visible:ring-offset-2 active:translate-y-0"
                style={{ background: 'var(--smvec-blue)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--smvec-blue-800)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--smvec-blue)';
                }}
              >
                Download Brand Assets
                <Download className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              </Link>
              <Link
                to="/brand-guidelines/review"
                className="ai-beam-btn group inline-flex h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-[6px] border px-5 text-[13.5px] font-semibold outline-none transition-all duration-200 hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-[var(--smvec-blue-300)] focus-visible:ring-offset-2 active:translate-y-0"
                style={{ borderColor: 'transparent', color: isDark ? '#fff' : 'var(--smvec-blue)' }}
              >
                <Sparkles className="ai-review-btn__icon h-4 w-4 shrink-0 text-[#DBA328]" strokeWidth={2} />
                AI Review
              </Link>
            </div>

            <Link
              to="/brand-guidelines/contact"
              className="group mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--fg-3)] transition-colors hover:text-[var(--smvec-blue)]"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Contact Brand Team</span>
              <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
            </Link>

            {/* Brand version status */}
            <div className="mt-20 max-w-[32rem]">
              <div
                className="flex items-center gap-3 rounded-[10px] border px-4 py-3"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'var(--smvec-blue-100)', background: 'var(--bg-1)' }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px]"
                  style={{
                    background: isDark ? 'rgba(219,163,40,0.20)' : 'var(--smvec-blue-050)',
                    color: isDark ? '#fff' : 'var(--smvec-blue)',
                  }}
                >
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: isDark ? '#fff' : 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
                  >
                    Brand Manual · v1.0
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: 'var(--fg-3)' }}>
                    Reviewed Apr 22, 2026 · Brand &amp; Communications Cell
                  </p>
                </div>
                <Link
                  to="/brand-guidelines/approval"
                  className="hidden shrink-0 text-[11.5px] font-semibold transition-colors hover:underline sm:inline-flex"
                  style={{ color: isDark ? 'var(--smvec-gold)' : 'var(--smvec-blue)' }}
                >
                  Workflow →
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT — Animated showcase */}
        <div
          ref={stageRef}
          onMouseMove={handleStageMove}
          onMouseLeave={handleStageLeave}
          className="brand-hero-stage relative isolate lg:mt-12"
          style={{ ['--brand-px' as const]: '0', ['--brand-py' as const]: '0' }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(60% 60% at 70% 30%, rgba(54,66,155,0.08), transparent 70%), radial-gradient(45% 45% at 30% 80%, rgba(219,163,40,0.10), transparent 70%)',
            }}
          />

          <div className="relative grid grid-cols-12 grid-rows-[repeat(8,1fr)] gap-4 aspect-[5/4] min-h-[440px]">
            {/* Hero feature card — full lockup */}
            <Link
              to="/brand-guidelines/applications"
              className="brand-hero-card brand-hero-card-shell group col-span-7 row-span-5 col-start-1 row-start-1 flex flex-col overflow-hidden rounded-[14px] outline-none"
              style={{
                animationDelay: '120ms',
                background: 'var(--smvec-blue-tint)',
                transform:
                  'translate3d(calc(var(--brand-px) * -8px), calc(var(--brand-py) * -8px), 0)',
              }}
            >
              <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>
                <span>Primary Lockup</span>
                <span style={{ color: 'var(--fg-3)' }}>01</span>
              </div>
              <div className="relative flex flex-1 items-center justify-center px-6 py-3">
                <img
                  src="https://res.cloudinary.com/dofapr3pk/image/upload/v1776859477/df_mhoxbm.png"
                  alt="SMVEC primary lockup"
                  className="h-full max-h-[160px] w-auto object-contain"
                  loading="lazy"
                />
              </div>
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'var(--smvec-blue-tint)' }}
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--smvec-ink)' }}>
                    Full lockup
                  </p>
                  <p className="text-[10.5px] leading-tight" style={{ color: 'var(--fg-3)' }}>
                    Default identity for every cover
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold transition-transform duration-200 group-hover:translate-x-0.5"
                  style={{ color: 'var(--smvec-blue)' }}
                >
                  View details
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>

            {/* Quote card */}
            <Link
              to="/brand-guidelines/overview"
              className="brand-hero-card brand-hero-card--float-alt brand-hero-card-shell group col-span-5 row-span-5 col-start-8 row-start-1 relative flex flex-col overflow-hidden rounded-[14px] outline-none"
              style={{
                animationDelay: '220ms',
                background: 'var(--smvec-blue)',
                transform:
                  'translate3d(calc(var(--brand-px) * 12px), calc(var(--brand-py) * 12px), 0)',
              }}
            >
              <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                <span className="absolute left-6 top-6 h-[3px] w-14 bg-[var(--smvec-gold)]" />
                <span className="absolute bottom-12 left-6 h-px w-24 bg-white/14" />
              </span>
              <span className="flex flex-1 items-center px-6 pb-7 pt-8">
                <span className="relative block max-w-[11.75rem] text-left">
                  <span
                    className="block text-[24px] leading-[1.13] text-white"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 650, letterSpacing: '-0.04em' }}
                  >
                    Design is so simple.
                    <br />
                    That&rsquo;s why it&rsquo;s
                    <br />
                    so complicated
                  </span>
                  <span className="mt-4 block h-[3px] w-10 bg-[var(--smvec-gold)] transition-all duration-300 group-hover:w-16" />
                  <span className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Simplicity requires discipline
                  </span>
                </span>
              </span>
              <span
                className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-[10.5px] font-semibold text-white/70 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white"
              >
                Story
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Color palette card */}
            <Link
              to="/brand-guidelines/colors"
              className="brand-hero-card brand-hero-card-shell group col-span-3 row-span-3 col-start-1 row-start-6 flex flex-col overflow-hidden rounded-[14px] p-4 outline-none"
              style={{
                animationDelay: '320ms',
                background: 'var(--smvec-blue-tint)',
                transform:
                  'translate3d(calc(var(--brand-px) * -14px), calc(var(--brand-py) * 6px), 0)',
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--smvec-blue)' }}
                >
                  Palette
                </p>
                <ArrowRight
                  className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                  style={{ color: 'var(--smvec-blue)' }}
                />
              </div>
              <div className="mt-2.5 flex h-9 items-stretch overflow-hidden rounded-[6px] border" style={{ borderColor: 'var(--border)' }}>
                <span className="flex-[2]" style={{ background: 'var(--smvec-blue)' }} />
                <span className="flex-1" style={{ background: 'var(--smvec-gold)' }} />
                <span className="flex-1" style={{ background: 'var(--smvec-ink)' }} />
                <span className="flex-1 border-l" style={{ background: '#fff', borderColor: 'var(--border)' }} />
              </div>
              <p className="mt-auto pt-2 text-[10.5px]" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                #36429B · #DBA328
              </p>
            </Link>

            {/* Typography sample card */}
            <Link
              to="/brand-guidelines/typography"
              className="brand-hero-card brand-hero-card--float brand-hero-card-shell group col-span-4 row-span-3 col-start-4 row-start-6 flex flex-col overflow-hidden rounded-[14px] p-4 outline-none"
              style={{
                animationDelay: '420ms',
                background: 'var(--smvec-blue-tint)',
                transform:
                  'translate3d(calc(var(--brand-px) * 6px), calc(var(--brand-py) * -10px), 0)',
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--smvec-blue)' }}
                >
                  Type
                </p>
                <ArrowRight
                  className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                  style={{ color: 'var(--smvec-blue)' }}
                />
              </div>
              <div
                className="mt-1 leading-[1] tracking-[-0.02em]"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 36,
                  color: 'var(--smvec-ink)',
                }}
              >
                Aa Gg
              </div>
              <p
                className="mt-auto pt-2 text-[10.5px]"
                style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
              >
                Google Sans · 17pt
              </p>
            </Link>

            {/* Emblem mini-card */}
            <Link
              to="/brand-guidelines/logo"
              className="brand-hero-card brand-hero-card-shell group col-span-5 row-span-3 col-start-8 row-start-6 relative flex items-center justify-center overflow-hidden rounded-[14px] bg-[var(--smvec-bg-soft)] outline-none"
              style={{
                animationDelay: '520ms',
                transform:
                  'translate3d(calc(var(--brand-px) * 14px), calc(14px + var(--brand-py) * -4px), 0)',
              }}
            >
              <p
                className="absolute left-4 top-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--smvec-blue)' }}
              >
                Emblem
              </p>
              <img
                src={BRAND_ASSETS.svg.frame42}
                alt="SMVEC emblem"
                className="h-[58%] w-auto object-contain"
                loading="lazy"
              />
              <ArrowRight
                className="absolute bottom-3 right-3 h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                style={{ color: 'var(--smvec-blue)' }}
              />
            </Link>
          </div>
        </div>
        </div>
      </section>

      <section className="border-y py-14" style={{ borderColor: 'var(--border)' }}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              tag: '01 · Identity',
              title: 'A defined visual system',
              body:
                'Royal Blue, Golden Age, Google Sans typography, and a structured grid form the backbone of every SMVEC communication.',
              Icon: Layers,
            },
            {
              tag: '02 · Consistency',
              title: 'One college, one voice',
              body:
                'Every brochure, social post, admission poster, departmental banner, and presentation should align with this reference before going live.',
              Icon: ShieldCheck,
            },
            {
              tag: '03 · Speed',
              title: 'Fewer revisions',
              body:
                'Following these guidelines reduces back-and-forth between requesters, designers, and the brand approval team.',
              Icon: Zap,
            },
          ].map(({ tag, title, body, Icon }) => (
            <article
              key={tag}
              className="group flex h-full flex-col gap-3 rounded-[12px] border p-5 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_38px_-24px_rgba(54,66,155,0.18)]"
              style={{
                borderColor: isDark ? '#2A3860' : 'var(--border)',
                background: isDark ? '#111827' : 'var(--bg-1)',
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-[8px]"
                  style={{
                    background: isDark ? '#1E2D55' : 'var(--smvec-blue-050)',
                    color: isDark ? '#ffffff' : 'var(--smvec-blue)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: isDark ? '#A8B2DC' : 'var(--smvec-blue)' }}
                >
                  {tag}
                </p>
              </div>
              <h3
                className="text-[19px] leading-snug"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  color: 'var(--smvec-ink)',
                }}
              >
                {title}
              </h3>
              <p className="text-[13.5px] leading-6" style={{ color: 'var(--fg-2)' }}>
                {body}
              </p>
            </article>
          ))}
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
              className="group flex items-center justify-between rounded-md border px-4 py-3.5 text-[13.5px] font-medium transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--smvec-blue-300)] hover:bg-[var(--smvec-blue-050)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-1)', color: 'var(--smvec-ink)' }}
            >
              {link.label}
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'var(--fg-3)' }}
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

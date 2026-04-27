import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ClipboardList,
  Bell,
  Users,
  ShieldCheck,
  ArrowRight,
  Zap,
  LayoutDashboard,
  FileText,
  MessageSquare,
  CheckCircle2,
  Clock,
  FilePlus,
  Activity,
  History,
  Upload,
  HelpCircle,
  Eye,
  ThumbsUp,
  ArrowLeftRight,
  KeyRound,
  FileSearch,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Request management',
    desc: 'Submit design briefs with category, urgency, deadline, and file attachments in one structured form. No back-and-forth emails.',
  },
  {
    icon: Sparkles,
    title: 'AI Buddy',
    desc: 'Attach a document and let the AI draft a complete design brief — title, description, category, and designer notes — in seconds.',
  },
  {
    icon: ShieldCheck,
    title: 'Approval workflow',
    desc: 'Design Lead reviews and approves or rejects submissions. Every decision is logged with a timestamp and reason.',
  },
  {
    icon: Bell,
    title: 'Real-time notifications',
    desc: 'Instant alerts on status changes, approvals, rejections, and comments via in-app notifications and WhatsApp.',
  },
  {
    icon: Users,
    title: 'Role-based access',
    desc: 'Staff submit, designers work, leads approve, treasurers oversee — each role sees only what it needs.',
  },
  {
    icon: Zap,
    title: 'AI Brand Review',
    desc: 'Upload a design and receive a 100-point brand compliance audit against SMVEC guidelines in under 30 seconds.',
  },
];

const WORKFLOW_STEPS = [
  {
    icon: FileText,
    step: '01',
    title: 'Submit a request',
    desc: 'Staff fills the New Request form with event details, deadline, files, and context. AI Buddy can auto-draft the brief.',
  },
  {
    icon: LayoutDashboard,
    step: '02',
    title: 'Designer picks up',
    desc: 'The assigned designer sees the task in their dashboard, reviews the brief, and moves it to In Progress.',
  },
  {
    icon: MessageSquare,
    step: '03',
    title: 'Collaborate',
    desc: 'Comments, file revisions, and clarifications happen inside the task thread — no scattered emails.',
  },
  {
    icon: CheckCircle2,
    step: '04',
    title: 'Lead approves',
    desc: 'Design Lead reviews the final artwork. Approved designs are archived; rejected ones return to the designer with notes.',
  },
];

const ROLES: Array<{
  role: string;
  color: string;
  darkColor: string;
  badgeCls: string;
  actions: Array<{ icon: LucideIcon; label: string }>;
}> = [
  {
    role: 'Staff', color: '#36429B', darkColor: '#8B96D6', badgeCls: 'brand-role-staff',
    actions: [
      { icon: FilePlus,      label: 'Submit requests' },
      { icon: Activity,      label: 'Track status' },
      { icon: History,       label: 'View history' },
      { icon: MessageSquare, label: 'Comment on tasks' },
    ],
  },
  {
    role: 'Designer', color: '#0E7490', darkColor: '#22D3EE', badgeCls: 'brand-role-designer',
    actions: [
      { icon: CheckCircle2,  label: 'Accept & work tasks' },
      { icon: Upload,        label: 'Upload deliverables' },
      { icon: HelpCircle,    label: 'Request clarification' },
      { icon: CheckCircle2,  label: 'Mark complete' },
    ],
  },
  {
    role: 'Design Lead', color: '#7C3AED', darkColor: '#A78BFA', badgeCls: 'brand-role-lead',
    actions: [
      { icon: Eye,           label: 'Review all submissions' },
      { icon: ThumbsUp,      label: 'Approve or reject' },
      { icon: ArrowLeftRight,label: 'Reassign tasks' },
      { icon: LayoutDashboard, label: 'Full dashboard access' },
    ],
  },
  {
    role: 'Treasurer', color: '#B45309', darkColor: '#FCD34D', badgeCls: 'brand-role-treasurer',
    actions: [
      { icon: Eye,           label: 'View all tasks' },
      { icon: KeyRound,      label: 'Authorise revisions' },
      { icon: FileSearch,    label: 'Audit activity log' },
      { icon: Download,      label: 'Export reports' },
    ],
  },
];

export default function DesignDesk() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const iconContainerStyle = {
    background: isDark ? '#1E2D55' : 'var(--smvec-blue-050)',
  };
  const iconColor = { color: isDark ? '#ffffff' : 'var(--smvec-blue)' };
  const accentColor = { color: isDark ? '#A8B2DC' : 'var(--smvec-blue)' };
  const cardStyle = {
    borderColor: isDark ? '#2A3860' : 'var(--border)',
    background: isDark ? '#111827' : 'var(--surface)',
  };
  return (
    <div className="space-y-20">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="space-y-8 pt-10 lg:pt-16">
        <div className="brand-hero-card">
          <div className="flex items-center gap-3">
            <span className="h-[2px] w-7" style={{ background: 'var(--smvec-gold)' }} aria-hidden />
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
            >
              SMVEC · DesignDesk
            </p>
          </div>
          <h1
            className="mt-6 leading-[1.04] tracking-[-0.025em]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px, 4.4vw, 58px)',
              color: 'var(--smvec-ink)',
              fontWeight: 500,
            }}
          >
            <span className="block">The official design</span>
            <span className="block" style={{ color: 'var(--smvec-blue)' }}>
              operations platform.
            </span>
          </h1>
          <p
            className="mt-6 max-w-[38rem] text-[16px] leading-[1.7]"
            style={{ color: 'var(--fg-2)' }}
          >
            DesignDesk is the internal platform that connects every department at SMVEC to the
            design team — structured requests, AI-assisted briefs, real-time tracking, and
            brand-compliant approvals, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-[6px] px-5 text-[13.5px] font-semibold text-white shadow-[0_10px_24px_-14px_rgba(54,66,155,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_16px_32px_-14px_rgba(54,66,155,0.65)]"
              style={{ background: 'var(--smvec-blue)' }}
            >
              <ArrowRight className="h-4 w-4" />
              Open DesignDesk
            </a>
            <Link
              to="/brand-guidelines/review"
              className="brand-analyser-pill"
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--smvec-gold)' }} strokeWidth={2} />
              Brand Compliance Analyser
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURE GRID ─────────────────────────────────── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="Platform"
          title="Everything the design team needs"
          description="Six core capabilities that cover the full lifecycle of a design request — from first brief to final approval."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-[10px] border p-6"
              style={cardStyle}
            >
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[8px]"
                style={iconContainerStyle}
              >
                <Icon className="h-5 w-5" style={iconColor} strokeWidth={1.8} />
              </div>
              <p
                className="mb-1.5 text-[14px] font-semibold"
                style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
              >
                {title}
              </p>
              <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="How it works"
          title="From brief to approved — in four steps"
          description="A structured workflow ensures no request is lost, every revision is tracked, and only compliant work reaches publication."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map(({ icon: Icon, step, title, desc }, i) => (
            <div key={step} className="relative">
              {i < WORKFLOW_STEPS.length - 1 && (
                <span
                  className="absolute top-5 left-full z-10 hidden h-[2px] w-5 lg:block"
                  style={{ background: 'var(--border)' }}
                />
              )}
              <div
                className="rounded-[10px] border p-6 h-full"
                style={cardStyle}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="text-[11px] font-bold tracking-[0.18em]"
                    style={{ color: 'var(--smvec-gold)', fontFamily: 'var(--font-display)' }}
                  >
                    {step}
                  </span>
                  <Icon className="h-4 w-4" style={{ color: 'var(--fg-3)' }} strokeWidth={1.8} />
                </div>
                <p
                  className="mb-2 text-[14px] font-semibold"
                  style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
                >
                  {title}
                </p>
                <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────────── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="Access control"
          title="Role-based permissions"
          description="Each role has a precise set of actions. Permissions are enforced server-side — roles cannot be self-escalated."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          {ROLES.map(({ role, color, darkColor, badgeCls, actions }) => (
            <div
              key={role}
              className="rounded-[10px] border p-6"
              style={cardStyle}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeCls}`}
                  style={{ color: isDark ? darkColor : color }}
                >
                  {role}
                </span>
              </div>
              <ul className="space-y-2">
                {actions.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={accentColor}
                      strokeWidth={1.8}
                    />
                    <span className="text-[13px]" style={{ color: 'var(--fg-2)' }}>
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── SLA / STANDARDS ──────────────────────────────── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="Standards"
          title="Submission & turnaround standards"
          description="All requests must meet these minimum standards before the design team begins work."
        />
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: FileText, label: 'Complete brief', detail: 'Event name, date, venue, purpose, and target audience must be filled. Incomplete requests are returned.' },
            { icon: Clock, label: 'Lead time', detail: 'Standard requests require 3 working days minimum. Rush requests with less notice require Design Lead sign-off.' },
            { icon: ShieldCheck, label: 'Brand compliance', detail: 'All final artwork must pass the AI Brand Review before submission for approval. Non-compliant work is rejected at review.' },
          ].map(({ icon: Icon, label, detail }) => (
            <div
              key={label}
              className="rounded-[10px] border p-6"
              style={cardStyle}
            >
              <Icon
                className="mb-3 h-5 w-5"
                style={accentColor}
                strokeWidth={1.8}
              />
              <p
                className="mb-1.5 text-[14px] font-semibold"
                style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
              >
                {label}
              </p>
              <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
                {detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────── */}
      <section>
        <div
          className="relative overflow-hidden rounded-[12px] px-8 py-12"
          style={{ background: 'var(--smvec-blue)' }}
        >
          <span
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
            style={{ background: 'var(--smvec-gold)' }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ background: 'var(--smvec-gold)' }}
            aria-hidden
          />
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/60"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Get started
          </p>
          <h2
            className="mb-3 text-[22px] font-medium leading-snug text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Need something designed?
          </h2>
          <p className="mb-7 max-w-[38rem] text-[14px] leading-[1.65] text-white/75">
            Submit a request through DesignDesk and the design team will take it from there. Include
            your brief, deadline, and any reference files to get started.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-white px-5 text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ color: 'var(--smvec-blue)' }}
            >
              Open DesignDesk
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/brand-guidelines/contact"
              className="inline-flex h-10 items-center gap-2 rounded-[6px] px-5 text-[13px] font-medium text-white transition-colors hover:border-white/60"
              style={{ border: '1px solid rgba(255,255,255,0.30)' }}
            >
              Contact brand team
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

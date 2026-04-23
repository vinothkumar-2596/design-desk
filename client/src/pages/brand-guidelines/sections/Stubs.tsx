import { ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Users, Briefcase, Printer, GraduationCap, Building2, Globe } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { Callout } from '../components/Callout';
import { DoDontGrid } from '../components/DoDontGrid';

const AUDIENCE_CARDS = [
  {
    icon: Users,
    title: 'For staff & departments',
    body: 'A single reference for marketing, admissions, departments, events, and communications teams when producing any official material — from posters to presentations.',
  },
  {
    icon: Briefcase,
    title: 'For agencies & freelancers',
    body: 'A reliable handoff document so vendors design correctly the first time, reducing approval cycles, reprints, and misaligned deliverables.',
  },
  {
    icon: Printer,
    title: 'For printers & fabricators',
    body: 'Exact Pantone, CMYK, and HEX values, logo files in every format, and approved specifications — preventing on-press surprises and color drift.',
  },
  {
    icon: GraduationCap,
    title: 'For student bodies',
    body: 'Clear guidelines for club posters, event banners, and social media — ensuring student-created materials uphold institutional standards.',
  },
  {
    icon: Building2,
    title: 'For campus signage',
    body: 'Specifications for wayfinding, building names, department boards, and permanent installations that reflect the institutional identity.',
  },
  {
    icon: Globe,
    title: 'For digital platforms',
    body: 'Web, app, and social media guidelines — profile images, cover photos, email signatures, and digital ad formats with correct asset usage.',
  },
];

export function WhyExists() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Context"
        title="Why this site"
        emphasis="exists"
        description="SMVEC has a defined brand system. Every brochure, social post, admission poster, departmental banner, presentation, certificate, standee, hoarding, and digital creative should align with the official identity."
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {AUDIENCE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-md border p-5"
              style={{
                borderColor: isDark ? '#2A3860' : 'var(--border)',
                background: isDark ? '#111827' : 'var(--bg-1)',
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-sm"
                style={{
                  background: isDark ? '#1E2D55' : 'var(--smvec-blue-050)',
                  color: isDark ? '#ffffff' : 'var(--smvec-blue)',
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[15px] font-medium" style={{ color: 'var(--fg-1)' }}>{card.title}</h3>
              <p className="mt-2 text-[13px] leading-6" style={{ color: 'var(--fg-2)' }}>{card.body}</p>
            </article>
          );
        })}
      </div>
      <Callout variant="info" title="One source of truth">
        This site replaces ad-hoc emails, slack files, and old artwork copies. If something here
        looks out of date, contact the brand team rather than guessing.
      </Callout>
    </div>
  );
}

export function Overview() {
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="About"
        title="Brand"
        emphasis="overview"
        description="An academic, authoritative, and trustworthy identity built for clarity, longevity, and disciplined application across every touchpoint."
      />
      <section>
        <h2 className="text-[20px] font-medium" style={{ color: 'var(--fg-1)' }}>Brand values</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Communication', body: 'Clear, structured, and respectful in every message.' },
            { label: 'Passionate', body: 'Driven by purpose, ambition, and academic excellence.' },
            { label: 'Reliable', body: 'Consistent, accountable, and trusted by students and partners.' },
            { label: 'Creative', body: 'Inventive in solutions while disciplined in execution.' },
          ].map((value) => (
            <div
              key={value.label}
              className="rounded-md border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>
                {value.label}
              </p>
              <p className="mt-1.5 text-[13px] leading-5" style={{ color: 'var(--fg-2)' }}>{value.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section
        className="rounded-md border p-6"
        style={{ borderColor: 'var(--border)', background: 'var(--smvec-blue-050)' }}
      >
        <h3 className="text-[16px] font-medium" style={{ color: 'var(--fg-1)' }}>Visual philosophy</h3>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-6" style={{ color: 'var(--fg-2)' }}>
          Royal Blue carries authority. Golden Age signals heritage and emphasis. Generous whitespace
          and editorial typography set a calm, collegiate tone. The system is print-first and
          rectangular by default — applied with discipline rather than decoration.
        </p>
      </section>
    </div>
  );
}

export function Spacing() {
  const SPACING = [4, 8, 12, 16, 24, 32, 48, 64];
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="System"
        title="Spacing &"
        emphasis="motion"
        description="A 4px-based spacing scale keeps every layout calm and rhythmic. Use these tokens in CSS, design files, and print artwork."
      />
      <section>
        <h2 className="text-[20px] font-medium" style={{ color: 'var(--fg-1)' }}>Spacing scale</h2>
        <div className="mt-5 space-y-2">
          {SPACING.map((value) => (
            <div key={value} className="flex items-center gap-4">
              <span className="w-12 font-mono text-[12px]" style={{ color: 'var(--fg-2)' }}>{value}px</span>
              <span className="block h-3 bg-[#36429B]" style={{ width: value * 2 }} />
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Radius', body: 'Use 0–6px corners. Reserve 8px for surface cards. Pills only on tags.' },
          { label: 'Shadow', body: 'Soft, downward, low-opacity. Avoid coloured glow shadows.' },
          { label: 'Motion', body: 'Subtle fades, 150–220ms. No bounce, no parallax, no spring.' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-md border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>{card.label}</p>
            <p className="mt-1.5 text-[13px] leading-5" style={{ color: 'var(--fg-2)' }}>{card.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function ApprovalWorkflow() {
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Process"
        title="Approval"
        emphasis="workflow"
        description="A practical checklist for staff and agencies. Run through the relevant list before sending anything to print or publishing online."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <ChecklistCard
          title="Before creating"
          items={[
            'Confirm the audience and channel',
            'Pull current logo + colour files from Downloads',
            'Use approved templates where available',
            'Write copy in sentence case',
          ]}
        />
        <ChecklistCard
          title="Before print"
          items={[
            'Check Pantone / CMYK values match the manual',
            'Confirm bleed, trim, and safe area',
            'Embed Google Sans or convert to outlines',
            'Submit final PDF to the brand team for sign-off',
          ]}
        />
        <ChecklistCard
          title="Before publishing digital"
          items={[
            'Verify logo placement and clear space',
            'Run a contrast check (WCAG AA minimum)',
            'Crop to platform-correct aspect ratios',
            'Notify the brand team of the publish date',
          ]}
        />
      </div>
      <Callout variant="info" title="Need a sign-off?">
        Submit your draft in DesignDesk under{' '}
        <Link to="/new-request" className="font-medium hover:underline" style={{ color: 'var(--smvec-blue)' }}>
          New Request
        </Link>{' '}
        with the "brand approval" label. Average turnaround is 24 working hours.
      </Callout>
    </div>
  );
}

function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      className="rounded-md border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[13px] leading-5" style={{ color: 'var(--fg-1)' }}>
            <span
              className="mt-2 inline-block h-1 w-3 shrink-0 bg-[#DBA328]"
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Contact() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Support"
        title="Contact the brand"
        emphasis="team"
        description="For approvals, source files, template requests, or any question about how to apply the SMVEC identity correctly."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <ContactCard
          title="Brand & Communications Cell"
          email="brand@smvec.ac.in"
          body="General questions, source file requests, and template support."
          isDark={isDark}
        >
          <Mail className="h-4 w-4" />
        </ContactCard>
        <ContactCard
          title="Approval submissions"
          email="design@smvec.ac.in"
          body="Submit final artwork for sign-off before print or publish. Include all source files."
          isDark={isDark}
        >
          <ArrowRight className="h-4 w-4" />
        </ContactCard>
      </div>
      <Callout variant="gold" title="Working inside DesignDesk?">
        Use the{' '}
        <Link to="/new-request" className="font-medium hover:underline" style={{ color: 'var(--smvec-blue)' }}>
          New Request
        </Link>{' '}
        flow with the brand-approval category — your request is automatically routed to the brand
        team queue.
      </Callout>
    </div>
  );
}

function ContactCard({
  title,
  email,
  body,
  isDark,
  children,
}: {
  title: string;
  email: string;
  body: string;
  isDark?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-md border p-5"
      style={{
        borderColor: isDark ? '#2A3860' : 'var(--border)',
        background: isDark ? '#111827' : 'var(--bg-1)',
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-sm"
        style={{
          background: isDark ? '#1E2D55' : 'var(--smvec-blue-050)',
          color: isDark ? '#ffffff' : 'var(--smvec-blue)',
        }}
      >
        {children}
      </span>
      <h3 className="mt-4 text-[15px] font-medium" style={{ color: 'var(--fg-1)' }}>{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-5" style={{ color: 'var(--fg-2)' }}>{body}</p>
      <a
        href={`mailto:${email}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
        style={{ color: isDark ? '#A8B2DC' : 'var(--smvec-blue)' }}
      >
        {email}
      </a>
    </div>
  );
}

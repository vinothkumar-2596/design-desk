import { CSSProperties, ReactNode, useState } from 'react';

const btnBase: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '0.01em',
  padding: '11px 20px',
  borderRadius: 'var(--radius-1)',
  border: '1px solid transparent',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'all var(--dur-base) var(--ease-out)',
  background: 'transparent',
  lineHeight: 1.2,
};

function Btn({
  variant,
  pill,
  disabled,
  children,
}: {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  pill?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const stylesByVariant: Record<string, CSSProperties> = {
    primary: { background: 'var(--smvec-blue)', color: '#fff' },
    secondary: { background: 'var(--smvec-gold)', color: '#000' },
    outline: {
      borderColor: 'var(--smvec-blue)',
      color: 'var(--smvec-blue)',
      background: '#fff',
    },
    ghost: { color: 'var(--smvec-blue)' },
  };
  const pillStyle: CSSProperties = pill
    ? {
        borderRadius: 999,
        padding: '12px 22px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontSize: 12,
        fontWeight: 700,
      }
    : {};
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...btnBase,
        ...stylesByVariant[variant],
        ...pillStyle,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const fieldBase: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-1)',
  background: '#fff',
  color: 'var(--fg-1)',
  outline: 'none',
  transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
  width: '100%',
};

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label
        className="text-[12px] font-medium tracking-[0.02em]"
        style={{ color: 'var(--fg-2)' }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <span
          className="text-[11px]"
          style={{ color: error ? '#B00020' : 'var(--fg-3)' }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function Badge({
  variant = 'default',
  children,
}: {
  variant?: 'default' | 'gold' | 'solid' | 'outline';
  children: ReactNode;
}) {
  const styles: Record<string, CSSProperties> = {
    default: {
      background: 'var(--smvec-blue-050)',
      color: 'var(--smvec-blue)',
      borderColor: 'var(--smvec-blue-100)',
    },
    gold: {
      background: 'var(--smvec-gold-050)',
      color: 'var(--smvec-gold-900)',
      borderColor: 'var(--smvec-gold-100)',
    },
    solid: {
      background: 'var(--smvec-blue)',
      color: '#fff',
      borderColor: 'var(--smvec-blue)',
    },
    outline: {
      background: '#fff',
      color: 'var(--smvec-blue)',
      borderColor: 'var(--smvec-blue)',
    },
  };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-1 text-[11px] font-medium uppercase"
      style={{
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.06em',
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

function Surface({
  variant = 'white',
  kicker,
  title,
  body,
  cta,
}: {
  variant?: 'white' | 'blue';
  kicker: string;
  title: string;
  body: string;
  cta: ReactNode;
}) {
  const isBlue = variant === 'blue';
  return (
    <div
      className="rounded-[10px] border p-[22px]"
      style={{
        background: isBlue ? 'var(--smvec-blue)' : '#fff',
        borderColor: isBlue ? 'var(--smvec-blue)' : 'var(--border)',
        color: isBlue ? '#fff' : 'var(--fg-1)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      <p
        className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em]"
        style={{ color: isBlue ? 'var(--smvec-gold)' : 'var(--smvec-blue)' }}
      >
        {kicker}
      </p>
      <h4
        className="m-0 mb-1 text-[18px]"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
      >
        {title}
      </h4>
      <p
        className="m-0 mb-3.5 text-[13px] leading-[1.55]"
        style={{ color: isBlue ? 'rgba(255,255,255,0.78)' : 'var(--fg-3)' }}
      >
        {body}
      </p>
      {cta}
    </div>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div
      className="relative flex flex-col gap-1 overflow-hidden rounded-[10px] border bg-white px-5 py-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <span
        className="text-[36px] leading-none"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--smvec-blue)',
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        {num}
      </span>
      <span
        className="text-[12px] uppercase tracking-[0.12em]"
        style={{ color: 'var(--fg-3)', fontWeight: 500 }}
      >
        {label}
      </span>
    </div>
  );
}

function NavLink({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="rounded-[4px] px-3.5 py-2 text-[13px] font-medium"
      style={{
        fontFamily: 'var(--font-display)',
        color: active ? 'var(--smvec-blue)' : 'var(--fg-1)',
        borderBottom: active ? '2px solid var(--smvec-gold)' : '2px solid transparent',
        borderRadius: active ? 0 : 4,
      }}
    >
      {children}
    </a>
  );
}

export default function Components() {
  const [name, setName] = useState('Ananya Ramesh');
  const [phone, setPhone] = useState('+91 98x');
  const [msg, setMsg] = useState('Requesting a campus visit next weekend.');
  const [prog, setProg] = useState('B.Tech — Computer Science and Engineering');

  return (
    <div className="brand-card">
      <header className="brand-card__header">
        <div>
          <div className="brand-card__eyebrow">02 · Components</div>
          <h1 className="brand-card__title">
            UI <b>components</b>
          </h1>
        </div>
        <p className="brand-card__intro">
          Rectangular, collegiate, flat. Gold for emphasis, blue for action, white surfaces with
          hairline borders.
        </p>
      </header>

      <section className="mt-2">
        <div className="brand-section-title">Buttons</div>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="primary">Apply Now</Btn>
          <Btn variant="secondary">Download Brochure</Btn>
          <Btn variant="outline">Learn More</Btn>
          <Btn variant="ghost">Cancel</Btn>
          <Btn variant="primary" pill>
            Enrol Now
          </Btn>
          <Btn variant="primary" disabled>
            Disabled
          </Btn>
        </div>
        <p className="mt-3 text-[12px]" style={{ color: 'var(--fg-3)' }}>
          Primary / secondary / outline / ghost, plus a pill CTA reserved for marketing callouts
          like "Enrol Now".
        </p>
      </section>

      <section className="mt-10 grid gap-12 md:grid-cols-2">
        <div>
          <div className="brand-section-title">Form fields</div>
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} style={fieldBase} />
          </Field>
          <Field label="Programme">
            <select value={prog} onChange={(e) => setProg(e.target.value)} style={fieldBase}>
              <option>B.Tech — Computer Science and Engineering</option>
              <option>B.Tech — Electronics &amp; Communication</option>
              <option>MBA — Management Studies</option>
            </select>
          </Field>
          <Field
            label="Phone"
            hint="Please enter a 10-digit mobile number."
            error
          >
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ ...fieldBase, borderColor: '#B00020' }}
            />
          </Field>
          <Field label="Message">
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              style={{ ...fieldBase, resize: 'vertical' }}
            />
          </Field>
        </div>
        <div>
          <div className="brand-section-title">Badges</div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>NAAC "A"</Badge>
            <Badge variant="gold">26 Years</Badge>
            <Badge variant="solid">Autonomous</Badge>
          </div>
          <div className="brand-section-title mt-9">Stats</div>
          <div className="grid grid-cols-2 gap-3">
            <Stat num="90%" label="Placement rate" />
            <Stat num="250+" label="Recruiters" />
            <Stat num="8" label="Departments" />
            <Stat num="1999" label="Established" />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="brand-section-title">Navigation</div>
        <div
          className="flex items-center justify-between rounded-[8px] bg-white px-[22px] py-3.5"
          style={{
            borderBottom: '4px solid var(--smvec-gold)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[6px] text-[14px] font-bold text-white"
              style={{ background: 'var(--smvec-blue)' }}
            >
              S
            </span>
            <div className="flex flex-col leading-tight">
              <span
                className="text-[13px] font-bold uppercase tracking-[0.02em]"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--smvec-blue)' }}
              >
                SRI MANAKULA VINAYAGAR
              </span>
              <span
                className="text-[9px] font-medium uppercase tracking-[0.12em]"
                style={{ color: 'var(--smvec-gold)' }}
              >
                Engineering College · An Autonomous Institution
              </span>
            </div>
          </div>
          <nav className="flex gap-1">
            <NavLink active>Home</NavLink>
            <NavLink>About</NavLink>
            <NavLink>Academics</NavLink>
            <NavLink>Admissions</NavLink>
            <NavLink>Placements</NavLink>
            <NavLink>Contact</NavLink>
          </nav>
        </div>
      </section>

      <section className="mt-10 grid gap-12 md:grid-cols-2">
        <div>
          <div className="brand-section-title">Card · white surface</div>
          <Surface
            kicker="Programme"
            title="B.Tech — Computer Science and Engineering"
            body="Four-year autonomous programme accredited by NBA. Curriculum covers core CS with electives in AI, cybersecurity, and distributed systems."
            cta={<Btn variant="outline">View syllabus</Btn>}
          />
        </div>
        <div>
          <div className="brand-section-title">Card · brand surface</div>
          <Surface
            variant="blue"
            kicker="Admissions 2025"
            title="Applications close 30 June"
            body="Management quota and Pondicherry-University centralised counselling both open. Apply online for a priority interview slot."
            cta={<Btn variant="secondary">Apply Now</Btn>}
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="brand-section-title">List · bulleted with gold dots</div>
        <ul className="m-0 list-none p-0" style={{ maxWidth: '60ch' }}>
          {[
            'Eight engineering departments spanning CSE, ECE, EEE, Mechanical, Civil, IT, and Biotechnology.',
            'NAAC "A" grade with NBA-accredited UG programmes.',
            'Placement partnerships with 250+ recruiters across IT, core, and manufacturing.',
            'Research centres in AI, IoT, and renewable energy.',
          ].map((item) => (
            <li
              key={item}
              className="relative py-2.5 pl-7 text-[14px]"
              style={{
                color: 'var(--fg-2)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                className="absolute left-1.5 top-[19px] block h-[6px] w-[6px] rounded-full"
                style={{ background: 'var(--smvec-gold)' }}
              />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

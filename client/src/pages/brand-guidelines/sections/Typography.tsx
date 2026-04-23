type ScaleRow = {
  tag: string;
  desc: string;
  sample: string;
  spec: string;
  style: React.CSSProperties;
};

const DISPLAY_SCALE: ScaleRow[] = [
  {
    tag: 'display-2xl',
    desc: 'Brand covers',
    sample: 'Brand Guideline',
    spec: '88 / 92 · -3% · 400',
    style: { fontSize: 88, lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 400 },
  },
  {
    tag: 'display-xl',
    desc: 'Section titles',
    sample: 'About SMVEC',
    spec: '64 / 68 · -2.5% · 400',
    style: { fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.025em', fontWeight: 400 },
  },
  {
    tag: 'display-lg',
    desc: 'Page headers',
    sample: 'Admissions Open 2025',
    spec: '44 / 48 · -2% · 400',
    style: { fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 400 },
  },
  {
    tag: 'h1',
    desc: 'Content titles',
    sample: 'Placement & Training Cell',
    spec: '36 / 41 · -1.5% · 400',
    style: { fontSize: 36, lineHeight: 1.15, letterSpacing: '-0.015em', fontWeight: 400 },
  },
  {
    tag: 'h2',
    desc: 'Sub-sections',
    sample: 'Department of Computer Science',
    spec: '28 / 34 · -1% · 400',
    style: { fontSize: 28, lineHeight: 1.2, letterSpacing: '-0.01em', fontWeight: 400 },
  },
  {
    tag: 'h3',
    desc: 'Card titles',
    sample: 'Programmes Offered',
    spec: '22 / 28 · 500',
    style: { fontSize: 22, lineHeight: 1.25, fontWeight: 500 },
  },
  {
    tag: 'h4',
    desc: 'Labels',
    sample: 'Apply by 30 June 2025',
    spec: '18 / 23 · 500',
    style: { fontSize: 18, lineHeight: 1.3, fontWeight: 500 },
  },
];

function ScaleSeries({ rows, family }: { rows: ScaleRow[]; family: string }) {
  return (
    <div>
      {rows.map((row, idx) => (
        <div
          key={row.tag}
          className="grid items-baseline gap-6 py-5"
          style={{
            gridTemplateColumns: '180px 1fr 140px',
            borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--border)',
          }}
        >
          <div
            className="pt-1.5 text-[12px]"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
          >
            <b
              className="block text-[13px] font-medium"
              style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
            >
              {row.tag}
            </b>
            {row.desc}
          </div>
          <div style={{ ...row.style, fontFamily: family, color: 'var(--fg-1)' }}>{row.sample}</div>
          <div
            className="pt-1.5 text-right text-[12px] whitespace-nowrap"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
          >
            {row.spec}
          </div>
        </div>
      ))}
    </div>
  );
}

const TEXT_SCALE: ScaleRow[] = [
  {
    tag: 'body',
    desc: 'Running paragraphs',
    sample:
      'Sri Manakula Vinayagar Engineering College, affiliated to Pondicherry University, is among the leading engineering colleges in Puducherry and Tamil Nadu — with NAAC "A" grade and NBA-accredited programmes across engineering and management.',
    spec: '16 / 26 · 400',
    style: { fontSize: 16, lineHeight: 1.65, fontWeight: 400, maxWidth: '60ch' },
  },
  {
    tag: 'body-sm',
    desc: 'Captions, notes',
    sample:
      'The Placement & Training Cell partners with 250+ recruiters across IT, core engineering, and manufacturing sectors.',
    spec: '14 / 23 · 400',
    style: { fontSize: 14, lineHeight: 1.65, fontWeight: 400, maxWidth: '60ch' },
  },
  {
    tag: 'caption',
    desc: 'Image credits, meta',
    sample: 'Last updated — 17 April 2025 · Office of Academic Affairs',
    spec: '12 / 18 · 400',
    style: { fontSize: 12, lineHeight: 1.5, fontWeight: 400 },
  },
  {
    tag: 'overline',
    desc: 'Eyebrow labels',
    sample: 'AN AUTONOMOUS INSTITUTION · ESTD. 1999',
    spec: '11 · +14% · 500',
    style: {
      fontSize: 11,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--smvec-blue)',
      fontWeight: 500,
    },
  },
];

export default function Typography() {
  return (
    <div className="brand-card">
      <header className="brand-card__header">
        <div>
          <div className="brand-card__eyebrow">01 · Foundations</div>
          <h1 className="brand-card__title">
            <b>Typography</b>
          </h1>
        </div>
        <p className="brand-card__intro">
          The whole brand lives on two optical sizes of Google Sans, set in Regular with generous
          whitespace. A single script face carries the anniversary badge.
        </p>
      </header>

      {/* Hero specimen */}
      <div
        className="relative grid gap-12 overflow-hidden rounded-[8px] p-10 text-white md:grid-cols-2"
        style={{ background: 'var(--smvec-blue)' }}
      >
        <span
          className="absolute left-0 top-0 bottom-0 w-[6px]"
          style={{ background: 'var(--smvec-gold)' }}
        />
        <div>
          <p
            className="m-0 leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 140,
              fontWeight: 400,
              letterSpacing: '-0.04em',
            }}
          >
            Aa Gg
          </p>
        </div>
        <div className="flex flex-col justify-between gap-4">
          <div>
            <h3
              className="m-0 mb-2 text-white"
              style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500 }}
            >
              Google Sans
            </h3>
            <p className="text-[15px] leading-[1.55] text-white/75">
              Geometric humanist sans. Double-story <i>a</i>, two-story <i>g</i>, open apertures.
              Set display copy in Regular — the manual's oversized section titles are never bold.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Regular 400', 'Medium 500', 'SemiBold 600', 'Bold 700', '+ italics'].map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] text-white"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Display scale */}
      <section className="mt-12">
        <div className="brand-section-title">
          Display scale ·{' '}
          <code
            className="text-[12px]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
          >
            var(--font-display)
          </code>
        </div>
        <ScaleSeries rows={DISPLAY_SCALE} family="var(--font-display)" />
      </section>

      {/* Text scale */}
      <section className="mt-12">
        <div className="brand-section-title">
          Text scale ·{' '}
          <code
            className="text-[12px]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
          >
            var(--font-body)
          </code>{' '}
          · Google Sans Text 17pt
        </div>
        <ScaleSeries rows={TEXT_SCALE} family="var(--font-body)" />
      </section>

      {/* Script */}
      <section className="mt-12">
        <div className="brand-section-title">Anniversary script · Great Vibes</div>
        <div
          className="grid items-center gap-6 py-7"
          style={{ gridTemplateColumns: '180px 1fr 1fr' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            <b
              className="block text-[13px] font-medium"
              style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
            >
              script
            </b>
            Badge-only
          </div>
          <div
            className="relative inline-flex items-start"
            style={{ color: 'var(--smvec-blue)' }}
          >
            <span
              className="leading-[0.85]"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 168,
                fontWeight: 400,
                fontStyle: 'normal',
                letterSpacing: '-0.04em',
                color: 'var(--smvec-blue)',
              }}
            >
              26
            </span>
            <span
              className="ml-2 mt-3 inline-flex flex-col items-start"
              style={{ color: 'var(--smvec-blue)' }}
            >
              <span
                className="text-[13px] font-semibold uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.22em',
                  lineHeight: 1,
                  color: 'var(--smvec-blue)',
                }}
              >
                Years
              </span>
              <span
                className="mt-1.5 inline-block h-[3px] w-11"
                style={{ background: 'var(--smvec-gold)' }}
                aria-hidden="true"
              />
            </span>
          </div>
          <div
            className="text-[12px] leading-5"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
          >
            168 / light · reserved for
            <br />
            the 26-year mark only
          </div>
        </div>
        <p
          className="mt-4 max-w-[60ch] text-[14px] leading-[1.65]"
          style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-body)' }}
        >
          This is a typographic stand-in for the hand-lettered{' '}
          <strong style={{ color: 'var(--fg-1)' }}>26 YEARS</strong> mark on the official logo
          lockup. For real artwork — print, web, signage — always use the supplied lockup file from
          Downloads. Never use this script face anywhere else: not for headlines, pull-quotes,
          event titles, or decorative flourishes.
        </p>
      </section>
    </div>
  );
}

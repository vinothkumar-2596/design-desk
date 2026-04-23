import { BRAND_ASSETS } from '../assets';

const VALUES = [
  {
    num: '01',
    name: 'Communication',
    desc: 'Clear institutional voice across every department, every notice, every channel.',
  },
  {
    num: '02',
    name: 'Passionate',
    desc: 'Commitment to student growth — academic, co-curricular, and placement outcomes.',
  },
  {
    num: '03',
    name: 'Reliable',
    desc: '25+ years of autonomous, NAAC "A"-graded engineering education in Puducherry.',
  },
  {
    num: '04',
    name: 'Creative',
    desc: 'Research centres, MoUs, and project-based pedagogy feeding real industry problems.',
  },
];

function Lockup({
  label,
  src,
  variant = 'white',
  alt,
}: {
  label: string;
  src: string;
  variant?: 'white' | 'blue';
  alt: string;
}) {
  const isBlue = variant === 'blue';
  return (
    <div
      className="relative flex min-h-[300px] flex-col items-center justify-center rounded-[10px] border p-10"
      style={{
        background: isBlue ? 'var(--smvec-blue)' : '#fff',
        borderColor: isBlue ? 'var(--smvec-blue)' : 'var(--border)',
      }}
    >
      <span
        className="absolute left-4 top-3.5 text-[11px] font-medium uppercase tracking-[0.12em]"
        style={{ color: isBlue ? 'rgba(255,255,255,0.75)' : 'var(--fg-3)' }}
      >
        {label}
      </span>
      <img src={src} alt={alt} className="max-h-[220px] max-w-full object-contain" loading="lazy" />
    </div>
  );
}

function ChapterDemo({
  variant,
  chapter,
  title,
  emphasis,
}: {
  variant: 'blue' | 'gold';
  chapter: string;
  title: string;
  emphasis: string;
}) {
  const isBlue = variant === 'blue';
  const bg = isBlue ? 'var(--smvec-blue)' : 'var(--smvec-gold)';
  const fg = isBlue ? '#fff' : 'var(--smvec-blue)';
  const ruleColor = isBlue ? 'var(--smvec-gold)' : 'var(--smvec-blue)';
  return (
    <div
      className="relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[8px] p-10"
      style={{ background: bg, color: fg }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-2"
        style={{ background: ruleColor }}
      />
      <div
        className="text-[12px] uppercase tracking-[0.14em]"
        style={{ opacity: 0.75 }}
      >
        {chapter}
      </div>
      <h3
        className="m-0 mt-2 inline-block leading-[1.05]"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 44,
          letterSpacing: '-0.02em',
          fontWeight: 400,
        }}
      >
        {title}{title && emphasis ? ' ' : ''}
        {emphasis && (
          <b
            className="inline-block pb-1"
            style={{
              borderBottom: `4px solid ${isBlue ? 'var(--smvec-gold)' : 'currentColor'}`,
              fontWeight: 'inherit',
            }}
          >
            {emphasis}
          </b>
        )}
      </h3>
    </div>
  );
}

function Dont({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-[10px] border bg-white p-6"
      style={{ borderColor: 'var(--border)' }}
    >
      <span
        className="absolute right-3 top-3 rounded-[3px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ background: '#FEE9EA', color: '#B00020' }}
      >
        Don't
      </span>
      <div className="mb-3 flex h-[100px] items-center justify-center overflow-hidden rounded-[6px]">
        {children}
      </div>
      <p className="m-0 text-[12px] leading-[1.55]" style={{ color: 'var(--fg-3)' }}>
        {caption}
      </p>
    </div>
  );
}

export default function Logo() {
  return (
    <div className="brand-card">
      <header className="brand-card__header">
        <div>
          <div className="brand-card__eyebrow">Brand</div>
          <h1 className="brand-card__title">
            Logo &amp; <b>brand marks</b>
          </h1>
        </div>
        <p className="brand-card__intro">
          The lockup combines a botanical tree-and-lamp emblem with the "26 YEARS" anniversary
          script and the wordmark. Use the full lockup by default; reach for the emblem only at
          small sizes.
        </p>
      </header>

      <section className="mt-2">
        <div className="brand-section-title">Lockups</div>
        <div className="grid gap-5 md:grid-cols-2">
          <Lockup
            label="Primary · 26 Years Edition"
            src={BRAND_ASSETS.svg.group}
            alt="SMVEC full logo"
          />
          <Lockup
            label="Emblem · alone"
            src={BRAND_ASSETS.svg.frame42}
            alt="SMVEC emblem"
          />
        </div>
        <p
          className="mt-3 text-[12.5px] leading-5"
          style={{ color: 'var(--fg-3)' }}
        >
          Reverse, mono, and on-blue variants are available in the official{' '}
          <a
            href="/brand-guidelines/downloads"
            className="font-medium underline decoration-[var(--smvec-gold)] underline-offset-4"
            style={{ color: 'var(--smvec-blue)' }}
          >
            logo pack
          </a>
          .
        </p>
      </section>

      <section className="mt-12">
        <div className="brand-section-title">Brand values · as published in the manual</div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <div
              key={value.num}
              className="relative overflow-hidden rounded-[10px] border bg-white p-6"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="mb-1.5 leading-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 48,
                  color: 'var(--smvec-gold)',
                  letterSpacing: '-0.02em',
                  fontWeight: 500,
                }}
              >
                {value.num}
              </div>
              <div
                className="mb-1.5 text-[18px]"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  color: 'var(--smvec-blue)',
                }}
              >
                {value.name}
              </div>
              <p className="m-0 text-[12px] leading-[1.55]" style={{ color: 'var(--fg-3)' }}>
                {value.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="brand-section-title">Section-title architecture · keyline + gold rule</div>
        <div className="grid gap-5 md:grid-cols-2">
          <ChapterDemo variant="blue" chapter="Chapter 01" title="" emphasis="Introduction" />
          <ChapterDemo variant="gold" chapter="Chapter 03" title="Our" emphasis="Values" />
        </div>
        <p
          className="mt-4 max-w-[72ch] text-[13px] leading-[1.55]"
          style={{ color: 'var(--fg-3)' }}
        >
          A vertical keyline bar runs the full height of the outer edge; the title sits at the
          bottom with a 4px rule underlining the final word. Gold rule on blue pages, blue rule on
          gold pages.
        </p>
      </section>

      <section className="mt-12">
        <div className="brand-section-title">Logo — don'ts</div>
        <div className="grid gap-4 md:grid-cols-3">
          <Dont caption="Don't place on off-brand colors. Blue or white backgrounds only; gold only for the wordmark sublabel.">
            <div
              className="flex h-[100px] w-full items-center justify-center"
              style={{ background: '#7D4098' }}
            >
              <img
                src={BRAND_ASSETS.svg.frame42}
                alt=""
                className="max-h-[80px]"
                loading="lazy"
              />
            </div>
          </Dont>
          <Dont caption="Don't stretch or skew. The emblem's proportions are locked.">
            <img
              src={BRAND_ASSETS.svg.frame42}
              alt=""
              loading="lazy"
              style={{ transform: 'scaleX(1.5)', maxHeight: 70 }}
            />
          </Dont>
          <Dont caption="Don't place on patterned or textured surfaces. Keep backgrounds solid.">
            <div
              className="flex h-[100px] w-full items-center justify-center"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #E5E5EC 0 6px, #fff 6px 12px)',
              }}
            >
              <img
                src={BRAND_ASSETS.svg.frame42}
                alt=""
                className="max-h-[80px]"
                loading="lazy"
              />
            </div>
          </Dont>
        </div>
      </section>
    </div>
  );
}

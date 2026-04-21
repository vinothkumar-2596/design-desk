/*
 * On-brand minimal SVG covers for blog posts. Each cover uses only the SMVEC
 * palette (Royal Blue, Golden Age, Black, White + tints) and communicates the
 * article's subject through simple geometric / typographic motifs — no stock
 * photography, no off-brand imagery.
 */

type Category =
  | 'Identity'
  | 'Typography'
  | 'Color'
  | 'Print'
  | 'Digital'
  | 'Process'
  | 'Systems';

const BLUE = '#36429B';
const GOLD = '#DBA328';
const INK = '#1A1F33';
const PASTEL = '#EEF1FB';
const PASTEL_2 = '#DCE2F4';

function SystemsCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill={BLUE} />
      {/* 12-column grid overlay */}
      {Array.from({ length: 13 }).map((_, i) => (
        <line
          key={i}
          x1={40 + (i * 520) / 12}
          y1={40}
          x2={40 + (i * 520) / 12}
          y2={320}
          stroke="#FFFFFF"
          strokeOpacity={0.12}
          strokeWidth={1}
        />
      ))}
      {/* Horizontal rules */}
      {[80, 140, 200, 260].map((y) => (
        <line key={y} x1={40} y1={y} x2={560} y2={y} stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1} />
      ))}
      {/* Composition blocks */}
      <rect x={40} y={80} width={260} height={60} fill={GOLD} opacity={0.92} />
      <rect x={40} y={160} width={170} height={100} fill="#FFFFFF" opacity={0.95} />
      <rect x={230} y={160} width={130} height={40} fill={GOLD} opacity={0.55} />
      <rect x={230} y={210} width={130} height={50} fill="#FFFFFF" opacity={0.25} />
      <rect x={380} y={80} width={180} height={180} fill="#FFFFFF" opacity={0.18} />
      <line x1={380} y1={260} x2={560} y2={260} stroke={GOLD} strokeWidth={4} />
    </svg>
  );
}

function TypographyCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill={PASTEL} />
      <text
        x="60"
        y="235"
        fill={INK}
        fontFamily="'Google Sans','Google Sans Display',Inter,system-ui,sans-serif"
        fontSize="200"
        fontWeight={500}
        letterSpacing="-0.04em"
      >
        Aa
      </text>
      <text
        x="380"
        y="235"
        fill={BLUE}
        fontFamily="'Google Sans','Google Sans Display',Inter,system-ui,sans-serif"
        fontSize="200"
        fontWeight={500}
        letterSpacing="-0.04em"
      >
        Gg
      </text>
      <line x1={60} y1={260} x2={180} y2={260} stroke={GOLD} strokeWidth={4} />
      <text
        x="60"
        y="300"
        fill="#6E7791"
        fontFamily="'Google Sans',Inter,system-ui,sans-serif"
        fontSize="16"
        letterSpacing="0.14em"
      >
        GOOGLE SANS · 17PT
      </text>
    </svg>
  );
}

function ColorCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill="#FFFFFF" />
      <rect x={40} y={40} width={240} height={280} fill={BLUE} />
      <rect x={300} y={40} width={120} height={140} fill={GOLD} />
      <rect x={300} y={200} width={120} height={120} fill={INK} />
      <rect x={440} y={40} width={120} height={140} fill={PASTEL_2} />
      <rect x={440} y={200} width={120} height={120} fill={PASTEL} stroke="#E5E7EE" strokeWidth={1} />
      <text
        x="60"
        y="300"
        fill="#FFFFFF"
        fontFamily="'Google Sans',Inter,system-ui,sans-serif"
        fontSize="13"
        letterSpacing="0.22em"
        fontWeight={600}
      >
        #36429B
      </text>
    </svg>
  );
}

function IdentityCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill={PASTEL} />
      <rect x={40} y={40} width={520} height={280} fill="#FFFFFF" />
      {/* Stylised lotus emblem */}
      <g transform="translate(300 190)">
        {/* gold petals */}
        {Array.from({ length: 7 }).map((_, i) => {
          const angle = -60 + i * 20;
          return (
            <path
              key={i}
              d="M0 -60 Q 8 -30 0 0 Q -8 -30 0 -60 Z"
              fill={GOLD}
              transform={`rotate(${angle})`}
            />
          );
        })}
        {/* blue bowl */}
        <path d="M -70 0 A 70 70 0 0 0 70 0 L 60 36 L -60 36 Z" fill={BLUE} />
        <line x1={-60} y1={18} x2={60} y2={18} stroke="#FFFFFF" strokeWidth={1.5} />
      </g>
      <rect x={40} y={300} width={200} height={3} fill={GOLD} />
      <text
        x="40"
        y="330"
        fill={INK}
        fontFamily="'Google Sans',Inter,system-ui,sans-serif"
        fontSize="13"
        letterSpacing="0.22em"
        fontWeight={600}
      >
        SMVEC · IDENTITY
      </text>
    </svg>
  );
}

function PrintCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill={PASTEL} />
      {/* Paper sheet */}
      <rect x={150} y={40} width={300} height={280} fill="#FFFFFF" stroke={PASTEL_2} strokeWidth={1} />
      {/* Crop marks */}
      {[
        [130, 40],
        [470, 40],
        [130, 320],
        [470, 320],
      ].map(([cx, cy], i) => (
        <g key={i} stroke={INK} strokeWidth={1.2}>
          <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} />
          <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} />
        </g>
      ))}
      {/* Content rows on paper */}
      <rect x={180} y={72} width={100} height={14} fill={BLUE} />
      <rect x={180} y={100} width={240} height={6} fill={PASTEL_2} />
      <rect x={180} y={114} width={180} height={6} fill={PASTEL_2} />
      <rect x={180} y={128} width={210} height={6} fill={PASTEL_2} />
      <rect x={180} y={160} width={180} height={90} fill={BLUE} opacity={0.92} />
      <rect x={370} y={160} width={50} height={40} fill={GOLD} />
      <rect x={180} y={270} width={240} height={4} fill={GOLD} />
      <rect x={180} y={285} width={140} height={6} fill={PASTEL_2} />
    </svg>
  );
}

function DigitalCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill={BLUE} />
      {/* Browser frame */}
      <rect x={80} y={60} width={440} height={250} rx={8} fill="#FFFFFF" />
      <rect x={80} y={60} width={440} height={26} rx={8} fill={PASTEL} />
      <circle cx={100} cy={73} r={4} fill={GOLD} />
      <circle cx={116} cy={73} r={4} fill={PASTEL_2} />
      <circle cx={132} cy={73} r={4} fill={PASTEL_2} />
      {/* Content blocks inside frame */}
      <rect x={100} y={110} width={160} height={14} fill={INK} />
      <rect x={100} y={136} width={100} height={8} fill={PASTEL_2} />
      <rect x={100} y={170} width={200} height={100} fill={BLUE} opacity={0.18} />
      <rect x={320} y={170} width={180} height={46} fill={GOLD} />
      <rect x={320} y={224} width={180} height={46} fill={PASTEL_2} />
      <line x1={100} y1={290} x2={500} y2={290} stroke={GOLD} strokeWidth={3} />
    </svg>
  );
}

function ProcessCover() {
  return (
    <svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="600" height="360" fill="#FFFFFF" />
      {/* Flow line */}
      <line x1={70} y1={180} x2={530} y2={180} stroke={PASTEL_2} strokeWidth={2} />
      {/* Nodes */}
      {[100, 220, 340, 460].map((cx, i) => {
        const active = i < 3;
        return (
          <g key={cx}>
            <circle
              cx={cx}
              cy={180}
              r={26}
              fill={active ? BLUE : '#FFFFFF'}
              stroke={active ? BLUE : PASTEL_2}
              strokeWidth={2}
            />
            <text
              x={cx}
              y={186}
              textAnchor="middle"
              fill={active ? '#FFFFFF' : '#6E7791'}
              fontFamily="'Google Sans',Inter,system-ui,sans-serif"
              fontSize="14"
              fontWeight={600}
            >
              0{i + 1}
            </text>
          </g>
        );
      })}
      {/* Gold progress bar */}
      <line x1={100} y1={180} x2={340} y2={180} stroke={GOLD} strokeWidth={3} />
      {/* Labels */}
      {['Submit', 'Review', 'Approve', 'Publish'].map((label, i) => (
        <text
          key={label}
          x={100 + i * 120}
          y={240}
          textAnchor="middle"
          fill={INK}
          fontFamily="'Google Sans',Inter,system-ui,sans-serif"
          fontSize="13"
          letterSpacing="0.18em"
          fontWeight={500}
        >
          {label.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}

export function BlogCover({
  category,
  slug,
}: {
  category: Category;
  /** Reserved for per-post overrides in the future. */
  slug?: string;
}) {
  // slug kept in signature so data callers don't have to change if we ever
  // want per-article variants; currently the category drives the treatment.
  void slug;
  switch (category) {
    case 'Typography':
      return <TypographyCover />;
    case 'Color':
      return <ColorCover />;
    case 'Identity':
      return <IdentityCover />;
    case 'Print':
      return <PrintCover />;
    case 'Digital':
      return <DigitalCover />;
    case 'Process':
      return <ProcessCover />;
    case 'Systems':
    default:
      return <SystemsCover />;
  }
}

import { BRAND_ASSETS, BRAND_COLORS } from '../assets';
import { SectionTitle } from '../components/SectionTitle';
import { Callout } from '../components/Callout';
import { XCircle } from 'lucide-react';

/* ================================================================
   LOGO VARIATIONS
   ================================================================ */
const VARIATIONS = [
  {
    label: 'Full-color lockup',
    description: 'Primary version with blue emblem, gold accents, and blue type on white or light backgrounds.',
    variant: 'light' as const,
    bg: '#FAFBFE',
    image: 'https://res.cloudinary.com/dofapr3pk/image/upload/v1776859477/df_mhoxbm.png',
  },
  {
    label: 'Reverse lockup',
    description: 'White type with gold emblem accents on Royal Blue. Use on dark or branded backgrounds.',
    variant: 'dark' as const,
    bg: '#36429B',
    image: 'https://res.cloudinary.com/dofapr3pk/image/upload/v1776859476/daf_qo1tij.png',
  },
];

/* ================================================================
   PROPER / IMPROPER USAGE
   ================================================================ */
const PROPER_USAGE = [
  'Full-color lockup on white background',
  'White (reverse) lockup on Royal Blue',
  'Gold mono lockup on black background',
];

const IMPROPER_USAGE: { rule: string; style?: React.CSSProperties; className?: string }[] = [
  {
    rule: "Don't stretch, condense or change the dimensions of the identity",
    style: { transform: 'scaleX(1.5)' },
  },
  {
    rule: "Don't alter the placement or scale of the elements",
    style: { transform: 'translate(12px, -8px) scale(0.7)' },
  },
  {
    rule: "Don't add colors to individual elements",
    style: { filter: 'hue-rotate(90deg) saturate(2)' },
  },
  {
    rule: "Don't alter or replace the typefaces of the identity",
    style: { filter: 'blur(0.5px)', transform: 'scaleY(0.85)' },
  },
  {
    rule: "Don't rotate the identity",
    style: { transform: 'rotate(-18deg)' },
  },
  {
    rule: "Don't use colors other than those specified in this document",
    style: { filter: 'hue-rotate(200deg) saturate(1.5)' },
  },
  {
    rule: "Don't rearrange the placement of the type within the identity",
    style: { transform: 'scaleX(-1)' },
  },
  {
    rule: "Don't use drop shadows, strokes or other visual effects",
    style: { filter: 'drop-shadow(3px 3px 4px rgba(0,0,0,0.4))' },
  },
  {
    rule: "Don't add any extra elements to the identity",
    style: { filter: 'sepia(0.6) brightness(1.1)' },
  },
];

/* ================================================================
   COLLATERAL APPLICATIONS
   ================================================================ */
const APPLICATIONS = [
  {
    title: 'Admission posters',
    image: BRAND_ASSETS.svg.frame42,
    description:
      'Royal Blue background with the lockup top-left, Golden Age underline beneath the program name, and call-to-action band at the foot.',
    rules: ['Logo upper-left', 'Gold rule under headline', 'Single hero image, no patterns'],
  },
  {
    title: 'Department posters',
    image: BRAND_ASSETS.svg.frame55,
    description:
      'White editorial layout with department name in Heading 1, supporting body copy, and the SMVEC lockup anchored bottom-right.',
    rules: ['Editorial whitespace', 'Heading + supporting body', 'Lockup bottom-right'],
  },
  {
    title: 'Brochures',
    image: BRAND_ASSETS.svg.frame57,
    description:
      'Two-column grid, opening section with Royal Blue cover, interior pages on white with consistent margins and gold keylines between sections.',
    rules: ['Two-column grid', 'Royal Blue cover only', 'Gold keyline between sections'],
  },
  {
    title: 'Social media creative',
    image: BRAND_ASSETS.svg.frame56,
    description:
      'Square or 4:5 frames with brand-tinted surfaces, lockup or emblem in the lower corner, and one focal element per post.',
    rules: ['One focal element', 'Lockup or emblem only', 'No external profile filters'],
  },
  {
    title: 'Event banners',
    image: BRAND_ASSETS.svg.frame58,
    description:
      'Royal Blue header band, Golden Age accent rule, event title in Display, date and venue in Body Large beneath.',
    rules: ['Blue header band', 'Gold rule under title', 'Date + venue in Body Large'],
  },
  {
    title: 'Certificates',
    image: BRAND_ASSETS.svg.frame61,
    description:
      'Landscape orientation, white surface, gold border keyline, lockup centred above the recipient name in Display weight.',
    rules: ['Landscape only', 'Gold border keyline', 'Lockup centred above name'],
  },
];

/* ================================================================
   COMPONENT
   ================================================================ */
const SMVEC_LOGO = BRAND_ASSETS.svg.frame56;
const SMVEC_LOGO_WHITE = '/smvec-logo-white.svg';
const SMVEC_LOGO_GOLD = '/smvec-logo-gold.svg';

export default function Applications() {
  const logoSrc = SMVEC_LOGO;

  return (
    <div className="space-y-20">

      {/* ─── SECTION 1: Logo Variations ─── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="Identity"
          title="Logo"
          emphasis="variations"
          description="The SMVEC identity exists in two orientations. Always use the supplied artwork — never recreate, redraw, or retype the logo."
        />

        <div className="grid gap-6 md:grid-cols-2">
          {VARIATIONS.map((v) => (
            <div
              key={v.label}
              className="overflow-hidden rounded-md border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}
            >
              <div
                className="flex h-64 items-center justify-center border-b p-8"
                style={{ background: v.bg, borderColor: 'var(--border)' }}
              >
                <img
                  src={v.image}
                  alt={`SMVEC logo — ${v.label}`}
                  className="max-h-full max-w-[320px] object-contain"
                  loading="lazy"
                />
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-medium" style={{ color: 'var(--fg-1)' }}>{v.label}</span>
                  <span
                    className="rounded-full border border-dashed px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest"
                    style={{ borderColor: 'rgba(54,66,155,0.30)', color: 'var(--smvec-blue)' }}
                  >
                    {v.variant}
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-5" style={{ color: 'var(--fg-2)' }}>{v.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SECTION 3: Proper Logo Usage ─── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="Identity"
          title="Proper"
          emphasis="logo usage"
          description="These examples show the only approved ways to display the SMVEC identity. Follow these exactly."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {PROPER_USAGE.map((rule, idx) => {
            const bgColors = [BRAND_COLORS.white, BRAND_COLORS.royalBlue, '#252525'];
            const bg = bgColors[idx] || BRAND_COLORS.white;
            const logoVariants = [SMVEC_LOGO, SMVEC_LOGO_WHITE, SMVEC_LOGO_GOLD];
            const cardLogo = logoVariants[idx] || SMVEC_LOGO;
            return (
              <div
                key={rule}
                className="overflow-hidden rounded-md border"
                style={{ borderColor: 'var(--border)' }}
              >
                <div
                  className="flex h-48 items-center justify-center p-8"
                  style={{ background: bg }}
                >
                  <img
                    src={cardLogo}
                    alt={rule}
                    className="h-16 object-contain"
                    loading="lazy"
                  />
                </div>
                <div
                  className="flex items-center gap-2 border-t px-4 py-3"
                  style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}
                >
                  <span className="text-[12.5px] leading-5" style={{ color: 'var(--fg-1)' }}>{rule}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── SECTION 4: Improper Logo Usage ─── */}
      <section className="space-y-8">
        <SectionTitle
          eyebrow="Identity"
          title="Improper"
          emphasis="logo usage"
          description="Never modify, distort, or recolor the SMVEC identity. These are common misuses to avoid."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMPROPER_USAGE.map((item) => (
            <div
              key={item.rule}
              className="overflow-hidden rounded-md border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}
            >
              <div
                className="relative flex h-36 items-center justify-center overflow-hidden p-6"
                style={{ background: 'var(--bg-2)' }}
              >
                {/* Diagonal hatch overlay */}
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(135deg, transparent, transparent 6px, #36429B 6px, #36429B 7px)',
                  }}
                />
                <img
                  src={logoSrc}
                  alt=""
                  className="relative z-[1] h-12 object-contain opacity-90"
                  style={item.style}
                  loading="lazy"
                />
              </div>
              <div
                className="flex items-start gap-2 border-t px-4 py-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span className="text-[12.5px] leading-5" style={{ color: 'var(--fg-2)' }}>{item.rule}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Callout variant="info" title="Unsure about a logo application?">
        Always use the supplied artwork — never recreate, screenshot, or retype the logo. If your
        use case isn't covered above, reach out to the brand team for guidance before publishing. See{' '}
        <a href="/brand-guidelines/contact" className="font-medium hover:underline" style={{ color: 'var(--smvec-blue)' }}>
          Contact
        </a>
        .
      </Callout>
    </div>
  );
}

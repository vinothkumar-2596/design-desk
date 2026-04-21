import { BRAND_ASSETS } from '../assets';
import { SectionTitle } from '../components/SectionTitle';
import { Callout } from '../components/Callout';

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

export default function Applications() {
  return (
    <div className="space-y-14">
      <SectionTitle
        eyebrow="Applied"
        title="Collateral"
        emphasis="applications"
        description="Reference layouts for the most common SMVEC outputs. Each example documents the approved logo placement, color balance, typography hierarchy, and spacing discipline."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {APPLICATIONS.map((item) => (
          <article
            key={item.title}
            className="overflow-hidden rounded-md border border-[#E4E7F1] bg-white"
          >
            <div className="flex h-56 items-center justify-center border-b border-[#E4E7F1] bg-[#F8F9FE] p-6">
              <img
                src={item.image}
                alt={item.title}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="p-5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#36429B]">
                Application
              </p>
              <h3 className="mt-1.5 text-[17px] font-medium text-[#0B1024]">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#48506B]">{item.description}</p>
              <ul className="mt-4 space-y-1.5">
                {item.rules.map((rule) => (
                  <li
                    key={rule}
                    className="flex items-start gap-2 text-[12.5px] leading-5 text-[#0B1024]"
                  >
                    <span
                      className="mt-1.5 inline-block h-1 w-3 shrink-0 bg-[#DBA328]"
                      aria-hidden="true"
                    />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <Callout variant="info" title="Need a layout that isn't here?">
        Standees, hoardings, presentations, emailers, official notices, and campus signage follow
        the same principles — open the closest example above, then ask the brand team to confirm
        before going to print or publish. See{' '}
        <a href="/brand-guidelines/contact" className="font-medium text-[#36429B] hover:underline">
          Contact
        </a>
        .
      </Callout>
    </div>
  );
}

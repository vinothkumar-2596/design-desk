import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Tag } from 'lucide-react';
import { BRAND_ASSETS } from '../assets';
import { SectionTitle } from '../components/SectionTitle';

type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  category: 'Identity' | 'Typography' | 'Color' | 'Print' | 'Digital' | 'Process';
  author: string;
  authorRole: string;
  date: string;
  readMinutes: number;
  cover: string;
  featured?: boolean;
};

const POSTS: BlogPost[] = [
  {
    id: 'lockup-hierarchy',
    title: 'Why the SMVEC lockup must always lead the cover',
    excerpt:
      'The full lockup carries our institutional weight. Cropping it for "balance" or hiding it for "minimalism" weakens every piece of collateral that follows.',
    category: 'Identity',
    author: 'Brand & Communications Cell',
    authorRole: 'SMVEC',
    date: 'Apr 22, 2026',
    readMinutes: 6,
    cover: BRAND_ASSETS.svg.group,
    featured: true,
  },
  {
    id: 'gold-rule',
    title: 'How to use the gold rule without overusing it',
    excerpt:
      'Golden Age is reserved for emphasis: keylines, underlines, and signature accents. A field full of gold becomes louder than the institution it represents.',
    category: 'Color',
    author: 'Anbarasai V',
    authorRole: 'Design Lead',
    date: 'Apr 18, 2026',
    readMinutes: 4,
    cover: BRAND_ASSETS.svg.frame55,
  },
  {
    id: 'typography-discipline',
    title: 'Setting display copy in Regular — and why we never bold it',
    excerpt:
      'Editorial calm is the goal. Heavy display weights make a college brochure read like a sale flyer. Discipline starts at the headline.',
    category: 'Typography',
    author: 'Brand & Communications Cell',
    authorRole: 'SMVEC',
    date: 'Apr 14, 2026',
    readMinutes: 5,
    cover: BRAND_ASSETS.svg.frame57,
  },
  {
    id: 'admission-poster',
    title: 'Anatomy of an SMVEC admission poster',
    excerpt:
      'Royal Blue header band, gold rule, lockup top-left, single hero image, no patterns. Every admission cycle, we make the same five decisions.',
    category: 'Print',
    author: 'Anbarasai V',
    authorRole: 'Design Lead',
    date: 'Apr 09, 2026',
    readMinutes: 7,
    cover: BRAND_ASSETS.svg.frame42,
  },
  {
    id: 'social-templates',
    title: 'Building the new department social templates',
    excerpt:
      'Eight departments, one visual language. We rebuilt the Instagram and LinkedIn frames so any staff member can ship on-brand in minutes.',
    category: 'Digital',
    author: 'DesignDesk Team',
    authorRole: 'Internal Tools',
    date: 'Apr 03, 2026',
    readMinutes: 5,
    cover: BRAND_ASSETS.svg.frame56,
  },
  {
    id: 'approval-workflow',
    title: 'A 24-hour approval window: how the workflow stays predictable',
    excerpt:
      'Submit on time, follow the checklist, and the brand team reviews within one working day. Here is what makes the cycle move quickly.',
    category: 'Process',
    author: 'Brand & Communications Cell',
    authorRole: 'SMVEC',
    date: 'Mar 28, 2026',
    readMinutes: 4,
    cover: BRAND_ASSETS.svg.frame58,
  },
  {
    id: 'palette-print',
    title: 'Royal Blue on press: keeping color true across paper stocks',
    excerpt:
      'Why our Pantone reference matters more than the screen value. A short note for printers and our admissions print runs.',
    category: 'Color',
    author: 'Brand & Communications Cell',
    authorRole: 'SMVEC',
    date: 'Mar 22, 2026',
    readMinutes: 6,
    cover: BRAND_ASSETS.svg.frame61,
  },
];

const CATEGORIES: Array<BlogPost['category'] | 'All'> = [
  'All',
  'Identity',
  'Typography',
  'Color',
  'Print',
  'Digital',
  'Process',
];

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors"
      style={{
        background: active ? 'var(--smvec-blue)' : 'transparent',
        color: active ? '#fff' : 'var(--fg-2)',
        border: `1px solid ${active ? 'var(--smvec-blue)' : 'var(--smvec-blue-100)'}`,
        fontFamily: 'var(--font-display)',
      }}
    >
      {label}
    </button>
  );
}

function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to="/brand-guidelines/blog"
      className="group grid overflow-hidden rounded-[14px] outline-none lg:grid-cols-[1.15fr,1fr]"
      style={{
        background: 'rgba(54, 66, 155, 0.05)',
      }}
    >
      <div className="relative flex items-center justify-center px-8 py-10 lg:py-12" style={{ background: 'var(--smvec-blue)' }}>
        <span
          className="absolute left-5 top-5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'var(--font-display)' }}
        >
          Featured
        </span>
        <img
          src={post.cover}
          alt=""
          className="h-full max-h-[200px] w-auto object-contain"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col justify-between gap-5 px-7 py-8 lg:px-9 lg:py-10">
        <div className="space-y-3">
          <span
            className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
          >
            <Tag className="h-3 w-3" />
            {post.category}
          </span>
          <h2
            className="text-[24px] leading-[1.15] tracking-[-0.015em] lg:text-[28px]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              color: 'var(--smvec-ink)',
            }}
          >
            {post.title}
          </h2>
          <p className="text-[14px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
            {post.excerpt}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]" style={{ color: 'var(--fg-3)' }}>
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}>
              {post.author}
            </p>
            <p className="truncate text-[11px]">
              {post.authorRole} · {post.date}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="h-3 w-3" /> {post.readMinutes} min read
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ color: 'var(--smvec-blue)' }}
        >
          Read article
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to="/brand-guidelines/blog"
      className="group flex h-full flex-col overflow-hidden rounded-[12px] border bg-white outline-none transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_38px_-24px_rgba(54,66,155,0.18)]"
      style={{ borderColor: 'var(--smvec-blue-100)' }}
    >
      <div
        className="flex h-44 items-center justify-center overflow-hidden p-6"
        style={{ background: 'rgba(54, 66, 155, 0.05)' }}
      >
        <img
          src={post.cover}
          alt=""
          className="h-full max-h-[120px] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span
          className="inline-flex w-fit items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
        >
          <Tag className="h-2.5 w-2.5" />
          {post.category}
        </span>
        <h3
          className="text-[15.5px] leading-snug tracking-[-0.005em]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--smvec-ink)',
          }}
        >
          {post.title}
        </h3>
        <p className="line-clamp-2 text-[13px] leading-[1.55]" style={{ color: 'var(--fg-2)' }}>
          {post.excerpt}
        </p>
        <div
          className="mt-auto flex items-center justify-between border-t pt-3 text-[11.5px]"
          style={{ borderColor: 'var(--smvec-blue-100)', color: 'var(--fg-3)' }}
        >
          <span className="truncate font-medium" style={{ color: 'var(--fg-2)' }}>
            {post.author}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3" /> {post.readMinutes} min
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('All');

  const featured = useMemo(() => POSTS.find((p) => p.featured) || POSTS[0], []);
  const filteredPosts = useMemo(() => {
    const rest = POSTS.filter((p) => p.id !== featured.id);
    if (activeCategory === 'All') return rest;
    return rest.filter((p) => p.category === activeCategory);
  }, [activeCategory, featured.id]);

  return (
    <div className="space-y-12">
      <SectionTitle
        eyebrow="Editorial"
        title="The brand"
        emphasis="journal"
        description="Notes, case studies, and process pieces from the SMVEC Brand & Communications Cell. Practical reading for staff, designers, and partner agencies."
      />

      <FeaturedCard post={featured} />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="brand-section-title m-0">Latest posts</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div
            className="rounded-[12px] border bg-white px-6 py-12 text-center"
            style={{ borderColor: 'var(--smvec-blue-100)' }}
          >
            <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>
              No posts in this category yet.
            </p>
            <button
              type="button"
              onClick={() => setActiveCategory('All')}
              className="mt-3 text-[13px] font-medium underline-offset-4 hover:underline"
              style={{ color: 'var(--smvec-blue)' }}
            >
              Show all posts
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      <section
        className="overflow-hidden rounded-[14px] px-7 py-10 lg:px-12 lg:py-12"
        style={{ background: 'rgba(54, 66, 155, 0.05)' }}
      >
        <div className="grid items-center gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="space-y-3">
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: 'var(--smvec-blue)' }}
            >
              Submit a story
            </p>
            <h3
              className="text-[24px] leading-snug tracking-[-0.01em]"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                color: 'var(--smvec-ink)',
              }}
            >
              Worked on something the brand team should publish?
            </h3>
            <p className="text-[14px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
              Case studies, departmental campaigns, and process notes are welcome. Send a short
              pitch and we will help you shape the post.
            </p>
          </div>
          <div className="flex justify-start lg:justify-end">
            <Link
              to="/brand-guidelines/contact"
              className="inline-flex h-11 items-center gap-2 rounded-[6px] px-5 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-14px_rgba(54,66,155,0.55)] transition-all duration-200 hover:-translate-y-[1px]"
              style={{ background: 'var(--smvec-blue)' }}
            >
              Pitch the brand team
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

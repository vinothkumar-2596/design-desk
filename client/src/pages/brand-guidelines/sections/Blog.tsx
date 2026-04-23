import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Tag } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { BlogCover } from '../components/BlogCover';
import { BLOG_POSTS, type BlogPost } from '../data/blogPosts';

const CATEGORIES: Array<BlogPost['category'] | 'All'> = [
  'All',
  'Identity',
  'Typography',
  'Color',
  'Print',
  'Digital',
  'Process',
  'Systems',
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
      to={`/brand-guidelines/blog/${post.slug}`}
      className="group grid overflow-hidden rounded-[14px] outline-none lg:h-[360px] lg:grid-cols-[1.05fr,1fr]"
      style={{ background: 'var(--smvec-blue-tint)' }}
    >
      <div className="relative h-56 overflow-hidden md:h-72 lg:h-full">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]">
          <BlogCover category={post.category} slug={post.slug} />
        </div>
        <span
          className="absolute left-5 top-5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
          style={{
            background: 'rgba(54, 66, 155, 0.92)',
            fontFamily: 'var(--font-display)',
          }}
        >
          Featured
        </span>
      </div>
      <div className="flex flex-col justify-between gap-5 px-7 py-7 lg:px-9 lg:py-8">
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
        <div
          className="flex items-center justify-between gap-4 text-[12px]"
          style={{ color: 'var(--fg-3)' }}
        >
          <div className="min-w-0">
            <p
              className="truncate font-medium"
              style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
            >
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
      to={`/brand-guidelines/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[12px] border outline-none transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_38px_-24px_rgba(54,66,155,0.18)]"
      style={{ borderColor: 'var(--smvec-blue-100)', background: 'var(--bg-1)' }}
    >
      <div className="h-44 overflow-hidden">
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]">
          <BlogCover category={post.category} slug={post.slug} />
        </div>
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

  const featured = useMemo(() => BLOG_POSTS.find((p) => p.featured) || BLOG_POSTS[0], []);
  const filteredPosts = useMemo(() => {
    const rest = BLOG_POSTS.filter((p) => p.slug !== featured.slug);
    if (activeCategory === 'All') return rest;
    return rest.filter((p) => p.category === activeCategory);
  }, [activeCategory, featured.slug]);

  return (
    <div className="space-y-12">
      <SectionTitle
        eyebrow="Editorial"
        title="The brand"
        emphasis="journal"
        description="Notes, case studies, and process pieces drawn from the canon of graphic design — referenced where they belong, applied where they help SMVEC ship better collateral."
      />

      <FeaturedCard post={featured} />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="brand-section-title m-0">Latest articles</div>
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
            className="rounded-[12px] border px-6 py-12 text-center"
            style={{ borderColor: 'var(--smvec-blue-100)', background: 'var(--bg-1)' }}
          >
            <p className="text-[14px]" style={{ color: 'var(--fg-3)' }}>
              No articles in this category yet.
            </p>
            <button
              type="button"
              onClick={() => setActiveCategory('All')}
              className="mt-3 text-[13px] font-medium underline-offset-4 hover:underline"
              style={{ color: 'var(--smvec-blue)' }}
            >
              Show all articles
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>

      <section
        className="overflow-hidden rounded-[14px] px-7 py-10 lg:px-12 lg:py-12"
        style={{ background: 'var(--smvec-blue-tint)' }}
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
              pitch and we will help you shape the article.
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

      {/* Editorial credit footer */}
      <footer
        className="flex flex-col items-center gap-1 border-t pt-6 text-center"
        style={{ borderColor: 'var(--smvec-blue-100)' }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
        >
          The Brand Journal
        </p>
        <p
          className="text-[12px]"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-display)' }}
        >
          Curated &amp; edited by{' '}
          <span style={{ color: 'var(--smvec-ink)', fontWeight: 500 }}>Vinothkumar S</span> ·
          Brand &amp; Communications Cell, SMVEC
        </p>
      </footer>
    </div>
  );
}

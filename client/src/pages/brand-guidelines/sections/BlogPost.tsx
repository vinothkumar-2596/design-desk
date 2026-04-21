import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, ExternalLink, Tag } from 'lucide-react';
import {
  BLOG_POSTS,
  getBlogPost,
  getRelatedPosts,
  type BlogBlock,
} from '../data/blogPosts';
import { BlogCover } from '../components/BlogCover';

function renderBlock(block: BlogBlock, key: number) {
  switch (block.type) {
    case 'p':
      return (
        <p
          key={key}
          className="text-[15.5px] leading-[1.8]"
          style={{ color: 'var(--fg-2)' }}
        >
          {block.text}
        </p>
      );
    case 'h2':
      return (
        <h2
          key={key}
          className="mt-2 text-[24px] leading-tight tracking-[-0.01em]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--smvec-ink)',
          }}
        >
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3
          key={key}
          className="text-[18px] leading-snug"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--smvec-ink)',
          }}
        >
          {block.text}
        </h3>
      );
    case 'list':
      return (
        <ul key={key} className="space-y-2.5 pl-1">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-[14.5px] leading-[1.7]"
              style={{ color: 'var(--fg-2)' }}
            >
              <span
                aria-hidden="true"
                className="mt-2.5 h-1 w-3 shrink-0"
                style={{ background: 'var(--smvec-gold)' }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-2 border-l-[3px] py-1 pl-5"
          style={{ borderColor: 'var(--smvec-gold)' }}
        >
          <p
            className="text-[18px] leading-[1.55] tracking-[-0.005em]"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--smvec-ink)',
              fontStyle: 'italic',
              fontWeight: 400,
            }}
          >
            &ldquo;{block.text}&rdquo;
          </p>
          {block.cite ? (
            <cite
              className="mt-2 block text-[12px] not-italic"
              style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-display)' }}
            >
              — {block.cite}
            </cite>
          ) : null}
        </blockquote>
      );
    case 'callout':
      return (
        <div
          key={key}
          className="rounded-[10px] px-5 py-4"
          style={{ background: 'rgba(54, 66, 155, 0.05)' }}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
          >
            {block.title}
          </p>
          <p className="mt-1.5 text-[14px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
            {block.text}
          </p>
        </div>
      );
    default:
      return null;
  }
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [slug]);

  if (!post) {
    return <Navigate to="/brand-guidelines/blog" replace />;
  }

  const related = getRelatedPosts(post.slug, 3);

  return (
    <article className="space-y-12">
      <Link
        to="/brand-guidelines/blog"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors"
        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-display)' }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to journal
      </Link>

      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
          >
            <Tag className="h-3 w-3" />
            {post.category}
          </span>
          <span style={{ color: 'var(--fg-3)' }}>·</span>
          <span className="text-[12px]" style={{ color: 'var(--fg-3)' }}>
            {post.date}
          </span>
          <span style={{ color: 'var(--fg-3)' }}>·</span>
          <span
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--fg-3)' }}
          >
            <Clock className="h-3 w-3" /> {post.readMinutes} min read
          </span>
        </div>

        <h1
          className="max-w-[40rem] text-[32px] leading-[1.1] tracking-[-0.02em] md:text-[42px]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--smvec-ink)',
          }}
        >
          {post.title}
        </h1>

        <p className="max-w-[42rem] text-[16px] leading-[1.7]" style={{ color: 'var(--fg-2)' }}>
          {post.excerpt}
        </p>

        <div
          className="flex flex-wrap items-center gap-3 border-t pt-5 text-[12.5px]"
          style={{ borderColor: 'var(--smvec-blue-100)' }}
        >
          <span
            className="font-medium"
            style={{ color: 'var(--smvec-ink)', fontFamily: 'var(--font-display)' }}
          >
            {post.author}
          </span>
          <span style={{ color: 'var(--fg-3)' }}>·</span>
          <span style={{ color: 'var(--fg-3)' }}>{post.authorRole}</span>
        </div>
      </header>

      <div
        className="overflow-hidden rounded-[14px]"
        style={{ background: 'rgba(54, 66, 155, 0.05)', aspectRatio: '21 / 9' }}
      >
        <BlogCover category={post.category} slug={post.slug} />
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr,16rem]">
        <div className="max-w-[42rem] space-y-7">
          {post.body.map(renderBlock)}

          <div
            className="mt-6 border-t pt-6"
            style={{ borderColor: 'var(--smvec-blue-100)' }}
          >
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
            >
              References
            </p>
            <ul className="mt-3 space-y-2">
              {post.references.map((ref) => (
                <li
                  key={ref.label}
                  className="flex items-start gap-2 text-[13px] leading-[1.65]"
                  style={{ color: 'var(--fg-2)' }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    style={{ background: 'var(--smvec-gold)' }}
                  />
                  {ref.href ? (
                    <a
                      href={ref.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                      style={{ color: 'var(--smvec-blue)' }}
                    >
                      {ref.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>{ref.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
          <div>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}
            >
              Continue reading
            </p>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--fg-3)' }}>
              {BLOG_POSTS.length} articles · refreshed monthly
            </p>
          </div>
          <ul className="space-y-3">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/brand-guidelines/blog/${item.slug}`}
                  className="group block"
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-display)' }}
                  >
                    {item.category}
                  </p>
                  <p
                    className="mt-1 text-[14px] leading-snug transition-colors group-hover:text-[var(--smvec-blue)]"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      color: 'var(--smvec-ink)',
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--smvec-blue)' }}
                  >
                    Read
                    <ArrowRight className="h-3 w-3" />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </article>
  );
}

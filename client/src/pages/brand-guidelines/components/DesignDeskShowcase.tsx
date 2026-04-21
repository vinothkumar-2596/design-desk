import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { DESIGNDESK_SCREENSHOTS } from '../assets';

const INTERVAL_MS = 5500;

export function DesignDeskShowcase() {
  const slides = DESIGNDESK_SCREENSHOTS;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadedSlides, setLoadedSlides] = useState<Record<number, 'ok' | 'error'>>({});
  const intervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || slides.length <= 1) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced || paused) return;
    intervalRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [paused, slides.length]);

  const goTo = (next: number) => {
    setIndex((next + slides.length) % slides.length);
  };

  if (slides.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ background: 'var(--smvec-blue)' }}
      >
        <p className="text-[12px] text-white/70">No screenshots available.</p>
      </div>
    );
  }

  const active = slides[index];

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--smvec-blue)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Soft radial accents to give the dark stage some life */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 80% 0%, rgba(255,255,255,0.08), transparent 70%), radial-gradient(50% 50% at 0% 100%, rgba(219,163,40,0.08), transparent 70%)',
        }}
      />

      {/* Slide track */}
      <div
        className="relative flex h-full w-full transition-transform duration-[600ms]"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        {slides.map((slide, i) => {
          const status = loadedSlides[i];
          return (
            <div
              key={slide.url + i}
              className="relative flex h-full w-full shrink-0 items-center justify-center px-6 pt-6 pb-20 sm:px-10 sm:pt-8"
            >
              {status !== 'error' ? (
                <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
                  <img
                    src={slide.url}
                    alt={slide.label}
                    className="block h-full w-full object-cover object-top"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    draggable={false}
                    onLoad={() =>
                      setLoadedSlides((prev) => ({ ...prev, [i]: 'ok' }))
                    }
                    onError={() =>
                      setLoadedSlides((prev) => ({ ...prev, [i]: 'error' }))
                    }
                  />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <ImageOff className="h-7 w-7 text-white/55" />
                  <p
                    className="text-[12.5px] text-white/85"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Screenshot pending — {slide.label}
                  </p>
                  <p className="max-w-[28rem] text-[11px] leading-5 text-white/55">
                    Drop the file at{' '}
                    <code className="rounded bg-white/10 px-1.5 py-0.5">
                      public/brand-guidelines/screenshots/{slide.url.split('/').pop()}
                    </code>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom-left caption */}
      <div className="pointer-events-none absolute bottom-12 left-5 right-5 max-w-[80%] sm:bottom-10 sm:max-w-[60%]">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/70"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')} ·{' '}
          {active.label}
        </p>
        <p
          className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug text-white"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {active.caption}
        </p>
      </div>

      {/* Controls cluster — bottom right */}
      {slides.length > 1 ? (
        <>
          <div className="absolute bottom-10 right-5 z-10 flex items-center gap-2 sm:bottom-9">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={(e) => {
                e.preventDefault();
                goTo(index - 1);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white outline-none backdrop-blur-md transition-colors hover:bg-white/22 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={(e) => {
                e.preventDefault();
                goTo(index + 1);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white outline-none backdrop-blur-md transition-colors hover:bg-white/22 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dots */}
          <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.url + i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  goTo(i);
                }}
                aria-label={`Show ${s.label}`}
                className="rounded-full outline-none transition-all focus:outline-none"
                style={{
                  width: i === index ? 20 : 6,
                  height: 6,
                  background:
                    i === index ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-white/10">
            <div
              key={`${index}-${paused ? 'p' : 'r'}`}
              className="h-full"
              style={{
                background: 'var(--smvec-gold)',
                width: '100%',
                transformOrigin: 'left',
                animation: paused
                  ? 'none'
                  : `brand-slider-progress ${INTERVAL_MS}ms linear forwards`,
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

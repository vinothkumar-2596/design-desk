import { ReactNode } from 'react';

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  emphasis?: string;
  description?: ReactNode;
  align?: 'left' | 'center';
};

export function SectionTitle({ eyebrow, title, emphasis, description, align = 'left' }: SectionTitleProps) {
  return (
    <header className={align === 'center' ? 'text-center' : 'text-left'}>
      {eyebrow ? (
        <p
          className="text-[11px] font-medium uppercase tracking-[0.22em]"
          style={{ color: 'var(--smvec-blue)', opacity: 0.85 }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h1
        className="mt-2 text-[32px] font-normal leading-[1.1] tracking-[-0.01em] md:text-[40px]"
        style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}
      >
        {title}
        {emphasis ? (
          <>
            {' '}
            <span className="relative inline-block">
              <span className="relative z-10">{emphasis}</span>
              <span className="absolute inset-x-0 -bottom-1 h-[3px] bg-[#DBA328]" aria-hidden="true" />
            </span>
          </>
        ) : null}
      </h1>
      {description ? (
        <p className="mt-4 max-w-3xl text-[15px] leading-7" style={{ color: 'var(--fg-2)' }}>{description}</p>
      ) : null}
    </header>
  );
}

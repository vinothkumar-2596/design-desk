import { Layout, Palette, Send, CheckCircle2 } from 'lucide-react';

export function DesignDeskShowcase() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: 'var(--smvec-blue)' }}
    >
      {/* Radial accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 80% 0%, rgba(255,255,255,0.08), transparent 70%), radial-gradient(50% 50% at 0% 100%, rgba(219,163,40,0.08), transparent 70%)',
        }}
      />

      {/* Grid pattern overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <img
            src="/smvec-emblem-white.svg"
            alt="SMVEC"
            className="h-10 w-10 object-contain"
          />
          <div>
            <p
              className="text-[18px] font-semibold tracking-tight text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              DesignDesk
            </p>
            <p className="text-[10px] tracking-[0.12em] text-white/50">
              Task Management Portal
            </p>
          </div>
        </div>

        {/* Headline */}
        <h2
          className="max-w-md text-center text-[24px] font-medium leading-[1.2] text-white sm:text-[28px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Design workflows,{' '}
          <span className="text-[#DBA328]">made efficient</span>
        </h2>

        <p className="max-w-sm text-center text-[13px] leading-6 text-white/60">
          A single platform to request, track, and collaborate on every design deliverable.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: Send, label: 'Request' },
            { icon: CheckCircle2, label: 'Track' },
            { icon: Palette, label: 'Collaborate' },
          ].map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-sm"
            >
              <f.icon className="h-3 w-3 text-[#DBA328]" />
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {/* Gold accent line at bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: 'var(--smvec-gold)' }}
      />
    </div>
  );
}

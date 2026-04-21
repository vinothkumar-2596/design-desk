import { useState, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

type Step = { name: string; var: string; light?: boolean };

const BLUE_STEPS: Step[] = [
  { name: '050', var: '--smvec-blue-050', light: true },
  { name: '100', var: '--smvec-blue-100', light: true },
  { name: '300', var: '--smvec-blue-300', light: true },
  { name: '500', var: '--smvec-blue-500' },
  { name: '700 · brand', var: '--smvec-blue-700' },
  { name: '800', var: '--smvec-blue-800' },
  { name: '900', var: '--smvec-blue-900' },
];

const GOLD_STEPS: Step[] = [
  { name: '050', var: '--smvec-gold-050', light: true },
  { name: '100', var: '--smvec-gold-100', light: true },
  { name: '300', var: '--smvec-gold-300', light: true },
  { name: '500 · brand', var: '--smvec-gold-500', light: true },
  { name: '700', var: '--smvec-gold-700' },
  { name: '900', var: '--smvec-gold-900' },
  { name: 'ink', var: '--smvec-ink' },
];

const NEUTRAL_STEPS: Step[] = [
  { name: 'white', var: '--smvec-white', light: true },
  { name: 'bg-soft', var: '--smvec-bg-soft', light: true },
  { name: 'line', var: '--smvec-line', light: true },
  { name: 'ink-4', var: '--smvec-ink-4' },
  { name: 'ink-3', var: '--smvec-ink-3' },
  { name: 'ink', var: '--smvec-ink' },
];

const CORE = [
  { name: 'Royal Blue', hex: '#36429B', var: '--smvec-blue', light: false },
  { name: 'Golden age', hex: '#DBA328', var: '--smvec-gold', light: false },
  { name: 'Black', hex: '#000000', var: '--smvec-black', light: false },
  { name: 'White', hex: '#FFFFFF', var: '--smvec-white', light: true },
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Copied ${label}`, { description: value });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Copy failed');
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${value}`}
      className="group inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 transition-colors hover:bg-[var(--smvec-blue-050)]"
    >
      <code
        className="font-mono text-[12px] transition-colors"
        style={{
          fontFamily: 'var(--font-mono)',
          color: copied ? 'var(--smvec-blue)' : 'var(--fg-1)',
        }}
      >
        {value}
      </code>
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        <Copy
          className="absolute h-3.5 w-3.5 transition-all duration-200"
          style={{
            opacity: copied ? 0 : 0.55,
            transform: copied ? 'scale(0.6)' : 'scale(1)',
            color: 'var(--fg-3)',
          }}
          aria-hidden="true"
        />
        <Check
          className="absolute h-3.5 w-3.5 transition-all duration-200"
          style={{
            opacity: copied ? 1 : 0,
            transform: copied ? 'scale(1)' : 'scale(0.6)',
            color: 'var(--smvec-blue)',
          }}
          aria-hidden="true"
          strokeWidth={3}
        />
      </span>
    </button>
  );
}

function CoreSwatch({
  name,
  hex,
  varName,
  light,
}: {
  name: string;
  hex: string;
  varName: string;
  light: boolean;
}) {
  return (
    <div
      className="group flex min-h-[200px] flex-col overflow-hidden rounded-[10px] border bg-white transition-shadow duration-200 hover:shadow-[var(--shadow-2)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className="flex flex-1 items-end p-4"
        style={{ background: hex, color: light ? 'var(--fg-1)' : '#fff' }}
      >
        <div
          className="text-[17px] font-medium tracking-[-0.01em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {name}
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-2 border-t px-3 py-2.5 text-[12px]"
        style={{ borderColor: 'var(--border)', color: 'var(--fg-3)' }}
      >
        <CopyButton value={hex} label={name} />
        <CopyButton value={varName} label={name} />
      </div>
    </div>
  );
}

function TintStrip({ steps }: { steps: Step[] }) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const handleCopy = async (step: Step) => {
    try {
      await navigator.clipboard.writeText(`var(${step.var})`);
      setCopiedVar(step.var);
      toast.success(`Copied var(${step.var})`);
      setTimeout(() => setCopiedVar((current) => (current === step.var ? null : current)), 1400);
    } catch {
      toast.error('Copy failed');
    }
  };
  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{
        borderColor: 'var(--border)',
        display: 'grid',
        gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
      }}
    >
      {steps.map((step) => {
        const isCopied = copiedVar === step.var;
        return (
          <button
            key={step.var}
            type="button"
            onClick={() => handleCopy(step)}
            aria-label={`Copy ${step.var}`}
            className="group relative flex h-[84px] flex-col justify-end px-3 py-2.5 text-left text-[11px] transition-transform duration-150 hover:scale-[1.02] hover:z-10"
            style={{
              background: `var(${step.var})`,
              color: step.light ? 'var(--fg-1)' : '#fff',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span
              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-[3px] backdrop-blur-sm transition-opacity duration-150"
              style={{
                background: step.light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.18)',
                opacity: isCopied ? 1 : 0,
              }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span
              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-[3px] opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
              style={{
                background: step.light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.18)',
                opacity: isCopied ? 0 : undefined,
              }}
            >
              <Copy className="h-3 w-3" />
            </span>
            {step.name}
          </button>
        );
      })}
    </div>
  );
}

export default function Colors() {
  return (
    <div className="brand-card">
      <header className="brand-card__header">
        <div>
          <div className="brand-card__eyebrow">01 · Foundations</div>
          <h1 className="brand-card__title">
            Color <b>palette</b>
          </h1>
        </div>
        <p className="brand-card__intro">
          A strict four-color brand: Royal Blue, Golden age, black, white. Tints are engineered
          extensions used only for page-background watermarks and soft UI fills — never for running
          text.
        </p>
      </header>

      <section className="mt-2">
        <div className="brand-section-title">Brand core · published in the manual</div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CORE.map((swatch) => (
            <CoreSwatch
              key={swatch.var}
              name={swatch.name}
              hex={swatch.hex}
              varName={swatch.var}
              light={swatch.light}
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="brand-section-title">Blue tints · watermarks &amp; surfaces</div>
        <TintStrip steps={BLUE_STEPS} />
      </section>

      <section className="mt-12">
        <div className="brand-section-title">Gold tints · bars &amp; accent fills</div>
        <TintStrip steps={GOLD_STEPS} />
      </section>

      <section className="mt-12">
        <div className="brand-section-title">Neutrals &amp; lines</div>
        <TintStrip steps={NEUTRAL_STEPS} />
      </section>
    </div>
  );
}

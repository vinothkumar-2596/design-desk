import { ReactNode } from 'react';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

type CalloutProps = {
  variant?: 'info' | 'gold' | 'success' | 'warning';
  title?: string;
  children: ReactNode;
};

const VARIANTS = {
  info: {
    icon: Info,
    borderColor: 'rgba(54, 66, 155, 0.25)',
    bg: 'var(--smvec-blue-050)',
    iconColor: 'var(--smvec-blue)',
  },
  gold: {
    icon: Info,
    borderColor: 'rgba(219, 163, 40, 0.35)',
    bg: 'var(--smvec-gold-050)',
    iconColor: 'var(--smvec-gold)',
  },
  success: {
    icon: CheckCircle2,
    borderColor: 'rgba(54, 66, 155, 0.20)',
    bg: 'var(--bg-1)',
    iconColor: '#1F8B5A',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'var(--callout-warning-bd)',
    bg: 'var(--callout-warning-bg)',
    iconColor: '#C5443A',
  },
} as const;

export function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = VARIANTS[variant];
  const Icon = config.icon;
  return (
    <div
      className="rounded-md border p-4"
      style={{ borderColor: config.borderColor, background: config.bg }}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: config.iconColor }} />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className="text-[13px] font-semibold" style={{ color: 'var(--fg-1)' }}>{title}</p>
          ) : null}
          <div className="text-[13px] leading-6" style={{ color: 'var(--fg-2)' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

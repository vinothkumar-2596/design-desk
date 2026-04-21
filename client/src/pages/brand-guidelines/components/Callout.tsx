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
    border: 'border-[#36429B]/25',
    bg: 'bg-[#F2F4FB]',
    iconColor: 'text-[#36429B]',
    titleColor: 'text-[#0B1024]',
  },
  gold: {
    icon: Info,
    border: 'border-[#DBA328]/35',
    bg: 'bg-[#FBF5E8]',
    iconColor: 'text-[#A47A1B]',
    titleColor: 'text-[#0B1024]',
  },
  success: {
    icon: CheckCircle2,
    border: 'border-[#36429B]/20',
    bg: 'bg-white',
    iconColor: 'text-[#1F8B5A]',
    titleColor: 'text-[#0B1024]',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-[#C5443A]/25',
    bg: 'bg-[#FBF1F0]',
    iconColor: 'text-[#C5443A]',
    titleColor: 'text-[#0B1024]',
  },
} as const;

export function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = VARIANTS[variant];
  const Icon = config.icon;
  return (
    <div className={`rounded-md border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconColor}`} />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className={`text-[13px] font-semibold ${config.titleColor}`}>{title}</p>
          ) : null}
          <div className="text-[13px] leading-6 text-[#48506B]">{children}</div>
        </div>
      </div>
    </div>
  );
}

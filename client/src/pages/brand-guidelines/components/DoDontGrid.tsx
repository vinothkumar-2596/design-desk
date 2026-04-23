import { ReactNode } from 'react';
import { Check, X } from 'lucide-react';

type Item = { label: string; description?: string };

type DoDontGridProps = {
  dos: Item[];
  donts: Item[];
  doMedia?: ReactNode;
  dontMedia?: ReactNode;
};

export function DoDontGrid({ dos, donts, doMedia, dontMedia }: DoDontGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div
        className="rounded-md border"
        style={{ borderColor: 'rgba(54, 66, 155, 0.15)', background: 'var(--bg-1)' }}
      >
        {doMedia ? (
          <div
            className="border-b p-6"
            style={{ borderColor: 'rgba(54, 66, 155, 0.10)', background: 'var(--smvec-blue-050)' }}
          >
            {doMedia}
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F8B5A] text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1F8B5A]">Do</p>
          </div>
          <ul className="mt-3 space-y-2.5">
            {dos.map((item) => (
              <li key={item.label} className="text-[13.5px] leading-6" style={{ color: 'var(--fg-1)' }}>
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="block text-[12.5px] leading-5" style={{ color: 'var(--fg-2)' }}>
                    {item.description}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="rounded-md border"
        style={{ borderColor: 'rgba(197, 68, 58, 0.15)', background: 'var(--bg-1)' }}
      >
        {dontMedia ? (
          <div
            className="border-b p-6"
            style={{ borderColor: 'rgba(197, 68, 58, 0.10)', background: 'var(--status-rejected-bg)' }}
          >
            {dontMedia}
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C5443A] text-white">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C5443A]">Don't</p>
          </div>
          <ul className="mt-3 space-y-2.5">
            {donts.map((item) => (
              <li key={item.label} className="text-[13.5px] leading-6" style={{ color: 'var(--fg-1)' }}>
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="block text-[12.5px] leading-5" style={{ color: 'var(--fg-2)' }}>
                    {item.description}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

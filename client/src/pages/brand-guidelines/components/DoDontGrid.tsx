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
      <div className="rounded-md border border-[#36429B]/15 bg-white">
        {doMedia ? (
          <div className="border-b border-[#36429B]/10 bg-[#F8F9FE] p-6">{doMedia}</div>
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
              <li key={item.label} className="text-[13.5px] leading-6 text-[#0B1024]">
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="block text-[12.5px] leading-5 text-[#48506B]">
                    {item.description}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-md border border-[#C5443A]/15 bg-white">
        {dontMedia ? (
          <div className="border-b border-[#C5443A]/10 bg-[#FBF6F5] p-6">{dontMedia}</div>
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
              <li key={item.label} className="text-[13.5px] leading-6 text-[#0B1024]">
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="block text-[12.5px] leading-5 text-[#48506B]">
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

import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-[#D9E6FF] bg-white/90 px-4 py-3 text-sm text-[#1E2A44] shadow-none transition-colors placeholder:text-[13px] placeholder:font-normal placeholder:text-[#8090B2] focus-visible:border-[#BDD0FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDE8FF] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card/90 dark:text-slate-100 dark:placeholder:text-slate-400",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

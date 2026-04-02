import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-[#D9E6FF] bg-white/90 px-3.5 py-2.5 text-sm font-medium text-[#1E2A44] shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#1E2A44] placeholder:text-[13px] placeholder:font-normal placeholder:text-[#8090B2] focus-visible:border-[#BDD0FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDE8FF] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card/90 dark:text-slate-100 dark:file:text-slate-100 dark:placeholder:text-slate-400",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

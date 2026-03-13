import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold tracking-tight text-[#253977] dark:text-[#C8D7FF]",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 rounded-full border border-[#C7D9FF] bg-white/80 p-0 text-[#3B54A6] shadow-none backdrop-blur-md transition hover:bg-[#EEF4FF] hover:text-[#223467] dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-[#B4C7FF] dark:hover:bg-slate-900/85 dark:hover:text-white",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "w-9 rounded-md text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#5D75B9] dark:text-[#9CB3EE]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-xl border border-transparent bg-white/45 p-0 font-medium text-[#223067] shadow-none backdrop-blur-md transition-all aria-selected:opacity-100 hover:border-[#C9D7FF] hover:bg-[#EEF4FF]/90 hover:text-[#223067] dark:bg-slate-900/40 dark:text-[#D6E2FF] dark:hover:border-slate-600/70 dark:hover:bg-slate-900/85 dark:hover:text-white",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "border-[#C9D7FF] bg-[#EEF4FF]/95 text-[#1E2A5A] shadow-none backdrop-blur-xl hover:border-[#C9D7FF] hover:bg-[#EEF4FF] hover:text-[#1E2A5A] focus:bg-[#EEF4FF] focus:text-[#1E2A5A] dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-white dark:hover:bg-slate-900/90 dark:hover:text-white dark:focus:bg-slate-900/90",
        day_today:
          "border border-[#D7E3FF] bg-white/80 text-[#3550A8] backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-[#D9E4FF]",
        day_outside:
          "day-outside border-transparent bg-transparent text-[#94A3B8] opacity-55 hover:border-transparent hover:bg-transparent hover:text-[#94A3B8] dark:text-slate-500 dark:hover:bg-transparent dark:hover:text-slate-500",
        day_disabled: "text-[#A3B1CF] opacity-45 dark:text-slate-600",
        day_range_middle: "aria-selected:border-[#D7E3FF] aria-selected:bg-white/75 aria-selected:text-[#223067] dark:aria-selected:border-slate-700/60 dark:aria-selected:bg-slate-900/70 dark:aria-selected:text-slate-100",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

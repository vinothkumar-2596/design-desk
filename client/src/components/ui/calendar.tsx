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
      className={cn(
        "rounded-[16px] border border-[#D9E6FF] bg-white/95 p-2 shadow-none dark:border-border dark:bg-card/95 dark:[background-image:none]",
        className
      )}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-4",
        month: "space-y-3",
        caption: "relative flex items-center justify-center px-1 pt-1 pb-2",
        caption_label: "text-sm font-semibold tracking-tight text-[#253977] dark:text-[#C8D7FF]",
        nav: "absolute inset-x-0 top-1 flex items-center justify-between px-1",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 rounded-[10px] border border-[#D7E3FF] bg-[#EEF4FF]/90 p-0 text-[#4863B7] shadow-none transition-all hover:border-[#C7D8FF] hover:bg-[#E4EEFF] hover:text-[#3550A8] dark:border-sidebar-border/70 dark:bg-sidebar-accent/95 dark:text-slate-200 dark:hover:border-sidebar-ring/35 dark:hover:bg-sidebar-accent dark:hover:text-slate-50",
        ),
        nav_button_previous: "static",
        nav_button_next: "static",
        table: "w-full border-collapse",
        head_row: "flex justify-between pb-1",
        head_cell:
          "flex h-9 w-9 items-center justify-center text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#5D75B9] dark:text-[#9CB3EE]",
        row: "mt-1.5 flex w-full justify-between",
        cell: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-full border border-transparent bg-transparent p-0 font-medium text-[#223067] shadow-none transition-colors aria-selected:opacity-100 hover:bg-[#EEF4FF] hover:text-[#223067] dark:text-[#D6E2FF] dark:hover:bg-sidebar-accent dark:hover:text-slate-50",
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-[#3550A8] text-white shadow-none hover:bg-[#2C4391] hover:text-white focus:bg-[#2C4391] focus:text-white dark:bg-primary dark:text-white dark:hover:bg-primary dark:hover:text-white dark:focus:bg-primary",
        day_today:
          "border border-[#9FBCFF]/60 text-[#1E2E66] dark:border-sidebar-ring/40 dark:text-[#D9E4FF]",
        day_outside:
          "day-outside border-transparent bg-transparent text-[#94A3B8] opacity-55 hover:border-transparent hover:bg-transparent hover:text-[#94A3B8] dark:text-slate-500 dark:hover:bg-transparent dark:hover:text-slate-500",
        day_disabled: "text-[#A3B1CF] opacity-45 dark:text-slate-600",
        day_range_middle:
          "aria-selected:bg-[#EAF1FF] aria-selected:text-[#223067] dark:aria-selected:bg-sidebar-accent dark:aria-selected:text-slate-100",
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

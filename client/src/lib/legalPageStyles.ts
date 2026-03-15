export const legalPageStyles = {
  page:
    'relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#E5EEFF] dark:from-[#050B18] dark:via-[#081530] dark:to-[#0B1738]',
  glowPrimary:
    'pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#DCE8FF]/90 blur-3xl dark:bg-[#1A2E5C]/42',
  glowSecondary:
    'pointer-events-none absolute right-0 top-32 h-72 w-72 rounded-full bg-[#EDF4FF]/85 blur-3xl dark:bg-[#243A6A]/26',
  glowTertiary:
    'pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#E3EDFF]/75 blur-3xl dark:bg-[#16305F]/24',
  topButton:
    'h-10 rounded-full border-[#C9D7FF] bg-white/82 px-5 text-[#1E2A5A] shadow-none hover:bg-[#EEF4FF] dark:border-border dark:bg-card/80 dark:text-foreground dark:hover:bg-muted',
  topBadge:
    'rounded-full border border-[#D5E2FB] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4D82] shadow-none dark:border-border dark:bg-card/80 dark:text-muted-foreground',
  shell:
    'mt-6 rounded-[32px] border border-[#D9E6FF] bg-gradient-to-br from-white/90 via-[#F5F8FF]/84 to-[#EAF2FF]/80 p-8 shadow-none supports-[backdrop-filter]:bg-[#F5F8FF]/66 backdrop-blur-2xl dark:border-border dark:bg-card/86 dark:bg-none dark:backdrop-blur-xl sm:p-10',
  eyebrow:
    'text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6B7A99] dark:text-muted-foreground',
  title: 'mt-3 text-4xl font-bold text-[#1E2A5A] dark:text-foreground premium-headline',
  body: 'mt-4 text-sm leading-7 text-[#5B6F93] dark:text-muted-foreground premium-body',
  infoChipPrimary:
    'rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[#35429A] dark:border-border dark:bg-muted/70 dark:text-slate-200',
  infoChipSecondary:
    'rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[#5C6E95] dark:border-border dark:bg-muted/70 dark:text-slate-300',
  section:
    'rounded-[26px] border border-[#D9E6FF] bg-white/78 p-6 supports-[backdrop-filter]:bg-white/62 backdrop-blur-xl dark:border-border dark:bg-background/55 dark:backdrop-blur-xl',
  sectionIcon:
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D7E0F8] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(232,239,255,0.92))] text-[#35429A] dark:border-border dark:bg-muted/80 dark:bg-none dark:text-slate-200',
  sectionTitle: 'text-lg font-semibold text-[#1E2A5A] dark:text-foreground',
  sectionBody: 'mt-2 text-sm leading-6 text-[#5C6E95] dark:text-muted-foreground',
  sectionList: 'mt-5 space-y-3 text-sm leading-6 text-[#40557F] dark:text-slate-300',
  sectionListItem: 'grid grid-cols-[0.55rem_minmax(0,1fr)] items-start gap-3',
  sectionListText: 'min-w-0 leading-6',
  sectionDot: 'mt-[0.6rem] h-2 w-2 rounded-full bg-[#5F7CFF] dark:bg-[#9EB2FF]',
  contactSection:
    'mt-6 rounded-[26px] border border-[#D7E0F8] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,244,255,0.92))] p-6 dark:border-border dark:bg-background/45 dark:bg-none',
  contactCard:
    'rounded-2xl border border-[#D7E0F8] bg-white/85 px-4 py-3 text-sm dark:border-border dark:bg-card/78',
  contactTitle: 'text-lg font-semibold text-[#1E2A5A] dark:text-foreground',
  contactBody: 'mt-2 text-sm leading-6 text-[#5C6E95] dark:text-muted-foreground',
  contactMeta: 'mt-1 text-[#6B7A99] dark:text-muted-foreground',
} as const;

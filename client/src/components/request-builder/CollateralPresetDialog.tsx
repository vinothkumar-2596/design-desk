import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { COLLATERAL_PRESETS, type CollateralPreset } from '@/lib/campaignRequest';
import { useTheme } from 'next-themes';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Image,
  Layers3,
  MessageSquare,
  Printer,
  Search,
} from 'lucide-react';

type CollateralPresetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: CollateralPreset) => void;
  onSelectMany?: (presets: CollateralPreset[]) => void;
  variant?: 'auto' | 'dark' | 'light';
};

const groupMeta: Record<
  CollateralPreset['group'],
  {
    label: string;
    description: string;
    icon: typeof Image;
  }
> = {
  social_media: {
    label: 'Social Media',
    description: 'Instagram, Facebook, YouTube, and feed creatives.',
    icon: Image,
  },
  print: {
    label: 'Print',
    description: 'Flyers, posters, standees, banners, and brochures.',
    icon: Printer,
  },
  event_branding: {
    label: 'Event Branding',
    description: 'LED backdrops, stage graphics, arches, and invites.',
    icon: Layers3,
  },
  identity: {
    label: 'Identity',
    description: 'ID cards, certificates, and branded credentials.',
    icon: BadgeCheck,
  },
  messaging: {
    label: 'Messaging',
    description: 'WhatsApp-first formats for direct distribution.',
    icon: MessageSquare,
  },
};

const orientationLabels: Record<NonNullable<CollateralPreset['orientation']>, string> = {
  portrait: 'Portrait',
  landscape: 'Landscape',
  square: 'Square',
  custom: 'Custom',
};

const getPresetSearchText = (preset: CollateralPreset) =>
  [
    preset.label,
    preset.collateralType,
    preset.platform,
    preset.usageType,
    preset.sizeLabel,
    preset.ratioLabel,
    groupMeta[preset.group].label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getPresetPreviewStyle = (preset: CollateralPreset) => {
  let width = preset.width;
  let height = preset.height;

  if (!width || !height) {
    if (preset.orientation === 'portrait') {
      width = 4;
      height = 5;
    } else if (preset.orientation === 'landscape') {
      width = 16;
      height = 9;
    } else if (preset.orientation === 'square') {
      width = 1;
      height = 1;
    } else {
      width = 5;
      height = 4;
    }
  }

  const maxWidth = 74;
  const maxHeight = 74;
  const scale = Math.min(maxWidth / width, maxHeight / height);

  return {
    width: `${Math.max(14, Math.round(width * scale))}px`,
    height: `${Math.max(14, Math.round(height * scale))}px`,
  };
};

const detectDarkTheme = () => {
  if (typeof document === 'undefined') return false;

  const hasDarkClass = Boolean(document.querySelector('html.dark, body.dark, #root.dark, .dark'));
  if (hasDarkClass) return true;

  const parseRgb = (value: string) => {
    const match = value.match(/\d+(\.\d+)?/g);
    if (!match || match.length < 3) return null;
    return [Number(match[0]), Number(match[1]), Number(match[2])] as const;
  };

  const getLuminance = (rgb: readonly [number, number, number]) =>
    (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;

  const bodyRgb = parseRgb(getComputedStyle(document.body).backgroundColor || '');
  const root = document.getElementById('root');
  const rootRgb = root ? parseRgb(getComputedStyle(root).backgroundColor || '') : null;

  if (bodyRgb && getLuminance(bodyRgb) < 0.35) return true;
  if (rootRgb && getLuminance(rootRgb) < 0.35) return true;

  return false;
};

export function CollateralPresetDialog({
  open,
  onOpenChange,
  onSelect,
  onSelectMany,
  variant = 'auto',
}: CollateralPresetDialogProps) {
  const { resolvedTheme, theme } = useTheme();
  const [activeGroup, setActiveGroup] = useState<CollateralPreset['group']>('social_media');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(() => detectDarkTheme());
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);

  useEffect(() => {
    const syncTheme = () => {
      setIsDark((resolvedTheme || theme) === 'dark' || detectDarkTheme());
    };

    syncTheme();

    if (typeof document === 'undefined') return undefined;

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [open, resolvedTheme, theme]);

  useEffect(() => {
    if (!open) {
      setSelectedPresetIds([]);
    }
  }, [open]);

  const presetCounts = useMemo(() => {
    return COLLATERAL_PRESETS.reduce<Record<CollateralPreset['group'], number>>(
      (counts, preset) => {
        counts[preset.group] += 1;
        return counts;
      },
      {
        social_media: 0,
        print: 0,
        event_branding: 0,
        identity: 0,
        messaging: 0,
      }
    );
  }, []);

  const filteredPresets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return COLLATERAL_PRESETS.filter((preset) => {
      if (preset.group !== activeGroup) return false;
      if (!normalizedQuery) return true;
      return getPresetSearchText(preset).includes(normalizedQuery);
    });
  }, [activeGroup, searchQuery]);

  const currentGroup = groupMeta[activeGroup];
  const useDarkSkin = variant === 'dark' ? true : variant === 'light' ? false : isDark;
  const shellClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar/90 supports-[backdrop-filter]:bg-sidebar/82 backdrop-blur-[28px] shadow-[0_36px_120px_-48px_rgba(2,8,23,0.98)] [&>button]:border-sidebar-border [&>button]:bg-sidebar-accent/80 [&>button]:text-sidebar-foreground [&>button]:backdrop-blur-xl'
    : '[&>button]:border-[#D9E6FF] [&>button]:bg-[#EEF4FF]';
  const glowClass = useDarkSkin
    ? 'bg-[radial-gradient(circle_at_top_left,rgba(126,162,255,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.07),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(59,91,190,0.22),transparent_30%)]'
    : 'hidden';
  const asideClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar/95 supports-[backdrop-filter]:bg-sidebar/86 backdrop-blur-[24px]'
    : '';
  const sectionGlassClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar-accent/70 supports-[backdrop-filter]:bg-sidebar-accent/58 backdrop-blur-[24px]'
    : '';
  const pillGlassClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar-accent/82 text-sidebar-foreground backdrop-blur-xl'
    : '';
  const inputGlassClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar-accent/85 text-sidebar-foreground placeholder:text-slate-400 backdrop-blur-xl'
    : '';
  const presetCardClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar-accent/76 supports-[backdrop-filter]:bg-sidebar-accent/62 backdrop-blur-[26px] hover:border-sidebar-ring/60 hover:bg-sidebar-accent/84'
    : '';
  const previewGlassClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar/72 backdrop-blur-md'
    : '';
  const ctaGlassClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar-primary/25 text-sidebar-foreground backdrop-blur-lg'
    : '';
  const activeSidebarClass = useDarkSkin
    ? 'border-sidebar-ring/40 bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_18px_40px_-28px_rgba(29,78,216,0.42)]'
    : '';
  const idleSidebarClass = useDarkSkin
    ? 'border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:border-sidebar-ring/40 hover:bg-sidebar-accent/86'
    : '';
  const selectedPresets = COLLATERAL_PRESETS.filter((preset) => selectedPresetIds.includes(preset.id));

  const togglePresetSelection = (presetId: string) => {
    setSelectedPresetIds((previous) =>
      previous.includes(presetId)
        ? previous.filter((id) => id !== presetId)
        : [...previous, presetId]
    );
  };

  const handleAddSelected = () => {
    if (!selectedPresets.length) return;
    if (onSelectMany) {
      onSelectMany(selectedPresets);
    } else {
      selectedPresets.forEach((preset) => onSelect(preset));
    }
    setSelectedPresetIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[min(94vw,1120px)] max-w-none overflow-hidden border border-[#D9E6FF] bg-white p-0 shadow-none sm:rounded-[28px] [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:p-1 [&>button]:opacity-100',
          shellClass
        )}
      >
        <div className={cn('pointer-events-none absolute inset-0', glowClass)} />
        <div className="relative z-10 flex h-[min(84dvh,760px)] min-h-0 flex-col xl:grid xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className={cn(
              'flex flex-col border-b border-[#D9E6FF] bg-[#F7FAFF] p-6 xl:border-b-0 xl:border-r',
              asideClass
            )}
          >
            <DialogHeader className="pr-12 text-left">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                Preset Library
              </div>
              <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
                Add Collateral
              </DialogTitle>
              <DialogDescription className="max-w-sm text-sm leading-6 text-muted-foreground">
                Select a production-ready preset, then finish the brief in the campaign builder.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-2">
              {(Object.keys(groupMeta) as Array<CollateralPreset['group']>).map((group) => {
                const item = groupMeta[group];
                const Icon = item.icon;
                const isActive = activeGroup === group;

                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setActiveGroup(group)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left outline-none transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                      useDarkSkin && 'backdrop-blur-xl',
                      isActive
                        ? useDarkSkin
                          ? activeSidebarClass
                          : 'border-[#D7E1FA] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(242,247,255,0.82))] text-foreground shadow-[0_8px_18px_-20px_rgba(49,86,210,0.28)]'
                        : useDarkSkin
                          ? idleSidebarClass
                          : 'border-[#E4EBFA] bg-white/74 text-foreground/90 hover:border-[#D6E0F6] hover:bg-white/92'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          useDarkSkin && 'backdrop-blur-md',
                          isActive
                            ? useDarkSkin
                              ? 'border-[rgba(133,164,255,0.28)] bg-[rgba(104,137,255,0.12)] text-[#A9C1FF]'
                              : 'border-[#C8D7FF] bg-[#F2F6FF] text-primary'
                            : useDarkSkin
                              ? 'border-white/10 bg-white/5 text-slate-400'
                              : 'border-[#E1E8F8] bg-white text-muted-foreground'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px]',
                        isActive
                          ? useDarkSkin
                            ? 'border-[rgba(133,164,255,0.28)] bg-[rgba(104,137,255,0.12)] text-[#A9C1FF]'
                            : 'border-[#C8D7FF] bg-[#F2F6FF] text-primary'
                          : useDarkSkin
                            ? 'border-white/10 bg-white/5 text-slate-300'
                            : 'border-[#E1E8F8] bg-white text-foreground/80'
                      )}
                    >
                      {presetCounts[group]}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                'mt-auto rounded-2xl border border-[#D9E6FF] bg-white/80 p-4',
                sectionGlassClass
              )}
            >
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Why presets
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                This is a request workflow, not an editor. Presets standardize sizing and reduce
                back-and-forth before production starts.
              </p>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div
              className={cn(
                'border-b border-[#D9E6FF] bg-white/90 px-6 py-6',
                sectionGlassClass
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="pr-12">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {currentGroup.label}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-foreground">
                    Choose a preset format
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {currentGroup.description}
                  </p>
                </div>

                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search preset, platform, size, or usage"
                    className={cn(
                      'h-11 rounded-xl border-[#D9E6FF] bg-white pl-9 shadow-none',
                      inputGlassClass
                    )}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    'rounded-full px-3 py-1',
                    pillGlassClass
                  )}
                >
                  {filteredPresets.length} presets
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'rounded-full px-3 py-1',
                    pillGlassClass
                  )}
                >
                  {currentGroup.label}
                </Badge>
                {searchQuery.trim() ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full px-3 py-1',
                      pillGlassClass
                    )}
                  >
                    Search: {searchQuery.trim()}
                  </Badge>
                ) : null}
                {selectedPresetIds.length > 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full px-3 py-1',
                      pillGlassClass
                    )}
                  >
                    {selectedPresetIds.length} selected
                  </Badge>
                ) : null}
              </div>
            </div>

            <ScrollArea
              type="always"
              className="min-h-0 flex-1"
              scrollbarClassName={cn('w-3 p-[2px]', useDarkSkin ? 'bg-white/[0.05]' : 'bg-[#EEF4FF]')}
              thumbClassName={cn(useDarkSkin ? 'bg-[#7EA2FF]/58' : 'bg-primary/40')}
            >
              <div className="p-6 pr-4">
                {filteredPresets.length === 0 ? (
                  <div
                    className={cn(
                      'flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#D9E6FF] bg-white/80 px-6 text-center',
                      sectionGlassClass
                    )}
                  >
                    <Search className="h-10 w-10 text-primary/70" />
                    <h4 className="mt-4 text-lg font-semibold text-foreground">No presets found</h4>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      Try another keyword or switch the preset category from the left panel.
                    </p>
                  </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {filteredPresets.map((preset) => (
                        <div
                          key={preset.id}
                          data-selected={selectedPresetIds.includes(preset.id) ? 'true' : 'false'}
                          className={cn(
                            'group relative flex h-full flex-col rounded-[16px] border border-[#D9E6FF] bg-white p-3 text-left transition-colors hover:border-primary/25',
                            presetCardClass,
                            selectedPresetIds.includes(preset.id) &&
                              (useDarkSkin
                                ? 'border-sidebar-ring/60 bg-sidebar-accent/90 shadow-[0_24px_55px_-36px_rgba(96,124,255,0.55)]'
                                : 'border-primary/35 bg-primary/[0.03]')
                          )}
                        >
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-x-3 top-0 h-px rounded-full opacity-0 transition-opacity',
                              useDarkSkin
                                ? 'bg-[linear-gradient(90deg,transparent,rgba(191,208,255,0.95),transparent)]'
                                : 'bg-[linear-gradient(90deg,transparent,rgba(67,97,204,0.55),transparent)]',
                              (selectedPresetIds.includes(preset.id) || true) && 'group-hover:opacity-100',
                              selectedPresetIds.includes(preset.id) && 'opacity-100'
                            )}
                          />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold leading-5 text-foreground">
                                {preset.label}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'rounded-full bg-[#F2F5FA] px-2 py-0.5 text-[9px] text-foreground',
                                useDarkSkin && 'bg-white/10 text-slate-200 backdrop-blur-lg'
                              )}
                            >
                              {orientationLabels[preset.orientation || 'custom']}
                            </Badge>
                          </div>

                          <div className="mt-2 flex items-center gap-3">
                            <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center">
                              <div
                                className="relative overflow-hidden"
                                style={getPresetPreviewStyle(preset)}
                              >
                                <div
                                  className={cn(
                                    'absolute inset-0 rounded-[6px] border border-[#D7E4FF] bg-white',
                                    previewGlassClass
                                  )}
                                />
                                <div className={cn('absolute left-[22%] right-[22%] top-[18%] h-[9%] rounded-full bg-[#D6E1FF]', useDarkSkin && 'bg-[#7F9EE8]')} />
                                <div className={cn('absolute left-[22%] right-[26%] top-[39%] h-[9%] rounded-full bg-[#D6E1FF]', useDarkSkin && 'bg-[#7F9EE8]')} />
                                <div className={cn('absolute left-[22%] right-[34%] top-[60%] h-[9%] rounded-full bg-[#E5ECFF]', useDarkSkin && 'bg-[#4E669A]')} />
                                <div
                                  className={cn(
                                    'absolute bottom-[14%] right-[14%] h-[24%] w-[24%] rounded-full border border-[#D8E4FF] bg-[#F4F8FF]',
                                    useDarkSkin &&
                                      'border-[rgba(138,168,255,0.28)] bg-[rgba(162,189,255,0.08)]'
                                  )}
                                />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1 space-y-1 text-[11px]">
                              <p className="truncate text-muted-foreground">
                                {preset.platform || preset.collateralType}
                              </p>
                              <p className="truncate font-medium text-foreground">
                                {preset.sizeLabel || 'Custom size'}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {preset.usageType || 'Design asset'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePresetSelection(preset.id)}
                              className={cn(
                                'h-8 rounded-full px-3 text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
                                selectedPresetIds.includes(preset.id) && 'opacity-100',
                                useDarkSkin
                                  ? selectedPresetIds.includes(preset.id)
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
                                    : 'border border-sidebar-border bg-sidebar/70 text-sidebar-foreground hover:bg-sidebar-accent'
                                  : selectedPresetIds.includes(preset.id)
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'border border-border bg-white text-foreground hover:bg-muted'
                              )}
                            >
                              {selectedPresetIds.includes(preset.id) ? (
                                <>
                                  <Check className="mr-1.5 h-3 w-3" />
                                  Selected
                                </>
                              ) : (
                                'Select'
                              )}
                            </Button>

                            <button
                              type="button"
                              onClick={() => onSelect(preset)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border border-primary/15 bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-semibold text-primary',
                                ctaGlassClass
                              )}
                            >
                              Use preset
                              <ArrowUpRight className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            </ScrollArea>

            <div
              className={cn(
                'border-t border-[#D9E6FF] bg-[#FBFDFF] px-6 py-4',
                sectionGlassClass
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Pick the closest preset now. You can still refine the brief, deadlines, and
                  references in the next step.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {selectedPresetIds.length > 0 ? (
                    <Button type="button" onClick={handleAddSelected}>
                      Add selected ({selectedPresetIds.length})
                    </Button>
                  ) : null}

                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

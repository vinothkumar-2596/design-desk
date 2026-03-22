import { useMemo, useState } from 'react';
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
import {
  ArrowUpRight,
  BadgeCheck,
  Image,
  Layers3,
  MessageSquare,
  Printer,
  Search,
  Sparkles,
} from 'lucide-react';

type CollateralPresetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: CollateralPreset) => void;
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

  const maxWidth = 170;
  const maxHeight = 108;
  const scale = Math.min(maxWidth / width, maxHeight / height);

  return {
    width: `${Math.max(66, Math.round(width * scale))}px`,
    height: `${Math.max(54, Math.round(height * scale))}px`,
  };
};

export function CollateralPresetDialog({
  open,
  onOpenChange,
  onSelect,
}: CollateralPresetDialogProps) {
  const [activeGroup, setActiveGroup] = useState<CollateralPreset['group']>('social_media');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1220px)] max-w-none overflow-hidden border border-[#D8E4FF] bg-[#F7FAFF]/98 p-0 shadow-[0_40px_120px_rgba(15,23,42,0.24)] backdrop-blur-xl dark:border-border dark:bg-slate-950/96 [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:border-[#D8E4FF] [&>button]:bg-white/90 [&>button]:p-1 [&>button]:opacity-100 dark:[&>button]:border-border dark:[&>button]:bg-slate-900/90">
        <div className="flex h-[min(88vh,780px)] flex-col xl:grid xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col border-b border-[#E5EDFF] bg-[linear-gradient(180deg,#EFF5FF_0%,#F7FAFF_72%)] p-6 dark:border-border dark:bg-[linear-gradient(180deg,rgba(18,24,39,0.94)_0%,rgba(11,15,28,0.96)_100%)] xl:border-b-0 xl:border-r">
            <DialogHeader className="pr-12 text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Preset Library
              </div>
              <DialogTitle className="pt-4 text-2xl font-semibold text-foreground">
                Add Collateral
              </DialogTitle>
              <DialogDescription className="max-w-sm text-sm leading-6 text-muted-foreground">
                Select a production-ready preset, then finish the brief in the campaign builder.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8 space-y-2">
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
                      'flex w-full items-center justify-between gap-3 rounded-[24px] border px-4 py-3 text-left transition-all',
                      isActive
                        ? 'border-primary/25 bg-white text-foreground shadow-[0_14px_30px_rgba(43,87,255,0.10)] dark:bg-slate-900'
                        : 'border-transparent bg-white/72 hover:border-primary/20 hover:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.06]'
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                          isActive
                            ? 'bg-primary text-white'
                            : 'bg-[#E8F0FF] text-primary dark:bg-slate-800'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1',
                        isActive && 'border-primary/30 bg-primary/10 text-primary'
                      )}
                    >
                      {presetCounts[group]}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-[28px] border border-[#DCE8FF] bg-white/80 p-4 shadow-sm dark:border-border dark:bg-white/[0.04]">
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
            <div className="border-b border-[#E5EDFF] bg-white/80 px-6 py-6 dark:border-border dark:bg-slate-950/55">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="pr-12">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
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
                    className="h-11 rounded-full border-[#D8E4FF] bg-white pl-9 shadow-sm dark:border-border dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {filteredPresets.length} presets
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {currentGroup.label}
                </Badge>
                {searchQuery.trim() ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Search: {searchQuery.trim()}
                  </Badge>
                ) : null}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="p-6">
                {filteredPresets.length === 0 ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[32px] border border-dashed border-[#D7E4FF] bg-white/70 px-6 text-center dark:border-border dark:bg-slate-900/30">
                    <Search className="h-10 w-10 text-primary/70" />
                    <h4 className="mt-4 text-lg font-semibold text-foreground">No presets found</h4>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      Try another keyword or switch the preset category from the left panel.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelect(preset)}
                        className="group flex h-full flex-col rounded-[30px] border border-[#D6E5FF] bg-white p-5 text-left shadow-[0_16px_40px_rgba(21,38,72,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_22px_50px_rgba(43,87,255,0.12)] dark:border-border dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold leading-7 text-foreground">
                              {preset.label}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[preset.collateralType, preset.platform].filter(Boolean).join(' | ') ||
                                'Design preset'}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-[#F2F5FA] px-3 py-1 text-foreground"
                          >
                            {orientationLabels[preset.orientation || 'custom']}
                          </Badge>
                        </div>

                        <div className="mt-5 rounded-[24px] border border-[#E6EEFF] bg-[#F8FBFF] p-4 dark:border-border dark:bg-slate-950/60">
                          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            <span>Canvas</span>
                            <span>{preset.ratioLabel || preset.unit?.toUpperCase() || 'Custom'}</span>
                          </div>

                          <div className="mt-4 flex h-36 items-center justify-center rounded-[22px] border border-dashed border-[#D8E5FF] bg-white dark:border-border dark:bg-slate-900">
                            <div
                              className="relative overflow-hidden rounded-[18px] border border-primary/20 bg-gradient-to-br from-[#E7F0FF] via-white to-[#EEF4FF] shadow-sm"
                              style={getPresetPreviewStyle(preset)}
                            >
                              <div className="absolute inset-x-0 top-0 h-5 bg-white/70" />
                              <div className="absolute left-3 right-3 top-8 h-2 rounded-full bg-primary/15" />
                              <div className="absolute left-3 top-14 h-2 w-[58%] rounded-full bg-slate-300/75" />
                              <div className="absolute left-3 top-20 h-2 w-[42%] rounded-full bg-slate-200" />
                              <div className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-primary/12" />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Size</span>
                              <span className="font-medium text-foreground">
                                {preset.sizeLabel || 'Custom size'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Usage</span>
                              <span className="font-medium text-foreground">
                                {preset.usageType || 'Design asset'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Production Ready
                            </p>
                            <p className="mt-1 text-sm text-foreground">
                              Use this format as the collateral base
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                            Use preset
                            <ArrowUpRight className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-[#E5EDFF] bg-white/82 px-6 py-4 dark:border-border dark:bg-slate-950/45">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Pick the closest preset now. You can still refine the brief, deadlines, and
                  references in the next step.
                </p>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

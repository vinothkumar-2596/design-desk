import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { COLLATERAL_PRESETS, type CollateralPreset } from '@/lib/campaignRequest';
import { useTheme } from 'next-themes';
import { ArrowRight, Check, Clock, Plus, Search, Sparkles } from 'lucide-react';

// Synthetic preset for fully custom collateral — no fixed dimensions
const CUSTOM_PRESET: CollateralPreset = {
  id: 'custom-format',
  label: 'Custom Format',
  collateralType: 'Custom',
  group: 'social_media',
  category: 'campaign_or_others',
  orientation: 'custom',
};

type CollateralPresetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: CollateralPreset) => void;
  onSelectMany?: (presets: CollateralPreset[]) => void;
  existingCollateralTypes?: string[];
  variant?: 'auto' | 'dark' | 'light';
};

type TabId = CollateralPreset['group'] | 'recent' | 'recommended';

const groupMeta: Record<CollateralPreset['group'], { label: string }> = {
  social_media:   { label: 'Social Media' },
  print:          { label: 'Print' },
  event_branding: { label: 'Event Branding' },
  identity:       { label: 'Identity' },
  messaging:      { label: 'Messaging' },
};

const orientationTag: Record<NonNullable<CollateralPreset['orientation']>, string | null> = {
  portrait:  'Portrait',
  landscape: 'Landscape',
  square:    'Square',
  custom:    null,
};

// Stable O(1) preset lookup by id
const PRESET_BY_ID = new Map(COLLATERAL_PRESETS.map((p) => [p.id, p]));

const RECENT_KEY = 'dd_recent_presets';
const MAX_RECENT = 8;

function getRecentIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]; }
  catch { return []; }
}

function pushRecentId(id: string, current: string[]): string[] {
  const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

function getRecommended(existingTypes: string[]): CollateralPreset[] {
  const seen = new Set<string>();
  const picks: CollateralPreset[] = [];
  for (const preset of COLLATERAL_PRESETS) {
    if (seen.has(preset.collateralType)) continue;
    seen.add(preset.collateralType);
    if (!existingTypes.includes(preset.collateralType)) picks.push(preset);
    if (picks.length >= 9) break;
  }
  return picks;
}

const getPresetSearchText = (preset: CollateralPreset) =>
  [preset.label, preset.collateralType, preset.platform, preset.usageType, preset.sizeLabel, groupMeta[preset.group].label]
    .filter(Boolean).join(' ').toLowerCase();

const getPreviewSize = (preset: CollateralPreset) => {
  let w = preset.width, h = preset.height;
  if (!w || !h) {
    if (preset.orientation === 'portrait')       { w = 3; h = 4; }
    else if (preset.orientation === 'landscape') { w = 16; h = 9; }
    else if (preset.orientation === 'square')    { w = 1; h = 1; }
    else                                          { w = 4; h = 3; }
  }
  const maxW = 42, maxH = 54, scale = Math.min(maxW / w, maxH / h);
  return { width: `${Math.max(12, Math.round(w * scale))}px`, height: `${Math.max(12, Math.round(h * scale))}px` };
};

export function CollateralPresetDialog({
  open,
  onOpenChange,
  onSelect,
  onSelectMany,
  existingCollateralTypes = [],
  variant = 'auto',
}: CollateralPresetDialogProps) {
  const { resolvedTheme, theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('social_media');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const recommendedPresets = useMemo(
    () => getRecommended(existingCollateralTypes),
    [existingCollateralTypes]
  );

  // Single effect for open/close — reads localStorage once, avoids duplicate getRecommended call
  useEffect(() => {
    if (open) {
      const ids = getRecentIds();
      setRecentIds(ids);
      if (ids.length > 0) setActiveTab('recent');
      else if (recommendedPresets.length > 0) setActiveTab('recommended');
      else setActiveTab('social_media');
    } else {
      setSelectedIds([]);
      setSearchQuery('');
    }
  }, [open, recommendedPresets]);

  const dark = useMemo(() => {
    const t = resolvedTheme || theme || 'light';
    return variant === 'dark' ? true : variant === 'light' ? false : t === 'dark';
  }, [resolvedTheme, theme, variant]);

  const recentPresets = useMemo(
    () => recentIds.map((id) => PRESET_BY_ID.get(id)).filter(Boolean) as CollateralPreset[],
    [recentIds]
  );

  const selectedPresets = useMemo(
    () => selectedIds.map((id) => PRESET_BY_ID.get(id)).filter(Boolean) as CollateralPreset[],
    [selectedIds]
  );

  const groupPresets = useMemo(() => {
    if (activeTab === 'recent' || activeTab === 'recommended') return [];
    const q = searchQuery.trim().toLowerCase();
    return COLLATERAL_PRESETS.filter((p) => {
      if (p.group !== activeTab) return false;
      return !q || getPresetSearchText(p).includes(q);
    });
  }, [activeTab, searchQuery]);

  const visiblePresets =
    activeTab === 'recent'      ? recentPresets :
    activeTab === 'recommended' ? recommendedPresets :
    groupPresets;

  const selectedCountByGroup = useMemo(() => {
    const map: Partial<Record<TabId, number>> = {};
    for (const p of selectedPresets) {
      map[p.group] = (map[p.group] ?? 0) + 1;
    }
    return map;
  }, [selectedPresets]);

  const tabs = useMemo<Array<{ id: TabId; label: string; icon?: typeof Clock }>>(() => [
    ...(recentPresets.length > 0      ? [{ id: 'recent'      as TabId, label: 'Recent',  icon: Clock }]     : []),
    ...(recommendedPresets.length > 0  ? [{ id: 'recommended' as TabId, label: 'For You', icon: Sparkles }] : []),
    ...Object.keys(groupMeta).map((g) => ({ id: g as TabId, label: groupMeta[g as CollateralPreset['group']].label })),
  ], [recentPresets.length, recommendedPresets.length]);

  const handleCardClick = (preset: CollateralPreset) => {
    const next = pushRecentId(preset.id, recentIds);
    setRecentIds(next);
    if (onSelectMany) {
      setSelectedIds((prev) =>
        prev.includes(preset.id) ? prev.filter((id) => id !== preset.id) : [...prev, preset.id]
      );
    } else {
      onSelect(preset);
      onOpenChange(false);
    }
  };

  const handleAddSelected = () => {
    if (!selectedPresets.length) return;
    if (onSelectMany) onSelectMany(selectedPresets);
    else selectedPresets.forEach((p) => onSelect(p));
    setSelectedIds([]);
    onOpenChange(false);
  };

  // Theme tokens
  const shell = dark
    ? 'border-sidebar-border bg-sidebar/90 supports-[backdrop-filter]:bg-sidebar/82 backdrop-blur-[28px] shadow-[0_36px_120px_-48px_rgba(2,8,23,0.98)] [&>button]:border-sidebar-border [&>button]:bg-sidebar-accent/80 [&>button]:text-sidebar-foreground'
    : '[&>button]:border-[#D9E6FF] [&>button]:bg-[#EEF4FF]';
  const headerBg   = dark ? 'border-sidebar-border bg-sidebar-accent/60 backdrop-blur-[24px]'                  : 'border-[#E8EFF8] bg-white/95';
  const inputCls   = dark ? 'border-sidebar-border bg-sidebar-accent/85 text-sidebar-foreground placeholder:text-slate-400' : 'border-[#D9E6FF] bg-white';
  const tabActive  = dark ? 'text-sidebar-foreground font-semibold border-sidebar-foreground'                  : 'text-foreground font-semibold border-foreground';
  const tabIdle    = dark ? 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80 border-transparent font-medium' : 'text-muted-foreground hover:text-foreground/70 border-transparent font-medium';
  const cardBase   = dark ? 'border-sidebar-border bg-sidebar-accent/65 backdrop-blur-[20px] hover:border-sidebar-ring/50 hover:bg-sidebar-accent/88' : 'border-[#E6EEF8] bg-white hover:border-primary/30 hover:bg-[#F7FAFE]';
  const cardSel    = dark ? 'border-sidebar-ring/70 bg-sidebar-primary/18 shadow-[0_12px_32px_-20px_rgba(96,130,255,0.5)]' : 'border-primary/45 bg-[#F3F7FF] shadow-[0_6px_18px_-10px_rgba(67,97,204,0.16)]';
  const checkBg    = dark ? 'bg-sidebar-primary text-sidebar-primary-foreground'                               : 'bg-primary text-primary-foreground';
  const previewBg  = dark ? 'border-sidebar-border bg-sidebar/70'                                             : 'border-[#D7E4FF] bg-white';
  const previewL1  = dark ? 'bg-[#7F9EE8]'                                                                    : 'bg-[#D6E1FF]';
  const previewL2  = dark ? 'bg-[#4E669A]'                                                                    : 'bg-[#E5ECFF]';
  const tagCls     = dark ? 'bg-white/8 text-sidebar-foreground/55'                                           : 'bg-[#F0F4FB] text-muted-foreground';
  const footerBg   = dark ? 'border-sidebar-border bg-sidebar/60 backdrop-blur-[20px]'                        : 'border-[#DDE6F5] bg-[#F5F8FF]';
  const hintText   = dark ? 'text-sidebar-foreground/45'                                                      : 'text-muted-foreground/80';

  const showSearch = activeTab !== 'recent' && activeTab !== 'recommended';
  const count = selectedIds.length;

  const emptyMessage =
    activeTab === 'recent'      ? 'No recently used presets yet.' :
    activeTab === 'recommended' ? 'No recommendations available.' :
    'No presets found. Try a different keyword.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[min(94vw,960px)] max-w-none overflow-hidden border border-[#D9E6FF] bg-white p-0 shadow-none sm:rounded-[28px]',
          '[&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:p-1 [&>button]:opacity-100',
          shell
        )}
      >
        <DialogTitle className="sr-only">Add Deliverable</DialogTitle>

        <div className="relative z-10 flex h-[84vh] max-h-[720px] min-h-0 flex-col">

          {/* Header */}
          <div className={cn('border-b px-6 pt-5 pb-0', headerBg)}>
            <div className="flex items-start justify-between gap-4 pr-10">
              <div>
                <h2 className="text-[18px] font-semibold leading-6 text-foreground">Add Deliverable</h2>
                <p className={cn('mt-0.5 text-sm', hintText)}>Select a format to continue</p>
              </div>

              {showSearch && (
                <div className="relative mt-0.5 w-full max-w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search presets…"
                    className={cn('h-9 rounded-xl pl-9 text-sm shadow-none', inputCls)}
                  />
                </div>
              )}
            </div>

            {/* Underline tabs */}
            <div className="mt-4 flex gap-0 overflow-x-auto">
              {tabs.map(({ id, label, icon: Icon }) => {
                const groupCount = selectedCountByGroup[id] ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 border-b-2 px-4 pb-3 text-[13px] outline-none transition-colors focus:outline-none',
                      activeTab === id ? tabActive : tabIdle
                    )}
                  >
                    {Icon && <Icon className="h-3 w-3" />}
                    {label}
                    {groupCount > 0 && (
                      <span className={cn(
                        'text-[12px] font-semibold',
                        dark ? 'text-sidebar-primary' : 'text-primary'
                      )}>
                        ({groupCount})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          <ScrollArea
            type="always"
            className="min-h-0 flex-1"
            scrollbarClassName={cn('w-3 p-[2px]', dark ? 'bg-white/[0.05]' : 'bg-[#EEF4FF]')}
            thumbClassName={dark ? 'bg-[#7EA2FF]/58' : 'bg-primary/40'}
          >
            <div className="p-5 pr-3">
              {visiblePresets.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                  <Search className="h-7 w-7 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[...visiblePresets, CUSTOM_PRESET].map((preset) => {
                    const isSelected = selectedIds.includes(preset.id);
                    const preview = getPreviewSize(preset);
                    const tag = preset.orientation ? orientationTag[preset.orientation] : null;

                    const isCustom = preset.id === 'custom-format';

                    if (isCustom) return (
                      <button
                        key="custom-format"
                        type="button"
                        onClick={() => {
                          if (onSelectMany && selectedPresets.length > 0) {
                            onSelectMany([...selectedPresets, CUSTOM_PRESET]);
                          } else {
                            onSelect(CUSTOM_PRESET);
                          }
                          onOpenChange(false);
                        }}
                        className={cn(
                          'group flex items-center gap-4 rounded-xl border border-dashed p-4 text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          dark
                            ? 'border-sidebar-border/60 bg-transparent hover:border-sidebar-ring/50 hover:bg-sidebar-accent/40'
                            : 'border-[#C8D8F0] bg-transparent hover:border-primary/30 hover:bg-[#F7FAFE]'
                        )}
                      >
                        <div className={cn(
                          'flex h-[60px] w-[48px] shrink-0 items-center justify-center rounded-xl',
                          dark ? 'bg-sidebar-accent/50' : 'bg-[#F0F5FF]'
                        )}>
                          <Plus className={cn('h-5 w-5', dark ? 'text-sidebar-foreground/50' : 'text-primary/50')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-[13px] font-semibold leading-[1.35]', dark ? 'text-sidebar-foreground/70' : 'text-foreground/70')}>
                            Custom Format
                          </p>
                          <p className={cn('mt-1 text-[11px] leading-4', dark ? 'text-sidebar-foreground/40' : 'text-muted-foreground/70')}>
                            Enter your own dimensions
                          </p>
                        </div>
                      </button>
                    );

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleCardClick(preset)}
                        className={cn(
                          'group relative flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          cardBase,
                          isSelected && cardSel
                        )}
                      >
                        {isSelected && (
                          <div className={cn('absolute right-3 top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full', checkBg)}>
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </div>
                        )}

                        <div className="flex h-[60px] w-[48px] shrink-0 items-center justify-center">
                          <div className="relative overflow-hidden rounded-[3px]" style={preview}>
                            <div className={cn('absolute inset-0 rounded-[3px] border', previewBg)} />
                            <div className={cn('absolute left-[16%] right-[16%] top-[14%] h-[12%] rounded-sm', previewL1)} />
                            <div className={cn('absolute left-[16%] right-[26%] top-[38%] h-[10%] rounded-sm', previewL1)} />
                            <div className={cn('absolute left-[16%] right-[40%] top-[56%] h-[10%] rounded-sm', previewL2)} />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 pr-4">
                          <p className="truncate text-[13px] font-semibold leading-[1.35] text-foreground">
                            {preset.label}
                          </p>
                          <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
                            {preset.sizeLabel || 'Custom size'}
                          </p>
                          {tag && (
                            <span className={cn('mt-1.5 inline-block rounded-full px-2 py-[2px] text-[10px] font-medium leading-none', tagCls)}>
                              {tag}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className={cn('border-t px-6 py-4', footerBg)}>
            <div className="flex items-center justify-between gap-4">
              <p className={cn('text-[13px]', hintText)}>
                {count > 0
                  ? `${count} ${count === 1 ? 'format' : 'formats'} selected`
                  : 'You can edit details in the next step.'}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('text-[13px]', dark ? 'text-sidebar-foreground/60 hover:text-sidebar-foreground' : '')}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>

                {onSelectMany && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={count === 0}
                    className="gap-1.5 text-[13px]"
                    onClick={handleAddSelected}
                  >
                    Add Selected {count > 0 && `(${count})`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

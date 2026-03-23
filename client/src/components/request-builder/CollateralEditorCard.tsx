import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AttachmentUploadField } from '@/components/request-builder/AttachmentUploadField';
import type { CollateralDraft } from '@/components/request-builder/types';
import {
  COLLATERAL_PRIORITY_OPTIONS,
  COLLATERAL_STATUS_OPTIONS,
  formatCollateralStatusLabel,
  getCollateralDisplayName,
  getCollateralSizeSummary,
} from '@/lib/campaignRequest';
import { Trash2, CalendarDays, ChevronDown } from 'lucide-react';

type CollateralEditorCardProps = {
  collateral: CollateralDraft;
  useCommonDeadline: boolean;
  commonDeadline?: Date;
  minDeadline?: string;
  onChange: (next: CollateralDraft) => void;
  onRemove: () => void;
  statusEditable?: boolean;
};

const dateInputValue = (value?: Date) => (value ? format(value, 'yyyy-MM-dd') : '');

export function CollateralEditorCard({
  collateral,
  useCommonDeadline,
  commonDeadline,
  minDeadline,
  onChange,
  onRemove,
  statusEditable = false,
}: CollateralEditorCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const lbl = 'text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-sidebar-foreground/55';
  const fld =
    'h-8 rounded-xl border border-white/12 bg-white/55 px-3 text-sm shadow-none transition-colors focus-visible:ring-0 focus-visible:border-white/20 focus-visible:bg-white/68 dark:!border-sidebar-border dark:!bg-sidebar dark:!text-sidebar-foreground dark:placeholder:!text-sidebar-foreground/45 dark:focus-visible:!border-sidebar-ring/40 dark:focus-visible:!bg-sidebar-accent';
  const dimensionField =
    'h-8 appearance-none rounded-full border border-white/16 bg-white/72 px-4 text-sm text-foreground shadow-none transition-colors focus-visible:ring-0 focus-visible:border-white/24 disabled:bg-white/72 disabled:text-foreground/80 disabled:opacity-100 dark:!border-sidebar-border dark:!bg-sidebar dark:!text-sidebar-foreground dark:disabled:!bg-sidebar dark:disabled:!text-sidebar-foreground/85 dark:focus-visible:!border-sidebar-ring/40 dark:focus-visible:!bg-sidebar-accent';
  const shellClass =
    'overflow-hidden rounded-[22px] border border-[#D7E3FF]/55 bg-white/38 text-foreground dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground';
  const sectionSurface =
    'border-white/10 bg-white/28 supports-[backdrop-filter]:bg-white/20 backdrop-blur-xl dark:!border-sidebar-border dark:!bg-sidebar-accent';

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between gap-3 border-b border-transparent px-4 py-3 dark:border-sidebar-border dark:bg-sidebar/96">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {getCollateralDisplayName(collateral as never)}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground/70">
            {getCollateralSizeSummary(collateral as never)}
          </span>
          <Badge
            variant="secondary"
            className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium dark:border-transparent dark:bg-sidebar-primary dark:text-sidebar-primary-foreground"
          >
            {formatCollateralStatusLabel(collateral.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground/55 dark:text-sidebar-foreground/55 dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand collateral details' : 'Collapse collateral details'}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
            />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground/50 hover:text-destructive dark:text-sidebar-foreground/50 dark:hover:bg-sidebar-accent"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className={`space-y-2.5 border-t px-4 py-3 ${sectionSurface}`}>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className={lbl}>Name</Label>
                <Input
                  value={collateral.title || ''}
                  onChange={(e) => onChange({ ...collateral, title: e.target.value })}
                  placeholder="Launch Day Instagram"
                  className={fld}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={lbl}>Platform</Label>
                <Input
                  value={collateral.platform || ''}
                  onChange={(e) => onChange({ ...collateral, platform: e.target.value })}
                  placeholder="Instagram"
                  className={fld}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={lbl}>Usage Type</Label>
                <Input
                  value={collateral.usageType || ''}
                  onChange={(e) => onChange({ ...collateral, usageType: e.target.value })}
                  placeholder="Feed Post"
                  className={fld}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={lbl}>Priority</Label>
                <Select
                  value={collateral.priority}
                  onValueChange={(v) =>
                    onChange({ ...collateral, priority: v as CollateralDraft['priority'] })
                  }
                >
                  <SelectTrigger className={fld}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLATERAL_PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className={lbl}>Dimensions</Label>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <Input
                  type="text"
                  inputMode="numeric"
              value={collateral.width ?? ''}
                  onChange={(e) =>
                    onChange({ ...collateral, width: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="1080"
              disabled={collateral.sizeMode !== 'custom'}
                  className={`${dimensionField} w-[150px] min-w-[150px] shrink-0 text-center font-medium`}
                />

                <div className="flex h-8 w-4 shrink-0 items-center justify-center text-xs text-muted-foreground/45">
                  x
                </div>

                <Input
                  type="text"
                  inputMode="numeric"
                  value={collateral.height ?? ''}
                  onChange={(e) =>
                    onChange({ ...collateral, height: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="1350"
                  disabled={collateral.sizeMode !== 'custom'}
                  className={`${dimensionField} w-[150px] min-w-[150px] shrink-0 text-center font-medium`}
                />

                <Select
                  value={collateral.unit || 'px'}
                  onValueChange={(v) => onChange({ ...collateral, unit: v as CollateralDraft['unit'] })}
                >
                  <SelectTrigger
                    className={`${dimensionField} h-8 w-[74px] min-w-[74px] shrink-0 justify-between px-3 text-left font-medium`}
                  >
                    <SelectValue placeholder="px" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="px">px</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="ft">ft</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={collateral.customSizeLabel || ''}
                  onChange={(e) => onChange({ ...collateral, customSizeLabel: e.target.value })}
                  placeholder="e.g. 12"
                  className={`${dimensionField} w-[128px] min-w-[128px] shrink-0 px-4 text-left font-normal text-muted-foreground dark:!text-sidebar-foreground/55`}
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_188px]">
              <div className="space-y-1">
                <Label className={lbl}>Content Brief</Label>
                <Textarea
                  value={collateral.brief}
                  onChange={(e) => onChange({ ...collateral, brief: e.target.value })}
                  placeholder="Headline, CTA, event date, language, logos, sponsor mentions, and production notes."
                  className="min-h-[68px] resize-none rounded-xl border border-white/16 bg-white/72 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-none transition-colors focus-visible:ring-0 focus-visible:border-white/24 dark:!border-sidebar-border dark:!bg-sidebar dark:!text-sidebar-foreground dark:placeholder:!text-sidebar-foreground/45 dark:focus-visible:!border-sidebar-ring/40 dark:focus-visible:!bg-sidebar-accent"
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
                    <Label className={lbl}>Delivery</Label>
                  </div>
                  {useCommonDeadline ? (
                    <div className="rounded-xl border border-white/10 bg-white/28 px-3 py-2 supports-[backdrop-filter]:bg-white/18 dark:!border-sidebar-border dark:!bg-sidebar-primary/28">
                      <p className="text-xs font-medium text-foreground">Common deadline</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {commonDeadline
                          ? format(commonDeadline, 'EEE, dd MMM yyyy')
                          : 'Set a common deadline above.'}
                      </p>
                    </div>
                  ) : (
                    <Input
                      type="date"
                      min={minDeadline}
                      value={dateInputValue(collateral.deadline)}
                      onChange={(e) =>
                        onChange({
                          ...collateral,
                          deadline: e.target.value ? new Date(`${e.target.value}T00:00:00`) : undefined,
                        })
                      }
                      className={fld}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className={lbl}>Status</Label>
                  <Select
                    value={collateral.status}
                    onValueChange={(v) =>
                      onChange({ ...collateral, status: v as CollateralDraft['status'] })
                    }
                    disabled={!statusEditable}
                  >
                    <SelectTrigger className={fld}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLLATERAL_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className={`border-t px-4 py-3 ${sectionSurface}`}>
            <AttachmentUploadField
              label="Reference Files"
              description="Copy decks, reference samples, or previous versions."
              attachments={collateral.referenceFiles}
              onChange={(referenceFiles) =>
                onChange({
                  ...collateral,
                  referenceFiles:
                    typeof referenceFiles === 'function'
                      ? referenceFiles(collateral.referenceFiles)
                      : referenceFiles,
                })
              }
              taskTitle={collateral.title || collateral.presetLabel || collateral.collateralType}
              taskSection={`Collateral-${collateral.collateralType}`}
              emptyLabel="Separate references from the master campaign files."
            />
          </div>
        </>
      )}
    </div>
  );
}

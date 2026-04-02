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
  formatCollateralStatusLabel,
  getCollateralDisplayName,
  getCollateralSizeSummary,
} from '@/lib/campaignRequest';
import { Trash2, CalendarDays, ChevronDown } from 'lucide-react';

type CollateralEditorCardProps = {
  collateral: CollateralDraft;
  expanded: boolean;
  onToggle: () => void;
  useCommonDeadline: boolean;
  commonDeadline?: Date;
  minDeadline?: string;
  onChange: (next: CollateralDraft) => void;
  onRemove: () => void;
};

const dateInputValue = (value?: Date) => (value ? format(value, 'yyyy-MM-dd') : '');

export function CollateralEditorCard({
  collateral,
  expanded,
  onToggle,
  useCommonDeadline,
  commonDeadline,
  minDeadline,
  onChange,
  onRemove,
}: CollateralEditorCardProps) {
  const lbl =
    'text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground dark:text-sidebar-foreground/80';
  const fld = 'h-10 px-3 shadow-none';
  const dimensionField =
    'h-10 appearance-none px-3.5 shadow-none disabled:opacity-100 disabled:text-[#1E2A44]/80 dark:disabled:text-slate-100/85';
  const shellClass =
    'overflow-hidden rounded-[11px] border border-[#D7E3FF]/65 bg-gradient-to-br from-white/90 via-[#F5F9FF]/80 to-[#EAF2FF]/74 supports-[backdrop-filter]:from-white/74 supports-[backdrop-filter]:via-[#F5F9FF]/64 supports-[backdrop-filter]:to-[#EAF2FF]/56 backdrop-blur-xl shadow-[0_2px_20px_-6px_rgba(99,131,210,0.10)] text-foreground dark:bg-sidebar-accent dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent dark:border-sidebar-border dark:backdrop-blur-xl dark:text-sidebar-foreground';
  const sectionSurface =
    'border-white/10 bg-white/18 supports-[backdrop-filter]:bg-white/12 backdrop-blur-xl dark:!border-sidebar-border dark:!bg-sidebar-accent';

  const deliveryText = useCommonDeadline
    ? commonDeadline
      ? format(commonDeadline, 'EEE, dd MMM yyyy')
      : 'Set a common deadline above.'
    : collateral.deadline
      ? format(collateral.deadline, 'EEE, dd MMM yyyy')
      : null;

  return (
    <div className={shellClass}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 border-b border-transparent px-3.5 py-2.5 dark:border-sidebar-border dark:bg-sidebar/96">
        <div className="flex min-w-0 items-center gap-2">
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

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground/55 dark:text-sidebar-foreground/55 dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse collateral details' : 'Expand collateral details'}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
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

      {expanded && (
        <>
          <div className={`space-y-3 border-t px-4 py-3 ${sectionSurface}`}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
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

            <div className="space-y-1.5">
              <Label className={lbl}>Size</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={collateral.width ?? ''}
                  onChange={(e) =>
                    onChange({ ...collateral, width: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="1080"
                  disabled={collateral.sizeMode !== 'custom'}
                  className={`${dimensionField} w-24 text-center font-medium`}
                />
                <span className="text-[11px] text-muted-foreground/45">×</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={collateral.height ?? ''}
                  onChange={(e) =>
                    onChange({ ...collateral, height: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="1350"
                  disabled={collateral.sizeMode !== 'custom'}
                  className={`${dimensionField} w-24 text-center font-medium`}
                />
                <Select
                  value={collateral.unit || 'px'}
                  onValueChange={(v) => onChange({ ...collateral, unit: v as CollateralDraft['unit'] })}
                >
                  <SelectTrigger className={`${dimensionField} w-20 justify-between px-3 font-medium`}>
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
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={lbl}>Content Brief</Label>
              <Textarea
                value={collateral.brief}
                onChange={(e) => onChange({ ...collateral, brief: e.target.value })}
                placeholder="Headline, CTA, event date, language, logos, sponsor mentions, and production notes."
                className="min-h-[92px] resize-none shadow-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className={lbl}>Delivery</span>
              {useCommonDeadline ? (
                <span className="ml-1 text-[12px] font-medium text-foreground">
                  {deliveryText}
                </span>
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
                  className="ml-1 h-8 w-40 px-2 text-[12px] shadow-none"
                />
              )}
            </div>
          </div>

          <div className={`border-t px-4 py-3 ${sectionSurface}`}>
            <AttachmentUploadField
              label="Attachments"
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
              uploadTitle="Drag & drop or upload files"
              uploadDescription="Files will be linked to this request."
              emptyLabel=""
              buttonLabel="Upload"
            />
          </div>
        </>
      )}
    </div>
  );
}

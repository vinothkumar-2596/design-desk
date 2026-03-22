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
import { Trash2, CalendarDays } from 'lucide-react';

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
  return (
    <div className="rounded-[28px] border border-[#D7E4FF] bg-white/90 p-5 shadow-sm dark:border-border dark:bg-card/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {getCollateralDisplayName(collateral)}
            </h3>
            <Badge variant="secondary">{formatCollateralStatusLabel(collateral.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {collateral.presetLabel || collateral.collateralType} • {getCollateralSizeSummary(collateral)}
          </p>
        </div>

        <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label>Collateral Name</Label>
          <Input
            value={collateral.title || ''}
            onChange={(event) => onChange({ ...collateral, title: event.target.value })}
            placeholder="Launch Day Instagram Post"
          />
        </div>

        <div className="space-y-2">
          <Label>Platform</Label>
          <Input
            value={collateral.platform || ''}
            onChange={(event) => onChange({ ...collateral, platform: event.target.value })}
            placeholder="Instagram"
          />
        </div>

        <div className="space-y-2">
          <Label>Usage Type</Label>
          <Input
            value={collateral.usageType || ''}
            onChange={(event) => onChange({ ...collateral, usageType: event.target.value })}
            placeholder="Feed Post / Print / LED"
          />
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={collateral.priority}
            onValueChange={(value) =>
              onChange({ ...collateral, priority: value as CollateralDraft['priority'] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {COLLATERAL_PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <Label>Size Mode</Label>
          <Select
            value={collateral.sizeMode}
            onValueChange={(value) =>
              onChange({ ...collateral, sizeMode: value as CollateralDraft['sizeMode'] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Preset or custom" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="preset">Preset</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Orientation</Label>
          <Select
            value={collateral.orientation}
            onValueChange={(value) =>
              onChange({ ...collateral, orientation: value as CollateralDraft['orientation'] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Orientation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Width</Label>
          <Input
            type="number"
            value={collateral.width ?? ''}
            onChange={(event) =>
              onChange({
                ...collateral,
                width: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            placeholder="1080"
            disabled={collateral.sizeMode !== 'custom'}
          />
        </div>

        <div className="space-y-2">
          <Label>Height</Label>
          <Input
            type="number"
            value={collateral.height ?? ''}
            onChange={(event) =>
              onChange({
                ...collateral,
                height: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            placeholder="1350"
            disabled={collateral.sizeMode !== 'custom'}
          />
        </div>

        <div className="space-y-2">
          <Label>Unit</Label>
          <Select
            value={collateral.unit || 'px'}
            onValueChange={(value) =>
              onChange({ ...collateral, unit: value as CollateralDraft['unit'] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Unit" />
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

      {collateral.sizeMode === 'custom' ? (
        <div className="mt-4 space-y-2">
          <Label>Custom Size Label</Label>
          <Input
            value={collateral.customSizeLabel || ''}
            onChange={(event) => onChange({ ...collateral, customSizeLabel: event.target.value })}
            placeholder="12 x 8 ft / 3000 x 2000 px"
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-2">
          <Label>Content Brief / Text Instructions</Label>
          <Textarea
            value={collateral.brief}
            onChange={(event) => onChange({ ...collateral, brief: event.target.value })}
            placeholder="Headline, CTA, event date, language, logos, sponsor mentions, and production notes."
            className="min-h-[120px]"
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#D7E4FF] bg-[#F8FBFF] p-4 dark:border-border dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Delivery</p>
            </div>
            {useCommonDeadline ? (
              <div className="mt-3 rounded-xl border border-white/80 bg-white px-3 py-3 text-sm dark:border-border dark:bg-card">
                <p className="font-medium text-foreground">Uses common deadline</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {commonDeadline ? format(commonDeadline, 'EEE, dd MMM yyyy') : 'Set a common deadline above.'}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <Label>Individual Deadline</Label>
                <Input
                  type="date"
                  min={minDeadline}
                  value={dateInputValue(collateral.deadline)}
                  onChange={(event) =>
                    onChange({
                      ...collateral,
                      deadline: event.target.value ? new Date(`${event.target.value}T00:00:00`) : undefined,
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={collateral.status}
              onValueChange={(value) =>
                onChange({ ...collateral, status: value as CollateralDraft['status'] })
              }
              disabled={!statusEditable}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {COLLATERAL_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <AttachmentUploadField
          label="Reference Attachment"
          description="Upload collateral-specific copy decks, reference samples, or previous versions."
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
          emptyLabel="This collateral can keep its own references separate from the master campaign files."
        />
      </div>
    </div>
  );
}

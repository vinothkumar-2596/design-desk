import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Palette,
  Sparkles,
  Upload,
} from 'lucide-react';
import { GridSmallBackground } from '@/components/ui/background';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import type { Task } from '@/types';

const foundationTokens = [
  { name: 'Primary', token: '--primary', swatchClass: 'bg-primary', note: 'Primary actions and links' },
  { name: 'Accent', token: '--accent', swatchClass: 'bg-accent', note: 'Highlights and emphasis' },
  { name: 'Secondary', token: '--secondary', swatchClass: 'bg-secondary', note: 'Subtle surfaces' },
  { name: 'Surface', token: '--card', swatchClass: 'bg-card', note: 'Cards and content wells' },
  { name: 'Border', token: '--border', swatchClass: 'bg-border', note: 'Separators and outlines' },
  { name: 'Destructive', token: '--destructive', swatchClass: 'bg-destructive', note: 'Errors and delete actions' },
];

const statusTokens = [
  { name: 'Pending', className: 'bg-status-pending' },
  { name: 'In Progress', className: 'bg-status-progress' },
  { name: 'Review', className: 'bg-status-review' },
  { name: 'Completed', className: 'bg-status-completed' },
  { name: 'Urgent', className: 'bg-status-urgent' },
  { name: 'Clarification', className: 'bg-status-clarification' },
];

const mockTask: Task = {
  id: 'design-system-task',
  title: 'Graduation ceremony social launch kit',
  description:
    'Create a polished multi-format campaign pack for convocation announcements, countdown posts, and the final stage backdrop.',
  category: 'social_media_creative',
  urgency: 'urgent',
  status: 'under_review',
  isEmergency: true,
  emergencyApprovalStatus: 'approved',
  requesterId: 'staff-01',
  requesterName: 'Placement Cell',
  requesterEmail: 'placement@smvec.ac.in',
  requesterPhone: '+91 9876543210',
  requesterDepartment: 'Placement',
  assignedTo: 'designer-01',
  assignedToId: 'designer-01',
  assignedToName: 'Vinoth Kumar',
  assignedDesignerEmail: 'designer@smvec.ac.in',
  ccEmails: ['treasurer@smvec.ac.in'],
  accessMode: 'full',
  viewOnly: false,
  deadline: new Date('2026-03-21T10:00:00'),
  proposedDeadline: new Date('2026-03-20T10:00:00'),
  deadlineApprovalStatus: 'approved',
  isModification: false,
  approvalStatus: 'pending',
  changeCount: 3,
  changeHistory: [],
  files: [],
  comments: [],
  createdAt: new Date('2026-03-13T10:00:00'),
  updatedAt: new Date('2026-03-13T13:00:00'),
};

const typographySpec = [
  { label: 'Display', className: 'text-5xl font-semibold tracking-tight', sample: 'Design systems that ship' },
  { label: 'Heading', className: 'text-3xl font-semibold tracking-tight', sample: 'Review and approve modifications' },
  { label: 'Section', className: 'text-xl font-semibold tracking-tight', sample: 'Component library' },
  { label: 'Body', className: 'text-base text-muted-foreground', sample: 'Clear, operational UI copy built for task-heavy flows.' },
  { label: 'Caption', className: 'text-xs uppercase tracking-[0.24em] text-muted-foreground', sample: 'Operational metadata' },
];

export default function DesignSystemCapture() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [requestType, setRequestType] = useState('campaign');
  const metrics = useMemo(
    () => [
      { title: 'Pending approvals', value: 12, icon: <Clock3 className="h-4 w-4" />, trend: { value: 8, isPositive: false } },
      { title: 'Active requests', value: 47, icon: <LayoutGrid className="h-4 w-4" />, trend: { value: 18, isPositive: true } },
      { title: 'Files delivered', value: 92, icon: <Upload className="h-4 w-4" />, trend: { value: 12, isPositive: true } },
    ],
    []
  );

  return (
    <GridSmallBackground className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-10 px-6 py-10 md:px-10 xl:px-14">
        <section className="overflow-hidden rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,rgba(50,72,183,0.12),rgba(255,255,255,0.96)_42%,rgba(244,200,89,0.12))] shadow-[0_30px_90px_-50px_rgba(29,39,101,0.45)]">
          <div className="grid gap-10 px-8 py-10 lg:grid-cols-[1.4fr_0.9fr] lg:px-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-primary">
                <Palette className="h-3.5 w-3.5" />
                DesignDesk UI System
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                  Design system, components, and screen patterns prepared for Figma capture.
                </h1>
                <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                  This page documents the current foundation tokens, UI primitives, and composite task
                  patterns used across the portal so they can be added to the same Figma file as a
                  reference board.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg">Primary Action</Button>
                <Button size="lg" variant="outline">Secondary Review</Button>
                <Button size="lg" variant="ghost">Ghost Utility</Button>
              </div>
            </div>
            <Card className="border-white/70 bg-white/80 shadow-card backdrop-blur">
              <CardHeader className="space-y-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Quick Reference
                </CardDescription>
                <CardTitle className="text-2xl">Current capture scope</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  Desktop routes have already been pushed into the active Figma file.
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  This board adds components, token references, and composite UI examples.
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                  Mobile and tablet captures will be appended as separate responsive frames.
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Foundation</CardDescription>
              <CardTitle>Color tokens</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {foundationTokens.map((token) => (
                <div key={token.name} className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
                  <div className={`h-20 rounded-2xl border border-border/60 ${token.swatchClass}`} />
                  <div className="mt-4 space-y-1">
                    <p className="font-semibold">{token.name}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{token.token}</p>
                    <p className="text-sm text-muted-foreground">{token.note}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
                <div className="h-20 rounded-2xl border border-border/60" style={{ backgroundImage: 'var(--gradient-primary)' }} />
                <div className="mt-4 space-y-1">
                  <p className="font-semibold">Primary Gradient</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">--gradient-primary</p>
                  <p className="text-sm text-muted-foreground">Primary hero wash and emphasis surface.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Status System</CardDescription>
              <CardTitle>Operational state colors</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {statusTokens.map((token) => (
                <div key={token.name} className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className={`h-12 w-12 rounded-2xl ${token.className}`} />
                  <div>
                    <p className="font-semibold">{token.name}</p>
                    <p className="text-sm text-muted-foreground">Used in badges, chips, upload states, and task workflows.</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Typography</CardDescription>
              <CardTitle>Text hierarchy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {typographySpec.map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-background px-5 py-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{item.label}</p>
                  <p className={item.className}>{item.sample}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Actions</CardDescription>
              <CardTitle>Buttons, badges, and tabs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="success">Success</Button>
                <Button variant="warning">Warning</Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge variant="pending">Pending</Badge>
                <Badge variant="progress">In Progress</Badge>
                <Badge variant="review">Under Review</Badge>
                <Badge variant="completed">Completed</Badge>
                <Badge variant="urgent">Urgent</Badge>
                <Badge variant="clarification">Clarification</Badge>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start gap-2 rounded-2xl bg-muted/70 p-1">
                  <TabsTrigger value="overview" className="rounded-xl px-4">Overview</TabsTrigger>
                  <TabsTrigger value="files" className="rounded-xl px-4">Files</TabsTrigger>
                  <TabsTrigger value="activity" className="rounded-xl px-4">Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="rounded-2xl border border-border/70 bg-background p-4">
                  Primary content tabs are used in details, settings, and content-heavy task panels.
                </TabsContent>
                <TabsContent value="files" className="rounded-2xl border border-border/70 bg-background p-4">
                  File and deliverable sections rely on the same surface + spacing rules.
                </TabsContent>
                <TabsContent value="activity" className="rounded-2xl border border-border/70 bg-background p-4">
                  Activity timelines lean on chips, metadata labels, and compact action buttons.
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Forms</CardDescription>
              <CardTitle>Inputs and selectors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="request-title-preview">Request title</Label>
                  <Input id="request-title-preview" value="Convocation countdown posters" readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="campaign">Campaign or others</SelectItem>
                      <SelectItem value="social">Social media creative</SelectItem>
                      <SelectItem value="website">Website assets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-note-preview">Brief</Label>
                <Textarea
                  id="request-note-preview"
                  readOnly
                  value="Highlight event date, chief guest announcement, and department-level branding in a premium academic style."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">WhatsApp updates</p>
                      <p className="text-sm text-muted-foreground">Keep stakeholders informed on major changes.</p>
                    </div>
                    <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Checkbox id="approval-needed" checked />
                    <div className="space-y-1">
                      <Label htmlFor="approval-needed">Approval required</Label>
                      <p className="text-sm text-muted-foreground">Use for modified assets and final deliverables.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Composite Metrics</CardDescription>
              <CardTitle>Dashboard patterns</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                {metrics.map((metric) => (
                  <StatsCard
                    key={metric.title}
                    title={metric.title}
                    value={metric.value}
                    icon={metric.icon}
                    trend={metric.trend}
                  />
                ))}
              </div>
              <div className="rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(50,72,183,0.05),rgba(255,255,255,1)_42%,rgba(244,200,89,0.08))] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Live panel</p>
                    <h3 className="text-2xl font-semibold tracking-tight">Notification card language</h3>
                  </div>
                  <Button variant="outline" size="icon">
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                    <p className="font-semibold">Clear stage chips</p>
                    <p className="mt-2 text-sm text-muted-foreground">Pending, approved, urgent, and review labels stay consistent.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                    <p className="font-semibold">Strong metadata</p>
                    <p className="mt-2 text-sm text-muted-foreground">Every record has task ID, timeline, and ownership context.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                    <p className="font-semibold">Action affordance</p>
                    <p className="mt-2 text-sm text-muted-foreground">Buttons and icon controls use clear hierarchy and focus states.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[28px] border-border/70 shadow-card">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Composite Pattern</CardDescription>
              <CardTitle>Task card</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskCard task={mockTask} showRequester showAssignee />
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[28px] border-border/70 bg-slate-950 text-slate-100 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.92)]">
              <CardHeader>
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Dark Surface</CardDescription>
                <CardTitle className="text-slate-100">Dark mode accent panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Badge variant="progress">Realtime</Badge>
                  <Badge variant="review">Review Mode</Badge>
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  Dashboard, previews, and AI workspaces lean on a deep navy canvas with bright status accents.
                </p>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Preview overlay</p>
                      <p className="text-sm text-slate-400">Optimized for zoom controls, file viewing, and review comments.</p>
                    </div>
                    <Button className="bg-primary text-white hover:bg-primary/90">
                      Open preview
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70 shadow-card">
              <CardHeader>
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.22em]">Capture Notes</CardDescription>
                <CardTitle>Responsive targets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Mobile capture
                  </div>
                  Capture at phone-first widths for dashboard, requests, approvals, and task detail.
                </div>
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-status-completed" />
                    Tablet capture
                  </div>
                  Capture at medium-width layouts to preserve sidebars, grids, and detail panels.
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </GridSmallBackground>
  );
}

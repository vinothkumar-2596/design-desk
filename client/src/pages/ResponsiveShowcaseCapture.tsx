import { Bell, CalendarDays, CheckCircle2, Clock3, LayoutGrid, Plus, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GridSmallBackground } from '@/components/ui/background';
import { cn } from '@/lib/utils';

function DeviceShell({
  label,
  title,
  className,
  children,
}: {
  label: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between px-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        </div>
        <Badge variant="outline">{label}</Badge>
      </div>
      <div className="rounded-[34px] border border-slate-900 bg-slate-950 p-3 shadow-[0_35px_90px_-45px_rgba(15,23,42,0.9)]">
        <div className="rounded-[26px] bg-[#06102b] p-3 text-slate-100">
          {children}
        </div>
      </div>
    </div>
  );
}

function MobileDashboardFrame() {
  return (
    <div className="mx-auto w-[390px] overflow-hidden rounded-[22px] bg-[#071430]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Treasurer</p>
            <h4 className="mt-1 text-xl font-semibold">Dashboard</h4>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Bell className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-3 text-slate-300">
            <Search className="h-4 w-4" />
            <span className="text-sm">Search requests</span>
          </div>
        </div>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="rounded-3xl border border-[#3357d7]/30 bg-[linear-gradient(135deg,rgba(53,82,197,0.26),rgba(11,22,53,0.9))] px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Overview</p>
          <h5 className="mt-2 text-2xl font-semibold">Welcome back</h5>
          <p className="mt-2 text-sm text-slate-300">Review approvals and monitor live task changes.</p>
          <Button className="mt-4 h-10 rounded-xl bg-white text-slate-950 hover:bg-white/90">
            <Plus className="h-4 w-4" />
            New request
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Total', '47'],
            ['Pending', '12'],
            ['In Review', '8'],
            ['Done', '26'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold">Recent task</h5>
            <Badge variant="progress">Review</Badge>
          </div>
          <p className="mt-3 text-sm font-medium text-white">Convocation social asset pack</p>
          <p className="mt-1 text-sm text-slate-400">Assigned to Vinoth Kumar</p>
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Mar 21</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" /> 2 updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileRequestFrame() {
  return (
    <div className="mx-auto w-[390px] overflow-hidden rounded-[22px] bg-[#071430]">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">New Request</p>
        <h4 className="mt-1 text-xl font-semibold">Campaign submission</h4>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-sm font-semibold">Submission rules</p>
          <p className="mt-2 text-sm text-slate-400">Include source files, final copy, and the preferred delivery date.</p>
        </div>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
          <Input value="Graduation launch poster" readOnly className="border-white/10 bg-white/10 text-white placeholder:text-slate-400" />
          <Textarea value="Need poster, invite card, and social story set for alumni promotion." readOnly className="border-white/10 bg-white/10 text-white placeholder:text-slate-400" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Urgency</p>
              <p className="mt-2 font-semibold">Normal</p>
            </div>
            <div className="rounded-2xl border border-white/10 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deadline</p>
              <p className="mt-2 font-semibold">Mar 21</p>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-[#4f68d6] bg-[#102052] px-4 py-5 text-center text-sm text-slate-300">
            Upload attachments
          </div>
          <Button className="h-11 w-full rounded-xl bg-primary text-white hover:bg-primary/90">Submit request</Button>
        </div>
      </div>
    </div>
  );
}

function TabletWorkspaceFrame() {
  return (
    <div className="mx-auto w-[820px] overflow-hidden rounded-[28px] bg-[#071430]">
      <div className="grid grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-r border-white/10 px-4 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">DesignDesk</p>
            <p className="mt-2 text-lg font-semibold">Task Portal</p>
          </div>
          <div className="mt-4 space-y-2">
            {['Dashboard', 'New Request', 'Tasks', 'Approvals', 'Settings'].map((item, index) => (
              <div key={item} className={cn('rounded-2xl px-4 py-3 text-sm', index === 0 ? 'bg-primary text-white' : 'bg-white/5 text-slate-300')}>
                {item}
              </div>
            ))}
          </div>
        </aside>
        <div className="px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Tablet layout</p>
              <h4 className="mt-1 text-2xl font-semibold">Dashboard overview</h4>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">This month</Button>
              <Button className="bg-white text-slate-950 hover:bg-white/90">Export</Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              ['Tasks', '47', <LayoutGrid className="h-4 w-4" key="tasks" />],
              ['Review', '8', <ShieldCheck className="h-4 w-4" key="review" />],
              ['Done', '26', <CheckCircle2 className="h-4 w-4" key="done" />],
            ].map(([label, value, icon]) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-sm">{label}</span>
                  {icon}
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-[1.2fr_0.9fr] gap-4">
            <Card className="rounded-[26px] border-white/10 bg-white/5 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Recent Tasks</p>
              <div className="mt-4 space-y-3">
                {['Convocation social pack', 'Placement drive reels', 'Website admission banner'].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-white/10 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{item}</p>
                      <Badge variant={index === 0 ? 'review' : index === 1 ? 'progress' : 'pending'}>{index === 0 ? 'Review' : index === 1 ? 'Active' : 'Pending'}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">Task metadata, ownership, and deadline remain visible in the list pattern.</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="rounded-[26px] border-white/10 bg-white/5 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Approvals</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="font-semibold">Modification approval</p>
                  <p className="mt-2 text-sm text-slate-400">Requires treasurer action before delivery.</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="font-semibold">Final file review</p>
                  <p className="mt-2 text-sm text-slate-400">Design review notes stay in-context with preview links.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabletDetailFrame() {
  return (
    <div className="mx-auto w-[820px] overflow-hidden rounded-[28px] bg-[#071430]">
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 px-5 py-5">
        <Card className="rounded-[26px] border-white/10 bg-white/5 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Task detail</p>
          <h4 className="mt-2 text-2xl font-semibold">Convocation social asset pack</h4>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="review">Under review</Badge>
            <Badge variant="urgent">Urgent</Badge>
            <Badge variant="progress">Assigned</Badge>
          </div>
          <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-[#091839] px-4 py-16 text-center text-sm text-slate-400">
            File preview canvas
          </div>
        </Card>
        <Card className="rounded-[26px] border-white/10 bg-white/5 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Review side panel</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 px-4 py-4">
              <p className="font-semibold">Assigned designer</p>
              <p className="mt-2 text-sm text-slate-400">Vinoth Kumar</p>
            </div>
            <div className="rounded-2xl border border-white/10 px-4 py-4">
              <p className="font-semibold">Deadline</p>
              <p className="mt-2 text-sm text-slate-400">Mar 21, 2026</p>
            </div>
            <div className="rounded-2xl border border-white/10 px-4 py-4">
              <p className="font-semibold">Recent activity</p>
              <p className="mt-2 text-sm text-slate-400">File upload, comment, and approval updates.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ResponsiveShowcaseCapture() {
  return (
    <GridSmallBackground className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-10 px-6 py-10 md:px-10 xl:px-14">
        <section className="rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,rgba(50,72,183,0.12),rgba(255,255,255,0.96)_42%,rgba(244,200,89,0.12))] px-8 py-10 shadow-[0_30px_90px_-50px_rgba(29,39,101,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Responsive Showcase</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
            Phone and tablet UI boards for the Figma handoff.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
            This capture route packages the key mobile and tablet layouts into clean device-stage compositions so
            the Figma file includes responsive references even when live route serialization is inconsistent.
          </p>
        </section>

        <section className="grid gap-8 xl:grid-cols-2">
          <DeviceShell label="Phone" title="Treasurer dashboard">
            <MobileDashboardFrame />
          </DeviceShell>
          <DeviceShell label="Phone" title="New request form">
            <MobileRequestFrame />
          </DeviceShell>
        </section>

        <section className="grid gap-8">
          <DeviceShell label="Tablet" title="Dashboard workspace">
            <TabletWorkspaceFrame />
          </DeviceShell>
          <DeviceShell label="Tablet" title="Task detail and review">
            <TabletDetailFrame />
          </DeviceShell>
        </section>
      </div>
    </GridSmallBackground>
  );
}

import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  Gavel,
  Lock,
  Mail,
  ServerCog,
  Shield,
  Upload,
  UserCheck,
} from 'lucide-react';

type TermsSection = {
  title: string;
  icon: React.ElementType;
  description: string;
  points: string[];
};

const termsSections: TermsSection[] = [
  {
    title: 'Eligibility And Accounts',
    icon: UserCheck,
    description:
      'DesignDesk is intended for authorized users who access the portal for institutional design workflows.',
    points: [
      'You must use an approved account and keep your login credentials secure.',
      'Role-based access is enforced for staff, designers, treasurers, and administrators.',
      'You are responsible for activity performed through your account unless unauthorized access is reported promptly.',
      'Access may be suspended or removed if account use violates policy, security requirements, or institutional rules.',
    ],
  },
  {
    title: 'Acceptable Use',
    icon: Shield,
    description:
      'The service must be used only for legitimate request submission, collaboration, review, and delivery.',
    points: [
      'Do not upload unlawful, harmful, misleading, or unrelated material.',
      'Do not attempt to bypass permissions, impersonate another user, or interfere with platform operations.',
      'Do not use the portal to distribute malware, spam, or unauthorized external content.',
      'Users must provide accurate request details and cooperate respectfully with reviewers and designers.',
    ],
  },
  {
    title: 'Requests, Files, And Content',
    icon: Upload,
    description:
      'You remain responsible for the materials you submit and for ensuring you have the right to use them.',
    points: [
      'Uploaded references, briefs, and working files should be relevant to the request and safe to process.',
      'You confirm that submitted content does not knowingly violate confidentiality, copyright, or usage restrictions.',
      'DesignDesk may store, move, transform, preview, or share files internally as needed to complete the workflow.',
      'Request history, comments, and file records may remain available for operational and audit purposes.',
    ],
  },
  {
    title: 'Approvals And Delivery',
    icon: FileCheck,
    description:
      'The portal supports internal review and delivery, but final responsibility for business use remains with the requesting team.',
    points: [
      'Approval states, comments, and change requests are part of the official task record.',
      'Delivered outputs should be reviewed by the requesting team before publication or distribution.',
      'Deadlines are target dates and may be affected by incomplete inputs, revision cycles, or operational constraints.',
      'DesignDesk may reject, pause, or return requests that lack required information or violate workflow standards.',
    ],
  },
  {
    title: 'Availability And Integrations',
    icon: ServerCog,
    description:
      'The project may rely on internal infrastructure and third-party services to function.',
    points: [
      'Features such as authentication, notifications, file storage, or messaging may depend on third-party providers.',
      'Service interruptions, maintenance, or provider outages can affect portal availability or feature behavior.',
      'The project team may change, disable, or replace integrations when necessary for security or operations.',
      'No guarantee is made that every feature will be available continuously or without interruption.',
    ],
  },
  {
    title: 'Confidentiality, Security, And Enforcement',
    icon: Lock,
    description:
      'Users must handle institutional information carefully and follow applicable security expectations.',
    points: [
      'Sensitive or confidential content should be shared only with authorized users and only through approved workflow channels.',
      'The project team may monitor logs, investigate misuse, and take corrective action to protect the service.',
      'Violations may result in request removal, account restriction, escalation to administrators, or other enforcement steps.',
      'Security incidents and access concerns should be reported immediately to the DesignDesk support contact.',
    ],
  },
  {
    title: 'Changes And Governing Use',
    icon: Gavel,
    description:
      'Use of the portal is subject to current project rules and may evolve as the system changes.',
    points: [
      'These terms may be updated to reflect operational, legal, institutional, or technical changes.',
      'Continued use of DesignDesk after updates means the revised terms apply going forward.',
      'If any part of these terms cannot be enforced, the remaining terms continue to apply.',
      'Questions about acceptable use or policy interpretation should be directed to the project team before proceeding.',
    ],
  },
];

const TermsService = () => {
  const lastUpdated = 'March 12, 2026';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#E5EEFF] dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#DCE8FF]/90 blur-3xl dark:bg-[#233B7C]/35" />
      <div className="pointer-events-none absolute right-0 top-32 h-72 w-72 rounded-full bg-[#EDF4FF]/85 blur-3xl dark:bg-[#314E98]/20" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#E3EDFF]/75 blur-3xl dark:bg-[#1E366C]/20" />

      <div className="relative mx-auto max-w-5xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-full border-[#C9D7FF] bg-white/82 px-5 text-[#1E2A5A] hover:bg-[#EEF4FF] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
          >
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Link>
          </Button>

          <Badge className="rounded-full border border-[#D5E2FB] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A4D82] dark:border-border dark:bg-card dark:text-muted-foreground">
            Public document
          </Badge>
        </div>

        <div className="mt-6 rounded-[32px] border border-[#C9D7FF]/70 bg-gradient-to-br from-white/90 via-[#F5F8FF]/82 to-[#EAF2FF]/78 p-8 shadow-none supports-[backdrop-filter]:bg-[#F5F8FF]/65 backdrop-blur-2xl dark:border-border dark:bg-card/90 dark:backdrop-blur-none sm:p-10">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6B7A99] dark:text-muted-foreground">
              DesignDesk
            </p>
            <h1 className="mt-3 text-4xl font-bold text-[#1E2A5A] dark:text-foreground premium-headline">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#5B6F93] dark:text-muted-foreground premium-body">
              These Terms of Service govern access to and use of the DesignDesk portal,
              including request submission, approvals, file handling, collaboration,
              notifications, and related workflow features provided through this project.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <div className="rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[#35429A] dark:border-border dark:bg-background/60 dark:text-slate-200">
                Last updated: {lastUpdated}
              </div>
              <div className="rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[#5C6E95] dark:border-border dark:bg-background/60 dark:text-slate-300">
                Continued use of the portal means you accept these terms
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {termsSections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.title}
                  className="rounded-[26px] border border-[#D9E6FF] bg-white/78 p-6 supports-[backdrop-filter]:bg-white/62 backdrop-blur-xl dark:border-border dark:bg-slate-950/40 dark:backdrop-blur-none"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D7E0F8] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(232,239,255,0.92))] text-[#35429A] dark:border-border dark:bg-background/60 dark:text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#1E2A5A] dark:text-foreground">
                        {section.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#5C6E95] dark:text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-3 text-sm leading-6 text-[#40557F] dark:text-slate-300">
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#5F7CFF] dark:bg-[#9EB2FF]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <section className="mt-6 rounded-[26px] border border-[#D7E0F8] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,244,255,0.92))] p-6 dark:border-border dark:bg-background/40">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-lg font-semibold text-[#1E2A5A] dark:text-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  Contact
                </div>
                <p className="mt-2 text-sm leading-6 text-[#5C6E95] dark:text-muted-foreground">
                  For questions about portal use, policy expectations, or enforcement,
                  contact the DesignDesk project team before relying on the service for
                  a request.
                </p>
              </div>
              <div className="rounded-2xl border border-[#D7E0F8] bg-white/85 px-4 py-3 text-sm dark:border-border dark:bg-slate-950/50">
                <div className="flex items-center gap-2 font-semibold text-[#1E2A5A] dark:text-foreground">
                  <Mail className="h-4 w-4" />
                  design@smvec.ac.in
                </div>
                <p className="mt-1 text-[#6B7A99] dark:text-muted-foreground">
                  DesignDesk support contact
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsService;

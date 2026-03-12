import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Bell,
  Database,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';

type PolicySection = {
  title: string;
  icon: React.ElementType;
  description: string;
  points: string[];
};

const policySections: PolicySection[] = [
  {
    title: 'Information We Collect',
    icon: Database,
    description:
      'DesignDesk collects the information needed to run the request portal and support the design workflow.',
    points: [
      'Account details such as name, email address, role, and login method.',
      'Request information including titles, descriptions, deadlines, comments, and approval activity.',
      'Uploaded files, references, and working assets attached to tasks.',
      'Operational data such as IP address, browser details, session information, and audit logs.',
    ],
  },
  {
    title: 'How We Use Information',
    icon: FileText,
    description:
      'The platform uses collected data only for request management, collaboration, security, and support.',
    points: [
      'Authenticate users and control access by role.',
      'Route tasks to staff, designers, treasurers, and administrators.',
      'Store and deliver files, comments, notifications, and request history.',
      'Investigate misuse, troubleshoot issues, and maintain service reliability.',
    ],
  },
  {
    title: 'Who Can Access It',
    icon: Users,
    description:
      'Access is limited to people and services involved in the DesignDesk workflow.',
    points: [
      'Authorized users can view information relevant to their role and assigned tasks.',
      'Administrators may access records for support, security review, and operational management.',
      'Service providers may process limited data when hosting, email delivery, Google sign-in, or Drive storage is enabled.',
      'Information may be disclosed when required by law, institutional policy, or security response.',
    ],
  },
  {
    title: 'Integrations And Notifications',
    icon: Bell,
    description:
      'Some project features rely on third-party integrations to complete the workflow.',
    points: [
      'Google Sign-In may be used to authenticate approved staff accounts.',
      'Google Drive may be used for file upload, storage, or asset delivery when enabled by the deployment.',
      'Email or messaging services may be used for password reset, alerts, reminders, and task communication.',
      'These providers process only the information required to deliver the related feature.',
    ],
  },
  {
    title: 'Security And Retention',
    icon: ShieldCheck,
    description:
      'The project applies reasonable administrative and technical safeguards, but no system is risk-free.',
    points: [
      'Access controls, authentication, and audit logging are used to reduce unauthorized activity.',
      'Records may be retained as long as needed for active tasks, institutional operations, compliance, backup, or dispute resolution.',
      'Uploaded files and tokens should be handled carefully by authorized users and administrators.',
      'If you suspect unauthorized access, contact the DesignDesk team immediately.',
    ],
  },
  {
    title: 'Your Choices',
    icon: Lock,
    description:
      'Users can request updates to account information and raise privacy concerns through the project contacts.',
    points: [
      'You may request correction of inaccurate profile or task information where permitted.',
      'You may stop using Google Sign-In and use another supported login method if your account allows it.',
      'You may request deletion or review of records, subject to operational, legal, or institutional retention needs.',
      'Continued use of the platform after policy changes means the updated policy applies going forward.',
    ],
  },
];

const PrivacyPolicy = () => {
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
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#5B6F93] dark:text-muted-foreground premium-body">
              This Privacy Policy explains how DesignDesk handles information used to
              submit, manage, approve, and complete design requests through this portal.
              It is written for the current project features, including user accounts,
              task workflows, file uploads, notifications, and optional Google-based
              integrations.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <div className="rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[#35429A] dark:border-border dark:bg-background/60 dark:text-slate-200">
                Last updated: {lastUpdated}
              </div>
              <div className="rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[#5C6E95] dark:border-border dark:bg-background/60 dark:text-slate-300">
                Applies to the DesignDesk web portal and related workflow services
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {policySections.map((section) => {
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
                <h2 className="text-lg font-semibold text-[#1E2A5A] dark:text-foreground">
                  Contact
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5C6E95] dark:text-muted-foreground">
                  For privacy questions, correction requests, or concerns about how data
                  is handled in DesignDesk, contact the project team.
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

export default PrivacyPolicy;

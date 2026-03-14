import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { legalPageStyles } from '@/lib/legalPageStyles';
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
    <div className={legalPageStyles.page}>
      <div className={legalPageStyles.glowPrimary} />
      <div className={legalPageStyles.glowSecondary} />
      <div className={legalPageStyles.glowTertiary} />

      <div className="relative mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            asChild
            variant="outline"
            className={legalPageStyles.topButton}
          >
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Link>
          </Button>

          <Badge variant="outline" className={legalPageStyles.topBadge}>
            Public document
          </Badge>
        </div>

        <div className={legalPageStyles.shell}>
          <div className="max-w-3xl">
            <p className={legalPageStyles.eyebrow}>
              DesignDesk
            </p>
            <h1 className={legalPageStyles.title}>
              Privacy Policy
            </h1>
            <p className={legalPageStyles.body}>
              This Privacy Policy explains how DesignDesk handles information used to
              submit, manage, approve, and complete design requests through this portal.
              It is written for the current project features, including user accounts,
              task workflows, file uploads, notifications, and optional Google-based
              integrations.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <div className={legalPageStyles.infoChipPrimary}>
                Last updated: {lastUpdated}
              </div>
              <div className={legalPageStyles.infoChipSecondary}>
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
                  className={legalPageStyles.section}
                >
                  <div className="flex items-start gap-4">
                    <div className={legalPageStyles.sectionIcon}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className={legalPageStyles.sectionTitle}>
                        {section.title}
                      </h2>
                      <p className={legalPageStyles.sectionBody}>
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <ul className={legalPageStyles.sectionList}>
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span className={legalPageStyles.sectionDot} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <section className={legalPageStyles.contactSection}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className={legalPageStyles.contactTitle}>
                  Contact
                </h2>
                <p className={legalPageStyles.contactBody}>
                  For privacy questions, correction requests, or concerns about how data
                  is handled in DesignDesk, contact the project team.
                </p>
              </div>
              <div className={legalPageStyles.contactCard}>
                <div className="flex items-center gap-2 font-semibold text-[#1E2A5A] dark:text-foreground">
                  <Mail className="h-4 w-4" />
                  design@smvec.ac.in
                </div>
                <p className={legalPageStyles.contactMeta}>
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

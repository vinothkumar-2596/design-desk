import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DESIGN_GOVERNANCE_NOTICE_POLICY } from '@/lib/designGovernance';
import { legalPageStyles } from '@/lib/legalPageStyles';
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
      DESIGN_GOVERNANCE_NOTICE_POLICY,
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
              Terms of Service
            </h1>
            <p className={legalPageStyles.body}>
              These Terms of Service govern access to and use of the DesignDesk portal,
              including request submission, approvals, file handling, collaboration,
              notifications, and related workflow features provided through this project.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <div className={legalPageStyles.infoChipPrimary}>
                Last updated: {lastUpdated}
              </div>
              <div className={legalPageStyles.infoChipSecondary}>
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
                      <li key={point} className={legalPageStyles.sectionListItem}>
                        <span className={legalPageStyles.sectionDot} />
                        <span className={legalPageStyles.sectionListText}>{point}</span>
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
                <div className={`flex items-center gap-2 ${legalPageStyles.contactTitle}`}>
                  <CheckCircle2 className="h-5 w-5" />
                  Contact
                </div>
                <p className={legalPageStyles.contactBody}>
                  For questions about portal use, policy expectations, or enforcement,
                  contact the DesignDesk project team before relying on the service for
                  a request.
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

export default TermsService;

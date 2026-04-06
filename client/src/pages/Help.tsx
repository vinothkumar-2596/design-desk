import { ReactNode } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ClipboardList,
  AlarmClock,
  Bell,
  Settings,
  Users,
  Shield,
  LifeBuoy,
  Mail,
} from 'lucide-react';

type HelpItem = {
  title: string;
  icon: React.ElementType;
  body: ReactNode;
};

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="space-y-1 border-b border-[#E7EEFF] pb-2.5 last:border-b-0 last:pb-0 dark:border-border/70">
      <p className="text-[13px] font-semibold leading-5 text-[#1E2A5A] dark:text-slate-100">
        {question}
      </p>
      <p className="text-xs leading-5 text-[#5B6B8A] dark:text-slate-400">{answer}</p>
    </div>
  );
}

const helpItems: HelpItem[] = [
  {
    title: 'Getting Started',
    icon: BookOpen,
    body: (
      <>
        <p>
          DesignDesk is a role-based portal for managed design requests.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sign in with your staff credentials.</li>
          <li>
            Your account is linked to a specific college and department.
          </li>
          <li>
            You can create and manage requests only for your assigned department.
          </li>
          <li>
            Contact support if your access or department mapping is incorrect.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Dashboard Overview',
    icon: ClipboardList,
    body: (
      <>
        <p>
          The dashboard gives a quick view of your current request activity.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            See requests by status, priority, and deadline.
          </li>
          <li>
            Review recent updates, comments, and pending actions.
          </li>
          <li>
            Open request records to check files and progress.
          </li>
          <li>
            Use the dashboard to identify what needs your attention next.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Submitting a New Request',
    icon: ClipboardList,
    body: (
      <>
        <p>
          Submit complete requests so they can move through review without delay.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Add a clear title, purpose, format, deadline, and priority.
          </li>
          <li>
            Upload all required content, references, and source files.
          </li>
          <li>Save as draft if the brief is not ready.</li>
          <li>
            Submit only when details are complete and accurate.
          </li>
          <li>
            Incomplete requests may be returned or delayed.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Tracking Your Requests',
    icon: ClipboardList,
    body: (
      <>
        <p>
          Each request record shows progress from submission to delivery.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            View the current status and activity timeline.
          </li>
          <li>
            Check comments for clarifications or revision notes.
          </li>
          <li>
            Review deadlines, priorities, and assigned ownership.
          </li>
          <li>
            Access final deliverables when the request is completed.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Design Governance And Revisions',
    icon: Shield,
    body: (
      <>
        <p>
          Requests follow a controlled process to support quality and brand
          compliance.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Design work starts only after approval.</li>
          <li>Submit revision feedback inside the request record.</li>
          <li>Keep feedback clear, specific, and consolidated.</li>
          <li>Major scope changes may require a new request.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Request Status Definitions',
    icon: AlarmClock,
    body: (
      <>
        <p>Statuses show where your request is in the workflow.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Request Created: Draft saved.</li>
          <li>Request Submitted: Awaiting review.</li>
          <li>Admin / Reviewer Approval: Under compliance check.</li>
          <li>Designer Assignment / Design In Progress: Approved and in work.</li>
          <li>Review / Final Delivery: In revision, delivered, or closed.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Designer Availability',
    icon: Users,
    body: (
      <>
        <p>
          Designer assignment is based on workflow, capacity, and priority.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Designers are assigned only after the request is approved.</li>
          <li>
            Assignment depends on workload, complexity, and deadlines.
          </li>
          <li>Users cannot directly choose a designer.</li>
          <li>
            Urgent requests are reviewed, but faster assignment is not guaranteed.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Notifications & Alerts',
    icon: Bell,
    body: (
      <>
        <p>
          Notifications help you stay updated when action or review is needed.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Alerts are sent for submission, approval, revision, and completion updates.
          </li>
          <li>
            Comments and request changes may also trigger notifications.
          </li>
          <li>Always check the request record for the latest status.</li>
          <li>If alerts are missing, review your settings and contact support if needed.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Account Settings',
    icon: Settings,
    body: (
      <>
        <p>
          Account settings help you manage profile and communication details.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Review your registered staff and department information.</li>
          <li>Update profile details where permitted.</li>
          <li>Manage notification preferences if available.</li>
          <li>Department access and role permissions are controlled by administrators.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Support & Contact',
    icon: LifeBuoy,
    body: (
      <>
        <p>
          Use the correct contact based on whether the issue is operational or technical.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>General support: design@smvec.ac.in</li>
          <li>Use general support for access, workflow, and request guidance.</li>
          <li>Response time: up to 24 hours on business days.</li>
          <li>Technical issues and portal defects: chandruvino003@gmail.com</li>
          <li>Include your department, request ID, and screenshots when reporting a bug.</li>
        </ul>
      </>
    ),
  },
];

const faqItem: HelpItem = {
  title: 'Frequently Asked Questions',
  icon: BookOpen,
  body: (
    <div className="space-y-3">
      <p>Common questions about request handling, access, and support.</p>
      <FAQItem
        question="Can I edit a request after I submit it?"
        answer="Editing may be limited after submission. Use comments or follow reviewer guidance if changes are needed."
      />
      <FAQItem
        question="What should I do if my request is delayed at the approval stage?"
        answer="Check the request status and comments first. If it remains pending, contact the relevant approver or general support."
      />
      <FAQItem
        question="What does it mean if my request is rejected or returned?"
        answer="Review the reason in the request record, correct the issue, and resubmit if permitted."
      />
      <FAQItem
        question="How many revisions are allowed?"
        answer="Submit revision feedback in the request comments. Keep feedback consolidated and within the approved scope."
      />
      <FAQItem
        question="Can I mark my request as urgent?"
        answer="Yes, but urgency does not bypass approval or workload rules. Final scheduling depends on capacity and priority."
      />
      <FAQItem
        question="Why can I only see requests for one department?"
        answer="Your account is restricted to your assigned college and department unless broader access has been approved."
      />
      <FAQItem
        question="I did not receive a notification. Has my request stopped moving?"
        answer="Check your notification settings and review the request record directly. Contact support if updates are still missing."
      />
      <FAQItem
        question="Who should I contact for a bug, system error, or technical malfunction in the portal?"
        answer="Report technical defects, errors, or malfunctioning features to chandruvino003@gmail.com with clear issue details and screenshots."
      />
    </div>
  ),
};

const FAQIcon = faqItem.icon;

export default function Help() {
  return (
    <DashboardLayout fitContentHeight>
      <div className="rounded-[32px] border border-[#D9E6FF] bg-white/90 p-6 md:p-10 shadow-none dark:border-border dark:bg-card/90 dark:shadow-none">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start">
          <div className="space-y-6 lg:max-w-[34rem]">
            <div className="space-y-3">
              <Badge className="rounded-full border border-[#DDE6FF] bg-white/80 text-[#5B6B8A] dark:border-border dark:bg-muted/70 dark:text-slate-300">
                Help & Support - DesignDesk Task Portal
              </Badge>
              <h1 className="text-3xl md:text-4xl font-semibold text-[#1E2A5A] dark:text-slate-100 premium-headline">
                Help Centre
              </h1>
              <p className="text-base text-[#5B6B8A] dark:text-slate-400 premium-body">
                Find quick guidance on submitting department-based design
                requests, tracking progress, managing revisions, and receiving
                final deliverables in DesignDesk.
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-3.5">
              <AccordionItem
                value={faqItem.title}
                className="overflow-hidden rounded-2xl border border-[#E3EBFF] bg-[#F7F9FF] px-4 shadow-none dark:border-border dark:bg-slate-900/50"
              >
                <AccordionTrigger className="gap-4 py-4 text-left text-sm font-semibold text-[#1E2A5A] hover:no-underline [&>svg]:ml-4 [&>svg]:box-content [&>svg]:rounded-full [&>svg]:bg-white [&>svg]:p-2 [&>svg]:text-[#4F6EF7] dark:text-slate-100 dark:[&>svg]:bg-slate-900/70 dark:[&>svg]:text-primary">
                  <span className="flex items-center gap-2">
                    <FAQIcon className="h-4 w-4 text-[#4F6EF7] dark:text-primary" />
                    {faqItem.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2.5 border-t border-[#E7EEFF] pt-3 text-[13px] leading-5 text-[#5B6B8A] dark:border-border/70 dark:text-slate-300">
                  {faqItem.body}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="rounded-2xl border border-[#E3EBFF] bg-[#F5F7FF] p-5 shadow-none dark:border-border dark:bg-slate-900/60">
              <h2 className="text-lg font-semibold text-[#1E2A5A] dark:text-slate-100 premium-heading">
                Still have questions?
              </h2>
              <p className="mt-2 text-sm text-[#5B6B8A] dark:text-slate-400 premium-body">
                Contact the support team for help with portal access, request
                handling, or workflow clarification.
              </p>
              <Button asChild className="mt-4 rounded-full px-6">
                <a href="mailto:design@smvec.ac.in">Send email</a>
              </Button>
            </div>

            <div className="rounded-2xl border border-[#E3EBFF] bg-[#F9FBFF] p-4 dark:border-border dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2A5A] dark:text-slate-100">
                <Mail className="h-4 w-4" />
                Support Email
              </div>
              <p className="mt-2 text-sm text-[#5B6B8A] dark:text-slate-400">
                design@smvec.ac.in
              </p>
              <p className="text-xs text-[#7B8CAD] dark:text-slate-500">
                Response time: up to 24 hours on business days.
              </p>
            </div>
          </div>

          <div className="lg:pl-1">
            <Accordion
              type="single"
              collapsible
              defaultValue={helpItems[0]?.title}
              className="space-y-3.5"
            >
              {helpItems.map((item) => {
                const Icon = item.icon;
                return (
                  <AccordionItem
                    key={item.title}
                    value={item.title}
                    className="overflow-hidden rounded-2xl border border-[#E3EBFF] bg-[#F7F9FF] px-4 shadow-none dark:border-border dark:bg-slate-900/50"
                  >
                    <AccordionTrigger className="gap-4 py-4 text-left text-sm font-semibold text-[#1E2A5A] hover:no-underline [&>svg]:ml-4 [&>svg]:box-content [&>svg]:rounded-full [&>svg]:bg-white [&>svg]:p-2 [&>svg]:text-[#4F6EF7] dark:text-slate-100 dark:[&>svg]:bg-slate-900/70 dark:[&>svg]:text-primary">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#4F6EF7] dark:text-primary" />
                        {item.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2.5 border-t border-[#E7EEFF] pt-3 text-[13px] leading-5 text-[#5B6B8A] dark:border-border/70 dark:text-slate-300">
                      {item.body}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}



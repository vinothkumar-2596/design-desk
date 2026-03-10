import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_URL, authFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type EmailTaskPreview = {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  deadline: string | null;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  assignedToName: string;
  updatedAt: string | null;
};

type EmailTaskResolveResponse = {
  taskId: string;
  preview: EmailTaskPreview;
  canOpenTask: boolean;
  openPath: string;
  viewer: {
    isAuthenticated: boolean;
    role: string;
    email: string;
  };
};

const glassPanelClass =
  "bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF]/35 ring-0 rounded-[30px] shadow-none dark:bg-card dark:border-border/55 dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent";
const glassCardClass =
  "rounded-2xl border border-[#D9E6FF]/65 bg-gradient-to-br from-white/88 via-[#F5F9FF]/78 to-[#EAF2FF]/72 supports-[backdrop-filter]:bg-[#F5F9FF]/62 backdrop-blur-xl shadow-none dark:border-slate-700/60 dark:bg-slate-900/60 dark:supports-[backdrop-filter]:bg-slate-900/52";
const glassMetaClass =
  "rounded-2xl border border-[#D5E2FB]/80 bg-white/80 supports-[backdrop-filter]:bg-white/55 backdrop-blur-md p-4 dark:border-border/60 dark:bg-background/70 dark:backdrop-blur-none";
const glassBadgeClass =
  "rounded-full border border-[#C9D7FF] bg-gradient-to-r from-white/80 via-[#E6F1FF]/85 to-[#D6E5FF]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1E2A5A] backdrop-blur-xl dark:border-slate-700/80 dark:bg-gradient-to-r dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-800/85 dark:text-slate-100 dark:shadow-none";
const primaryButtonClass =
  "h-11 rounded-xl border border-white/20 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 px-5 text-white shadow-[0_20px_40px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-xl transition-all duration-200 hover:bg-primary/85 hover:shadow-[0_22px_44px_-22px_hsl(var(--primary)/0.6)]";
const secondaryButtonClass =
  "h-11 rounded-xl border border-[#D3E1FF] bg-gradient-to-r from-white/85 via-[#EEF4FF]/78 to-[#E8F1FF]/88 px-5 text-[#223467] shadow-none transition supports-[backdrop-filter]:bg-[#EEF4FF]/62 backdrop-blur-md hover:border-[#BFD1F4] hover:bg-[#EAF2FF]/90 dark:border-slate-600/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-500/80 dark:hover:bg-slate-800/80";

const humanize = (value: string) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

type MetaItemProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function MetaItem({ icon: Icon, label, value }: MetaItemProps) {
  return (
    <div className={glassMetaClass}>
      <div className="flex items-center gap-2 text-[#5C7098] dark:text-slate-400">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D9E6FF]/85 bg-gradient-to-br from-white/90 via-[#EEF4FF]/85 to-[#E2ECFF]/75 supports-[backdrop-filter]:bg-white/65 backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/75">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-3 break-words text-[15px] font-semibold leading-6 text-[#13264C] dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

export default function EmailTask() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EmailTaskResolveResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    const resolveLink = async () => {
      if (!token) {
        setError("Missing task link token.");
        setIsLoading(false);
        return;
      }
      if (!API_URL) {
        setError("Task link service is unavailable.");
        setIsLoading(false);
        return;
      }
      try {
        const response = await authFetch(
          `${API_URL}/api/auth/email-task/resolve?token=${encodeURIComponent(token)}`
        );
        const payload = (await response.json().catch(() => null)) as
          | EmailTaskResolveResponse
          | { error?: string }
          | null;
        if (!response.ok) {
          const message =
            payload && typeof payload.error === "string" && payload.error.trim()
              ? payload.error.trim()
              : "Unable to open this task link.";
          throw new Error(message);
        }
        if (!isMounted) return;
        const resolved = payload as EmailTaskResolveResponse;
        setData(resolved);
        if (resolved?.viewer?.isAuthenticated && resolved?.canOpenTask && resolved?.openPath) {
          navigate(resolved.openPath, { replace: true });
          return;
        }
      } catch (linkError) {
        if (!isMounted) return;
        const message =
          linkError instanceof Error && linkError.message
            ? linkError.message
            : "Unable to open this task link.";
        setError(message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    resolveLink();
    return () => {
      isMounted = false;
    };
  }, [navigate, token]);

  const preview = data?.preview ?? null;
  const previewDescription = String(preview?.description || "").trim();
  const viewerIsAuthenticated = Boolean(data?.viewer?.isAuthenticated);
  const viewerRole = String(data?.viewer?.role || "").trim().toLowerCase();
  const isAuthorizedRole = viewerRole === "designer" || viewerRole === "treasurer";

  const loginRedirectPath = useMemo(() => {
    const path = data?.openPath || (data?.taskId ? `/task/${data.taskId}` : "/dashboard");
    return `/login?redirect=${encodeURIComponent(path)}`;
  }, [data?.openPath, data?.taskId]);

  const headerDescription = useMemo(() => {
    if (isLoading) {
      return "Validating secure access and preparing the task preview.";
    }
    if (error) {
      return "This access link could not be verified. You can return to the workspace from the main application.";
    }
    if (viewerIsAuthenticated && data?.canOpenTask) {
      return "Your access has been verified. Open the full task workspace when permissions allow.";
    }
    if (viewerIsAuthenticated) {
      return "You are signed in. Preview access is available, while full task access depends on your role permissions.";
    }
    return "Review a limited preview of the assigned task. Sign in with an authorized account to access the full workspace.";
  }, [data?.canOpenTask, error, isLoading, viewerIsAuthenticated]);

  const requesterLabel = preview
    ? [preview.requesterName || "N/A", preview.requesterDepartment || "", preview.requesterEmail || ""]
        .filter(Boolean)
        .join(" | ")
    : "N/A";

  const previewMeta = preview
    ? [
        {
          icon: UserRound,
          label: "Assigned To",
          value: preview.assignedToName || "Not assigned",
        },
        {
          icon: Clock3,
          label: "Deadline",
          value: formatDateTime(preview.deadline),
        },
        {
          icon: Building2,
          label: "Requester",
          value: requesterLabel,
        },
        {
          icon: BriefcaseBusiness,
          label: "Last Updated",
          value: formatDateTime(preview.updatedAt),
        },
      ]
    : [];

  const noticeToneClass =
    viewerIsAuthenticated && data?.canOpenTask
      ? "border-[#BFD6FF]/80 bg-gradient-to-r from-[#F6FAFF]/90 via-[#EEF4FF]/80 to-[#EAF2FF]/88 text-[#21407D] dark:border-sky-500/25 dark:bg-slate-900/65 dark:text-sky-100"
      : "border-dashed border-[#C7D7FF] bg-[#F4F8FF]/78 text-[#516483] dark:border-[#33508A]/65 dark:bg-[#102348]/70 dark:text-slate-300";
  const showShellHeader = isLoading || Boolean(error) || !preview;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(221,233,255,0.92),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(238,244,255,0.88),_transparent_24%),linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top_left,rgba(56,83,145,0.22),transparent_26%),radial-gradient(circle_at_top_right,rgba(20,40,87,0.28),transparent_24%),linear-gradient(180deg,#081024_0%,#09162E_100%)] sm:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-[#DDE9FF]/55 blur-3xl dark:bg-[#28406D]/25" />
        <div className="absolute right-[-6rem] top-20 h-72 w-72 rounded-full bg-[#EAF2FF]/70 blur-3xl dark:bg-[#1B335F]/25" />
        <div className="absolute bottom-[-5rem] left-1/3 h-64 w-64 rounded-full bg-white/65 blur-3xl dark:bg-[#102348]/22" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        <div className={cn(glassPanelClass, "overflow-hidden")}>
          {showShellHeader ? (
            <div className="relative border-b border-[#D9E6FF]/70 px-6 py-6 sm:px-8 sm:py-7 dark:border-slate-700/60">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.9),_transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.28),rgba(230,241,255,0.06))] opacity-90 dark:bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.09),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.18),rgba(30,41,59,0.08))]" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#C9D7FF] bg-gradient-to-br from-white/88 via-[#EAF2FF]/84 to-[#DDE9FF]/74 backdrop-blur-xl dark:border-slate-700/70 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-700/80">
                    <img src="/favicon.png" alt="DesignDesk" className="h-9 w-9 object-contain" />
                  </span>
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C] dark:text-slate-400">
                      DesignDesk
                    </p>
                    <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#12254C] premium-headline dark:text-slate-50 sm:text-[2.35rem]">
                      Secure Task Preview
                    </h1>
                    <p className="max-w-2xl text-[15px] leading-7 text-[#5B6B8A] premium-body dark:text-slate-300">
                      {headerDescription}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-xl",
                    viewerIsAuthenticated
                      ? "border-[#C9D7FF] bg-white/72 text-[#1E2A5A] dark:border-slate-700/70 dark:bg-slate-900/72 dark:text-slate-100"
                      : "border-[#D7E4FF] bg-[#F7FAFF]/82 text-[#5E729A] dark:border-slate-700/70 dark:bg-slate-900/72 dark:text-slate-300"
                  )}
                >
                  {viewerIsAuthenticated ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}
                  {viewerIsAuthenticated ? "Authenticated" : "Restricted Preview"}
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn("relative", showShellHeader ? "px-6 py-6 sm:px-8 sm:py-8" : "")}>
            {isLoading ? (
              <div className={cn(glassCardClass, "p-6 sm:p-7")}>
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D9E6FF]/80 bg-white/72 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/75">
                    <Clock3 className="h-5 w-5 text-[#3B4BA8]" />
                  </span>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-[#12254C] premium-headline dark:text-slate-100">
                      Opening secure task link
                    </h2>
                    <p className="text-sm leading-7 text-[#5B6B8A] premium-body dark:text-slate-300">
                      Please wait while we prepare the protected preview.
                    </p>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className={cn(glassCardClass, "p-6 sm:p-7")}>
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D9E6FF]/80 bg-white/72 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/75">
                    <LockKeyhole className="h-5 w-5 text-[#3B4BA8]" />
                  </span>
                  <div className="flex-1 space-y-3">
                    <h2 className="text-xl font-semibold text-[#12254C] premium-headline dark:text-slate-100">
                      Task link unavailable
                    </h2>
                    <p className="text-sm leading-7 text-[#5B6B8A] premium-body dark:text-slate-300">
                      {error}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Button asChild className={primaryButtonClass}>
                        <Link to="/login" className="inline-flex items-center gap-2">
                          Go to Login
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className={secondaryButtonClass}>
                        <Link to="/">Go to Home</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : preview ? (
              <div className="overflow-hidden rounded-[28px] border border-[#D9E6FF]/70 bg-white/35 shadow-none">
                <div className="border-b border-[#D9E6FF]/70 px-6 py-4 sm:px-8 dark:border-slate-700/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C9D7FF]/80 bg-white/72 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/72">
                        <img src="/favicon.png" alt="DesignDesk" className="h-7 w-7 object-contain" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C] dark:text-slate-400">
                          DesignDesk
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#12254C] dark:text-slate-100">
                          Secure link preview
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-xl",
                        viewerIsAuthenticated
                          ? "border-[#C9D7FF] bg-white/72 text-[#1E2A5A] dark:border-slate-700/70 dark:bg-slate-900/72 dark:text-slate-100"
                          : "border-[#D7E4FF] bg-[#F7FAFF]/82 text-[#5E729A] dark:border-slate-700/70 dark:bg-slate-900/72 dark:text-slate-300"
                      )}
                    >
                      {viewerIsAuthenticated ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" />
                      )}
                      {viewerIsAuthenticated ? "Authenticated Preview" : "Restricted Preview"}
                    </div>
                  </div>
                </div>

                <div className="grid border-b border-[#D9E6FF]/70 lg:grid-cols-[minmax(0,1.25fr)_340px] dark:border-slate-700/60">
                  <div className="px-6 py-8 sm:px-8 sm:py-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C] dark:text-slate-400">
                      Task Overview
                    </p>
                    <h2 className="mt-4 max-w-3xl text-[2.15rem] font-semibold leading-tight tracking-[-0.04em] text-[#12254C] premium-headline dark:text-slate-50 sm:text-[2.85rem]">
                      Your protected task preview is ready
                    </h2>
                    <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[#5B6B8A] premium-body dark:text-slate-300">
                      Review the request details below. Sign in with an authorized DesignDesk
                      account to continue into the full workspace when your role allows it.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <Badge variant="secondary" className={glassBadgeClass}>
                        {humanize(preview.status)}
                      </Badge>
                      {preview.category ? (
                        <Badge variant="outline" className={glassBadgeClass}>
                          {humanize(preview.category)}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-8 max-w-2xl rounded-[26px] border border-[#D9E6FF]/80 bg-gradient-to-br from-white/86 via-[#F7FAFF]/75 to-[#EDF4FF]/74 p-5 supports-[backdrop-filter]:bg-white/58 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/62">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60749C] dark:text-slate-400">
                        Request Title
                      </p>
                      <h3 className="mt-3 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-[#12254C] premium-headline dark:text-slate-100">
                        {preview.title}
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-[#516483] dark:text-slate-300">
                        {previewDescription ||
                          "No summary was added for this task. Sign in with an approved account to continue into the full workspace."}
                      </p>
                    </div>
                  </div>

                  <div className="relative border-t border-[#D9E6FF]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(234,242,255,0.38))] px-6 py-8 sm:px-8 lg:border-l lg:border-t-0 dark:border-slate-700/60 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.15),rgba(15,23,42,0.34))]">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="absolute right-[-2.5rem] top-[-2rem] h-36 w-36 rounded-full bg-white/55 blur-3xl dark:bg-[#27406B]/25" />
                      <img
                        src="/favicon.png"
                        alt=""
                        className="absolute right-8 top-8 h-20 w-20 object-contain opacity-[0.08] dark:opacity-[0.06]"
                      />
                    </div>

                    <div className="relative space-y-4">
                      <div className={cn(glassCardClass, "p-5")}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60749C] dark:text-slate-400">
                          Access
                        </p>
                        <p className="mt-3 text-lg font-semibold leading-7 text-[#12254C] dark:text-slate-100">
                          {viewerIsAuthenticated
                            ? data?.canOpenTask
                              ? "Verified for full workspace access"
                              : "Signed in with restricted preview access"
                            : "Preview available until sign-in"}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-[#5B6B8A] dark:text-slate-300">
                          {viewerIsAuthenticated
                            ? data?.canOpenTask
                              ? "Your account is recognized. Use the action below if the workspace does not open automatically."
                              : "You can review the task from here, but workspace entry still depends on your role permissions."
                            : "This link keeps the task visible in preview mode, but only authorized accounts can open the full task."}
                        </p>
                      </div>

                      <div className={glassMetaClass}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60749C] dark:text-slate-400">
                          Task ID
                        </p>
                        <p className="mt-3 break-all text-lg font-semibold leading-7 text-[#12254C] dark:text-slate-100">
                          {preview.id}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div className={glassMetaClass}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60749C] dark:text-slate-400">
                            Assigned To
                          </p>
                          <p className="mt-3 text-sm font-semibold leading-6 text-[#12254C] dark:text-slate-100">
                            {preview.assignedToName || "Not assigned"}
                          </p>
                        </div>
                        <div className={glassMetaClass}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#60749C] dark:text-slate-400">
                            Deadline
                          </p>
                          <p className="mt-3 text-sm font-semibold leading-6 text-[#12254C] dark:text-slate-100">
                            {formatDateTime(preview.deadline)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 px-6 py-8 sm:px-8 sm:py-10">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C] dark:text-slate-400">
                        Message
                      </p>
                      <div className={cn(glassCardClass, "p-6")}>
                        <h3 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-[#12254C] premium-headline dark:text-slate-100">
                          Hi there,
                        </h3>
                        <p className="mt-4 text-[15px] leading-8 text-[#3C5181] premium-body dark:text-slate-300">
                          Thanks for opening this secure task link. Below is a limited snapshot of
                          the request so you can confirm the assignment, timing, and summary before
                          entering the full workspace.
                        </p>
                        <p className="mt-4 text-[15px] leading-8 text-[#3C5181] premium-body dark:text-slate-300">
                          Sign in with an approved account to continue when deeper task access is
                          required.
                        </p>
                      </div>
                    </div>

                    <div className={cn("rounded-2xl p-4 sm:p-5", glassCardClass, noticeToneClass)}>
                      <div className="flex items-start gap-3">
                        {viewerIsAuthenticated ? (
                          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                        ) : (
                          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                        )}
                        <p className="text-sm leading-7">
                          {viewerIsAuthenticated ? (
                            data?.canOpenTask ? (
                              <span>
                                Your account is authorized for this task. If automatic redirect does
                                not complete, use the action below to open the workspace directly.
                              </span>
                            ) : (
                              <span>
                                You are signed in
                                {isAuthorizedRole
                                  ? ""
                                  : " with a role that cannot open this task from email"}
                                . This preview remains visible, but full task access is restricted.
                              </span>
                            )
                          ) : (
                            <span>
                              You are not signed in. Preview is visible, but full task access is
                              limited to assigned designers, Design Leads, and treasurer.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C] dark:text-slate-400">
                      Summary
                    </p>
                    <div className={cn(glassCardClass, "p-6")}>
                      <p className="whitespace-pre-wrap rounded-2xl border border-[#D9E6FF]/80 bg-white/78 p-5 text-sm leading-8 text-[#243B6A] supports-[backdrop-filter]:bg-white/56 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/68 dark:text-slate-200">
                        {previewDescription ||
                          "No summary was added for this task. Sign in with an approved account to continue into the full workspace."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C] dark:text-slate-400">
                      Task Details
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {previewMeta.map((item) => (
                        <MetaItem key={item.label} icon={item.icon} label={item.label} value={item.value} />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#D9E6FF]/70 pt-6 dark:border-slate-700/60">
                    <div className="flex flex-wrap gap-3">
                      {!viewerIsAuthenticated ? (
                        <Button asChild className={primaryButtonClass}>
                          <Link to={loginRedirectPath} className="inline-flex items-center gap-2">
                            Login to Continue
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : data?.canOpenTask && data?.openPath ? (
                        <Button asChild className={primaryButtonClass}>
                          <Link to={data.openPath} className="inline-flex items-center gap-2">
                            Open Task
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild className={primaryButtonClass}>
                          <Link to="/dashboard" className="inline-flex items-center gap-2">
                            Go to Dashboard
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}

                      <Button asChild variant="outline" className={secondaryButtonClass}>
                        <Link to="/">Home</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn(glassCardClass, "p-6 sm:p-7")}>
                <h2 className="text-xl font-semibold text-[#12254C] premium-headline dark:text-slate-100">
                  Task preview unavailable
                </h2>
                <p className="mt-2 text-sm leading-7 text-[#5B6B8A] premium-body dark:text-slate-300">
                  This link did not return any task data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

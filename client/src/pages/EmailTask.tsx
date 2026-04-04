import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Clock3,
  LockKeyhole,
  Paperclip,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_URL, authFetch } from "@/lib/api";
import {
  formatCollateralStatusLabel,
  getCollateralDisplayName,
  getCollateralSizeSummary,
} from "@/lib/campaignRequest";
import type { CollateralItem } from "@/types";
import { cn } from "@/lib/utils";

type PreviewCollateral = {
  id: string;
  title?: string;
  collateralType: string;
  platform?: string;
  usageType?: string;
  width?: number;
  height?: number;
  unit?: string;
  sizeLabel?: string;
  customSizeLabel?: string;
  orientation?: string;
  brief: string;
  deadline: string | null;
  priority?: string;
  status: string;
  assignedToName?: string;
  referenceFileCount: number;
};

type PreviewTask = {
  id: string;
  requestType: string;
  title: string;
  description: string;
  status: string;
  category: string;
  urgency: string;
  approvalStatus: string;
  isEmergency: boolean;
  deadline: string | null;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  assignedToName: string;
  createdAt: string | null;
  updatedAt: string | null;
  campaign: {
    requestName: string;
    brief: string;
    deadlineMode: string;
    commonDeadline: string | null;
  } | null;
  collaterals: PreviewCollateral[];
};

type ResolveResponse = {
  taskId: string;
  preview: PreviewTask;
  canOpenTask: boolean;
  openPath: string;
  viewer: {
    isAuthenticated: boolean;
    role: string;
    email: string;
    accessMode: "full" | "view_only" | "none";
    accessReason: string;
  };
};

const WORKFLOW_STEPS = [
  ["pending", "Pending", "Request submitted"],
  ["assigned", "Assigned", "Task assigned to designer"],
  ["accepted", "Accepted", "Designer accepted the task"],
  ["in_progress", "In Progress", "Design work in motion"],
  ["clarification_required", "Clarification Required", "Waiting on clarifications"],
  ["under_review", "Under Review", "Review in progress"],
  ["completed", "Completed", "Delivery complete"],
] as const;

const shellClass =
  "relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(221,233,255,0.92),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(238,244,255,0.88),_transparent_24%),linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-4 py-8 text-foreground sm:py-12";
const surfaceClass =
  "overflow-hidden rounded-[30px] border border-[#D9E6FF]/80 bg-white/82 supports-[backdrop-filter]:bg-white/60 backdrop-blur-2xl";
const panelClass =
  "rounded-[24px] border border-[#D7E4FF]/90 bg-white/80 supports-[backdrop-filter]:bg-white/62 backdrop-blur-xl";
const pillClass =
  "inline-flex items-center rounded-full border border-[#C9D7FF] bg-[#F5F8FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#23407A]";

const humanize = (value: string) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeStatus = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "clarification") return "clarification_required";
  if (normalized === "submitted_for_review") return "under_review";
  return normalized || "pending";
};

const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString(
    "en-US",
    withTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "2-digit" }
  );
};

const relativeTime = (value?: string | null) => {
  if (!value) return "Recently updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently updated";
  return formatDistanceToNow(parsed, { addSuffix: true });
};

const isDone = (status?: string) => ["approved", "completed"].includes(normalizeStatus(status));

const badgeTone = (status?: string) => {
  const normalized = normalizeStatus(status);
  if (["completed", "approved"].includes(normalized)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["assigned", "accepted", "in_progress", "under_review"].includes(normalized)) return "border-[#C9D7FF] bg-[#EEF4FF] text-[#2E4FBA]";
  if (normalized === "clarification_required") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[#E4EBF8] bg-white text-[#6E7D9E]";
};

const accessCopy = (viewer: ResolveResponse["viewer"], canOpenTask: boolean) => {
  if (!viewer.isAuthenticated) {
    return "Sign in with the requester, assigned designer, Design Lead, treasurer, or CC'd manager account to open the full task page.";
  }
  if (!canOpenTask) {
    return "This signed-in account is not linked to the assignment, requester, or CC list for this task.";
  }
  if (viewer.accessReason === "cc_manager") {
    return "This manager account was copied on the assignment, so it can open the task page in view mode.";
  }
  if (viewer.accessReason === "cc_recipient") {
    return "This account was included in the assignment CC list, so it can open the task page in view mode.";
  }
  if (viewer.accessReason === "design_lead") {
    return "This Design Lead account can review the full task page in oversight mode.";
  }
  if (viewer.accessReason === "request_owner") {
    return "This requester account can open the full task page and track delivery progress.";
  }
  return "This account can open the linked task directly in the main DesignDesk workspace.";
};

export default function EmailTask() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ResolveResponse | null>(null);
  const [selectedCollateralId, setSelectedCollateralId] = useState("");

  useEffect(() => {
    let active = true;
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
        const response = await authFetch(`${API_URL}/api/auth/email-task/resolve?token=${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload && typeof payload.error === "string" && payload.error.trim()
              ? payload.error.trim()
              : "Unable to open this task link."
          );
        }
        if (!active) return;
        const resolved = payload as ResolveResponse;
        setData(resolved);
        if (resolved.viewer.isAuthenticated && resolved.canOpenTask && resolved.openPath) {
          navigate(resolved.openPath, { replace: true });
        }
      } catch (linkError) {
        if (!active) return;
        setError(linkError instanceof Error ? linkError.message : "Unable to open this task link.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    resolveLink();
    return () => {
      active = false;
    };
  }, [navigate, token]);

  const preview = data?.preview ?? null;
  const viewer = data?.viewer ?? {
    isAuthenticated: false,
    role: "",
    email: "",
    accessMode: "none" as const,
    accessReason: "sign_in_required",
  };
  const collaterals = preview?.collaterals ?? [];
  const isCampaign = Boolean(preview) && (preview.requestType === "campaign_request" || collaterals.length > 0);

  useEffect(() => {
    if (collaterals.length === 0) {
      setSelectedCollateralId("");
      return;
    }
    setSelectedCollateralId((current) => (collaterals.some((item) => item.id === current) ? current : collaterals[0].id));
  }, [collaterals]);

  const selectedCollateral = collaterals.find((item) => item.id === selectedCollateralId) || collaterals[0] || null;
  const workflowIndex = Math.max(0, WORKFLOW_STEPS.findIndex(([key]) => key === normalizeStatus(preview?.status)));
  const workflowProgress = Math.round(((workflowIndex + 1) / WORKFLOW_STEPS.length) * 100);
  const currentWorkflowStep = WORKFLOW_STEPS[workflowIndex] || WORKFLOW_STEPS[0];
  const canOpenTask = Boolean(data?.canOpenTask);
  const completedCount = collaterals.filter((item) => isDone(item.status)).length;
  const collateralProgress = collaterals.length > 0 ? Math.round((completedCount / collaterals.length) * 100) : 0;
  const overallBrief = String(preview?.campaign?.brief || preview?.description || "").trim() || "No request brief was included in this preview.";
  const loginRedirectPath = useMemo(
    () => `/login?redirect=${encodeURIComponent(data?.openPath || (data?.taskId ? `/task/${data.taskId}` : "/dashboard"))}`,
    [data?.openPath, data?.taskId]
  );
  const primaryActionPath = !viewer.isAuthenticated ? loginRedirectPath : canOpenTask ? data?.openPath || "/dashboard" : "/dashboard";
  const primaryActionLabel = !viewer.isAuthenticated ? "Sign in to View Task" : canOpenTask ? "View Task" : "Go to Dashboard";

  if (isLoading) {
    return <div className={shellClass}><div className="relative mx-auto max-w-6xl"><div className={cn(surfaceClass, "p-6 sm:p-8")}><h1 className="text-2xl font-semibold text-[#12254C]">Opening secure task link</h1><p className="mt-2 text-sm leading-7 text-[#5B6B8A]">Preparing the assignment preview and checking viewer access.</p></div></div></div>;
  }

  if (error) {
    return <div className={shellClass}><div className="relative mx-auto max-w-6xl"><div className={cn(surfaceClass, "p-6 sm:p-8")}><h1 className="text-2xl font-semibold text-[#12254C]">Task link unavailable</h1><p className="mt-2 text-sm leading-7 text-[#5B6B8A]">{error}</p><div className="mt-4 flex flex-wrap gap-3"><Button asChild className="h-11 rounded-xl px-5"><Link to="/login">Go to Login</Link></Button><Button asChild variant="outline" className="h-11 rounded-xl px-5"><Link to="/">Home</Link></Button></div></div></div></div>;
  }

  if (!preview) {
    return <div className={shellClass}><div className="relative mx-auto max-w-6xl"><div className={cn(surfaceClass, "p-6 sm:p-8")}><h1 className="text-2xl font-semibold text-[#12254C]">Task preview unavailable</h1><p className="mt-2 text-sm leading-7 text-[#5B6B8A]">This link did not return any task data.</p></div></div></div>;
  }

  return (
    <div className={shellClass}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-[#DDE9FF]/55 blur-3xl" />
        <div className="absolute right-[-6rem] top-20 h-72 w-72 rounded-full bg-[#EAF2FF]/70 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-6xl">
        <div className={surfaceClass}>
          <div className="border-b border-[#D9E6FF]/70 px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C9D7FF]/80 bg-white/72">
                  <img src="/favicon.png" alt="DesignDesk" className="h-7 w-7 object-contain" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#60749C]">DesignDesk</p>
                  <p className="mt-1 text-sm font-semibold text-[#12254C]">Secure assignment preview</p>
                </div>
              </div>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]", viewer.isAuthenticated ? "border-[#C9D7FF] bg-white/72 text-[#1E2A5A]" : "border-[#D7E4FF] bg-[#F7FAFF]/82 text-[#5E729A]")}>
                {viewer.isAuthenticated ? <ShieldCheck className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                {viewer.isAuthenticated ? "Signed In" : "Restricted Preview"}
              </span>
            </div>
          </div>
          <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.55fr)_340px] lg:items-start">
            <div className="space-y-6">
              <div className="border-b border-[#D9E6FF] pb-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={pillClass}>{humanize(preview.status)}</span>
                  {preview.category ? <span className={pillClass}>{humanize(preview.category)}</span> : null}
                  {preview.approvalStatus ? <span className={pillClass}>Approval {humanize(preview.approvalStatus)}</span> : null}
                </div>
                <h1 className="text-[1.95rem] font-semibold leading-tight tracking-[-0.04em] text-[#12254C]">
                  {preview.campaign?.requestName || preview.title}
                </h1>
                <p className="mt-3 max-w-3xl text-[15px] leading-8 text-[#5B6B8A]">
                  {`Requested by ${[preview.requesterName, preview.requesterDepartment, preview.requesterEmail].filter(Boolean).join(" | ")}${preview.assignedToName ? ` | Assigned to ${preview.assignedToName}` : ""}${preview.deadline ? ` | Due ${formatDate(preview.deadline, true)}` : ""}`}
                </p>
              </div>
              {isCampaign ? (
                <div className={panelClass}>
                  <div className="border-b border-[#E7EDF8] px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7E8DAB]">Campaign Overview</p>
                        <h2 className="mt-1 text-[1.35rem] font-semibold text-[#215ABB]">{preview.campaign?.requestName || preview.title}</h2>
                      </div>
                      <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold", badgeTone(preview.status))}>
                        {humanize(preview.status)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">
                        <span>Collateral Progress</span>
                        <span>{completedCount} / {collaterals.length || 0} completed</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#E6EBF2]">
                        <div className="h-full rounded-full bg-[#4A68D8]" style={{ width: `${collateralProgress}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="grid border-b border-[#E7EDF8] md:grid-cols-4">
                    <div className="px-5 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Request Structure</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{preview.campaign?.deadlineMode === "common" ? "Common deadline" : "Item-wise deadlines"}</p></div>
                    <div className="border-t border-[#E7EDF8] px-5 py-3.5 md:border-l md:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Collaterals</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{collaterals.length} {collaterals.length === 1 ? "Item" : "Items"}</p></div>
                    <div className="border-t border-[#E7EDF8] px-5 py-3.5 md:border-l md:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Delivery Target</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{formatDate(preview.campaign?.commonDeadline || preview.deadline)}</p></div>
                    <div className="border-t border-[#E7EDF8] px-5 py-3.5 md:border-l md:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Requested On</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{formatDate(preview.createdAt)}</p></div>
                  </div>
                  <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Description</p><p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#516483]">{overallBrief}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Collateral Scope</p><div className="mt-2 space-y-1.5 text-[13px] leading-6 text-[#516483]">{collaterals.map((item, index) => <p key={item.id || index}>{`${index + 1}. ${getCollateralDisplayName(item as Partial<CollateralItem>)}${getCollateralSizeSummary(item as Partial<CollateralItem>) ? ` | ${getCollateralSizeSummary(item as Partial<CollateralItem>)}` : ""}`}</p>)}</div></div>
                  </div>
                  <div className="border-t border-[#E7EDF8] px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold text-foreground">Deliverables</h3>
                      <div className="flex gap-2">
                        <span className="rounded-full border border-[#D7E4FF] bg-white px-2.5 py-1 text-[11px] font-medium text-[#40557E]">{collaterals.length} collateral{collaterals.length === 1 ? "" : "s"}</span>
                        <span className="rounded-full border border-[#D7E4FF] bg-white px-2.5 py-1 text-[11px] font-medium text-[#40557E]">{preview.campaign?.deadlineMode === "common" ? "Common deadline" : "Item-wise deadlines"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <div className="overflow-hidden rounded-[26px] border border-[#CFE0FF] bg-[#FBFDFF] lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
                      <div className="border-b border-[#DCE7FB] lg:border-b-0 lg:border-r">
                        <div className="px-4 pb-3 pt-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB]">Collateral Flow</p>
                          <p className="mt-2 max-w-[15rem] text-sm leading-6 text-[#6B7C9F]">
                            Select an item to review its brief, references, and delivery details.
                          </p>
                        </div>
                        <div className="space-y-3 px-3 pb-4">
                          {collaterals.map((item, index) => {
                            const isActive = selectedCollateral?.id === item.id;
                            const sizeLabel = getCollateralSizeSummary(item as Partial<CollateralItem>);
                            return (
                              <button
                                key={item.id || index}
                                type="button"
                                onClick={() => setSelectedCollateralId(item.id)}
                                className={cn(
                                  "w-full rounded-[20px] border px-4 py-4 text-left transition",
                                  isActive
                                    ? "border-[#7EA2FF] bg-[#EEF4FF] shadow-[0_16px_40px_-32px_rgba(54,90,187,0.65)]"
                                    : "border-[#D9E6FF] bg-white hover:border-[#BFD1FF] hover:bg-[#F9FBFF]"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", isActive ? "bg-[#3366E8] text-white" : "border border-[#D7E4FF] bg-[#F7FAFF] text-[#5270C7]")}>
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-[#203254]">
                                        {getCollateralDisplayName(item as Partial<CollateralItem>)}
                                      </p>
                                      <p className="mt-1 truncate text-xs text-[#7A8AA9]">
                                        {[humanize(item.collateralType || item.usageType || item.platform || "Collateral"), sizeLabel].filter(Boolean).join(" · ")}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold", badgeTone(item.status))}>
                                    {formatCollateralStatusLabel(item.status)}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#7A8AA9]">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(item.deadline)}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Paperclip className="h-3.5 w-3.5" />
                                    {item.referenceFileCount} ref{item.referenceFileCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="p-4 sm:p-5">
                        {selectedCollateral ? (
                          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px]">
                            <div className="space-y-5">
                              <div className="border-b border-[#E6EEF9] pb-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h4 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-[#18315F]">
                                      {getCollateralDisplayName(selectedCollateral as Partial<CollateralItem>)}
                                    </h4>
                                    <p className="mt-1 text-sm text-[#7383A3]">
                                      {[humanize(selectedCollateral.collateralType || selectedCollateral.usageType || selectedCollateral.platform || "Collateral"), getCollateralSizeSummary(selectedCollateral as Partial<CollateralItem>)].filter(Boolean).join(" · ")}
                                    </p>
                                  </div>
                                  <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold", badgeTone(selectedCollateral.status))}>
                                    {formatCollateralStatusLabel(selectedCollateral.status)}
                                  </span>
                                </div>
                                <p className="mt-3 text-sm text-[#617291]">
                                  {`Deadline: ${formatDate(selectedCollateral.deadline)} · Progress: ${humanize(selectedCollateral.status || "pending")}${selectedCollateral.assignedToName ? ` · Owner: ${selectedCollateral.assignedToName}` : ""}`}
                                </p>
                              </div>

                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Overall Brief</p>
                                <div className="mt-2 border-t border-[#E7EDF8] pt-3 text-sm leading-7 text-[#536482]">
                                  {overallBrief}
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Content Brief</p>
                                <div className="mt-2 border-t border-[#E7EDF8] pt-3 text-sm leading-7 text-[#536482]">
                                  {selectedCollateral.brief || "No collateral-specific brief was added for this item."}
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">
                                  <span>References</span>
                                  <span>{selectedCollateral.referenceFileCount} file{selectedCollateral.referenceFileCount === 1 ? "" : "s"}</span>
                                </div>
                                <div className="mt-2 rounded-2xl border border-[#E4ECFB] bg-white px-4 py-3 text-sm text-[#536482]">
                                  {selectedCollateral.referenceFileCount > 0
                                    ? `${selectedCollateral.referenceFileCount} reference file${selectedCollateral.referenceFileCount === 1 ? " is" : "s are"} attached and available inside the full task workspace.`
                                    : "No reference files attached yet."}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-5">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Specifications</p>
                                <div className="mt-2 space-y-2 border-t border-[#E7EDF8] pt-3 text-sm text-[#536482]">
                                  <div className="flex items-center justify-between gap-4"><span>Platform</span><span className="text-right font-medium text-[#1E2E52]">{selectedCollateral.platform || "Not specified"}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span>Usage</span><span className="text-right font-medium text-[#1E2E52]">{selectedCollateral.usageType || humanize(selectedCollateral.collateralType || "Collateral")}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span>Size</span><span className="text-right font-medium text-[#1E2E52]">{getCollateralSizeSummary(selectedCollateral as Partial<CollateralItem>) || "Not specified"}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span>Orientation</span><span className="text-right font-medium text-[#1E2E52]">{humanize(selectedCollateral.orientation || "portrait")}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span>Priority</span><span className="text-right font-medium text-[#1E2E52]">{humanize(selectedCollateral.priority || "normal")}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span>Owner</span><span className="text-right font-medium text-[#1E2E52]">{selectedCollateral.assignedToName || preview.assignedToName || "Unassigned"}</span></div>
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Delivery</p>
                                <div className="mt-2 space-y-2 border-t border-[#E7EDF8] pt-3 text-sm text-[#536482]">
                                  <div className="flex items-center justify-between gap-4"><span>Deadline</span><span className="text-right font-medium text-[#1E2E52]">{formatDate(selectedCollateral.deadline || preview.deadline)}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span>References</span><span className="text-right font-medium text-[#1E2E52]">{selectedCollateral.referenceFileCount} file{selectedCollateral.referenceFileCount === 1 ? "" : "s"}</span></div>
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Status</p>
                                <div className="mt-2 rounded-full border border-[#C9D7FF] bg-white px-4 py-2 text-sm font-semibold text-[#1E2E52]">
                                  {formatCollateralStatusLabel(selectedCollateral.status)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-[#D7E4FF] px-5 py-10 text-center text-sm text-[#6C7D9F]">
                            No collateral item is available in this preview.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={panelClass}>
                  <div className="border-b border-[#E7EDF8] px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7E8DAB]">Request Overview</p>
                        <h2 className="mt-1 text-[1.35rem] font-semibold text-[#215ABB]">{preview.title}</h2>
                      </div>
                      <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold", badgeTone(preview.status))}>
                        {humanize(preview.status)}
                      </span>
                    </div>
                  </div>
                  <div className="grid border-b border-[#E7EDF8] md:grid-cols-4">
                    <div className="px-5 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Category</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{humanize(preview.category || "General")}</p></div>
                    <div className="border-t border-[#E7EDF8] px-5 py-3.5 md:border-l md:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Priority</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{humanize(preview.urgency || "normal")}</p></div>
                    <div className="border-t border-[#E7EDF8] px-5 py-3.5 md:border-l md:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Delivery Target</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{formatDate(preview.deadline)}</p></div>
                    <div className="border-t border-[#E7EDF8] px-5 py-3.5 md:border-l md:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA7BF]">Requested On</p><p className="mt-1 text-sm font-semibold text-[#1F2F4B]">{formatDate(preview.createdAt)}</p></div>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Description</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#536482]">{overallBrief}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className={cn(panelClass, "p-5")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB]">Access</p>
                <h2 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.03em] text-[#17305D]">
                  {!viewer.isAuthenticated
                    ? "Sign in to continue"
                    : data?.canOpenTask
                      ? "Task access confirmed"
                      : "Signed in with another account"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#5A6C8C]">{accessCopy(viewer, data?.canOpenTask ?? false)}</p>
                <div className="mt-5 space-y-3">
                  <div className="rounded-[20px] border border-[#D9E6FF] bg-white/88 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A99B6]">Viewer</p>
                    <p className="mt-2 text-sm font-semibold text-[#1E2E52]">{viewer.email || "Guest preview"}</p>
                    <p className="mt-1 text-xs text-[#7182A5]">{viewer.role ? humanize(viewer.role) : "Not signed in"}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#D9E6FF] bg-white/88 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A99B6]">Task ID</p>
                    <p className="mt-2 break-all font-mono text-sm font-semibold text-[#1E2E52]">{preview.id}</p>
                    <p className="mt-1 text-xs text-[#7182A5]">
                      {data?.canOpenTask ? `Access mode: ${humanize(viewer.accessMode)}` : "Preview only until the right account signs in."}
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn(panelClass, "p-5")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB]">Delivery Workflow</p>
                    <h3 className="mt-2 text-[1.55rem] font-semibold text-[#17305D]">{WORKFLOW_STEPS[workflowIndex]?.[1] || humanize(preview.status)}</h3>
                    <p className="mt-1 text-sm text-[#6D7D9F]">{WORKFLOW_STEPS[workflowIndex]?.[2] || "Task progress is available inside the main workspace."}</p>
                  </div>
                  <span className="rounded-full border border-[#D7E4FF] bg-white px-3 py-1 text-[11px] font-semibold text-[#4860A8]">
                    Step {workflowIndex + 1} of {WORKFLOW_STEPS.length}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7E8DAB]">
                    <span>Progress</span>
                    <span>{workflowProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E5EBF5]">
                    <div className="h-full rounded-full bg-[#4166D5]" style={{ width: `${workflowProgress}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {preview.assignedToName ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E4FF] bg-white px-3 py-1.5 text-xs text-[#4D628E]">
                      <UserRound className="h-3.5 w-3.5" />
                      {preview.assignedToName}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E4FF] bg-white px-3 py-1.5 text-xs text-[#4D628E]">
                    <Clock3 className="h-3.5 w-3.5" />
                    {relativeTime(preview.updatedAt)}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {WORKFLOW_STEPS.map(([key, label, description], index) => {
                    const isCurrent = index === workflowIndex;
                    const isComplete = index < workflowIndex;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-[20px] border px-4 py-4 transition",
                          isCurrent
                            ? "border-[#9FB8FF] bg-white shadow-[0_18px_34px_-30px_rgba(55,93,189,0.7)]"
                            : isComplete
                              ? "border-emerald-200 bg-emerald-50/80"
                              : "border-[#E2EAF8] bg-white/72"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold", isCurrent ? "border-[#5F87FF] bg-[#3366E8] text-white" : isComplete ? "border-emerald-200 bg-white text-emerald-600" : "border-[#D7E4FF] bg-[#F8FAFF] text-[#7D8FB2]")}>
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#203254]">{label}</p>
                              <p className="mt-1 text-xs leading-5 text-[#7182A5]">{description}</p>
                            </div>
                          </div>
                          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", isCurrent ? "bg-[#EEF4FF] text-[#3A5BC9]" : isComplete ? "bg-white text-emerald-600" : "bg-[#F5F8FF] text-[#8A99B5]")}>
                            {isCurrent ? "Current" : isComplete ? "Done" : `Step ${index + 1}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isCampaign ? (
                  <div className="mt-5 border-t border-[#E5EDF9] pt-5">
                    <div className="rounded-[20px] border border-[#D7E4FF] bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7E8DAB]">Campaign Progress</p>
                          <p className="mt-1 text-sm font-semibold text-[#1E2E52]">{completedCount} / {collaterals.length} collateral items completed</p>
                        </div>
                        <p className="text-sm font-semibold text-[#4860A8]">{collateralProgress}%</p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E5EBF5]">
                        <div className="h-full rounded-full bg-[#4166D5]" style={{ width: `${collateralProgress}%` }} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={cn(panelClass, "p-5")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7E8DAB]">Next Step</p>
                <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.03em] text-[#17305D]">
                  {!viewer.isAuthenticated
                    ? "Sign in with an approved account"
                    : data?.canOpenTask
                      ? "Open the full task workspace"
                      : "Switch to the linked account"}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5A6C8C]">
                  {!viewer.isAuthenticated
                    ? "Use the requester, assigned designer, Design Lead, treasurer, or copied manager account to continue into the full task page."
                    : data?.canOpenTask
                      ? "This assignment can now open in the standard task detail view."
                      : "This account can preview the snapshot, but the full task page requires the account that was assigned or copied on the task."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild className="h-11 rounded-xl px-5">
                    <Link to={!viewer.isAuthenticated ? loginRedirectPath : data?.canOpenTask ? data.openPath : "/dashboard"}>
                      {!viewer.isAuthenticated ? "Sign in to View Task" : data?.canOpenTask ? "View Task" : "Go to Dashboard"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl px-5">
                    <Link to="/">Home</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

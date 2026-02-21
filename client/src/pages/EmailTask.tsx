import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_URL, authFetch } from "@/lib/api";

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

  const loginRedirectPath = useMemo(() => {
    const path = data?.openPath || (data?.taskId ? `/task/${data.taskId}` : "/dashboard");
    return `/login?redirect=${encodeURIComponent(path)}`;
  }, [data?.openPath, data?.taskId]);

  const viewerRole = String(data?.viewer?.role || "").trim().toLowerCase();
  const isAuthorizedRole = viewerRole === "designer" || viewerRole === "treasurer";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F8FF] via-white to-[#EEF4FF] px-4 py-10 text-foreground dark:from-[#0A1530] dark:via-[#0B1A39] dark:to-[#09162E]">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[#D9E6FF] bg-white/92 p-6 shadow-sm dark:border-[#2A3C6B]/70 dark:bg-[#0E1D3A]/88">
        {isLoading ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold">Opening task link...</p>
            <p className="text-sm text-muted-foreground">Please wait.</p>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-lg font-semibold">Task link unavailable</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/login">Go to Login</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Go to Home</Link>
              </Button>
            </div>
          </div>
        ) : data?.preview ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Email Task Preview
              </p>
              <h1 className="text-2xl font-bold">{data.preview.title}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{humanize(data.preview.status)}</Badge>
                {data.preview.category ? (
                  <Badge variant="outline">{humanize(data.preview.category)}</Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-medium">{data.preview.assignedToName || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium">{formatDateTime(data.preview.deadline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Requester</p>
                <p className="font-medium">
                  {data.preview.requesterName || "N/A"}
                  {data.preview.requesterDepartment
                    ? ` (${data.preview.requesterDepartment})`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDateTime(data.preview.updatedAt)}</p>
              </div>
            </div>

            {data.preview.description ? (
              <div>
                <p className="text-xs text-muted-foreground">Summary</p>
                <p className="mt-1 rounded-xl border border-[#D9E6FF] bg-[#F7FAFF] p-3 text-sm dark:border-[#2A3C6B]/70 dark:bg-[#0C1A35]/85">
                  {data.preview.description}
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-dashed border-[#C7D7FF] bg-[#F4F8FF] p-3 text-sm text-muted-foreground dark:border-[#33508A]/65 dark:bg-[#102348]/70">
              {data.viewer?.isAuthenticated ? (
                data.canOpenTask ? (
                  <span>Redirecting to the task...</span>
                ) : (
                  <span>
                    You are signed in
                    {isAuthorizedRole ? "" : " with a role that cannot open this task from email"}.
                    This preview is available, but full task access is restricted.
                  </span>
                )
              ) : (
                <span>
                  You are not signed in. Preview is visible, but full task access is limited to
                  assigned designers, main designers, and treasurer.
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!data.viewer?.isAuthenticated ? (
                <Button asChild>
                  <Link to={loginRedirectPath}>Login to Continue</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/">Home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-lg font-semibold">Task preview unavailable</p>
            <p className="text-sm text-muted-foreground">
              This link did not return any task data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

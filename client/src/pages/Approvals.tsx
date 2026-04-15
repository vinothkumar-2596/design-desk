import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { format } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { mockTasks } from '@/data/mockTasks';
import { API_URL, authFetch } from '@/lib/api';
import { DESIGN_GOVERNANCE_NOTICE_POLICY } from '@/lib/designGovernance';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import { hydrateTask } from '@/lib/taskHydration';

type ApprovalTask = (typeof mockTasks)[number];

type ApprovalCardProps = {
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  processing: boolean;
  requestId: string;
  staffUpdate: string;
  summary: string;
  task: ApprovalTask;
};

const colors = {
  pageBg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  title: '#111827',
  body: '#4B5563',
  muted: '#6B7280',
  label: '#94A3B8',
  subtleBg: '#F8FAFC',
  subtleBorder: '#EEF2F7',
  primary: '#4355C6',
  primaryHover: '#3949AB',
  reject: '#CC4B4B',
  rejectHover: '#B42323',
};

function formatDateLabel(value: Date | string | undefined) {
  if (!value) return { date: 'Unknown date', time: '' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: 'Unknown date', time: '' };
  }
  return {
    date: format(parsed, 'MMM d, yyyy'),
    time: format(parsed, 'h:mm a'),
  };
}

function getRequesterInitials(name?: string) {
  return (
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'AP'
  );
}

function formatRequestId(task: ApprovalTask) {
  const rawId = String(task.id || (task as { _id?: string })._id || '').trim();
  if (!rawId) return 'Request ID unavailable';
  return `Request ID ${rawId}`;
}

function ApprovalCard({
  task,
  summary,
  requestId,
  staffUpdate,
  processing,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const submitted = formatDateLabel(task.createdAt);
  const title =
    String(task.title || '').replace(/\s+/g, ' ').trim() || 'Untitled request';

  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '14px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03), 0 8px 24px rgba(15, 23, 42, 0.04)',
        height: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: '#D1D5DB',
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)',
        },
      }}
    >
      <Stack spacing={1.75} sx={{ height: '100%', p: { xs: 2.25, md: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Chip
            label="Awaiting Approval"
            size="small"
            sx={{
              height: 28,
              borderRadius: '999px',
              bgcolor: '#F8FAFC',
              border: `1px solid ${colors.border}`,
              color: '#334155',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              '& .MuiChip-label': {
                px: 1.5,
              },
            }}
          />

          <Box sx={{ flexShrink: 0, textAlign: 'right', pt: 0.25 }}>
            <Typography
              sx={{
                color: colors.muted,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {submitted.date}
            </Typography>
            <Typography
              sx={{
                color: colors.label,
                fontSize: 12,
                lineHeight: 1.3,
                mt: 0.25,
              }}
            >
              {submitted.time}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: colors.title,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </Typography>

          <Typography
            sx={{
              color: colors.muted,
              fontSize: 13,
              lineHeight: 1.55,
              mt: 0.5,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {summary}
          </Typography>

          <Typography
            sx={{
              color: colors.label,
              fontSize: 12,
              lineHeight: 1.45,
              mt: 0.75,
              overflowWrap: 'anywhere',
            }}
          >
            {requestId}
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{
            minWidth: 0,
          }}
        >
          <Avatar
            sx={{
              width: 30,
              height: 30,
              bgcolor: '#E5E7EB',
              color: '#374151',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {getRequesterInitials(task.requesterName)}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                color: colors.title,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.35,
              }}
            >
              {task.requesterName || 'Unknown requester'}
            </Typography>
            <Typography
              sx={{
                color: colors.muted,
                fontSize: 12,
                lineHeight: 1.35,
                mt: 0.25,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              <span>Submitted</span>
              <span>&bull;</span>
              <span>{submitted.date}</span>
              {submitted.time ? (
                <>
                  <span>&bull;</span>
                  <span>{submitted.time}</span>
                </>
              ) : null}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            borderRadius: '10px',
            bgcolor: colors.subtleBg,
            border: `1px solid ${colors.subtleBorder}`,
            px: 1.5,
            py: 1.25,
          }}
        >
          <Typography
            sx={{
              color: colors.label,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            Staff Update
          </Typography>
          <Typography
            sx={{
              color: colors.body,
              fontSize: 13,
              lineHeight: 1.5,
              mt: 0.75,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {staffUpdate || 'No staff update provided for this approval request.'}
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 'auto',
            pt: 1.5,
            borderTop: `1px solid #F3F4F6`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Button
              variant="contained"
              disableElevation
              startIcon={<CheckCircleOutlineRoundedIcon />}
              onClick={() => onApprove(task.id)}
              disabled={processing}
              sx={{
                minHeight: 36,
                px: 1.75,
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 600,
                bgcolor: colors.primary,
                '&:hover': {
                  bgcolor: colors.primaryHover,
                },
              }}
            >
              {processing ? 'Processing...' : 'Approve'}
            </Button>

            <Button
              variant="text"
              startIcon={<RemoveCircleOutlineRoundedIcon />}
              onClick={() => onReject(task.id)}
              disabled={processing}
              sx={{
                minHeight: 36,
                px: 0.5,
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 600,
                color: colors.reject,
                '&:hover': {
                  bgcolor: '#FEF2F2',
                  color: colors.rejectHover,
                },
              }}
            >
              Reject
            </Button>
          </Stack>

          <Button
            variant="outlined"
            component={RouterLink}
            to={`/task/${task.id}`}
            state={{ task, focusSection: 'change-history' }}
            startIcon={<VisibilityOutlinedIcon />}
            sx={{
              minHeight: 36,
              px: 1.75,
              borderRadius: '10px',
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 600,
              color: '#334155',
              borderColor: '#D1D5DB',
              '&:hover': {
                borderColor: '#9CA3AF',
                bgcolor: '#F8FAFC',
              },
            }}
          >
            Review Details
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

export default function Approvals() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ApprovalTask[]>(API_URL ? [] : mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = API_URL;

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        const hydrated = data.map((task: any) =>
          hydrateTask({ ...task, id: task.id || task._id })
        );
        setTasks(hydrated);
      } catch (error) {
        toast.error('Failed to load approvals');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  const pendingApprovals = useMemo(
    () => tasks.filter((task) => task.approvalStatus === 'pending'),
    [tasks]
  );

  useEffect(() => {
    setScopeLabel('Approvals');
    setItems(buildSearchItemsFromTasks(pendingApprovals));
  }, [pendingApprovals, setItems, setScopeLabel]);

  const filteredApprovals = useMemo(
    () =>
      pendingApprovals.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.requesterDepartment,
          task.category,
          task.status,
        ])
      ),
    [pendingApprovals, query]
  );

  const getStaffUpdatePreview = (task: ApprovalTask) => {
    const history = [...(task.changeHistory || [])].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    for (const entry of history) {
      if (entry.userRole !== 'staff') continue;
      if (entry.field === 'approval_status') continue;
      if (entry.field === 'staff_note' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.field === 'description' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.note) {
        return entry.note;
      }
      if (entry.newValue) {
        return entry.newValue;
      }
    }
    return '';
  };

  const getRequestSummary = (task: ApprovalTask) => {
    const title = String(task.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const description = String(task.description || '').replace(/\s+/g, ' ').trim();
    if (!description) return 'No additional request details were provided.';
    if (description.toLowerCase() === title) {
      return 'Details were not added beyond the request title.';
    }
    return description;
  };

  const updateApprovalStatus = async (
    taskId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    const oldValue = currentTask?.approvalStatus ?? 'pending';
    const newValue = decision === 'approved' ? 'Approved' : 'Rejected';
    const approvalNote = `Approval ${decision} by ${user?.name || 'Treasurer'}`;

    if (apiUrl) {
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            approvalStatus: decision,
            approvedBy: user?.name || '',
            approvalDate: new Date(),
          },
          changes: [
            {
              type: 'status',
              field: 'approval_status',
              oldValue,
              newValue,
              note: approvalNote,
            },
          ],
          userId: user?.id || '',
          userName: user?.name || '',
          userRole: user?.role || '',
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to update approval');
      }
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              approvalStatus: decision,
              approvedBy: user?.name || '',
              approvalDate: new Date(),
              updatedAt: new Date(),
              changeHistory: [
                {
                  id: `ch-${Date.now()}-0`,
                  type: 'status',
                  field: 'approval_status',
                  oldValue,
                  newValue,
                  note: approvalNote,
                  userId: user?.id || '',
                  userName: user?.name || 'Treasurer',
                  userRole: user?.role || 'treasurer',
                  createdAt: new Date(),
                },
                ...(task.changeHistory || []),
              ],
            }
          : task
      )
    );
  };

  const handleApprove = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await updateApprovalStatus(taskId, 'approved');
      toast.success('Request approved', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to approve request';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await updateApprovalStatus(taskId, 'rejected');
      toast.success('Request rejected', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to reject request';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ bgcolor: colors.pageBg, minHeight: '100%', py: { xs: 3, md: 4 } }}>
        <Container
          maxWidth={false}
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            px: { xs: 2, md: 3 },
          }}
        >
          <Stack spacing={2.5}>
            <Box>
              <Typography
                sx={{
                  color: colors.title,
                  fontSize: { xs: 28, md: 30 },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                }}
              >
                Pending Approvals
              </Typography>
              <Typography
                sx={{
                  color: colors.muted,
                  fontSize: 14,
                  mt: 0.75,
                }}
              >
                Compact review queue for incoming staff requests and approval actions.
              </Typography>
            </Box>

            <Card
              elevation={0}
              sx={{
                bgcolor: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: '14px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ px: 2.25, py: 1.75 }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '10px',
                      bgcolor: colors.subtleBg,
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.muted,
                      flexShrink: 0,
                    }}
                  >
                    <ErrorOutlineRoundedIcon sx={{ fontSize: 18 }} />
                  </Box>

                  <Box>
                    <Typography sx={{ color: colors.title, fontSize: 14, fontWeight: 600 }}>
                      Approval Guidelines
                    </Typography>
                    <Typography sx={{ color: colors.muted, fontSize: 13, lineHeight: 1.55, mt: 0.5 }}>
                      {DESIGN_GOVERNANCE_NOTICE_POLICY}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
                  <Typography sx={{ color: colors.label, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Queue Size
                  </Typography>
                  <Typography sx={{ color: colors.title, fontSize: 18, fontWeight: 600, mt: 0.25 }}>
                    {filteredApprovals.length}
                  </Typography>
                </Box>
              </Stack>
            </Card>

            {isLoading ? (
              <Card
                elevation={0}
                sx={{
                  bgcolor: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '14px',
                  py: 8,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ color: colors.muted, fontSize: 14 }}>
                  Loading approvals...
                </Typography>
              </Card>
            ) : filteredApprovals.length > 0 ? (
              <Grid container spacing={2}>
                {filteredApprovals.map((task) => (
                  <Grid key={task.id} item xs={12} md={6}>
                    <ApprovalCard
                      task={task}
                      summary={getRequestSummary(task)}
                      requestId={formatRequestId(task)}
                      staffUpdate={getStaffUpdatePreview(task)}
                      processing={processingId === task.id}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Card
                elevation={0}
                sx={{
                  bgcolor: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '14px',
                  py: 8,
                  px: 3,
                  textAlign: 'center',
                }}
              >
                <TaskAltRoundedIcon sx={{ fontSize: 40, color: colors.label, mb: 1.5 }} />
                <Typography sx={{ color: colors.title, fontSize: 18, fontWeight: 600 }}>
                  All caught up
                </Typography>
                <Typography sx={{ color: colors.muted, fontSize: 14, mt: 0.75 }}>
                  No pending approvals are waiting for review right now.
                </Typography>
              </Card>
            )}
          </Stack>
        </Container>
      </Box>
    </DashboardLayout>
  );
}

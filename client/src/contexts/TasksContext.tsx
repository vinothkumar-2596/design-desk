import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { API_URL, authFetch } from '@/lib/api';
import { mockTasks } from '@/data/mockTasks';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { hydrateTask, mergeViewerReadAt } from '@/lib/taskHydration';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/types';

type TasksContextValue = {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refreshTasks: () => Promise<void>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
};

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

const getLocalTasks = (): Task[] => {
  if (typeof window === 'undefined') return mockTasks;
  return mergeLocalTasks(mockTasks);
};

export function TasksProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const apiUrl = API_URL;
  const [tasks, setTasks] = useState<Task[]>(apiUrl ? [] : getLocalTasks());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    if (!apiUrl) {
      setTasks(getLocalTasks());
      setError(null);
      return;
    }
    if (!isAuthenticated) {
      setTasks([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${apiUrl}/api/tasks`);
      if (response.status === 401) {
        setTasks([]);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load tasks');
      }
      const data = await response.json();
      const hydrated = Array.isArray(data) ? data.map(hydrateTask) : [];
      setTasks(hydrated);
    } catch (err) {
      setTasks([]);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, isAuthenticated]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    if (!apiUrl) return;
    const handleNewRequest = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const id = payload.id || payload._id;
      if (!id) return;
      setTasks((prev) => {
        if (prev.some((task) => (task.id || task._id) === id)) {
          return prev;
        }
        const hydrated = hydrateTask({ ...payload, id });
        return [hydrated, ...prev];
      });
    };
    const handleTaskUpdated = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const id = payload.id || payload._id;
      if (!id) return;
      setTasks((prev) => {
        const index = prev.findIndex((task) => (task.id || task._id) === id);
        if (index === -1) return prev;
        const previousTask = prev[index];
        const hydrated = hydrateTask({
          ...payload,
          id,
          viewerReadAt: mergeViewerReadAt(payload, previousTask.viewerReadAt),
        });
        const next = [...prev];
        next[index] = hydrated;
        return next;
      });
    };
    window.addEventListener('designhub:request:new', handleNewRequest);
    window.addEventListener('designhub:task:updated', handleTaskUpdated);
    return () => {
      window.removeEventListener('designhub:request:new', handleNewRequest);
      window.removeEventListener('designhub:task:updated', handleTaskUpdated);
    };
  }, [apiUrl]);

  const value = useMemo(
    () => ({
      tasks,
      isLoading,
      error,
      refreshTasks,
      setTasks,
    }),
    [tasks, isLoading, error, refreshTasks]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export const useTasksContext = () => {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasksContext must be used within TasksProvider');
  }
  return context;
};

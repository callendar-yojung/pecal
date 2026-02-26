import { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';
import { clearWidgetData, syncWidgetData } from '../lib/widget-bridge';
import { apiFetch } from '../lib/api';
import type { TaskItem } from '../lib/types';

type MobileAppContextValue = {
  auth: ReturnType<typeof useAuth>;
  data: ReturnType<typeof useDashboardData>;
};

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const data = useDashboardData(auth.session);

  useEffect(() => {
    void auth.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth.session) return;
    void data.loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);

  useEffect(() => {
    if (!data.selectedWorkspace) return;
    void data.loadDashboard(data.selectedWorkspace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.selectedWorkspaceId]);

  useEffect(() => {
    if (!auth.session) {
      void clearWidgetData();
      return;
    }
    if (!data.selectedWorkspace) return;
    const session = auth.session;
    const selectedWorkspace = data.selectedWorkspace;
    void (async () => {
      let tasksForWidget: TaskItem[] = data.tasks;
      if (!tasksForWidget.length) {
        try {
          const res = await apiFetch<{ tasks?: TaskItem[] }>(
            `/api/tasks?workspace_id=${selectedWorkspace.workspace_id}&limit=200&sort_by=start_time&sort_order=ASC`,
            session
          );
          tasksForWidget = res.tasks ?? [];
        } catch {
          // Keep existing tasks array on fetch failure.
        }
      }

      await syncWidgetData({
        tasks: tasksForWidget,
        workspaceName: selectedWorkspace.name,
        nickname: session.nickname,
        maxItems: 180,
      });
    })();
  }, [auth.session, data.selectedWorkspace, data.tasks]);

  const value = useMemo<MobileAppContextValue>(() => ({ auth, data }), [auth, data]);

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp() {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp must be used within MobileAppProvider');
  return ctx;
}

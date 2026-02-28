import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';
import { clearWidgetData, syncWidgetData } from '../lib/widget-bridge';
import { apiFetch } from '../lib/api';
import { registerDevicePushToken } from '../lib/push-notifications';
import type { TaskItem } from '../lib/types';

type MobileAppContextValue = {
  auth: ReturnType<typeof useAuth>;
  data: ReturnType<typeof useDashboardData>;
};

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const data = useDashboardData(auth.session);
  const pushRegisteredMemberRef = useRef<number | null>(null);

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
    if (!auth.session) {
      pushRegisteredMemberRef.current = null;
      return;
    }
    if (pushRegisteredMemberRef.current === auth.session.memberId) return;
    const session = auth.session;
    void (async () => {
      try {
        await registerDevicePushToken(session);
        pushRegisteredMemberRef.current = session.memberId;
      } catch (error) {
        console.warn('[mobile] push token register failed:', error);
      }
    })();
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
    if (data.dashboardLoading) return;
    const session = auth.session;
    const selectedWorkspace = data.selectedWorkspace;
    void (async () => {
      const maxItems = 180;
      const allWorkspaces = [
        ...data.workspaces,
        ...data.teamWorkspaces.map((workspace) => ({
          workspace_id: workspace.workspace_id,
          name: workspace.name,
        })),
      ].reduce<Array<{ workspace_id: number; name: string }>>((acc, workspace) => {
        if (acc.some((item) => item.workspace_id === workspace.workspace_id)) return acc;
        acc.push(workspace);
        return acc;
      }, []);
      if (!allWorkspaces.some((workspace) => workspace.workspace_id === selectedWorkspace.workspace_id)) {
        allWorkspaces.unshift({
          workspace_id: selectedWorkspace.workspace_id,
          name: selectedWorkspace.name,
        });
      }
      const workspaceTasksMap = new Map<number, TaskItem[]>();

      workspaceTasksMap.set(selectedWorkspace.workspace_id, data.tasks);

      await Promise.all(
        allWorkspaces.map(async (workspace) => {
          if (workspace.workspace_id === selectedWorkspace.workspace_id) return;
          try {
            const res = await apiFetch<{ tasks?: TaskItem[] }>(
              `/api/tasks?workspace_id=${workspace.workspace_id}&limit=200&sort_by=start_time&sort_order=ASC`,
              session
            );
            workspaceTasksMap.set(workspace.workspace_id, res.tasks ?? []);
          } catch {
            workspaceTasksMap.set(workspace.workspace_id, []);
          }
        })
      );

      await syncWidgetData({
        tasks: workspaceTasksMap.get(selectedWorkspace.workspace_id) ?? [],
        workspaceName: selectedWorkspace.name,
        nickname: session.nickname,
        maxItems,
        workspaces: allWorkspaces.map((workspace) => ({
          workspaceId: workspace.workspace_id,
          workspaceName: workspace.name,
          tasks: workspaceTasksMap.get(workspace.workspace_id) ?? [],
        })),
      });
    })();
  }, [auth.session, data.selectedWorkspace, data.tasks, data.workspaces, data.teamWorkspaces, data.dashboardLoading]);

  const value = useMemo<MobileAppContextValue>(() => ({ auth, data }), [auth, data]);

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp() {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp must be used within MobileAppProvider');
  return ctx;
}

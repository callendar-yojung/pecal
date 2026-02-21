import { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';

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

  const value = useMemo<MobileAppContextValue>(() => ({ auth, data }), [auth, data]);

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp() {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp must be used within MobileAppProvider');
  return ctx;
}

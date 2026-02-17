"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Workspace {
  workspace_id: number;
  type: "team" | "personal";
  name: string;
  owner_id: number;
  memberCount?: number;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 초기 워크스페이스 로드
    const loadInitialWorkspace = async () => {
      try {
        const response = await fetch('/api/me/workspaces');
        const data = await response.json();

        if (data.workspaces && data.workspaces.length > 0) {
          // localStorage에서 마지막 선택한 워크스페이스 확인
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');

          if (savedWorkspaceId) {
            const saved = data.workspaces.find(
              (w: Workspace) => w.workspace_id === Number(savedWorkspaceId)
            );
            if (saved) {
              setCurrentWorkspace(saved);
              setIsLoading(false);
              return;
            }
          }

          // 없으면 첫 번째 워크스페이스 선택
          setCurrentWorkspace(data.workspaces[0]);
        }
      } catch (error) {
        console.error("Failed to load workspace:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialWorkspace();
  }, []);

  const handleSetWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', String(workspace.workspace_id));
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        setCurrentWorkspace: handleSetWorkspace,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}


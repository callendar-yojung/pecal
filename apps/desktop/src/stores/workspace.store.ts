import { create } from 'zustand'
import type { Mode, Workspace, Team } from '../types'

// localStorage key for workspace order
const getOrderKey = (mode: Mode, teamId: number | null) =>
  mode === 'PERSONAL' ? 'ws_order_personal' : `ws_order_team_${teamId}`

const TEAM_ORDER_KEY = 'team_order'

const loadOrder = (mode: Mode, teamId: number | null): number[] => {
  try {
    const raw = localStorage.getItem(getOrderKey(mode, teamId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

const saveOrder = (mode: Mode, teamId: number | null, ids: number[]) => {
  localStorage.setItem(getOrderKey(mode, teamId), JSON.stringify(ids))
}

const loadTeamOrder = (): number[] => {
  try {
    const raw = localStorage.getItem(TEAM_ORDER_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveTeamOrder = (ids: number[]) => {
  localStorage.setItem(TEAM_ORDER_KEY, JSON.stringify(ids))
}

const applySavedOrder = (workspaces: Workspace[], mode: Mode, teamId: number | null): Workspace[] => {
  const savedIds = loadOrder(mode, teamId)
  if (savedIds.length === 0) return workspaces

  const wsMap = new Map(workspaces.map(ws => [ws.workspace_id, ws]))
  const ordered: Workspace[] = []

  // Add workspaces in saved order
  for (const id of savedIds) {
    const ws = wsMap.get(id)
    if (ws) {
      ordered.push(ws)
      wsMap.delete(id)
    }
  }
  // Append any new workspaces not in saved order
  for (const ws of wsMap.values()) {
    ordered.push(ws)
  }
  return ordered
}

const applySavedTeamOrder = (teams: Team[]): Team[] => {
  const savedIds = loadTeamOrder()
  if (savedIds.length === 0) return teams

  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const ordered: Team[] = []

  for (const id of savedIds) {
    const team = teamMap.get(id)
    if (team) {
      ordered.push(team)
      teamMap.delete(id)
    }
  }

  for (const team of teamMap.values()) {
    ordered.push(team)
  }

  return ordered
}

interface WorkspaceState {
  currentMode: Mode
  selectedTeamId: number | null
  teams: Team[]
  workspaces: Workspace[]
  selectedWorkspaceId: number | null
  isLoading: boolean
  error: string | null
  isDropdownOpen: boolean

  setMode: (mode: Mode, teamId?: number | null) => void
  setTeams: (teams: Team[]) => void
  moveTeam: (teamId: number, direction: 'up' | 'down') => void
  setWorkspaces: (workspaces: Workspace[]) => void
  selectWorkspace: (workspaceId: number | null) => void
  addWorkspace: (workspace: Workspace) => void
  updateWorkspaceInStore: (workspaceId: number, name: string) => void
  removeWorkspace: (workspaceId: number) => void
  moveWorkspace: (workspaceId: number, direction: 'up' | 'down') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  toggleDropdown: () => void
  closeDropdown: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentMode: 'PERSONAL',
  selectedTeamId: null,
  teams: [],
  workspaces: [],
  selectedWorkspaceId: null,
  isLoading: false,
  error: null,
  isDropdownOpen: false,

  setMode: (mode, teamId = null) =>
    set({
      currentMode: mode,
      selectedTeamId: mode === 'PERSONAL' ? null : teamId,
      selectedWorkspaceId: null,
      workspaces: [], // 워크스페이스 목록 초기화
      isDropdownOpen: false,
    }),
  setTeams: (teams) =>
    set(() => {
      const ordered = applySavedTeamOrder(teams)
      return { teams: ordered }
    }),

  moveTeam: (teamId, direction) =>
    set((state) => {
      const idx = state.teams.findIndex((team) => team.id === teamId)
      if (idx === -1) return state

      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= state.teams.length) return state

      const newList = [...state.teams]
      ;[newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]]
      saveTeamOrder(newList.map((team) => team.id))

      return {
        teams: newList,
        selectedTeamId: state.selectedTeamId,
      }
    }),

  setWorkspaces: (workspaces) =>
      set((state) => {
        const ordered = applySavedOrder(workspaces, state.currentMode, state.selectedTeamId)
        // 현재 선택이 새 목록에 있으면 유지, 아니면 첫 번째 자동 선택
        const stillExists = state.selectedWorkspaceId != null
          && ordered.some((ws) => ws.workspace_id === state.selectedWorkspaceId)
        const selectedWorkspaceId = stillExists
          ? state.selectedWorkspaceId
          : ordered.length > 0 ? ordered[0].workspace_id : null
        return { workspaces: ordered, selectedWorkspaceId }
      }),

  selectWorkspace: (workspaceId) => set({ selectedWorkspaceId: workspaceId }),
  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [...state.workspaces, workspace] })),
  updateWorkspaceInStore: (workspaceId, name) =>
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.workspace_id === workspaceId ? { ...ws, name } : ws
      ),
    })),
  removeWorkspace: (workspaceId) =>
    set((state) => ({
      workspaces: state.workspaces.filter((ws) => ws.workspace_id !== workspaceId),
      selectedWorkspaceId:
        state.selectedWorkspaceId === workspaceId ? null : state.selectedWorkspaceId,
    })),
  moveWorkspace: (workspaceId, direction) =>
    set((state) => {
      const idx = state.workspaces.findIndex((ws) => ws.workspace_id === workspaceId)
      if (idx === -1) return state
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= state.workspaces.length) return state

      const newList = [...state.workspaces]
      ;[newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]]

      // Persist order
      saveOrder(state.currentMode, state.selectedTeamId, newList.map(ws => ws.workspace_id))

      return { workspaces: newList }
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  toggleDropdown: () => set((state) => ({ isDropdownOpen: !state.isDropdownOpen })),
  closeDropdown: () => set({ isDropdownOpen: false }),
}))

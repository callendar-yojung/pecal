import { create } from 'zustand'
import type { Task } from '../types'

export type ViewType =
  | 'overview'
  | 'calendar'
  | 'tasks'
  | 'files'
  | 'memo'
  | 'task_create'
  | 'team_manage'
  | 'task_detail'
  | 'task_export'

interface ViewState {
  activeView: ViewType
  previousView: ViewType | null
  createTaskDate: Date | null
  detailTask: Task | null
  exportTask: Task | null
  setView: (view: ViewType) => void
  openTaskCreate: (date: Date) => void
  closeTaskCreate: () => void
  openTaskExport: (task: Task) => void
  closeTaskExport: () => void
  openTaskDetail: (task: Task) => void
  closeTaskDetail: () => void
}

export const useViewStore = create<ViewState>((set) => ({
  activeView: 'overview',
  previousView: null,
  createTaskDate: null,
  detailTask: null,
  exportTask: null,
  setView: (activeView) =>
    set({
      activeView,
      previousView: null,
      detailTask: null,
      exportTask: null,
    }),
  openTaskCreate: (date) =>
    set({ activeView: 'task_create', previousView: 'overview', createTaskDate: date }),
  closeTaskCreate: () => set({ activeView: 'overview', previousView: null, createTaskDate: null }),
  openTaskExport: (task) =>
    set((state) => ({
      previousView: state.activeView,
      activeView: 'task_export',
      exportTask: task,
    })),
  closeTaskExport: () =>
    set((state) => ({
      activeView: state.previousView ?? 'overview',
      previousView: null,
      exportTask: null,
    })),
  openTaskDetail: (task) =>
    set((state) => ({
      previousView: state.activeView,
      activeView: 'task_detail',
      detailTask: task,
    })),
  closeTaskDetail: () =>
    set((state) => ({
      activeView: state.previousView ?? 'overview',
      previousView: null,
      detailTask: null,
    })),
}))

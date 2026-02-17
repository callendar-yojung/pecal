import { create } from 'zustand'
import type { ModalType, Task } from '../types'

interface ModalState {
  openedModal: ModalType
  selectedEvent: Task | null
  createDate: Date | null

  openDetailModal: (event: Task) => void
  openEditModal: (event: Task) => void
  openCreateModal: (date: Date) => void
  openTeamCreateModal: () => void
  openSettingsModal: () => void
  openNotificationsModal: () => void
  openAlarmHistoryModal: () => void
  closeModal: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  openedModal: null,
  selectedEvent: null,
  createDate: null,

  openDetailModal: (event) =>
    set({ openedModal: 'DETAIL', selectedEvent: event, createDate: null }),
  openEditModal: (event) =>
    set({ openedModal: 'EDIT', selectedEvent: event, createDate: null }),
  openCreateModal: (date) =>
    set({ openedModal: 'CREATE', selectedEvent: null, createDate: date }),
  openTeamCreateModal: () =>
    set({ openedModal: 'TEAM_CREATE', selectedEvent: null, createDate: null }),
  openSettingsModal: () =>
    set({ openedModal: 'SETTINGS', selectedEvent: null, createDate: null }),
  openNotificationsModal: () =>
    set({ openedModal: 'NOTIFICATIONS', selectedEvent: null, createDate: null }),
  openAlarmHistoryModal: () =>
    set({ openedModal: 'ALARM_HISTORY', selectedEvent: null, createDate: null }),
  closeModal: () =>
    set({ openedModal: null, selectedEvent: null, createDate: null }),
}))

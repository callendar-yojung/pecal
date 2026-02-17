import { create } from 'zustand'
import type { Task } from '../types'

interface CalendarState {
  events: Task[]
  selectedDate: Date
  isLoading: boolean
  error: string | null

  setEvents: (events: Task[]) => void
  setSelectedDate: (date: Date) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearEvents: () => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
  events: [],
  selectedDate: new Date(),
  isLoading: false,
  error: null,

  setEvents: (events) => set({ events }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearEvents: () => set({ events: [] }),
}))
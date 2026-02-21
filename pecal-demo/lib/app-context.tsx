import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User, Workspace, Tag, Schedule, Memo, AppFile, AppNotification,
  AuthProvider, MemoSortOrder, FileFilter,
} from './types';
import {
  SEED_WORKSPACES, SEED_TAGS, SEED_SCHEDULES, SEED_MEMOS, SEED_FILES, SEED_NOTIFICATIONS,
} from './seed-data';

const STORAGE_KEY = 'pecal_app_state_v1';

// ─── State ────────────────────────────────────────────────────────────────────
interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  // Workspace
  workspaces: Workspace[];
  currentWorkspaceId: string;
  // Data
  tags: Tag[];
  schedules: Schedule[];
  memos: Memo[];
  files: AppFile[];
  notifications: AppNotification[];
  // UI
  notificationPanelOpen: boolean;
  memoSortOrder: MemoSortOrder;
  fileFilter: FileFilter;
}

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  workspaces: SEED_WORKSPACES,
  currentWorkspaceId: 'ws-personal',
  tags: SEED_TAGS,
  schedules: SEED_SCHEDULES,
  memos: SEED_MEMOS,
  files: SEED_FILES,
  notifications: SEED_NOTIFICATIONS,
  notificationPanelOpen: false,
  memoSortOrder: 'latest',
  fileFilter: 'all',
};

// ─── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_WORKSPACE'; payload: string }
  | { type: 'ADD_WORKSPACE'; payload: Workspace }
  | { type: 'ADD_TAG'; payload: Tag }
  | { type: 'UPDATE_TAG'; payload: Tag }
  | { type: 'DELETE_TAG'; payload: string }
  | { type: 'ADD_SCHEDULE'; payload: Schedule }
  | { type: 'UPDATE_SCHEDULE'; payload: Schedule }
  | { type: 'DELETE_SCHEDULE'; payload: string }
  | { type: 'ADD_MEMO'; payload: Memo }
  | { type: 'UPDATE_MEMO'; payload: Memo }
  | { type: 'DELETE_MEMO'; payload: string }
  | { type: 'TOGGLE_MEMO_FAVORITE'; payload: string }
  | { type: 'ADD_FILE'; payload: AppFile }
  | { type: 'DELETE_FILES'; payload: string[] }
  | { type: 'ADD_NOTIFICATION'; payload: AppNotification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'TOGGLE_NOTIFICATION_PANEL' }
  | { type: 'SET_MEMO_SORT'; payload: MemoSortOrder }
  | { type: 'SET_FILE_FILTER'; payload: FileFilter }
  | { type: 'HYDRATE'; payload: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false };
    case 'SET_WORKSPACE':
      return { ...state, currentWorkspaceId: action.payload };
    case 'ADD_WORKSPACE':
      return { ...state, workspaces: [...state.workspaces, action.payload] };
    case 'ADD_TAG':
      return { ...state, tags: [...state.tags, action.payload] };
    case 'UPDATE_TAG':
      return { ...state, tags: state.tags.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TAG':
      return { ...state, tags: state.tags.filter(t => t.id !== action.payload) };
    case 'ADD_SCHEDULE':
      return { ...state, schedules: [action.payload, ...state.schedules] };
    case 'UPDATE_SCHEDULE':
      return { ...state, schedules: state.schedules.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SCHEDULE':
      return { ...state, schedules: state.schedules.filter(s => s.id !== action.payload) };
    case 'ADD_MEMO':
      return { ...state, memos: [action.payload, ...state.memos] };
    case 'UPDATE_MEMO':
      return { ...state, memos: state.memos.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MEMO':
      return { ...state, memos: state.memos.filter(m => m.id !== action.payload) };
    case 'TOGGLE_MEMO_FAVORITE':
      return {
        ...state,
        memos: state.memos.map(m =>
          m.id === action.payload ? { ...m, isFavorite: !m.isFavorite, updatedAt: new Date().toISOString() } : m
        ),
      };
    case 'ADD_FILE':
      return { ...state, files: [action.payload, ...state.files] };
    case 'DELETE_FILES':
      return { ...state, files: state.files.filter(f => !action.payload.includes(f.id)) };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, isRead: true } : n
        ),
      };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, isRead: true })) };
    case 'TOGGLE_NOTIFICATION_PANEL':
      return { ...state, notificationPanelOpen: !state.notificationPanelOpen };
    case 'SET_MEMO_SORT':
      return { ...state, memoSortOrder: action.payload };
    case 'SET_FILE_FILTER':
      return { ...state, fileFilter: action.payload };
    case 'HYDRATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // Convenience selectors
  currentWorkspace: Workspace | undefined;
  workspaceTags: Tag[];
  workspaceSchedules: Schedule[];
  workspaceMemos: Memo[];
  workspaceFiles: AppFile[];
  workspaceNotifications: AppNotification[];
  unreadCount: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<AppState>;
          dispatch({ type: 'HYDRATE', payload: saved });
        } catch {
          // ignore parse errors
        }
      }
    });
  }, []);

  // Persist to AsyncStorage on state changes (debounced via effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      const toSave: Partial<AppState> = {
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        workspaces: state.workspaces,
        currentWorkspaceId: state.currentWorkspaceId,
        tags: state.tags,
        schedules: state.schedules,
        memos: state.memos,
        files: state.files,
        notifications: state.notifications,
        memoSortOrder: state.memoSortOrder,
        fileFilter: state.fileFilter,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const currentWorkspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  const workspaceTags = state.tags.filter(t => t.workspaceId === state.currentWorkspaceId);
  const workspaceSchedules = state.schedules.filter(s => s.workspaceId === state.currentWorkspaceId);
  const workspaceMemos = state.memos.filter(m => m.workspaceId === state.currentWorkspaceId);
  const workspaceFiles = state.files.filter(f => f.workspaceId === state.currentWorkspaceId);
  const workspaceNotifications = state.notifications.filter(n => n.workspaceId === state.currentWorkspaceId);
  const unreadCount = workspaceNotifications.filter(n => !n.isRead).length;

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      currentWorkspace,
      workspaceTags,
      workspaceSchedules,
      workspaceMemos,
      workspaceFiles,
      workspaceNotifications,
      unreadCount,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ─── Helper: generate ID ──────────────────────────────────────────────────────
export function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

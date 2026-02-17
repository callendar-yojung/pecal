import { apiClient } from './client'
import type {
  NotificationUnreadCountResponse,
  NotificationsResponse,
} from '../types'

export const notificationsApi = {
  getUnreadCount: () =>
    apiClient.get<NotificationUnreadCountResponse>('/api/notifications/unread'),

  getNotifications: (limit = 20) =>
    apiClient.get<NotificationsResponse>(`/api/notifications?limit=${limit}`),

  markRead: (notificationId: number) =>
    apiClient.patch<{ success: boolean }>(`/api/notifications/${notificationId}`),

  deleteOne: (notificationId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/notifications/${notificationId}`),

  clearAll: () =>
    apiClient.delete<{ deleted: number }>('/api/notifications/clear'),

  respondInvitation: (invitationId: number, action: 'accept' | 'decline') =>
    apiClient.patch<{ success: boolean }>(`/api/invitations/${invitationId}`, { action }),
}


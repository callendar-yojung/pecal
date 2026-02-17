import { apiClient } from './client'
import type { SubscriptionResponse } from '../types'

export const subscriptionApi = {
  getSubscription: () =>
    apiClient.get<SubscriptionResponse>('/api/me/subscription'),
}

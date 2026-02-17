import { useEffect, useMemo, useState } from 'react'
import { open } from '@tauri-apps/plugin-shell'
import { useTranslation } from 'react-i18next'
import { apiClient } from '../../api'
import { useAuthStore, useWorkspaceStore } from '../../stores'

type OwnerType = 'personal' | 'team'

interface Plan {
  id: number
  name: string
  price: number
  max_members: number
  max_storage_mb: number
  plan_type?: OwnerType
}

interface Subscription {
  id: number
  owner_id: number
  owner_type: OwnerType
  plan_id: number
  status: string
  started_at: string
  next_payment_date?: string | null
  plan_name?: string
  plan_price?: number
}

interface SavedCard {
  id: number
  cardCode: string
  cardName: string
  cardNoMasked: string
  createdAt: string
}

interface PaymentRecord {
  payment_id: number
  amount: number
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED'
  payment_type: 'FIRST' | 'RECURRING' | 'RETRY'
  plan_name?: string
  tid: string | null
  created_at: string
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://trabien.com').replace(/\/$/, '')

export function SettingsBillingTab() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { teams } = useWorkspaceStore()

  const [ownerType, setOwnerType] = useState<OwnerType>('personal')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  const [plans, setPlans] = useState<Plan[]>([])
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null)
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  const [loading, setLoading] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [removingCard, setRemovingCard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const ownerId = ownerType === 'personal' ? user?.memberId ?? null : selectedTeamId
  const isPaidSubscription = Boolean(activeSubscription && activeSubscription.id > 0)

  const visiblePlans = useMemo(() => {
    if (ownerType === 'team') {
      return plans.filter((plan) => plan.plan_type === 'team' || /team|enterprise/i.test(plan.name))
    }
    return plans.filter((plan) => plan.plan_type !== 'team' && !/team|enterprise/i.test(plan.name))
  }, [plans, ownerType])

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  const formatAmount = (amount: number) => `₩${amount.toLocaleString()}`

  const openExternal = async (url: string) => {
    try {
      await open(url)
    } catch (err) {
      console.error('Failed to open url via tauri shell:', err)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const loadPlans = async () => {
    const list = await apiClient.get<Plan[]>('/api/plans')
    setPlans(Array.isArray(list) ? list : [])
  }

  const loadBillingKey = async () => {
    try {
      const response = await apiClient.get<{ billingKey?: SavedCard }>('/api/nicepay/billing/register')
      setSavedCard(response.billingKey ?? null)
    } catch (err) {
      setSavedCard(null)
    }
  }

  const loadSubscriptionAndPayments = async () => {
    if (!ownerId) {
      setActiveSubscription(null)
      setPayments([])
      return
    }

    const [subResponse, paymentsResponse] = await Promise.all([
      apiClient.get<Subscription | null>(`/api/subscriptions?owner_id=${ownerId}&owner_type=${ownerType}&active=true`),
      apiClient
        .get<{ payments: PaymentRecord[] }>(`/api/payments?owner_id=${ownerId}&owner_type=${ownerType}`)
        .catch(() => ({ payments: [] as PaymentRecord[] })),
    ])

    setActiveSubscription(subResponse ?? null)
    setPayments(paymentsResponse.payments || [])
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await Promise.all([loadPlans(), loadBillingKey(), loadSubscriptionAndPayments()])
    } catch (err) {
      console.error('Failed to load billing info:', err)
      setError(t('billing.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id)
    }
  }, [teams, selectedTeamId])

  useEffect(() => {
    load()
  }, [ownerType, ownerId])

  const openPlansPage = async () => {
    if (!ownerId) return
    const url = `${BASE_URL}/dashboard/settings/billing/plans/${ownerType}?owner_id=${ownerId}`
    await openExternal(url)
  }

  const openCheckoutForPlan = async (planId: number) => {
    if (!ownerId) return
    const url = `${BASE_URL}/dashboard/settings/billing/checkout?plan_id=${planId}&owner_type=${ownerType}&owner_id=${ownerId}`
    await openExternal(url)
  }

  const handleCancelSubscription = async () => {
    if (!activeSubscription?.id || canceling) return
    setCanceling(true)
    setError(null)
    setSuccess(null)
    try {
      await apiClient.put<{ success: boolean }>('/api/subscriptions', {
        id: activeSubscription.id,
        status: 'CANCELED',
      })
      setSuccess(t('billing.cancelSuccess'))
      await loadSubscriptionAndPayments()
    } catch (err) {
      console.error('Failed to cancel subscription:', err)
      setError(t('billing.cancelError'))
    } finally {
      setCanceling(false)
    }
  }

  const handleRemoveCard = async () => {
    if (removingCard || isPaidSubscription) return
    setRemovingCard(true)
    setError(null)
    setSuccess(null)
    try {
      await apiClient.delete<{ success: boolean }>('/api/nicepay/billing/remove')
      setSavedCard(null)
      setSuccess(t('billing.removeCardSuccess'))
    } catch (err) {
      console.error('Failed to remove billing key:', err)
      setError(t('billing.removeCardError'))
    } finally {
      setRemovingCard(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setOwnerType('personal')}
          className={`px-3 py-2 text-xs rounded-lg border ${
            ownerType === 'personal'
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {t('billing.personal')}
        </button>
        <button
          onClick={() => setOwnerType('team')}
          className={`px-3 py-2 text-xs rounded-lg border ${
            ownerType === 'team'
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {t('billing.team')}
        </button>
      </div>

      {ownerType === 'team' && (
        <select
          value={selectedTeamId ?? ''}
          onChange={(e) => setSelectedTeamId(Number(e.target.value) || null)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          {teams.length === 0 ? (
            <option value="">{t('billing.noTeams')}</option>
          ) : (
            teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))
          )}
        </select>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-2 text-xs">
          {success}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('billing.currentPlan')}</span>
          <button
            onClick={openPlansPage}
            disabled={!ownerId}
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {t('billing.openPlans')}
          </button>
        </div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {activeSubscription?.plan_name || t('billing.basicPlan')}
        </p>
        {activeSubscription?.next_payment_date && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('billing.nextPayment')}: {formatDate(activeSubscription.next_payment_date)}
          </p>
        )}
        {ownerType === 'personal' && isPaidSubscription && (
          <button
            onClick={handleCancelSubscription}
            disabled={canceling}
            className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {canceling ? '...' : t('billing.cancelSubscription')}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">{t('billing.selectPlan')}</p>
        {loading ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : visiblePlans.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('billing.noPlans')}</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {visiblePlans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{plan.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {formatAmount(plan.price)} / month
                  </p>
                </div>
                <button
                  onClick={() => openCheckoutForPlan(plan.id)}
                  disabled={!ownerId || plan.price === 0}
                  className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('billing.checkout')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {ownerType === 'personal' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('billing.paymentMethod')}</p>
          {savedCard ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {savedCard.cardName || t('billing.savedCard')} · {savedCard.cardNoMasked}
              </p>
              <button
                onClick={handleRemoveCard}
                disabled={removingCard || isPaidSubscription}
                className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {removingCard ? '...' : t('billing.removeCard')}
              </button>
              {isPaidSubscription && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('billing.removeCardBlocked')}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('billing.noSavedCard')}</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">{t('billing.paymentHistory')}</p>
        {payments.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('billing.noPaymentHistory')}</p>
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {payments.map((payment) => (
              <div key={payment.payment_id} className="flex items-center justify-between rounded bg-gray-50 dark:bg-gray-800/50 px-2 py-1.5">
                <span className="text-[11px] text-gray-600 dark:text-gray-300">
                  {formatDate(payment.created_at)} · {payment.plan_name || '-'}
                </span>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                  {formatAmount(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


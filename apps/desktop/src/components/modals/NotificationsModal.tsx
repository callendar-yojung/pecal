import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button } from '../common'
import { notificationsApi } from '../../api'
import { useModalStore } from '../../stores'
import type { NotificationItem } from '../../types'

export function NotificationsModal() {
  const { t } = useTranslation()
  const { openedModal, closeModal } = useModalStore()
  const isOpen = openedModal === 'NOTIFICATIONS'

  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<number | null>(null)

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await notificationsApi.getNotifications(20)
      setItems(response.notifications || [])
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      setItems([])
      setError(t('notification.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const handleMarkRead = async (id: number) => {
    setWorkingId(id)
    try {
      await notificationsApi.markRead(id)
      setItems((prev) => prev.map((item) => (item.notification_id === id ? { ...item, is_read: 1 } : item)))
    } catch (err) {
      console.error('Failed to mark notification read:', err)
    } finally {
      setWorkingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setWorkingId(id)
    try {
      await notificationsApi.deleteOne(id)
      setItems((prev) => prev.filter((item) => item.notification_id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    } finally {
      setWorkingId(null)
    }
  }

  const handleClearAll = async () => {
    setWorkingId(-1)
    try {
      await notificationsApi.clearAll()
      setItems([])
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    } finally {
      setWorkingId(null)
    }
  }

  const handleRespond = async (invitationId: number, action: 'accept' | 'decline') => {
    setWorkingId(invitationId)
    try {
      await notificationsApi.respondInvitation(invitationId, action)
      await fetchNotifications()
    } catch (err) {
      console.error('Failed to respond invitation:', err)
    } finally {
      setWorkingId(null)
    }
  }

  const isEmpty = useMemo(() => !loading && !error && items.length === 0, [loading, error, items.length])

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={t('notification.title')}
      containerClassName="max-w-xl"
      contentClassName="p-0"
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400">{t('notification.subtitle')}</span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={workingId !== null}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            {t('notification.clearAll')}
          </button>
        )}
      </div>

      <div className="max-h-[460px] overflow-y-auto">
        {loading && (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
        )}

        {error && !loading && (
          <div className="p-6 text-sm text-red-500">
            {error}
            <button
              type="button"
              onClick={fetchNotifications}
              className="ml-2 underline text-xs text-gray-700 dark:text-gray-200"
            >
              {t('task.retry')}
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('notification.empty')}</div>
        )}

        {!loading &&
          items.map((item) => (
            <div
              key={item.notification_id}
              className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${
                item.is_read ? 'bg-white dark:bg-gray-800' : 'bg-blue-50/40 dark:bg-blue-900/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.title || t('notification.item')}
                  </p>
                  {item.message && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                      {item.message}
                    </p>
                  )}
                  {item.source_type === 'TEAM_INVITE' && item.source_id && (
                    <div className="mt-2 flex items-center gap-2">
                      {item.invitation_status === 'PENDING' ? (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => handleRespond(Number(item.source_id), 'accept')}
                            disabled={workingId === Number(item.source_id)}
                          >
                            {t('notification.accept')}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleRespond(Number(item.source_id), 'decline')}
                            disabled={workingId === Number(item.source_id)}
                          >
                            {t('notification.decline')}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.invitation_status === 'ACCEPTED'
                            ? t('notification.accepted')
                            : t('notification.declined')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  {!item.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.notification_id)}
                      disabled={workingId === item.notification_id}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                    >
                      {t('notification.markRead')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.notification_id)}
                    disabled={workingId === item.notification_id}
                    className="text-xs text-gray-500 hover:text-red-500 disabled:opacity-50"
                    aria-label={t('notification.delete')}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  )
}


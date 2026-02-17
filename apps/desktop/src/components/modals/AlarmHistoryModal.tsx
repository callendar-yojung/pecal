import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import { Modal, Button } from '../common'
import { useModalStore } from '../../stores'
import { isTauriApp } from '../../utils/tauri'

type AlarmStatus = 'pending' | 'snoozed' | 'fired' | 'dismissed'

interface AlarmRecord {
  alarm_id: string
  task_id: number
  workspace_id: number
  title: string
  start_at_unix: number
  trigger_at_unix: number
  next_trigger_at_unix: number | null
  status: AlarmStatus
  is_enabled: boolean
  reminder_minutes_before: number
  last_triggered_at_unix: number | null
  created_at_unix: number
  updated_at_unix: number
}

interface AlarmManagerState {
  notifications_enabled: boolean
  alarms: AlarmRecord[]
}

const statusClassName: Record<AlarmStatus, string> = {
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  snoozed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  fired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  dismissed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

export function AlarmHistoryModal() {
  const { t } = useTranslation()
  const { openedModal, closeModal } = useModalStore()
  const [alarms, setAlarms] = useState<AlarmRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workingAlarmId, setWorkingAlarmId] = useState<string | null>(null)

  const isOpen = openedModal === 'ALARM_HISTORY'

  const loadAlarms = useCallback(async () => {
    if (!isTauriApp()) {
      setAlarms([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const state = await invoke<AlarmManagerState>('get_alarm_manager_state')
      setAlarms(
        [...state.alarms].sort((a, b) => {
          const aTime = a.next_trigger_at_unix ?? a.updated_at_unix
          const bTime = b.next_trigger_at_unix ?? b.updated_at_unix
          return bTime - aTime
        })
      )
    } catch (e) {
      console.error('Failed to load alarm history:', e)
      setError(t('alarm.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (isOpen) {
      loadAlarms()
    }
  }, [isOpen, loadAlarms])

  const handleSnooze = async (alarmId: string) => {
    setWorkingAlarmId(alarmId)
    try {
      await invoke('snooze_alarm', { alarm_id: alarmId, minutes: 5 })
      await loadAlarms()
    } catch (e) {
      console.error('Failed to snooze alarm:', e)
      setError(t('alarm.actionError'))
    } finally {
      setWorkingAlarmId(null)
    }
  }

  const handleDismiss = async (alarmId: string) => {
    setWorkingAlarmId(alarmId)
    try {
      await invoke('dismiss_alarm', { alarm_id: alarmId })
      await loadAlarms()
    } catch (e) {
      console.error('Failed to dismiss alarm:', e)
      setError(t('alarm.actionError'))
    } finally {
      setWorkingAlarmId(null)
    }
  }

  const rows = useMemo(() => alarms, [alarms])

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={t('alarm.historyTitle')}
      containerClassName="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('alarm.historyDescription')}
          </p>
          <Button variant="secondary" onClick={loadAlarms}>
            {t('alarm.refresh')}
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('common.loading')}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-500">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('alarm.empty')}
          </div>
        ) : (
          <div className="max-h-[460px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            {rows.map((alarm) => {
              const nextAt = alarm.next_trigger_at_unix
                ? new Date(alarm.next_trigger_at_unix * 1000).toLocaleString()
                : '-'
              const startAt = new Date(alarm.start_at_unix * 1000).toLocaleString()
              const isWorking = workingAlarmId === alarm.alarm_id
              const canAction = alarm.is_enabled && alarm.status !== 'dismissed'

              return (
                <div
                  key={alarm.alarm_id}
                  className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {alarm.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('alarm.startAt')}: {startAt}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('alarm.nextAt')}: {nextAt}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[11px] font-medium ${statusClassName[alarm.status]}`}
                    >
                      {t(`alarm.status.${alarm.status}`)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleSnooze(alarm.alarm_id)}
                      disabled={!canAction || isWorking}
                    >
                      {t('alarm.snooze5m')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleDismiss(alarm.alarm_id)}
                      disabled={!canAction || isWorking}
                    >
                      {t('alarm.dismiss')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

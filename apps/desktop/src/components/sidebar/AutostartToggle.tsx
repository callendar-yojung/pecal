import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'

export function AutostartToggle() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    invoke<boolean>('get_autostart')
      .then(setEnabled)
      .catch(console.error)
  }, [])

  const toggle = async () => {
    try {
      const result = await invoke<boolean>('set_autostart', { enabled: !enabled })
      setEnabled(result)
    } catch (err) {
      console.error('Failed to toggle autostart:', err)
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      title={enabled ? t('autostart.disable') : t('autostart.enable')}
    >
      <div
        className={`relative w-8 h-4 rounded-full transition-colors ${
          enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      <span>{t('autostart.label')}</span>
    </button>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface TaskColorPresetPickerProps {
  color: string
  colorOptions: string[]
  onColorChange: (nextColor: string) => void
  onSaveCustomColor: (value: string) => Promise<string | null>
}

export function TaskColorPresetPicker({
  color,
  colorOptions,
  onColorChange,
  onSaveCustomColor,
}: TaskColorPresetPickerProps) {
  const { t } = useTranslation()
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false)
  const [customColorInput, setCustomColorInput] = useState(color.toUpperCase())
  const [customColorError, setCustomColorError] = useState<string | null>(null)
  const [savingCustomColor, setSavingCustomColor] = useState(false)

  useEffect(() => {
    setCustomColorInput(color.toUpperCase())
  }, [color])

  const handleSaveCustomColor = async () => {
    if (savingCustomColor) return
    setSavingCustomColor(true)
    try {
      setCustomColorError(null)
      const saved = await onSaveCustomColor(customColorInput)
      if (!saved) {
        setCustomColorError(t('event.customColorInvalid'))
        return
      }
      onColorChange(saved)
      setCustomColorInput(saved)
    } catch (error) {
      setCustomColorError(error instanceof Error ? error.message : t('common.error'))
    } finally {
      setSavingCustomColor(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {colorOptions.map((item) => {
          const active = color.toUpperCase() === item.toUpperCase()
          return (
            <button
              key={item}
              type="button"
              onClick={() => onColorChange(item)}
              className="h-7 w-7 rounded-full border transition-transform hover:scale-105"
              style={{
                backgroundColor: item,
                borderColor: active ? '#111827' : '#D1D5DB',
                borderWidth: active ? 3 : 1,
              }}
              title={item}
            >
              {active ? <span className="text-[11px] font-extrabold text-white">✓</span> : null}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvancedPicker((prev) => !prev)}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {showAdvancedPicker ? t('event.customColorFold') : t('event.customColorExpand')}
      </button>

      {showAdvancedPicker ? (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/40">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('event.customColorHelper')}</p>
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 shrink-0 rounded-full border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: customColorInput || color }}
            />
            <input
              type="text"
              value={customColorInput}
              onChange={(e) => {
                setCustomColorInput(e.target.value)
                if (customColorError) setCustomColorError(null)
              }}
              placeholder={t('event.customColorPlaceholder')}
              className="flex-1 px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleSaveCustomColor()}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
              disabled={savingCustomColor}
            >
              {savingCustomColor ? t('event.customColorSaving') : t('event.customColorSave')}
            </button>
          </div>
          {customColorError ? (
            <p className="text-xs text-red-500 dark:text-red-400">{customColorError}</p>
          ) : (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{customColorInput || color}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

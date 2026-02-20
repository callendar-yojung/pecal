import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-shell'
import { ask } from '@tauri-apps/plugin-dialog'
import { Modal, Input, TextArea, Button } from '../common'
import { useModalStore } from '../../stores'
import { useWorkspaceStore } from '../../stores'
import { teamApi } from '../../api'

type TeamPlan = 'free' | 'paid'
type ModalStep = 'details' | 'plan'

export function TeamCreateModal() {
  const { t } = useTranslation()
  const { openedModal, closeModal } = useModalStore()
  const { setMode } = useWorkspaceStore()

  const [step, setStep] = useState<ModalStep>('details')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdTeamId, setCreatedTeamId] = useState<number | null>(null)

  const isOpen = openedModal === 'TEAM_CREATE'

  const resetAndClose = () => {
    setStep('details')
    setName('')
    setDescription('')
    setError('')
    setIsSubmitting(false)
    setCreatedTeamId(null)
    closeModal()
  }

  const handleClose = () => {
    if (step === 'plan' && createdTeamId) {
      teamApi.deleteTeam(createdTeamId).catch((deleteError) => {
        console.error('Failed to rollback created team:', deleteError)
      })
    }
    resetAndClose()
  }

  const handleChoosePlan = async (plan: TeamPlan) => {
    if (!createdTeamId) {
      setError(t('mode.createTeamError'))
      return
    }

    localStorage.setItem('deskcal_plan_tier', plan === 'paid' ? 'pro' : 'free')
    setError('')

    if (plan === 'paid') {
      const confirmed = await ask(
        t('mode.confirmPaidMessage'),
        {
          title: t('mode.confirmPaidTitle'),
          okLabel: t('mode.goToBilling'),
          cancelLabel: t('event.cancel'),
        }
      )
      if (!confirmed) return

      const ownerId = createdTeamId
      const billingUrl = `https://pecal.site/dashboard/settings/billing/plans/team?owner_id=${ownerId}`
      try {
        await open(billingUrl)
      } catch (openError) {
        console.error('Failed to open billing page:', openError)
        window.open(billingUrl, '_blank', 'noopener,noreferrer')
      }
      setMode('TEAM', createdTeamId)
      resetAndClose()
      return
    }

    setMode('TEAM', createdTeamId)
    resetAndClose()
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    setIsSubmitting(true)
    setError('')

    try {
      const response = await teamApi.createTeam(trimmedName, description.trim() || undefined)
      setCreatedTeamId(response.teamId)
      setStep('plan')
    } catch (err) {
      console.error('Failed to create team:', err)
      setError(err instanceof Error ? err.message : t('mode.createTeamError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('mode.createNewTeam')}>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('mode.createTeamDescription')}
      </p>

      {step === 'details' ? (
        <div className="flex flex-col gap-4">
          <Input
            label={t('mode.teamName')}
            placeholder={t('mode.teamNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) handleSubmit()
            }}
            autoFocus
          />

          <TextArea
            label={t('mode.teamDescription')}
            placeholder={t('mode.teamDescriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>
              {t('event.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? t('mode.creating') : t('mode.createTeam')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleChoosePlan('free')}
            className="w-full rounded-xl border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-left hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              {t('mode.teamFreePlan')}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {t('mode.teamFreePlanDescription')}
            </p>
          </button>

          <button
            onClick={() => handleChoosePlan('paid')}
            className="w-full rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {t('mode.teamPaidPlan')}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {t('mode.teamPaidPlanDescription')}
            </p>
          </button>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={handleClose}>
              {t('event.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

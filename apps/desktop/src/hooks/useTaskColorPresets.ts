import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_TASK_COLORS,
  loadTaskColorOptionsForMember,
  saveTaskColorPresetForMember,
} from '../lib/taskColorPresets'

export function useTaskColorPresets(memberId?: number) {
  const [colorOptions, setColorOptions] = useState<string[]>([...DEFAULT_TASK_COLORS])

  useEffect(() => {
    let disposed = false

    const load = async () => {
      const options = await loadTaskColorOptionsForMember(memberId)
      if (!disposed) {
        setColorOptions(options)
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [memberId])

  const saveCustomColor = useCallback(
    async (input: string) => {
      const response = await saveTaskColorPresetForMember(memberId, input)
      setColorOptions(response.options)
      return response.saved
    },
    [memberId],
  )

  return { colorOptions, saveCustomColor }
}

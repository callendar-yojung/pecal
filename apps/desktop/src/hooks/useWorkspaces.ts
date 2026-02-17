import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores'
import { workspaceApi, teamApi } from '../api'

export function useWorkspaces() {
  const {
    setWorkspaces,
    setTeams,
    setLoading,
    setError,
    currentMode,
    selectedTeamId,
  } = useWorkspaceStore()

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        console.log('📋 Fetching teams...')
        const response = await teamApi.getMyTeams()
        console.log('✅ Teams received:', response.teams)
        setTeams(response.teams)
      } catch (err) {
        console.error('❌ Failed to fetch teams:', err)
      }
    }

    fetchTeams()
  }, [setTeams])

  // Fetch workspaces based on mode
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📁 Fetching workspaces for mode:', currentMode, 'teamId:', selectedTeamId)

        if (currentMode === 'PERSONAL') {
          const response = await workspaceApi.getMyWorkspaces()
          console.log('📦 All workspaces from API:', {
            total: response.workspaces.length,
            workspaces: response.workspaces.map(ws => ({
              id: ws.workspace_id,
              name: ws.name,
              type: ws.type,
              owner_id: ws.owner_id,
            }))
          })

          const personalWorkspaces = response.workspaces.filter(
            (ws) => ws.type === 'personal'
          )

          console.log('🏠 Personal workspaces (type=personal):', {
            count: personalWorkspaces.length,
            list: personalWorkspaces.map(ws => ({ id: ws.workspace_id, name: ws.name }))
          })

          setWorkspaces(personalWorkspaces)
          console.log('✅ Set personal workspaces to store:', personalWorkspaces.length)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        } else if (currentMode === 'TEAM' && selectedTeamId) {
          console.log('👥 Fetching team workspaces for team:', selectedTeamId)
          const response = await workspaceApi.getMyWorkspaces()
          const teamWorkspaces = response.workspaces.filter(
            (ws) => ws.type === 'team' && ws.owner_id === selectedTeamId
          )

          console.log('📦 Team workspaces:', {
            count: teamWorkspaces.length,
            list: teamWorkspaces.map(ws => ({ id: ws.workspace_id, name: ws.name, owner_id: ws.owner_id }))
          })

          setWorkspaces(teamWorkspaces)
          console.log('✅ Set team workspaces to store:', teamWorkspaces.length)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        } else {
          console.log('⚠️ No valid mode/team selected')
          setWorkspaces([])
        }
      } catch (err) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('❌ Failed to fetch workspaces:', err)
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        setError(err instanceof Error ? err.message : 'Failed to fetch workspaces')
        setWorkspaces([])
      } finally {
        setLoading(false)
      }
    }

    fetchWorkspaces()
  }, [currentMode, selectedTeamId, setWorkspaces, setLoading, setError])
}

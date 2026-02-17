import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore, useWorkspaceStore } from '../../stores'
import { teamApi } from '../../api'
import type {
  MemberSearchResult,
  TeamMemberInfo,
  TeamRoleInfo,
} from '../../types'

type PermissionDefinition = {
  code: string
  labelKey: string
}

const PERMISSIONS: PermissionDefinition[] = [
  { code: 'TASK_CREATE', labelKey: 'teamManage.permission.TASK_CREATE' },
  { code: 'TASK_EDIT_OWN', labelKey: 'teamManage.permission.TASK_EDIT_OWN' },
  { code: 'TASK_EDIT_ALL', labelKey: 'teamManage.permission.TASK_EDIT_ALL' },
  { code: 'TASK_DELETE_OWN', labelKey: 'teamManage.permission.TASK_DELETE_OWN' },
  { code: 'TASK_DELETE_ALL', labelKey: 'teamManage.permission.TASK_DELETE_ALL' },
  { code: 'WORKSPACE_CREATE', labelKey: 'teamManage.permission.WORKSPACE_CREATE' },
  { code: 'WORKSPACE_EDIT', labelKey: 'teamManage.permission.WORKSPACE_EDIT' },
  { code: 'WORKSPACE_DELETE', labelKey: 'teamManage.permission.WORKSPACE_DELETE' },
]

export function TeamManageView() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { selectedTeamId, teams, currentMode } = useWorkspaceStore()

  const [members, setMembers] = useState<TeamMemberInfo[]>([])
  const [roles, setRoles] = useState<TeamRoleInfo[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [memberRoleId, setMemberRoleId] = useState<number | null>(null)
  const [draftPermissionCodes, setDraftPermissionCodes] = useState<string[]>([])
  const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null)
  const [selectedAssigned, setSelectedAssigned] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [results, setResults] = useState<MemberSearchResult[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null)
  const [newRoleName, setNewRoleName] = useState('')

  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loadingRolePermissions, setLoadingRolePermissions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTeam = selectedTeamId
    ? teams.find((team) => team.id === selectedTeamId) ?? null
    : null

  const isAdmin = Boolean(
    user && selectedTeam && Number(selectedTeam.created_by) === Number(user.memberId)
  )

  const selectedRole = useMemo(
    () => roles.find((role) => role.team_role_id === selectedRoleId) || null,
    [roles, selectedRoleId]
  )

  const assignedCodes = useMemo(() => new Set(draftPermissionCodes), [draftPermissionCodes])

  const availablePermissions = useMemo(
    () => PERMISSIONS.filter((permission) => !assignedCodes.has(permission.code)),
    [assignedCodes]
  )

  const assignedPermissions = useMemo(
    () => PERMISSIONS.filter((permission) => assignedCodes.has(permission.code)),
    [assignedCodes]
  )

  const loadMembers = async () => {
    if (!selectedTeamId) return
    setLoadingMembers(true)
    try {
      const response = await teamApi.getTeamMembers(selectedTeamId)
      setMembers(response.members || [])
    } finally {
      setLoadingMembers(false)
    }
  }

  const loadRoles = async () => {
    if (!selectedTeamId) return
    setLoadingRoles(true)
    try {
      const response = await teamApi.getRoles(selectedTeamId)
      const roleList = response.roles || []
      setRoles(roleList)

      const nextSelectedRoleId =
        selectedRoleId && roleList.some((role) => role.team_role_id === selectedRoleId)
          ? selectedRoleId
          : roleList[0]?.team_role_id ?? null
      setSelectedRoleId(nextSelectedRoleId)

      const memberRole = roleList.find((role) => role.name === 'Member') || roleList[0] || null
      setMemberRoleId(memberRole?.team_role_id ?? null)
    } finally {
      setLoadingRoles(false)
    }
  }

  const loadRolePermissions = async (roleId: number) => {
    if (!selectedTeamId) return
    setLoadingRolePermissions(true)
    try {
      const response = await teamApi.getRolePermissions(selectedTeamId, roleId)
      setDraftPermissionCodes((response.permissions || []).map((permission) => permission.code))
      setSelectedAvailable(null)
      setSelectedAssigned(null)
    } finally {
      setLoadingRolePermissions(false)
    }
  }

  useEffect(() => {
    setQuery('')
    setResults([])
    setSelectedMember(null)
    setError(null)
    setMembers([])
    setRoles([])
    setDraftPermissionCodes([])
    setSelectedAvailable(null)
    setSelectedAssigned(null)
    setSelectedRoleId(null)

    if (selectedTeamId && isAdmin) {
      loadMembers().catch((err) => {
        console.error(err)
        setError('팀원 목록을 불러오지 못했습니다.')
      })
      loadRoles().catch((err) => {
        console.error(err)
        setError('역할 목록을 불러오지 못했습니다.')
      })
    }
  }, [selectedTeamId, isAdmin])

  useEffect(() => {
    if (!selectedTeamId || !selectedRoleId || !isAdmin) {
      setDraftPermissionCodes([])
      setSelectedAvailable(null)
      setSelectedAssigned(null)
      return
    }

    loadRolePermissions(selectedRoleId).catch((err) => {
      console.error(err)
      setError('권한 목록을 불러오지 못했습니다.')
    })
  }, [selectedTeamId, selectedRoleId, isAdmin])

  useEffect(() => {
    if (!isAdmin || !selectedTeamId) return
    const keyword = query.trim()
    if (keyword.length < 2) {
      setResults([])
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const type = keyword.includes('@') ? 'email' : 'nickname'
        const response = await teamApi.searchMembers(keyword, type)
        setResults(response.results || [])
      } catch (err) {
        console.error('Failed to search members:', err)
        setResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [query, isAdmin, selectedTeamId])

  const handleInvite = async () => {
    if (!selectedTeamId || !selectedMember || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await teamApi.inviteMember(selectedTeamId, selectedMember.member_id, memberRoleId)
      setQuery('')
      setSelectedMember(null)
      setResults([])
      await loadMembers()
    } catch (err) {
      console.error('Failed to invite member:', err)
      setError(err instanceof Error ? err.message : '팀원 초대에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (memberId: number) => {
    if (!selectedTeamId || !isAdmin) return
    if (!window.confirm('이 팀원을 제거하시겠습니까?')) return

    setSubmitting(true)
    setError(null)
    try {
      await teamApi.removeMember(selectedTeamId, memberId)
      await loadMembers()
    } catch (err) {
      console.error('Failed to remove member:', err)
      setError(err instanceof Error ? err.message : '팀원 제거에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateMemberRole = async (memberId: number, roleId: number) => {
    if (!selectedTeamId || !isAdmin) return
    setSubmitting(true)
    setError(null)
    try {
      await teamApi.updateMemberRole(selectedTeamId, memberId, roleId)
      await loadMembers()
    } catch (err) {
      console.error('Failed to update member role:', err)
      setError(err instanceof Error ? err.message : '역할 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateRole = async () => {
    if (!selectedTeamId || !newRoleName.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await teamApi.createRole(selectedTeamId, newRoleName.trim())
      setNewRoleName('')
      await loadRoles()
    } catch (err) {
      console.error('Failed to create role:', err)
      setError(err instanceof Error ? err.message : '역할 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedTeamId || !selectedRoleId || submitting) return
    if (!window.confirm('이 역할을 삭제하시겠습니까?')) return

    setSubmitting(true)
    setError(null)
    try {
      await teamApi.deleteRole(selectedTeamId, selectedRoleId)
      await loadRoles()
    } catch (err) {
      console.error('Failed to delete role:', err)
      setError(err instanceof Error ? err.message : '역할 삭제에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssignPermission = () => {
    if (!selectedAvailable || selectedRole?.name === 'Owner') return
    if (draftPermissionCodes.includes(selectedAvailable)) return
    setDraftPermissionCodes((prev) => [...prev, selectedAvailable])
    setSelectedAvailable(null)
  }

  const handleUnassignPermission = () => {
    if (!selectedAssigned || selectedRole?.name === 'Owner') return
    setDraftPermissionCodes((prev) => prev.filter((code) => code !== selectedAssigned))
    setSelectedAssigned(null)
  }

  const handleSaveRolePermissions = async () => {
    if (!selectedTeamId || !selectedRoleId || submitting || selectedRole?.name === 'Owner') return
    setSubmitting(true)
    setError(null)
    try {
      await teamApi.setRolePermissions(selectedTeamId, selectedRoleId, draftPermissionCodes)
      await loadRolePermissions(selectedRoleId)
    } catch (err) {
      console.error('Failed to save permissions:', err)
      setError(err instanceof Error ? err.message : '권한 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (currentMode !== 'TEAM' || !selectedTeamId) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        팀 워크스페이스를 선택하면 팀 관리를 사용할 수 있습니다.
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        팀 관리 권한은 관리자에게만 표시됩니다.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">팀 관리</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">웹 팀 관리 기준 기능</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">팀원 초대</p>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedMember(null)
                }}
                placeholder="닉네임 또는 이메일 검색"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleInvite}
                disabled={!selectedMember || submitting}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                초대
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">기본 역할</span>
              <select
                value={memberRoleId ?? ''}
                onChange={(e) => setMemberRoleId(Number(e.target.value) || null)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                {roles.map((role) => (
                  <option key={role.team_role_id} value={role.team_role_id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            {searchLoading && <p className="text-xs text-gray-400 dark:text-gray-500">검색 중...</p>}
            {!searchLoading && results.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {results.map((item) => {
                  const label = item.nickname || item.email || `#${item.member_id}`
                  return (
                    <button
                      key={item.member_id}
                      onClick={() => {
                        setSelectedMember(item)
                        setQuery(label)
                        setResults([])
                      }}
                      className="w-full text-left px-3 py-2 text-sm border-b last:border-b-0 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">역할 관리</p>
            <div className="flex gap-2">
              <input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="새 역할 이름"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateRole}
                disabled={!newRoleName.trim() || submitting}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                추가
              </button>
            </div>
            {loadingRoles ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={selectedRoleId ?? ''}
                    onChange={(e) => setSelectedRoleId(Number(e.target.value) || null)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  >
                    {roles.map((role) => (
                      <option key={role.team_role_id} value={role.team_role_id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleDeleteRole}
                    disabled={!selectedRoleId || submitting}
                    className="px-3 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={!selectedRoleId || submitting || selectedRole?.name === 'Owner'}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  권한 저장
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">팀원 목록</p>
          {loadingMembers ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">팀원이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const label = member.nickname || member.email || `#${member.member_id}`
                const isOwner = selectedTeam?.created_by === member.member_id
                return (
                  <div key={member.member_id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700/30">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <span className="text-xs text-gray-500">Owner</span>
                      ) : (
                        <select
                          value={member.role_id ?? ''}
                          onChange={(e) => handleUpdateMemberRole(member.member_id, Number(e.target.value))}
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                          disabled={submitting}
                        >
                          {roles.map((role) => (
                            <option key={role.team_role_id} value={role.team_role_id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {!isOwner && (
                        <button
                          onClick={() => handleRemove(member.member_id)}
                          disabled={submitting}
                          className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          제거
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">권한 관리</p>
          {loadingRolePermissions ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>
          ) : !selectedRoleId ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">역할을 선택하세요.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">할당 가능 권한</div>
                <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                  <div className="max-h-64 overflow-auto">
                    {availablePermissions.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 dark:text-gray-400">추가 가능한 권한이 없습니다.</p>
                    ) : (
                      availablePermissions.map((permission) => (
                        <button
                          key={permission.code}
                          type="button"
                          onClick={() => setSelectedAvailable(permission.code)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                            selectedAvailable === permission.code
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span>{t(permission.labelKey)}</span>
                          <span className="text-xs text-gray-500">{permission.code}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleAssignPermission}
                  disabled={!selectedAvailable || selectedRole?.name === 'Owner'}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={handleUnassignPermission}
                  disabled={!selectedAssigned || selectedRole?.name === 'Owner'}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  ←
                </button>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">할당된 권한</div>
                <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                  <div className="max-h-64 overflow-auto">
                    {assignedPermissions.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 dark:text-gray-400">할당된 권한이 없습니다.</p>
                    ) : (
                      assignedPermissions.map((permission) => (
                        <button
                          key={permission.code}
                          type="button"
                          onClick={() => setSelectedAssigned(permission.code)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                            selectedAssigned === permission.code
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span>{t(permission.labelKey)}</span>
                          <span className="text-xs text-gray-500">{permission.code}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

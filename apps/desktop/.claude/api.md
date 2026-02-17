### Workspaces
- `GET /api/me/workspaces` - 내 워크스페이스 목록 조회 (개인 + 소속 팀)
  - Returns: `{ workspaces: Workspace[] }`
- `GET /api/workspaces/[id]` - 워크스페이스 상세 조회
  - Returns: `{ workspace: Workspace }`
- `GET /api/workspaces/member/[id]` - 특정 회원의 워크스페이스 목록 조회
  - Params: `id` - member_id
  - Returns: `{ workspaces: Workspace[] }`
  - Note: 본인만 조회 가능 (또는 같은 팀 멤버)
- `GET /api/workspaces/team/[id]` - 특정 팀의 워크스페이스 목록 조회
  - Params: `id` - team_id
  - Returns: `{ workspaces: Workspace[] }`
  - Note: 팀 멤버만 조회 가능
- `PATCH /api/workspaces/[id]` - 워크스페이스 이름 수정
  - Body: `{ name: string }`
  - Returns: `{ success: true, message: string }`
- `POST /api/workspaces` - 새 워크스페이스 생성
  - Body: `{ name: string, type: "personal" | "team", owner_id: number }`
  - Returns: `{ workspace: Workspace, message: string }`
- `DELETE /api/workspaces/[id]` - 워크스페이스 삭제
  - Returns: `{ success: true, message: string }`

### Teams
- `GET /api/me/teams` - 내 팀 목록 조회
  - Returns: `{ teams: Team[] }`
- `POST /api/me/teams` - 새 팀 생성
  - Body: `{ name: string, description?: string }`
  - Returns: `{ success: true, teamId: number, message: string }`
- `GET /api/teams/[id]` - 팀 상세 조회
  - Returns: `{ team: Team }`
- `PATCH /api/teams/[id]` - 팀 정보 수정
  - Body: `{ name: string, description?: string }`
  - Returns: `{ success: true, message: string }`
- `DELETE /api/teams/[id]` - 팀 삭제
  - Returns: `{ success: true, message: string }`

### Tasks (워크스페이스 기반)
- `GET /api/tasks?workspace_id={id}` - 워크스페이스의 태스크 목록 조회
  - Query: `workspace_id` (required)
  - Returns: `{ tasks: Task[] }`
- `POST /api/tasks` - 새 태스크 생성
  - Body: `{ title, start_time, end_time, content?, status?, workspace_id }`
  - Returns: `{ success: true, taskId: number }`
- `PATCH /api/tasks` - 태스크 수정
  - Body: `{ task_id, title?, start_time?, end_time?, content?, status? }`
  - Returns: `{ success: true }`
- `DELETE /api/tasks?task_id={id}` - 태스크 삭제
  - Query: `task_id` (required)
  - Returns: `{ success: true }`

### External Auth (데스크탑/모바일 앱용)
- `POST /api/auth/external/kakao` - 카카오 토큰으로 로그인
  - Body: `{ access_token: string }` (카카오 SDK에서 받은 access_token)
  - Returns: `{ success: true, user: { memberId, nickname, email, provider }, accessToken, refreshToken, expiresIn }`
  - Note: 카카오 API로 토큰 검증 후 JWT 발급
- `POST /api/auth/external/refresh` - 토큰 갱신
  - Body: `{ refresh_token: string }`
  - Returns: `{ success: true, accessToken, refreshToken, expiresIn }`
  - Note: refresh_token 유효시 새 토큰 페어 발급
- `GET /api/auth/external/me` - 현재 사용자 정보 조회
  - Headers: `Authorization: Bearer {accessToken}`
  - Returns: `{ user: { memberId, nickname, email, provider } }`

### Calendar
- `GET /api/calendar?workspace_id={id}&year={year}&month={month}` - 월별 태스크 개수 조회
  - Query: `workspace_id`, `year`, `month` (required)
  - Returns: `{ taskCounts: { [date: string]: number } }`

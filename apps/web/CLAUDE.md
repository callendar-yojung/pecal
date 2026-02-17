# Kelindor (KD) 프로젝트 가이드

## 프로젝트 개요
Kelindor는 팀 협업, 프로젝트 관리, 태스크 관리를 위한 올인원 워크스페이스 플랫폼입니다.

## 기술 스택
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Auth**: NextAuth.js (next-auth@beta)
- **i18n**: next-intl
- **Database**: MySQL (mysql2)
- **Linting**: Biome

## 프로젝트 구조
```
src/
├── app/
│   ├── [locale]/           # 다국어 라우트
│   │   ├── layout.tsx      # 루트 레이아웃 (html, body, providers)
│   │   ├── page.tsx        # 랜딩 페이지
│   │   ├── login/          # 로그인 페이지
│   │   └── dashboard/      # 대시보드
│   │       ├── layout.tsx  # 사이드바 레이아웃
│   │       └── page.tsx    # 대시보드 메인
│   └── api/                # API 라우트 (locale 밖)
│       └── auth/
├── components/
│   ├── landing/            # 랜딩 페이지 컴포넌트
│   ├── dashboard/          # 대시보드 컴포넌트
│   └── SessionProvider.tsx
├── lib/
│   ├── db.ts              # MySQL 연결
│   └── member.ts          # 회원 서비스
├── i18n/
│   ├── config.ts          # 언어 설정 (ko, en)
│   ├── request.ts         # 서버 요청 설정
│   └── routing.ts         # 라우팅 네비게이션
├── auth.ts                # NextAuth 설정
└── middleware.ts          # i18n 미들웨어
messages/
├── ko.json                # 한국어 번역
└── en.json                # 영어 번역
```

## 다국어 (i18n) 지원

### 지원 언어
- 한국어 (ko) - 기본
- 영어 (en)

### 사용법
```tsx
// 클라이언트 컴포넌트
"use client";
import { useTranslations } from "next-intl";

export default function Component() {
  const t = useTranslations("namespace");
  return <h1>{t("key")}</h1>;
}
```

```tsx
// 링크 사용 (locale 자동 처리)
import { Link } from "@/i18n/routing";

<Link href="/dashboard">Dashboard</Link>
```

### 번역 추가 시
1. `messages/ko.json`에 한국어 추가
2. `messages/en.json`에 영어 추가
3. 같은 키 구조 유지

## 데이터베이스 스키마

### 회원 (members)
```sql
CREATE TABLE members (
  member_id      bigint PRIMARY KEY AUTO_INCREMENT,
  provider       varchar(50),      -- 소셜 로그인 제공자 (kakao, google 등)
  provider_id    varchar(200),     -- 제공자 고유 ID
  created_at     datetime,
  lasted_at      datetime,         -- 마지막 로그인
  email          varchar(200),
  phone_number   varchar(100),
  nickname       varchar(200)      -- 자동 생성
);
```

### 워크스페이스 (workspaces)
```sql
CREATE TABLE workspaces (
  workspace_id   bigint PRIMARY KEY AUTO_INCREMENT,
  type           ENUM('personal', 'team'),  -- 개인 또는 팀 워크스페이스
  owner_id       bigint,                     -- type에 따라 member_id 또는 team_id
  created_at     datetime,
  name           varchar(100),
  created_by     bigint                      -- member_id
);
```

### 팀 (teams)
```sql
CREATE TABLE teams (
  team_id        bigint PRIMARY KEY AUTO_INCREMENT,
  name           varchar(100),
  created_at     datetime,
  created_by     bigint,            -- member_id
  description    varchar(255)
);
```

### 팀 멤버 (team_members)
```sql
CREATE TABLE team_members (
  team_member_id  bigint PRIMARY KEY AUTO_INCREMENT,
  team_id         bigint NOT NULL,
  member_id       bigint NOT NULL,
  team_role_id    bigint NOT NULL
);
```

### 팀 역할 (team_roles)
```sql
CREATE TABLE team_roles (
  team_role_id  bigint PRIMARY KEY AUTO_INCREMENT,
  team_id       bigint NOT NULL,
  name          varchar(50),      -- Manager, Lead, Member 등
  created_at    datetime,
  created_by    bigint
);
```

### 권한 (permissions)
```sql
CREATE TABLE permissions (
  permission_id  bigint PRIMARY KEY AUTO_INCREMENT,
  code           varchar(50),     -- READ, WRITE, DELETE 등
  description    varchar(255)
);
```

### 팀 역할 권한 (team_role_permissions)
```sql
CREATE TABLE team_role_permissions (
  team_role_permission_id  bigint PRIMARY KEY AUTO_INCREMENT,
  permission_id            bigint NOT NULL,
  team_role_id             bigint NOT NULL
);
```

### 태스크 (tasks)
```sql
CREATE TABLE tasks (
  id            bigint PRIMARY KEY AUTO_INCREMENT,
  start_time    datetime,
  end_time      datetime,
  content       TEXT,
  created_at    datetime,
  updated_at    datetime,
  created_by    bigint,           -- member_id
  updated_by    bigint,           -- member_id
  workspace_id  bigint NOT NULL   -- 워크스페이스 소속
);
```

### 태그 (tags)
```sql
CREATE TABLE tags (
  tag_id        bigint PRIMARY KEY AUTO_INCREMENT,
  name          varchar(50),
  created_at    datetime,
  color         varchar(30),      -- 태그 색상 (예: "#ff0000")
  workspace_id  bigint NOT NULL   -- 워크스페이스 소속
);
```

### 파일 (files)
```sql
CREATE TABLE files (
  file_id        bigint PRIMARY KEY AUTO_INCREMENT,
  owner_type     ENUM('team', 'personal') NOT NULL,  -- 소유 타입
  owner_id       bigint NOT NULL,                     -- team_id 또는 member_id
  original_name  varchar(255) NOT NULL,               -- 원본 파일명
  stored_name    varchar(255) NOT NULL,               -- 저장된 파일명 (UUID)
  file_path      varchar(500) NOT NULL,               -- 저장 경로
  file_size      bigint NOT NULL,                     -- 파일 크기 (bytes)
  mime_type      varchar(100),                        -- MIME 타입
  uploaded_by    bigint NOT NULL,                     -- 업로더 member_id
  created_at     datetime
);
```

### 태스크 첨부파일 (task_attachments)
```sql
CREATE TABLE task_attachments (
  attachment_id  bigint PRIMARY KEY AUTO_INCREMENT,
  task_id        bigint NOT NULL,
  file_id        bigint NOT NULL,
  created_at     datetime,
  created_by     bigint NOT NULL,                     -- 첨부한 member_id
  UNIQUE KEY unique_task_file (task_id, file_id)     -- 중복 첨부 방지
);
```

### 저장소 사용량 (storage_usage)
```sql
CREATE TABLE storage_usage (
  owner_type       ENUM('team', 'personal') NOT NULL,
  owner_id         bigint NOT NULL,
  used_bytes       bigint NOT NULL DEFAULT 0,
  file_count       int NOT NULL DEFAULT 0,
  updated_at       datetime,
  PRIMARY KEY (owner_type, owner_id)
);
```

### 결제 이력 (payment_history)
```sql
CREATE TABLE payment_history (
  payment_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscription_id  BIGINT NOT NULL,
  owner_id         BIGINT NOT NULL,
  owner_type       ENUM('team', 'personal') NOT NULL,
  member_id        BIGINT NOT NULL,
  plan_id          BIGINT NOT NULL,
  amount           INT NOT NULL,
  order_id         VARCHAR(100) NOT NULL,
  tid              VARCHAR(100) NULL,
  bid              VARCHAR(50) NOT NULL,
  status           ENUM('SUCCESS', 'FAILED', 'REFUNDED') NOT NULL,
  result_code      VARCHAR(10) NULL,
  result_msg       VARCHAR(500) NULL,
  payment_type     ENUM('FIRST', 'RECURRING', 'RETRY') NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 빌링키 (billing_keys)
```sql
CREATE TABLE billing_keys (
  billing_key_id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id      BIGINT NOT NULL,                     -- 회원 ID
  bid            VARCHAR(50) NOT NULL,                -- NicePay 빌링키
  card_code      VARCHAR(10),                         -- 카드사 코드
  card_name      VARCHAR(50),                         -- 카드사 명
  card_no_masked VARCHAR(20),                         -- 마스킹된 카드번호
  status         ENUM('ACTIVE', 'REMOVED') DEFAULT 'ACTIVE',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_status (member_id, status)
);
```

> **Note**: `subscriptions` 테이블에 `next_payment_date` (DATETIME), `billing_key_member_id` (BIGINT), `retry_count` (INT DEFAULT 0) 컬럼 추가됨 (DDL: `database_update_recurring_billing.sql`)

## 환경 변수 (.env.local)
```env
# NextAuth
AUTH_SECRET=           # openssl rand -base64 32

# Kakao OAuth
AUTH_KAKAO_ID=         # 카카오 REST API 키
AUTH_KAKAO_SECRET=     # 카카오 Client Secret

# Google OAuth
AUTH_GOOGLE_ID=        # 구글 Client ID
AUTH_GOOGLE_SECRET=    # 구글 Client Secret

# MySQL Database
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=

# AWS S3 (프로필 이미지 등)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Cron (정기결제 스케쥴러 인증)
CRON_SECRET=
```

## 인증 시스템

### 인증 방식
- **웹 브라우저**: NextAuth.js (쿠키 기반 세션)
- **데스크탑/모바일 앱**: JWT (Bearer 토큰)

### JWT 토큰 구조
- **Access Token**: 1시간 유효
- **Refresh Token**: 7일 유효
- 알고리즘: HS256
- 시크릿: `AUTH_SECRET` 환경변수

### 웹 인증 흐름
1. 사용자가 `/login`에서 카카오 로그인 클릭
2. NextAuth가 카카오 OAuth 처리
3. `findOrCreateMember()` 실행:
   - DB에서 provider + provider_id로 회원 조회
   - 없으면 새 회원 생성 (닉네임 자동 생성 + **개인 워크스페이스 자동 생성**)
   - 있으면 lasted_at 업데이트
4. 세션에 memberId, nickname, provider 저장

### 외부 앱 인증 흐름 (데스크탑/모바일)

#### 방법 1: 브라우저 기반 OAuth (권장)
카카오가 커스텀 스킴(desktop-calendar://)을 redirect_uri로 허용하지 않으므로, 백엔드를 통한 OAuth 흐름을 사용합니다.

```
Desktop App → GET /api/auth/kakao/start?callback=desktop-calendar://auth/callback
                              ↓
              Response: { authUrl: "https://kauth.kakao.com/oauth/authorize?...&state=desktop-calendar://auth/callback" }
                              ↓
Desktop App → 브라우저에서 authUrl 열기
                              ↓
사용자 → 카카오 로그인 완료
                              ↓
카카오 → https://trabien.com/api/auth/kakao/callback?code=XXX&state=desktop-calendar://auth/callback
                              ↓
Backend → 토큰 교환 후 desktop-calendar://auth/callback?accessToken=...&refreshToken=... 로 리다이렉트
                              ↓
Desktop App → Deep link로 토큰 수신
```

#### 방법 2: SDK 기반 (카카오 SDK 사용 가능한 경우)
1. 앱에서 카카오 SDK로 로그인하여 `access_token` 획득
2. 서버 API에 카카오 `access_token` 전달
3. 서버가 카카오 API로 사용자 정보 검증
4. DB에서 회원 조회/생성
5. JWT 토큰 페어 발급 (accessToken, refreshToken)
6. 앱에서 토큰 저장 후 API 호출 시 사용

### API 인증 헬퍼
모든 API는 `getAuthUser(request)` 함수로 인증을 처리합니다.
- Authorization 헤더의 Bearer 토큰 (JWT) 우선 확인
- 없으면 NextAuth 세션 확인 (웹 폴백)

```typescript
import { getAuthUser } from "@/lib/auth-helper";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // user.memberId, user.nickname, user.provider 사용
}
```

## 워크스페이스 시스템

### 개념
- **개인 워크스페이스**: 회원가입 시 자동으로 생성되는 개인 전용 공간
- **팀 워크스페이스**: 팀 생성 시 자동으로 생성되는 협업 공간

### 자동 생성 시점
- 회원가입: 개인 워크스페이스 1개 자동 생성 (`{nickname}의 워크스페이스`)
- 팀 생성: 팀 워크스페이스 1개 자동 생성 (팀 이름과 동일)

### WorkspaceSwitcher 기능
- 개인/팀 워크스페이스 전환
- 팀 워크스페이스 생성 (모달)
- 선택된 워크스페이스 표시
- 빈 상태 처리 (팀이 없을 때)
- 다크모드 지원

## 개발 가이드라인

### 컴포넌트 작성
- 서버 컴포넌트 기본, 필요시 "use client"
- 다국어 텍스트는 반드시 번역 파일 사용
- Tailwind CSS 클래스 사용
- 다크모드 지원 (dark: prefix)

### 새 페이지 추가
1. `src/app/[locale]/` 하위에 폴더 생성
2. 번역 키 추가 (ko.json, en.json)
3. 네비게이션 필요시 Sidebar 또는 Navbar 수정

### API 라우트 추가
- `src/app/api/` 하위에 생성 (locale 밖)
- DB 작업은 `src/lib/` 에 서비스 함수 작성

### 새 소셜 로그인 추가
1. `src/auth.ts` providers 배열에 추가
2. `.env.local`에 키 추가
3. `src/app/[locale]/login/page.tsx`에 버튼 추가

## 현재 구현 상태

### 완료
- [x] 카카오 로그인
- [x] 구글 로그인
- [x] 다국어 지원 (한/영)
- [x] SEO 메타데이터
- [x] 랜딩 페이지
- [x] 대시보드 UI
- [x] 태스크 CRUD (추가/수정/삭제)
- [x] 태스크 목록 조회 (DB 연동)
- [x] 태스크 모달 (보기/수정/생성 모드)
- [x] 태스크 파일 첨부 (업로드/삭제/다운로드)
- [x] 캘린더 날짜별 태스크 개수 표시 (DB 연동)
- [x] 팀 CRUD (생성/조회/수정/삭제)
- [x] 워크스페이스 CRUD (생성/조회/수정/삭제)
- [x] 워크스페이스 스위처 (개인/팀 그룹화)
- [x] JWT 인증 (외부 앱용) + NextAuth 세션 (웹용)
- [x] 외부 카카오 로그인 API (데스크탑/모바일)
- [x] 외부 구글 로그인 API (데스크탑/모바일)
- [x] 파일 업로드 API (개인/팀 저장소 지원)
- [x] 저장소 용량 관리 (플랜별 제한, 사용량 추적)
- [x] NicePay 빌링키(BID) 기반 자동결제 시스템
- [x] 정기결제 스케쥴러 (크론 엔드포인트)
- [x] 결제 이력 추적 (payment_history 테이블)
- [x] 빌링키 만료 API (카드 삭제 시 NicePay expire 호출)
- [x] 결제 내역 조회 API + 빌링 페이지 UI (결제 이력 테이블, 다음 결제일 표시)

### TODO
- [ ] 태스크 상태 변경 (TODO, IN_PROGRESS, DONE)
- [ ] 팀원 초대
- [ ] 권한 관리
- [ ] 프로필 설정
- [ ] 알림 기능
- [ ] 캘린더 상세 페이지
- [ ] 네이버 로그인 추가

## API 엔드포인트

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

#### 브라우저 기반 OAuth (권장)

**카카오**
- `GET /api/auth/kakao/start?callback={appCallback}` - 카카오 OAuth 시작 URL 생성
  - Query: `callback` (required) - 앱의 딥링크 URL (예: `deskcal://auth/callback`)
  - Returns: `{ authUrl: string, redirectUri: string, state: string }`
  - Note: `authUrl`을 브라우저에서 열어 카카오 로그인 진행
- `GET /api/auth/kakao/callback?code={code}&state={state}` - 카카오 OAuth 콜백 처리
  - Query: `code` - 카카오 인증 코드, `state` - 앱 callback URL (인코딩됨)
  - Response: 커스텀 스킴이면 `{callback}?accessToken=...&refreshToken=...` 로 리다이렉트
  - Fallback: JSON `{ accessToken, refreshToken, member: {...} }`

**구글**
- `GET /api/auth/google/start?callback={appCallback}` - 구글 OAuth 시작 URL 생성
  - Query: `callback` (required) - 앱의 딥링크 URL (예: `deskcal://auth/callback`)
  - Returns: `{ authUrl: string, redirectUri: string, state: string }`
  - Note: `authUrl`을 브라우저에서 열어 구글 로그인 진행
- `GET /api/auth/google/callback?code={code}&state={state}` - 구글 OAuth 콜백 처리
  - Query: `code` - 구글 인증 코드, `state` - 앱 callback URL (인코딩됨)
  - Response: 커스텀 스킴이면 `{callback}?accessToken=...&refreshToken=...` 로 리다이렉트
  - Fallback: JSON `{ accessToken, refreshToken, member: {...} }`

#### SDK 기반

**카카오 (카카오 SDK 사용 가능한 경우)**
- `POST /api/auth/external/kakao` - 카카오 토큰으로 로그인
  - Body: `{ access_token: string }` (카카오 SDK에서 받은 access_token)
  - Returns: `{ success: true, user: { memberId, nickname, email, provider }, accessToken, refreshToken, expiresIn }`
  - Note: 카카오 API로 토큰 검증 후 JWT 발급

**구글 (구글 SDK 사용 가능한 경우)**
- `POST /api/auth/external/google` - 구글 토큰으로 로그인
  - Body: `{ access_token: string }` (구글 SDK에서 받은 access_token)
  - Returns: `{ success: true, user: { memberId, nickname, email, provider }, accessToken, refreshToken, expiresIn }`
  - Note: 구글 API로 토큰 검증 후 JWT 발급

#### 공통
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

### Plans (플랜 관리)
- `GET /api/plans` - 모든 플랜 조회
  - Returns: `Plan[]`
- `GET /api/plans?id={planId}` - 특정 플랜 조회
  - Query: `id` (required)
  - Returns: `Plan`
- `POST /api/plans` - 새 플랜 생성 (관리자)
  - Body: `{ name: string, price: number, max_members: number, max_storage_mb: number }`
  - Returns: `Plan`
- `PUT /api/plans` - 플랜 수정 (관리자)
  - Body: `{ id: number, name: string, price: number, max_members: number, max_storage_mb: number }`
  - Returns: `Plan`
- `DELETE /api/plans?id={planId}` - 플랜 삭제 (관리자)
  - Query: `id` (required)
  - Returns: `{ message: string }`

### Subscriptions (구독 관리)
- `GET /api/subscriptions?team_id={teamId}` - 팀의 모든 구독 내역 조회
  - Query: `team_id` (required)
  - Returns: `Subscription[]`
- `GET /api/subscriptions?team_id={teamId}&active=true` - 팀의 활성 구독 조회
  - Query: `team_id` (required), `active=true`
  - Returns: `Subscription | null`
- `GET /api/subscriptions?id={subscriptionId}` - 특정 구독 조회
  - Query: `id` (required)
  - Returns: `Subscription`
- `POST /api/subscriptions` - 새 구독 생성 (기존 활성 구독은 자동 만료)
  - Body: `{ team_id: number, plan_id: number }`
  - Returns: `Subscription`
- `PUT /api/subscriptions` - 구독 상태 변경
  - Body: `{ id: number, status: "ACTIVE" | "CANCELED" | "EXPIRED" }` 또는 `{ id: number, action: "cancel" }`
  - Returns: `Subscription`
- `DELETE /api/subscriptions?id={subscriptionId}` - 구독 삭제
  - Query: `id` (required)
  - Returns: `{ message: string }`

### Payments (결제 이력)
- `GET /api/payments?owner_id={id}&owner_type={type}` - 결제 이력 조회
  - Query: `owner_id` (required), `owner_type` (required: "team" | "personal")
  - Returns: `{ payments: PaymentRecord[] }`

### Cron (정기결제 스케쥴러)
- `POST /api/cron/billing` - 정기결제 실행 (외부 크론에서 호출)
  - Headers: `Authorization: Bearer {CRON_SECRET}`
  - Returns: `{ success: true, processed: number, results: [...] }`
  - 동작: 결제일 도래 구독 조회 → 빌링키로 결제 → 이력 기록 → 날짜 연장 (실패 시 최대 3회 재시도 후 구독 만료)

### Files Upload (파일 업로드)
- `POST /api/files/upload` - 파일 업로드
  - Content-Type: `multipart/form-data`
  - Body:
    - `file` (required) - 업로드할 파일
    - `owner_type` (required) - "team" | "personal"
    - `owner_id` (required) - team_id 또는 member_id
    - `task_id` (optional) - 태스크에 바로 첨부할 경우
  - Returns: `{ success: true, file: FileRecord }`
  - Error (400): 파일 타입 미허용 또는 필수 필드 누락
  - Error (403): 저장소 용량 초과 `{ error, used_bytes, limit_bytes, max_file_size_bytes }`
  - 허용 파일 타입: 이미지(jpeg, png, gif, webp, svg), 문서(pdf, word, excel, ppt), 텍스트(plain, csv, md), 압축(zip, rar, 7z)

### Task Attachments (태스크 첨부파일)
- `GET /api/tasks/attachments?task_id={taskId}` - 태스크 첨부파일 목록
  - Query: `task_id` (required)
  - Returns: `{ attachments: TaskAttachmentWithFile[] }`
- `POST /api/tasks/attachments` - 태스크에 파일 첨부
  - Body: `{ task_id: number, file_id: number }`
  - Returns: `{ success: true, attachment_id: number }`
- `DELETE /api/tasks/attachments?attachment_id={id}` - 첨부 삭제 (attachment_id 기준)
  - Query: `attachment_id` (required)
  - Returns: `{ success: boolean }`
- `DELETE /api/tasks/attachments?task_id={id}&file_id={id}&delete_file={boolean}` - 첨부 삭제
  - Query: `task_id`, `file_id` (required), `delete_file` (optional, 파일도 함께 삭제할지)
  - Returns: `{ success: boolean }`

### Files (파일 관리 - 레거시)
- `GET /api/files?team_id={teamId}` - 팀의 모든 파일 조회
  - Query: `team_id` (required)
  - Returns: `File[]`
- `GET /api/files?team_id={teamId}&total_size=true` - 팀의 총 파일 크기 조회
  - Query: `team_id` (required), `total_size=true`
  - Returns: `{ team_id: number, total_size_mb: number }`
- `GET /api/files?id={fileId}` - 특정 파일 조회
  - Query: `id` (required)
  - Returns: `File`
- `POST /api/files` - 새 파일 생성 (저장소 용량 체크 후 생성)
  - Body: `{ team_id: number, file_name: string, file_size_mb: number }`
  - Returns: `File`
  - Error (403): 저장소 용량 초과 시 `{ error, current, limit, required }`
- `PUT /api/files` - 파일 이름 수정
  - Body: `{ id: number, file_name: string }`
  - Returns: `File`
- `DELETE /api/files?id={fileId}` - 파일 삭제 (저장소 사용량 자동 차감)
  - Query: `id` (required)
  - Returns: `{ message: string }`

### Storage (저장소 사용량 관리)
- `GET /api/storage?team_id={teamId}` - 팀의 저장소 사용량 조회
  - Query: `team_id` (required)
  - Returns: `TeamStorageUsage`
- `GET /api/storage?team_id={teamId}&check_limit={additionalMb}` - 용량 추가 가능 여부 확인
  - Query: `team_id` (required), `check_limit` (required)
  - Returns: `{ allowed: boolean, current: number, limit: number }`
- `POST /api/storage` - 저장소 사용량 초기화
  - Body: `{ team_id: number }`
  - Returns: `TeamStorageUsage`
- `POST /api/storage` - 저장소 사용량 재계산 (실제 파일 크기 합계로 동기화)
  - Body: `{ team_id: number, action: "recalculate" }`
  - Returns: `{ ...TeamStorageUsage, recalculated_size: number }`
- `PUT /api/storage` - 저장소 사용량 수정
  - Body: `{ team_id: number, used_storage_mb: number }`
  - Returns: `TeamStorageUsage`
- `DELETE /api/storage?team_id={teamId}` - 저장소 사용량 삭제
  - Query: `team_id` (required)
  - Returns: `{ message: string }`

## 데이터 모델

### Plan
```typescript
interface Plan {
  id: number;
  name: string;
  price: number;
  max_members: number;
  max_storage_mb: number;
  created_at: Date;
}
```

### Subscription
```typescript
interface Subscription {
  id: number;
  owner_id: number;
  owner_type: "team" | "personal";
  plan_id: number;
  status: "ACTIVE" | "CANCELED" | "EXPIRED";
  started_at: Date;
  ended_at: Date | null;
  next_payment_date: Date | null;
  billing_key_member_id: number | null;
  retry_count: number;
  plan_name?: string;
  plan_price?: number;
}
```

### FileRecord (신규)
```typescript
interface FileRecord {
  file_id: number;
  owner_type: "team" | "personal";
  owner_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;        // bytes
  mime_type: string | null;
  uploaded_by: number;
  created_at: Date;
}
```

### TaskAttachment
```typescript
interface TaskAttachment {
  attachment_id: number;
  task_id: number;
  file_id: number;
  created_at: Date;
  created_by: number;
}

interface TaskAttachmentWithFile extends TaskAttachment {
  original_name: string;
  stored_name: string;
  file_path: string;
  file_size: number;
  file_size_formatted: string;  // "1.5 MB" 형태
  mime_type: string | null;
}
```

### PaymentRecord
```typescript
interface PaymentRecord {
  payment_id: number;
  subscription_id: number;
  owner_id: number;
  owner_type: "team" | "personal";
  member_id: number;
  plan_id: number;
  amount: number;
  order_id: string;
  tid: string | null;
  bid: string;
  status: "SUCCESS" | "FAILED" | "REFUNDED";
  result_code: string | null;
  result_msg: string | null;
  payment_type: "FIRST" | "RECURRING" | "RETRY";
  created_at: Date;
  plan_name?: string;
}
```

### StorageUsage (신규)
```typescript
interface StorageUsage {
  owner_type: "team" | "personal";
  owner_id: number;
  used_bytes: number;
  file_count: number;
  updated_at: Date;
}

interface StorageLimitInfo {
  owner_type: "team" | "personal";
  owner_id: number;
  used_bytes: number;
  limit_bytes: number;
  file_count: number;
  max_file_size_bytes: number;
  plan_name: string;
}
```

### File (레거시)
```typescript
interface File {
  id: number;
  team_id: number;
  file_name: string;
  file_size_mb: number;
  created_at: Date;
}
```

### TeamStorageUsage (레거시)
```typescript
interface TeamStorageUsage {
  team_id: number;
  used_storage_mb: number;
  updated_at: Date;
}
```

## 저장소 관리 시스템

### 통합 저장소 (개인/팀 지원)
- `owner_type`: "team" | "personal"
- `owner_id`: team_id 또는 member_id
- 바이트 단위 정밀 추적

### 동작 방식
1. **파일 업로드 시**:
   - `canUploadFile()` 함수로 용량 체크 (단일 파일 크기 + 총 저장소 용량)
   - 용량 초과 시 403 에러 반환
   - 파일 생성과 동시에 `storage_usage` 증가 (트랜잭션)

2. **파일 삭제 시**:
   - 파일 삭제와 동시에 `storage_usage` 차감 (트랜잭션)

3. **저장소 재계산**:
   - `recalculateStorageUsage()` 함수로 실제 파일 크기 합계 동기화
   - 데이터 불일치 시 사용

### 플랜별 용량 제한
| 플랜 | 총 저장소 | 단일 파일 |
|------|-----------|-----------|
| Basic | 500MB | 5MB |
| Pro | 5GB | 25MB |
| Team | 50GB | 100MB |
| Enterprise | 500GB | 500MB |

- 활성 구독이 없으면 **Basic** 플랜 적용 (500MB / 5MB)

## 라이브러리 함수

### Plan 관련 (`src/lib/plan.ts`)
- `getAllPlans()` - 모든 플랜 조회
- `getPlanById(planId)` - 플랜 조회
- `createPlan(name, price, maxMembers, maxStorageMb)` - 플랜 생성
- `updatePlan(planId, name, price, maxMembers, maxStorageMb)` - 플랜 수정
- `deletePlan(planId)` - 플랜 삭제

### Subscription 관련 (`src/lib/subscription.ts`)
- `getSubscriptionsByOwnerId(ownerId, ownerType)` - 오너의 모든 구독 조회
- `getActiveSubscriptionByOwner(ownerId, ownerType)` - 오너의 활성 구독 조회
- `getSubscriptionById(subscriptionId)` - 구독 조회
- `createSubscription(ownerId, ownerType, planId, createdBy?, billingKeyMemberId?)` - 새 구독 생성 (기존 활성 구독 자동 만료, next_payment_date = +1개월)
- `updateSubscriptionStatus(subscriptionId, status)` - 구독 상태 변경
- `cancelSubscription(subscriptionId)` - 구독 취소 (next_payment_date = NULL)
- `deleteSubscription(subscriptionId)` - 구독 삭제
- `getDueSubscriptions()` - 결제일 도래 활성 구독 목록 조회
- `advancePaymentDate(subscriptionId)` - 다음 결제일 1개월 연장 + retry_count 리셋
- `incrementRetryCount(subscriptionId)` - 재시도 횟수 증가

### Payment History 관련 (`src/lib/payment-history.ts`)
- `createPaymentRecord(data)` - 결제 이력 기록
- `getPaymentsByOwner(ownerId, ownerType, limit?, offset?)` - 소유자별 결제 이력 조회
- `getPaymentsBySubscription(subscriptionId)` - 구독별 결제 이력 조회

### NicePay 관련 (`src/lib/nicepay.ts`)
- `registerBillingKey(tid, orderId, amount, goodsName)` - 빌키(BID) 발급
- `approveBilling(bid, orderId, amount, goodsName)` - 빌링 재결제
- `expireBillingKey(bid, orderId)` - 빌키 만료 (NicePay API)
- `generateMoid(prefix)` - 주문번호 생성

### File 관련 (`src/lib/file.ts`)
- `createFileRecord(data)` - 파일 레코드 생성 (저장소 사용량 자동 증가)
- `getFileById(fileId)` - 파일 조회
- `getFilesByOwner(ownerType, ownerId)` - 소유자별 파일 목록 조회
- `getFilesByUploader(uploadedBy)` - 업로더별 파일 목록 조회
- `deleteFileRecord(fileId)` - 파일 삭제 (저장소 사용량 자동 차감)
- `updateFileName(fileId, originalName)` - 파일 이름 수정
- `getTotalFileSize(ownerType, ownerId)` - 소유자별 총 파일 크기 조회
- `getFileCount(ownerType, ownerId)` - 소유자별 파일 개수 조회
- 레거시 호환: `getFilesByTeamId()`, `createFile()`, `updateFile()`, `deleteFile()`, `getTotalFileSizeByTeamId()`

### Task Attachment 관련 (`src/lib/task-attachment.ts`)
- `attachFileToTask(taskId, fileId, createdBy)` - 태스크에 파일 첨부
- `getTaskAttachments(taskId)` - 태스크 첨부파일 목록 (파일 정보 포함)
- `detachFileFromTask(taskId, fileId)` - 첨부 연결 해제
- `deleteTaskAttachment(attachmentId)` - 첨부 삭제 (ID 기준)
- `detachAllFilesFromTask(taskId)` - 태스크의 모든 첨부 해제
- `getTasksWithFile(fileId)` - 파일이 첨부된 태스크 목록
- `getTaskAttachmentCount(taskId)` - 첨부파일 개수
- `isFileAttachedToTask(taskId, fileId)` - 첨부 여부 확인

### Storage 관련 (`src/lib/storage.ts`)
- `getStorageUsage(ownerType, ownerId)` - 저장소 사용량 조회
- `initializeStorageUsage(ownerType, ownerId)` - 저장소 사용량 초기화
- `increaseStorageUsage(ownerType, ownerId, bytes)` - 사용량 증가
- `decreaseStorageUsage(ownerType, ownerId, bytes)` - 사용량 감소
- `recalculateStorageUsage(ownerType, ownerId)` - 사용량 재계산
- `getActivePlanForOwner(ownerType, ownerId)` - 활성 플랜 조회 (없으면 Basic)
- `getStorageLimitInfo(ownerType, ownerId)` - 저장소 한도 정보
- `canUploadFile(ownerType, ownerId, fileSizeBytes)` - 업로드 가능 여부 확인
- `deleteStorageUsage(ownerType, ownerId)` - 저장소 사용량 삭제
- 레거시 호환: `getStorageUsageByTeamId()`, `checkStorageLimit()`
- 유틸리티: `bytesToMB()`, `mbToBytes()`, `formatBytes()`

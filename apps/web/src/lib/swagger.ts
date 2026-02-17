import type { OpenAPIV3 } from "openapi-types";

const swaggerSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "Kelindor API Documentation",
    version: "1.0.0",
    description: `
# Kelindor API

Kelindor는 팀 협업, 프로젝트 관리, 태스크 관리를 위한 올인원 워크스페이스 플랫폼입니다.

## 인증 방식

### 웹 브라우저
- NextAuth.js 기반 쿠키 세션 인증

### 데스크탑/모바일 앱
- JWT Bearer 토큰 인증
- Access Token: 1시간 유효
- Refresh Token: 7일 유효

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## 외부 앱 인증 흐름

### 방법 1: 브라우저 기반 OAuth (권장)
1. \`GET /api/auth/kakao/start?callback=myapp://auth\` 호출하여 authUrl 획득
2. 브라우저에서 authUrl 열기 (사용자가 로그인)
3. 콜백 URL로 accessToken, refreshToken 수신

### 방법 2: SDK 기반
1. 앱에서 카카오/구글 SDK로 access_token 획득
2. \`POST /api/auth/external/kakao\` 또는 \`/api/auth/external/google\`에 access_token 전달
3. JWT 토큰 페어 수신

## 에러 응답
모든 에러는 다음 형식으로 반환됩니다:
\`\`\`json
{ "error": "에러 메시지" }
\`\`\`

## 공통 HTTP 상태 코드
- 200: 성공
- 201: 생성 성공
- 400: 잘못된 요청
- 401: 인증 필요
- 403: 권한 없음
- 404: 리소스 없음
- 500: 서버 오류
    `,
    contact: {
      name: "Kelindor Support",
      email: "support@kelindor.com",
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      description: "API Server",
    },
  ],
  tags: [
    { name: "Auth - External", description: "외부 앱용 인증 API (JWT)" },
    { name: "Auth - OAuth", description: "OAuth 인증 흐름 API" },
    { name: "Tasks", description: "태스크 CRUD API" },
    { name: "Workspaces", description: "워크스페이스 관리 API" },
    { name: "Teams", description: "팀 관리 API" },
    { name: "Tags", description: "태그 관리 API" },
    { name: "Files", description: "파일 업로드/관리 API" },
    { name: "Calendar", description: "캘린더 데이터 API" },
    { name: "Plans", description: "구독 플랜 API" },
    { name: "Subscriptions", description: "구독 관리 API" },
    { name: "Storage", description: "저장소 용량 관리 API" },
    { name: "Account", description: "계정 관리 API" },
    { name: "Releases", description: "앱 릴리즈 정보 API" },
    { name: "Admin", description: "관리자 API" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT Access Token을 Authorization 헤더에 Bearer 형식으로 전달",
      },
      CookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "next-auth.session-token",
        description: "NextAuth 세션 쿠키 (웹 브라우저 전용)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "에러 메시지" },
        },
        required: ["error"],
      },
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "integer", description: "태스크 ID" },
          title: { type: "string", description: "태스크 제목" },
          start_time: { type: "string", description: "시작 시간 (YYYY-MM-DD HH:mm:ss)" },
          end_time: { type: "string", description: "종료 시간 (YYYY-MM-DD HH:mm:ss)" },
          content: { type: "string", nullable: true, description: "태스크 내용" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"], description: "태스크 상태" },
          color: { type: "string", description: "태스크 색상 (HEX 코드)" },
          created_at: { type: "string", description: "생성 시간" },
          updated_at: { type: "string", description: "수정 시간" },
          created_by: { type: "integer", description: "생성자 member_id" },
          updated_by: { type: "integer", description: "수정자 member_id" },
          workspace_id: { type: "integer", description: "워크스페이스 ID" },
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tag_id: { type: "integer" },
                name: { type: "string" },
                color: { type: "string" },
              },
            },
            description: "연결된 태그 목록",
          },
        },
      },
      TaskCreate: {
        type: "object",
        required: ["title", "start_time", "end_time", "workspace_id"],
        properties: {
          title: { type: "string", description: "태스크 제목" },
          start_time: { type: "string", description: "시작 시간 (YYYY-MM-DDTHH:mm 형식)" },
          end_time: { type: "string", description: "종료 시간 (YYYY-MM-DDTHH:mm 형식)" },
          content: { type: "string", description: "태스크 내용" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"], default: "TODO" },
          color: { type: "string", default: "#3B82F6", description: "태스크 색상" },
          workspace_id: { type: "integer", description: "워크스페이스 ID" },
          tag_ids: { type: "array", items: { type: "integer" }, description: "태그 ID 목록" },
          file_ids: { type: "array", items: { type: "integer" }, description: "첨부파일 ID 목록" },
        },
      },
      TaskUpdate: {
        type: "object",
        required: ["task_id"],
        properties: {
          task_id: { type: "integer", description: "수정할 태스크 ID" },
          title: { type: "string", description: "태스크 제목" },
          start_time: { type: "string", description: "시작 시간" },
          end_time: { type: "string", description: "종료 시간" },
          content: { type: "string", description: "태스크 내용" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
          color: { type: "string", description: "태스크 색상" },
          tag_ids: { type: "array", items: { type: "integer" }, description: "태그 ID 목록" },
        },
      },
      Workspace: {
        type: "object",
        properties: {
          workspace_id: { type: "integer", description: "워크스페이스 ID" },
          name: { type: "string", description: "워크스페이스 이름" },
          type: { type: "string", enum: ["personal", "team"], description: "워크스페이스 타입" },
          owner_id: { type: "integer", description: "소유자 ID (member_id 또는 team_id)" },
          created_at: { type: "string" },
          created_by: { type: "integer", description: "생성자 member_id" },
        },
      },
      Team: {
        type: "object",
        properties: {
          team_id: { type: "integer", description: "팀 ID" },
          name: { type: "string", description: "팀 이름" },
          description: { type: "string", nullable: true, description: "팀 설명" },
          created_at: { type: "string" },
          created_by: { type: "integer", description: "생성자 member_id" },
        },
      },
      Tag: {
        type: "object",
        properties: {
          tag_id: { type: "integer", description: "태그 ID" },
          name: { type: "string", description: "태그 이름" },
          color: { type: "string", description: "태그 색상 (HEX 코드)" },
          owner_type: { type: "string", enum: ["team", "personal"], description: "소유자 타입" },
          owner_id: { type: "integer", description: "소유자 ID" },
          created_at: { type: "string" },
        },
      },
      File: {
        type: "object",
        properties: {
          file_id: { type: "integer", description: "파일 ID" },
          original_name: { type: "string", description: "원본 파일명" },
          file_path: { type: "string", description: "파일 경로 (S3 URL)" },
          file_size: { type: "integer", description: "파일 크기 (bytes)" },
          file_size_formatted: { type: "string", description: "파일 크기 (포맷팅된 문자열)" },
          mime_type: { type: "string", nullable: true, description: "MIME 타입" },
          owner_type: { type: "string", enum: ["team", "personal"] },
          owner_id: { type: "integer" },
          uploaded_by: { type: "integer", description: "업로더 member_id" },
          created_at: { type: "string" },
        },
      },
      TaskAttachment: {
        type: "object",
        properties: {
          attachment_id: { type: "integer" },
          task_id: { type: "integer" },
          file_id: { type: "integer" },
          original_name: { type: "string" },
          file_path: { type: "string" },
          file_size: { type: "integer" },
          file_size_formatted: { type: "string" },
          mime_type: { type: "string", nullable: true },
          created_at: { type: "string" },
        },
      },
      Plan: {
        type: "object",
        properties: {
          plan_id: { type: "integer", description: "플랜 ID" },
          name: { type: "string", description: "플랜 이름" },
          price: { type: "number", description: "가격 (USD)" },
          max_members: { type: "integer", description: "최대 멤버 수" },
          max_storage_mb: { type: "integer", description: "최대 저장소 용량 (MB)" },
          max_file_size_mb: { type: "integer", description: "최대 파일 크기 (MB)" },
          created_at: { type: "string" },
        },
      },
      Subscription: {
        type: "object",
        properties: {
          subscription_id: { type: "integer", description: "구독 ID" },
          owner_type: { type: "string", enum: ["team", "personal"] },
          owner_id: { type: "integer" },
          plan_id: { type: "integer", description: "플랜 ID" },
          status: { type: "string", enum: ["ACTIVE", "CANCELED", "EXPIRED"], description: "구독 상태" },
          started_at: { type: "string" },
          ended_at: { type: "string", nullable: true },
          plan_name: { type: "string", description: "플랜 이름" },
          plan_price: { type: "number", description: "플랜 가격" },
        },
      },
      StorageUsage: {
        type: "object",
        properties: {
          owner_type: { type: "string", enum: ["team", "personal"] },
          owner_id: { type: "integer" },
          used_bytes: { type: "integer", description: "사용 용량 (bytes)" },
          file_count: { type: "integer", description: "파일 개수" },
          updated_at: { type: "string" },
        },
      },
      StorageLimitInfo: {
        type: "object",
        properties: {
          owner_type: { type: "string", enum: ["team", "personal"] },
          owner_id: { type: "integer" },
          used_bytes: { type: "integer" },
          limit_bytes: { type: "integer" },
          file_count: { type: "integer" },
          max_file_size_bytes: { type: "integer" },
          plan_name: { type: "string" },
        },
      },
      Member: {
        type: "object",
        properties: {
          member_id: { type: "integer", description: "회원 ID" },
          email: { type: "string", description: "이메일" },
          nickname: { type: "string", description: "닉네임" },
          provider: { type: "string", enum: ["kakao", "google"], description: "소셜 로그인 제공자" },
          created_at: { type: "string" },
          lasted_at: { type: "string", description: "마지막 로그인" },
        },
      },
      AuthTokens: {
        type: "object",
        properties: {
          accessToken: { type: "string", description: "JWT Access Token (1시간 유효)" },
          refreshToken: { type: "string", description: "JWT Refresh Token (7일 유효)" },
          expiresIn: { type: "integer", description: "Access Token 만료 시간 (초)" },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          memberId: { type: "integer" },
          nickname: { type: "string" },
          email: { type: "string" },
          provider: { type: "string" },
        },
      },
      Release: {
        type: "object",
        properties: {
          id: { type: "integer" },
          version: { type: "string", description: "버전 (예: 1.0.0)" },
          platform: { type: "string", enum: ["windows", "macos", "linux"], description: "플랫폼" },
          download_url: { type: "string", description: "다운로드 URL" },
          release_notes: { type: "string", nullable: true, description: "릴리즈 노트" },
          is_latest: { type: "boolean", description: "최신 버전 여부" },
          created_at: { type: "string" },
        },
      },
    },
  },
  paths: {
    // ==================== Auth - External ====================
    "/api/auth/external/kakao": {
      post: {
        tags: ["Auth - External"],
        summary: "카카오 SDK 토큰으로 로그인",
        description: "카카오 SDK에서 받은 access_token으로 JWT 토큰 발급",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["access_token"],
                properties: {
                  access_token: { type: "string", description: "카카오 SDK access_token" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "로그인 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    user: { $ref: "#/components/schemas/AuthUser" },
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                    expiresIn: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "access_token 누락" },
          "401": { description: "유효하지 않은 토큰" },
        },
      },
    },
    "/api/auth/external/google": {
      post: {
        tags: ["Auth - External"],
        summary: "구글 SDK 토큰으로 로그인",
        description: "구글 SDK에서 받은 access_token으로 JWT 토큰 발급",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["access_token"],
                properties: {
                  access_token: { type: "string", description: "구글 SDK access_token" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "로그인 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    user: { $ref: "#/components/schemas/AuthUser" },
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                    expiresIn: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "access_token 누락" },
          "401": { description: "유효하지 않은 토큰" },
        },
      },
    },
    "/api/auth/external/refresh": {
      post: {
        tags: ["Auth - External"],
        summary: "토큰 갱신",
        description: "Refresh Token으로 새 Access Token 발급",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refresh_token"],
                properties: {
                  refresh_token: { type: "string", description: "Refresh Token" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "갱신 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                    expiresIn: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { description: "유효하지 않거나 만료된 Refresh Token" },
        },
      },
    },
    "/api/auth/external/me": {
      get: {
        tags: ["Auth - External"],
        summary: "현재 사용자 정보 조회",
        description: "JWT 토큰으로 현재 로그인된 사용자 정보 조회",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "사용자 정보",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/AuthUser" },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Auth - OAuth ====================
    "/api/auth/kakao/start": {
      get: {
        tags: ["Auth - OAuth"],
        summary: "카카오 OAuth 시작 URL 생성",
        description: "브라우저 기반 OAuth 흐름 시작을 위한 카카오 로그인 URL 생성",
        parameters: [
          {
            name: "callback",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "앱의 딥링크 콜백 URL (예: myapp://auth/callback)",
          },
        ],
        responses: {
          "200": {
            description: "OAuth URL 생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authUrl: { type: "string", description: "브라우저에서 열 카카오 로그인 URL" },
                    redirectUri: { type: "string" },
                    state: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "callback 파라미터 누락" },
        },
      },
    },
    "/api/auth/google/start": {
      get: {
        tags: ["Auth - OAuth"],
        summary: "구글 OAuth 시작 URL 생성",
        description: "브라우저 기반 OAuth 흐름 시작을 위한 구글 로그인 URL 생성",
        parameters: [
          {
            name: "callback",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "앱의 딥링크 콜백 URL (예: myapp://auth/callback)",
          },
        ],
        responses: {
          "200": {
            description: "OAuth URL 생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authUrl: { type: "string", description: "브라우저에서 열 구글 로그인 URL" },
                    redirectUri: { type: "string" },
                    state: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "callback 파라미터 누락" },
        },
      },
    },

    // ==================== Tasks ====================
    "/api/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 목록 조회",
        description: "워크스페이스의 태스크 목록을 페이징, 정렬, 필터링하여 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "workspace_id", in: "query", required: true, schema: { type: "integer" }, description: "워크스페이스 ID" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "페이지 번호" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "페이지당 항목 수" },
          { name: "sort_by", in: "query", schema: { type: "string", enum: ["start_time", "end_time", "created_at", "updated_at", "title", "status"], default: "start_time" }, description: "정렬 기준" },
          { name: "sort_order", in: "query", schema: { type: "string", enum: ["ASC", "DESC"], default: "DESC" }, description: "정렬 순서" },
          { name: "status", in: "query", schema: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] }, description: "상태 필터" },
          { name: "search", in: "query", schema: { type: "string" }, description: "제목/내용 검색어" },
        ],
        responses: {
          "200": {
            description: "태스크 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    totalPages: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "workspace_id 누락" },
          "401": { description: "인증 필요" },
          "403": { description: "워크스페이스 접근 권한 없음" },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "새 태스크 생성",
        description: "워크스페이스에 새 태스크 생성. 파일 첨부도 가능",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TaskCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "태스크 생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    taskId: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "필수 필드 누락 또는 유효성 검사 실패" },
          "401": { description: "인증 필요" },
          "403": { description: "워크스페이스 접근 권한 없음" },
        },
      },
      patch: {
        tags: ["Tasks"],
        summary: "태스크 수정",
        description: "기존 태스크 정보 수정",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TaskUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "수정 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Success" },
              },
            },
          },
          "400": { description: "task_id 누락" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Tasks"],
        summary: "태스크 삭제",
        description: "태스크 삭제",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "task_id", in: "query", required: true, schema: { type: "integer" }, description: "삭제할 태스크 ID" },
        ],
        responses: {
          "200": {
            description: "삭제 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Success" },
              },
            },
          },
          "400": { description: "task_id 누락" },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/tasks/date": {
      get: {
        tags: ["Tasks"],
        summary: "특정 날짜의 태스크 조회",
        description: "특정 날짜에 해당하는 태스크 목록 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "workspace_id", in: "query", required: true, schema: { type: "integer" }, description: "워크스페이스 ID" },
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" }, description: "조회할 날짜 (YYYY-MM-DD)" },
        ],
        responses: {
          "200": {
            description: "태스크 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
                  },
                },
              },
            },
          },
          "400": { description: "필수 파라미터 누락" },
          "401": { description: "인증 필요" },
          "403": { description: "접근 권한 없음" },
        },
      },
    },
    "/api/tasks/attachments": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 첨부파일 조회",
        description: "태스크에 첨부된 파일 목록 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "task_id", in: "query", required: true, schema: { type: "integer" }, description: "태스크 ID" },
        ],
        responses: {
          "200": {
            description: "첨부파일 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    attachments: { type: "array", items: { $ref: "#/components/schemas/TaskAttachment" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "태스크에 파일 첨부",
        description: "기존 파일을 태스크에 첨부",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["task_id", "file_id"],
                properties: {
                  task_id: { type: "integer" },
                  file_id: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "첨부 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Tasks"],
        summary: "첨부파일 삭제",
        description: "태스크에서 첨부파일 연결 해제 (옵션으로 파일도 삭제)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "attachment_id", in: "query", required: true, schema: { type: "integer" } },
          { name: "delete_file", in: "query", schema: { type: "boolean", default: false }, description: "파일도 함께 삭제할지 여부" },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Calendar ====================
    "/api/calendar": {
      get: {
        tags: ["Calendar"],
        summary: "월별 태스크 데이터 조회",
        description: "특정 월의 날짜별 태스크 목록 조회 (캘린더 표시용)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "workspace_id", in: "query", required: true, schema: { type: "integer" } },
          { name: "year", in: "query", required: true, schema: { type: "integer" }, description: "연도" },
          { name: "month", in: "query", required: true, schema: { type: "integer", minimum: 1, maximum: 12 }, description: "월 (1-12)" },
        ],
        responses: {
          "200": {
            description: "월별 태스크 데이터",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tasksByDate: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          date: { type: "string", description: "날짜 (YYYY-MM-DD)" },
                          tasks: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "integer" },
                                title: { type: "string" },
                                start_time: { type: "string" },
                                end_time: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
          "403": { description: "접근 권한 없음" },
        },
      },
    },

    // ==================== Workspaces ====================
    "/api/me/workspaces": {
      get: {
        tags: ["Workspaces"],
        summary: "내 워크스페이스 목록 조회",
        description: "로그인한 사용자의 개인 워크스페이스 + 소속된 팀 워크스페이스 목록",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        responses: {
          "200": {
            description: "워크스페이스 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspaces: { type: "array", items: { $ref: "#/components/schemas/Workspace" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/workspaces": {
      post: {
        tags: ["Workspaces"],
        summary: "새 워크스페이스 생성",
        description: "개인 또는 팀 워크스페이스 생성",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "type", "owner_id"],
                properties: {
                  name: { type: "string", description: "워크스페이스 이름" },
                  type: { type: "string", enum: ["personal", "team"] },
                  owner_id: { type: "integer", description: "소유자 ID" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspace: { $ref: "#/components/schemas/Workspace" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/workspaces/{id}": {
      get: {
        tags: ["Workspaces"],
        summary: "워크스페이스 상세 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "워크스페이스 정보",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspace: { $ref: "#/components/schemas/Workspace" },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
          "404": { description: "워크스페이스 없음" },
        },
      },
      patch: {
        tags: ["Workspaces"],
        summary: "워크스페이스 수정",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Workspaces"],
        summary: "워크스페이스 삭제",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/workspaces/member/{id}": {
      get: {
        tags: ["Workspaces"],
        summary: "회원의 워크스페이스 목록",
        description: "특정 회원의 워크스페이스 목록 조회 (본인만 가능)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "member_id" },
        ],
        responses: {
          "200": {
            description: "워크스페이스 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspaces: { type: "array", items: { $ref: "#/components/schemas/Workspace" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
          "403": { description: "접근 권한 없음" },
        },
      },
    },
    "/api/workspaces/team/{id}": {
      get: {
        tags: ["Workspaces"],
        summary: "팀의 워크스페이스 목록",
        description: "특정 팀의 워크스페이스 목록 조회 (팀 멤버만 가능)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "team_id" },
        ],
        responses: {
          "200": {
            description: "워크스페이스 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspaces: { type: "array", items: { $ref: "#/components/schemas/Workspace" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
          "403": { description: "접근 권한 없음" },
        },
      },
    },

    // ==================== Teams ====================
    "/api/me/teams": {
      get: {
        tags: ["Teams"],
        summary: "내 팀 목록 조회",
        description: "로그인한 사용자가 속한 팀 목록",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        responses: {
          "200": {
            description: "팀 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    teams: { type: "array", items: { $ref: "#/components/schemas/Team" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      post: {
        tags: ["Teams"],
        summary: "새 팀 생성",
        description: "새 팀 생성 (팀 워크스페이스도 자동 생성)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", description: "팀 이름" },
                  description: { type: "string", description: "팀 설명" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "팀 생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    teamId: { type: "integer" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/teams/{id}": {
      get: {
        tags: ["Teams"],
        summary: "팀 상세 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "팀 정보",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    team: { $ref: "#/components/schemas/Team" },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
          "404": { description: "팀 없음" },
        },
      },
      patch: {
        tags: ["Teams"],
        summary: "팀 정보 수정",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Teams"],
        summary: "팀 삭제",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Tags ====================
    "/api/tags": {
      get: {
        tags: ["Tags"],
        summary: "태그 목록 조회",
        description: "소유자(팀/개인)의 태그 목록",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "owner_type", in: "query", required: true, schema: { type: "string", enum: ["team", "personal"] } },
          { name: "owner_id", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "태그 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      post: {
        tags: ["Tags"],
        summary: "새 태그 생성",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "color", "owner_type", "owner_id"],
                properties: {
                  name: { type: "string" },
                  color: { type: "string", description: "HEX 색상 코드" },
                  owner_type: { type: "string", enum: ["team", "personal"] },
                  owner_id: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "태그 생성 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/tags/{id}": {
      patch: {
        tags: ["Tags"],
        summary: "태그 수정",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  color: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Tags"],
        summary: "태그 삭제",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Files ====================
    "/api/files": {
      get: {
        tags: ["Files"],
        summary: "파일 목록 조회",
        description: "소유자의 파일 목록 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "owner_type", in: "query", required: true, schema: { type: "string", enum: ["team", "personal"] } },
          { name: "owner_id", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "파일 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    files: { type: "array", items: { $ref: "#/components/schemas/File" } },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Files"],
        summary: "파일 삭제",
        description: "파일 삭제 (S3 + DB)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "query", required: true, schema: { type: "integer" }, description: "file_id" },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
          "404": { description: "파일 없음" },
        },
      },
    },
    "/api/files/upload": {
      post: {
        tags: ["Files"],
        summary: "파일 업로드",
        description: "S3에 파일 업로드 및 DB 등록. 저장소 용량 체크 후 업로드",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "owner_type", "owner_id"],
                properties: {
                  file: { type: "string", format: "binary", description: "업로드할 파일" },
                  owner_type: { type: "string", enum: ["team", "personal"] },
                  owner_id: { type: "string", description: "소유자 ID" },
                  task_id: { type: "string", description: "연결할 태스크 ID (옵션)" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "업로드 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    file: { $ref: "#/components/schemas/File" },
                  },
                },
              },
            },
          },
          "400": { description: "파일 없음 또는 잘못된 요청" },
          "401": { description: "인증 필요" },
          "403": {
            description: "저장소 용량 초과",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    used_bytes: { type: "integer" },
                    limit_bytes: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==================== Storage ====================
    "/api/storage": {
      get: {
        tags: ["Storage"],
        summary: "저장소 사용량 조회",
        description: "팀/개인의 저장소 사용량 및 한도 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "team_id", in: "query", required: true, schema: { type: "integer" } },
          { name: "check_limit", in: "query", schema: { type: "number" }, description: "추가하려는 용량(MB) - 한도 체크용" },
        ],
        responses: {
          "200": {
            description: "저장소 사용량",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        team_id: { type: "integer" },
                        used_storage_mb: { type: "number" },
                        updated_at: { type: "string" },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        allowed: { type: "boolean" },
                        current: { type: "number" },
                        limit: { type: "number" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      post: {
        tags: ["Storage"],
        summary: "저장소 초기화/재계산",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["team_id"],
                properties: {
                  team_id: { type: "integer" },
                  action: { type: "string", enum: ["recalculate"], description: "recalculate: 실제 파일 크기로 재계산" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "성공" },
          "401": { description: "인증 필요" },
        },
      },
      put: {
        tags: ["Storage"],
        summary: "저장소 사용량 수정",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["team_id", "used_storage_mb"],
                properties: {
                  team_id: { type: "integer" },
                  used_storage_mb: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Storage"],
        summary: "저장소 사용량 삭제",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "team_id", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Plans ====================
    "/api/plans": {
      get: {
        tags: ["Plans"],
        summary: "플랜 목록 조회",
        description: "모든 구독 플랜 조회 또는 특정 플랜 조회",
        parameters: [
          { name: "id", in: "query", schema: { type: "integer" }, description: "특정 플랜 ID (없으면 전체)" },
        ],
        responses: {
          "200": {
            description: "플랜 목록 또는 단일 플랜",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { type: "array", items: { $ref: "#/components/schemas/Plan" } },
                    { $ref: "#/components/schemas/Plan" },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // ==================== Subscriptions ====================
    "/api/subscriptions": {
      get: {
        tags: ["Subscriptions"],
        summary: "구독 조회",
        description: "팀의 구독 내역 조회 또는 특정 구독 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "team_id", in: "query", schema: { type: "integer" } },
          { name: "id", in: "query", schema: { type: "integer" }, description: "특정 구독 ID" },
          { name: "active", in: "query", schema: { type: "boolean" }, description: "활성 구독만 조회" },
        ],
        responses: {
          "200": {
            description: "구독 정보",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { type: "array", items: { $ref: "#/components/schemas/Subscription" } },
                    { $ref: "#/components/schemas/Subscription" },
                  ],
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      post: {
        tags: ["Subscriptions"],
        summary: "새 구독 생성",
        description: "새 구독 생성 (기존 활성 구독은 자동 만료)",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["team_id", "plan_id"],
                properties: {
                  team_id: { type: "integer" },
                  plan_id: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "구독 생성 성공" },
          "401": { description: "인증 필요" },
        },
      },
      put: {
        tags: ["Subscriptions"],
        summary: "구독 상태 변경",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "integer" },
                  status: { type: "string", enum: ["ACTIVE", "CANCELED", "EXPIRED"] },
                  action: { type: "string", enum: ["cancel"], description: "cancel로 구독 취소" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "상태 변경 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Subscriptions"],
        summary: "구독 삭제",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        parameters: [
          { name: "id", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "삭제 성공" },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Account ====================
    "/api/me/account": {
      get: {
        tags: ["Account"],
        summary: "내 계정 정보 조회",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        responses: {
          "200": {
            description: "계정 정보",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    member: { $ref: "#/components/schemas/Member" },
                  },
                },
              },
            },
          },
          "401": { description: "인증 필요" },
        },
      },
      patch: {
        tags: ["Account"],
        summary: "내 계정 정보 수정",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nickname: { type: "string" },
                  email: { type: "string" },
                  phone_number: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정 성공" },
          "401": { description: "인증 필요" },
        },
      },
      delete: {
        tags: ["Account"],
        summary: "회원 탈퇴",
        security: [{ BearerAuth: [] }, { CookieAuth: [] }],
        responses: {
          "200": { description: "탈퇴 완료" },
          "401": { description: "인증 필요" },
        },
      },
    },

    // ==================== Releases ====================
    "/api/releases": {
      get: {
        tags: ["Releases"],
        summary: "릴리즈 목록 조회",
        description: "앱 릴리즈 목록 (플랫폼별 필터 가능)",
        parameters: [
          { name: "platform", in: "query", schema: { type: "string", enum: ["windows", "macos", "linux"] } },
        ],
        responses: {
          "200": {
            description: "릴리즈 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    releases: { type: "array", items: { $ref: "#/components/schemas/Release" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/releases/latest": {
      get: {
        tags: ["Releases"],
        summary: "최신 릴리즈 조회",
        description: "플랫폼별 최신 릴리즈 정보",
        parameters: [
          { name: "platform", in: "query", required: true, schema: { type: "string", enum: ["windows", "macos", "linux"] } },
        ],
        responses: {
          "200": {
            description: "최신 릴리즈",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Release" },
              },
            },
          },
          "404": { description: "해당 플랫폼 릴리즈 없음" },
        },
      },
    },

    // ==================== Admin ====================
    "/api/admin/login": {
      post: {
        tags: ["Admin"],
        summary: "관리자 로그인",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "로그인 성공" },
          "401": { description: "인증 실패" },
        },
      },
    },
    "/api/admin/logout": {
      post: {
        tags: ["Admin"],
        summary: "관리자 로그아웃",
        responses: {
          "200": { description: "로그아웃 성공" },
        },
      },
    },
    "/api/admin/me": {
      get: {
        tags: ["Admin"],
        summary: "현재 관리자 정보",
        responses: {
          "200": { description: "관리자 정보" },
          "401": { description: "인증 필요" },
        },
      },
    },
    "/api/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "통계 데이터",
        description: "전체 회원, 팀, 태스크 등 통계",
        responses: {
          "200": {
            description: "통계 데이터",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalMembers: { type: "integer" },
                    totalTeams: { type: "integer" },
                    totalTasks: { type: "integer" },
                    totalWorkspaces: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/members": {
      get: {
        tags: ["Admin"],
        summary: "회원 목록 조회",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "회원 목록" },
        },
      },
    },
    "/api/admin/teams": {
      get: {
        tags: ["Admin"],
        summary: "팀 목록 조회",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "팀 목록" },
        },
      },
    },
    "/api/admin/plans": {
      get: {
        tags: ["Admin"],
        summary: "플랜 관리 - 목록 조회",
        responses: {
          "200": { description: "플랜 목록" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "플랜 관리 - 새 플랜 생성",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "price", "max_members", "max_storage_mb"],
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                  max_members: { type: "integer" },
                  max_storage_mb: { type: "integer" },
                  max_file_size_mb: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "플랜 생성 성공" },
        },
      },
      put: {
        tags: ["Admin"],
        summary: "플랜 관리 - 플랜 수정",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                  price: { type: "number" },
                  max_members: { type: "integer" },
                  max_storage_mb: { type: "integer" },
                  max_file_size_mb: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정 성공" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "플랜 관리 - 플랜 삭제",
        parameters: [
          { name: "id", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "삭제 성공" },
        },
      },
    },
    "/api/admin/subscriptions": {
      get: {
        tags: ["Admin"],
        summary: "구독 관리 - 목록 조회",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "구독 목록" },
        },
      },
    },
    "/api/admin/admins": {
      get: {
        tags: ["Admin"],
        summary: "관리자 계정 목록",
        responses: {
          "200": { description: "관리자 목록" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "새 관리자 생성",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                  role: { type: "string", enum: ["SUPER_ADMIN", "ADMIN"] },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "관리자 생성 성공" },
        },
      },
    },
  },
};

export default swaggerSpec;

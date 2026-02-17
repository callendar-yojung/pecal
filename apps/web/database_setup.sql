-- Kelindor 데이터베이스 테이블 생성 스크립트

-- 1. 회원 테이블
CREATE TABLE IF NOT EXISTS members (
  member_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider       VARCHAR(50),      -- 소셜 로그인 제공자 (kakao, google 등)
  provider_id    VARCHAR(200),     -- 제공자 고유 ID
  created_at     DATETIME,
  lasted_at      DATETIME,         -- 마지막 로그인
  email          VARCHAR(200),
  phone_number   VARCHAR(100),
  nickname       VARCHAR(200),     -- 자동 생성
  profile_image_url VARCHAR(500),  -- 프로필 이미지 URL
  UNIQUE KEY unique_provider (provider, provider_id),  -- 중복 가입 방지
  UNIQUE KEY unique_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_provider ON members(provider, provider_id);

-- 2. 팀 테이블
CREATE TABLE IF NOT EXISTS teams (
  team_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
  name         VARCHAR(100),
  created_at   DATETIME,
  created_by   BIGINT,            -- member_id
  description  VARCHAR(255),
  FOREIGN KEY (created_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 팀 역할 테이블
CREATE TABLE IF NOT EXISTS team_roles (
  team_role_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id       BIGINT NOT NULL,
  name          VARCHAR(50),      -- Manager, Lead, Member 등
  created_at    DATETIME,
  created_by    BIGINT,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (created_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 팀 멤버 테이블
CREATE TABLE IF NOT EXISTS team_members (
  team_member_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id         BIGINT NOT NULL,
  member_id       BIGINT NOT NULL,
  team_role_id    BIGINT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (member_id) REFERENCES members(member_id),
  FOREIGN KEY (team_role_id) REFERENCES team_roles(team_role_id),
  UNIQUE KEY unique_team_member (team_id, member_id)  -- 같은 팀에 중복 가입 방지
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_team_members_member ON team_members(member_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);

-- 5. 권한 테이블
CREATE TABLE IF NOT EXISTS permissions (
  permission_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  code           VARCHAR(50),     -- READ, WRITE, DELETE 등
  description    VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 팀 역할 권한 테이블
CREATE TABLE IF NOT EXISTS team_role_permissions (
  team_role_permission_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_id            BIGINT NOT NULL,
  team_role_id             BIGINT NOT NULL,
  FOREIGN KEY (permission_id) REFERENCES permissions(permission_id),
  FOREIGN KEY (team_role_id) REFERENCES team_roles(team_role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.5 팀 초대 테이블
CREATE TABLE IF NOT EXISTS team_invitations (
  invitation_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_id            BIGINT NOT NULL,
  invited_member_id  BIGINT NOT NULL,
  invited_by         BIGINT NOT NULL,
  status             ENUM('PENDING', 'ACCEPTED', 'DECLINED') DEFAULT 'PENDING',
  created_at         DATETIME,
  responded_at       DATETIME,
  UNIQUE KEY unique_team_invitation (team_id, invited_member_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (invited_member_id) REFERENCES members(member_id),
  FOREIGN KEY (invited_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.6 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id       BIGINT NOT NULL,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(200),
  message         VARCHAR(500),
  payload_json    TEXT,
  source_type     VARCHAR(50),
  source_id       BIGINT,
  is_read         TINYINT DEFAULT 0,
  created_at      DATETIME,
  read_at         DATETIME,
  FOREIGN KEY (member_id) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_notifications_member ON notifications(member_id, is_read, created_at);
CREATE INDEX idx_notifications_source ON notifications(source_type, source_id);

-- 7. 워크스페이스 테이블
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  type          VARCHAR(20) NOT NULL,  -- 'personal' 또는 'team'
  owner_id      BIGINT NOT NULL,       -- member_id (personal) 또는 team_id (team)
  name          VARCHAR(100) NOT NULL,
  created_at    DATETIME NOT NULL,
  created_by    BIGINT NOT NULL,       -- member_id
  FOREIGN KEY (created_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_workspaces_type ON workspaces(type);
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);

-- 8. 태스크 테이블
CREATE TABLE IF NOT EXISTS tasks (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  title         VARCHAR(100) NOT NULL,
  start_time    DATETIME NOT NULL,
  end_time      DATETIME,                  -- NULL 허용 (진행 중인 태스크)
  content       TEXT,
  status        VARCHAR(50) DEFAULT 'TODO',  -- TODO, IN_PROGRESS, DONE 등
  color         VARCHAR(20) DEFAULT '#3B82F6',  -- 태스크 색상
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  created_by    BIGINT NOT NULL,           -- member_id
  updated_by    BIGINT NOT NULL,           -- member_id
  workspace_id  BIGINT NOT NULL,           -- 워크스페이스 소속
  FOREIGN KEY (created_by) REFERENCES members(member_id),
  FOREIGN KEY (updated_by) REFERENCES members(member_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_start_time ON tasks(start_time);

-- 9. 태그 테이블
CREATE TABLE IF NOT EXISTS tags (
  tag_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  color       VARCHAR(20) DEFAULT '#3B82F6',
  owner_type  ENUM('team', 'personal') NOT NULL,
  owner_id    BIGINT NOT NULL,  -- team_id 또는 member_id
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by  BIGINT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES members(member_id),
  UNIQUE KEY unique_tag_name (owner_type, owner_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_tags_owner ON tags(owner_type, owner_id);
CREATE INDEX idx_tags_created_by ON tags(created_by);

-- 10. 태스크-태그 연결 테이블
CREATE TABLE IF NOT EXISTS task_tags (
  task_tag_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id      BIGINT NOT NULL,
  tag_id       BIGINT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE,
  UNIQUE KEY unique_task_tag (task_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_task_tags_task ON task_tags(task_id);
CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);

-- 11. 플랜 테이블
CREATE TABLE IF NOT EXISTS plans (
  plan_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(50) NOT NULL UNIQUE,
  price          INT NOT NULL,
  max_members    INT NOT NULL,
  max_storage_mb INT NOT NULL,
  max_file_size_mb INT NOT NULL DEFAULT 10,  -- 단일 파일 최대 크기
  plan_type      ENUM('personal','team') NOT NULL DEFAULT 'personal',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 플랜 데이터 삽입
INSERT INTO plans (name, price, max_members, max_storage_mb, max_file_size_mb, plan_type, created_at) VALUES
  ('Basic', 0, 1, 500, 5, 'personal', NOW()),       -- 무료: 개인용, 500MB, 파일당 5MB
  ('Plus', 5000, 5, 5000, 25, 'personal', NOW()),    -- 프로: 5명, 5GB, 파일당 25MB
  ('Team', 15000, 50, 50000, 100, 'team', NOW()),  -- 팀: 50명, 50GB, 파일당 100MB
  ('Enterprise', 50000, 999, 500000, 500, 'team', NOW())  -- 엔터프라이즈: 무제한, 500GB, 파일당 500MB
ON DUPLICATE KEY UPDATE name=name;

-- 12. 구독 테이블 (팀 또는 개인 단위)
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_id         BIGINT NOT NULL,           -- member_id (personal) 또는 team_id (team)
  owner_type       ENUM('team','personal') NOT NULL,
  plan_id          BIGINT NOT NULL,
  status           ENUM('ACTIVE','CANCELED','EXPIRED') NOT NULL,
  started_at       DATETIME NOT NULL,
  ended_at         DATETIME NULL,
  created_by       BIGINT NOT NULL,           -- 구독을 생성한 member_id
  FOREIGN KEY (plan_id) REFERENCES plans(plan_id),
  FOREIGN KEY (created_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_subscriptions_owner ON subscriptions(owner_id, owner_type);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- 13. 파일 테이블 (개인/팀 모두 지원)
CREATE TABLE IF NOT EXISTS files (
  file_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_type     ENUM('team', 'personal') NOT NULL,
  owner_id       BIGINT NOT NULL,             -- team_id 또는 member_id
  original_name  VARCHAR(255) NOT NULL,       -- 원본 파일명
  stored_name    VARCHAR(255) NOT NULL,       -- 저장된 파일명 (UUID 등)
  file_path      VARCHAR(500) NOT NULL,       -- S3 경로 또는 로컬 경로
  file_size      BIGINT NOT NULL,             -- 바이트 단위
  mime_type      VARCHAR(100),                -- MIME 타입
  uploaded_by    BIGINT NOT NULL,             -- member_id
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_files_owner ON files(owner_type, owner_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

-- 14. 태스크 첨부파일 테이블
CREATE TABLE IF NOT EXISTS task_attachments (
  attachment_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id        BIGINT NOT NULL,
  file_id        BIGINT NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by     BIGINT NOT NULL,             -- member_id
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES members(member_id),
  UNIQUE KEY unique_task_file (task_id, file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_file ON task_attachments(file_id);

-- 14-1. 태스크 내보내기 테이블
CREATE TABLE IF NOT EXISTS task_exports (
  export_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id     BIGINT NOT NULL,
  token       VARCHAR(64) NOT NULL UNIQUE,
  visibility  ENUM('public', 'restricted') NOT NULL DEFAULT 'restricted',
  created_by  BIGINT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at  DATETIME NULL,
  expires_at  DATETIME NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES members(member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_task_exports_task ON task_exports(task_id);
CREATE INDEX idx_task_exports_created_by ON task_exports(created_by);
CREATE INDEX idx_task_exports_expires ON task_exports(expires_at);

-- 14-2. 태스크 내보내기 접근 허용 테이블
CREATE TABLE IF NOT EXISTS task_export_access (
  export_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  added_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (export_id, member_id),
  FOREIGN KEY (export_id) REFERENCES task_exports(export_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_task_export_access_member ON task_export_access(member_id);

-- 15. 메모 테이블 (개인/팀 개인 메모)
CREATE TABLE IF NOT EXISTS memos (
  memo_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_type ENUM('team', 'personal') NOT NULL,
  owner_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT 'Untitled',
  content_json LONGTEXT NOT NULL,
  is_favorite TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_type, owner_id),
  INDEX idx_owner_member (owner_type, owner_id, member_id),
  INDEX idx_member (member_id),
  INDEX idx_favorite (is_favorite),
  INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. 저장소 사용량 테이블 (개인/팀 모두 지원)
CREATE TABLE IF NOT EXISTS storage_usage (
  owner_type       ENUM('team', 'personal') NOT NULL,
  owner_id         BIGINT NOT NULL,           -- team_id 또는 member_id
  used_bytes       BIGINT NOT NULL DEFAULT 0, -- 바이트 단위
  file_count       INT NOT NULL DEFAULT 0,    -- 파일 개수
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_type, owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. 관리자 테이블
CREATE TABLE IF NOT EXISTS admins (
  admin_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,  -- 해시된 비밀번호
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(200) NOT NULL UNIQUE,
  role        VARCHAR(50) DEFAULT 'ADMIN',  -- SUPER_ADMIN, ADMIN
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login  DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 추가
CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_email ON admins(email);

-- 기본 관리자 계정 생성 (비밀번호: admin1234)
INSERT INTO admins (username, password, name, email, role, created_at) VALUES
  ('admin', '$2a$12$AsurKcvmeNml8P47f4fDuOtS.gcumADVs3kWe4Ie5dXuybfJBaw4i', '시스템 관리자', 'admin@task.com', 'SUPER_ADMIN', NOW())
ON DUPLICATE KEY UPDATE username=username;


CREATE TABLE billing_keys (
    billing_key_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    bid VARCHAR(50) NOT NULL,
    card_code VARCHAR(10),
    card_name VARCHAR(50),
    card_no_masked VARCHAR(20),
    status ENUM('ACTIVE','REMOVED') DEFAULT
  'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_member_status (member_id, status)
  );

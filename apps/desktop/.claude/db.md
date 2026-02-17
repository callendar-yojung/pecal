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

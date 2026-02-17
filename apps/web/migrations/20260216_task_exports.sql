-- Task export tables and columns
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

CREATE TABLE IF NOT EXISTS task_export_access (
  export_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  added_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (export_id, member_id),
  FOREIGN KEY (export_id) REFERENCES task_exports(export_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_task_export_access_member ON task_export_access(member_id);

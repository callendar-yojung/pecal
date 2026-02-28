CREATE TABLE IF NOT EXISTS member_push_tokens (
  push_token_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL,
  platform ENUM('ios','android') NOT NULL,
  device_id VARCHAR(191) NULL,
  app_build VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_token (token),
  INDEX idx_push_member_active (member_id, is_active),
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

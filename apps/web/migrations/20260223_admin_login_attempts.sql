CREATE TABLE IF NOT EXISTS admin_login_attempts (
  attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  fail_count INT NOT NULL DEFAULT 0,
  first_failed_at DATETIME NULL,
  last_failed_at DATETIME NULL,
  locked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_login_attempt (username, ip_address),
  INDEX idx_admin_login_locked_until (locked_until),
  INDEX idx_admin_login_last_failed_at (last_failed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

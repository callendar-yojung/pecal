CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  status ENUM('PROCESSING', 'COMPLETED') NOT NULL DEFAULT 'PROCESSING',
  payload_json LONGTEXT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  UNIQUE KEY uq_paypal_webhook_event (provider, event_id),
  INDEX idx_paypal_webhook_status (provider, status, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

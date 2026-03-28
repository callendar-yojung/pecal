CREATE TABLE IF NOT EXISTS task_recurrences (
  recurrence_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekdays_csv VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_recurrences_task_id (task_id),
  KEY idx_task_recurrences_range (start_date, end_date),
  CONSTRAINT fk_task_recurrences_task
    FOREIGN KEY (task_id)
    REFERENCES tasks(id)
    ON DELETE CASCADE
);

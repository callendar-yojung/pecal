CREATE TABLE IF NOT EXISTS categories (
  category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  owner_type ENUM('team', 'personal') NOT NULL,
  owner_id BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES members(member_id),
  UNIQUE KEY uq_category_name (owner_type, owner_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_categories_owner ON categories(owner_type, owner_id);
CREATE INDEX idx_categories_created_by ON categories(created_by);

ALTER TABLE tasks
  ADD COLUMN category_id BIGINT NULL AFTER color,
  ADD INDEX idx_tasks_category_id (category_id),
  ADD CONSTRAINT fk_tasks_category
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN reminder_minutes INT NULL AFTER color,
  ADD COLUMN rrule VARCHAR(255) NULL AFTER reminder_minutes;

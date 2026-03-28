ALTER TABLE member_settings
  ADD COLUMN IF NOT EXISTS task_color_presets JSON NULL
  AFTER marketing_consent;


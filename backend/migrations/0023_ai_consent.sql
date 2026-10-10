-- When the user agreed to have their meal photos and weekly logs analysed by the AI
-- provider; null until they do, and again after they withdraw it.
-- depends: 0022_weekly_reports

ALTER TABLE users ADD COLUMN ai_consent_at TEXT;

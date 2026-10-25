-- V4Career migration: normalized salary metadata for job listings.
-- Backward-compatible: existing jobs keep NULL salary bounds; no records are deleted.
-- Run once against the job_portal database before starting the updated application.
USE job_portal;

ALTER TABLE jobs
    ADD COLUMN salary_min DECIMAL(15,2) NULL AFTER experience,
    ADD COLUMN salary_max DECIMAL(15,2) NULL AFTER salary_min,
    ADD COLUMN salary_currency CHAR(3) NOT NULL DEFAULT 'INR' AFTER salary_max,
    ADD COLUMN salary_period VARCHAR(12) NOT NULL DEFAULT 'year' AFTER salary_currency;

CREATE INDEX idx_jobs_salary_filter
    ON jobs (salary_currency, salary_period, salary_min, salary_max);
CREATE INDEX idx_jobs_created_at
    ON jobs (created_at);
CREATE INDEX idx_collection_runs_started_at
    ON collection_runs (started_at);

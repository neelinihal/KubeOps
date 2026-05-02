CREATE SCHEMA IF NOT EXISTS aws;

-- K8s cache table
CREATE TABLE IF NOT EXISTS aws.k8s_cache (
    id BIGSERIAL PRIMARY KEY,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    data TEXT NOT NULL,
    fetched_at TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_key ON aws.k8s_cache (cache_key);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ce_command_name ON aws.command_execution (command_name);
CREATE INDEX IF NOT EXISTS idx_ce_executed_at ON aws.command_execution (executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ce_status ON aws.command_execution (status);
CREATE INDEX IF NOT EXISTS idx_ce_command_status ON aws.command_execution (command_name, status);

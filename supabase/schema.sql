-- CoinScope Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: tracked_coins
-- ============================================
CREATE TABLE IF NOT EXISTS tracked_coins (
    id INTEGER PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tracking_mode VARCHAR(10) NOT NULL CHECK (tracking_mode IN ('cmc', 'entry')),
    entry_price DECIMAL(20, 8),
    entry_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracked_coins_id ON tracked_coins(id);
CREATE INDEX IF NOT EXISTS idx_tracked_coins_symbol ON tracked_coins(symbol);

-- ============================================
-- TABLE: snapshots
-- ============================================
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_id INTEGER NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    percent_change_7d DECIMAL(10, 2),
    percent_change_24h DECIMAL(10, 2),
    volume_24h DECIMAL(30, 2),
    market_cap DECIMAL(30, 2),
    tier VARCHAR(20),
    tier_label VARCHAR(20),
    score DECIMAL(10, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_coin_id ON snapshots(coin_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_coin_timestamp ON snapshots(coin_id, timestamp DESC);

-- ============================================
-- TABLE: api_cache
-- ============================================
CREATE TABLE IF NOT EXISTS api_cache (
    key VARCHAR(100) PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

-- ============================================
-- FUNCTION: Update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_tracked_coins_updated_at ON tracked_coins;
CREATE TRIGGER update_tracked_coins_updated_at
    BEFORE UPDATE ON tracked_coins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_cache_updated_at ON api_cache;
CREATE TRIGGER update_api_cache_updated_at
    BEFORE UPDATE ON api_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Clean expired cache
-- ============================================
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM api_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: tracked_with_latest_snapshot
-- ============================================
CREATE OR REPLACE VIEW tracked_with_latest_snapshot AS
SELECT
    tc.id,
    tc.symbol,
    tc.name,
    tc.added_at,
    tc.tracking_mode,
    tc.entry_price,
    tc.entry_timestamp,
    s.price as latest_price,
    s.percent_change_7d,
    s.percent_change_24h,
    s.volume_24h,
    s.market_cap,
    s.tier,
    s.tier_label,
    s.score as weighted_score,
    s.timestamp as snapshot_timestamp,
    CASE
        WHEN tc.tracking_mode = 'entry' AND tc.entry_price IS NOT NULL AND s.price IS NOT NULL THEN
            jsonb_build_object(
                'entry_price', tc.entry_price,
                'entry_timestamp', tc.entry_timestamp,
                'latest_price', s.price,
                'latest_timestamp', s.timestamp,
                'price_change', s.price - tc.entry_price,
                'price_change_percent', ((s.price - tc.entry_price) / tc.entry_price) * 100
            )
        ELSE NULL
    END as entry_performance,
    (SELECT COUNT(*) FROM snapshots WHERE coin_id = tc.id) as snapshot_count
FROM tracked_coins tc
LEFT JOIN LATERAL (
    SELECT * FROM snapshots
    WHERE coin_id = tc.id
    ORDER BY timestamp DESC
    LIMIT 1
) s ON true;

-- ============================================
-- FUNCTION: Add or update tracked coin
-- ============================================
CREATE OR REPLACE FUNCTION upsert_tracked_coin(
    p_id INTEGER,
    p_symbol VARCHAR(20),
    p_name VARCHAR(100),
    p_tracking_mode VARCHAR(10),
    p_entry_price DECIMAL(20, 8) DEFAULT NULL
)
RETURNS TABLE (id INTEGER, symbol VARCHAR(20), name VARCHAR(100)) AS $$
BEGIN
    INSERT INTO tracked_coins (id, symbol, name, tracking_mode, entry_price, entry_timestamp)
    VALUES (p_id, p_symbol, p_name, p_tracking_mode,
            CASE WHEN p_tracking_mode = 'entry' THEN p_entry_price ELSE NULL END,
            CASE WHEN p_tracking_mode = 'entry' THEN NOW() ELSE NULL END)
    ON CONFLICT (id) DO UPDATE SET
        tracking_mode = EXCLUDED.tracking_mode,
        entry_price = CASE WHEN EXCLUDED.tracking_mode = 'entry' THEN EXCLUDED.entry_price ELSE tracked_coins.entry_price END,
        entry_timestamp = CASE WHEN EXCLUDED.tracking_mode = 'entry' THEN NOW() ELSE tracked_coins.entry_timestamp END,
        updated_at = NOW()
    RETURNING id, symbol, name;
END;
$$ LANGUAGE plpgsql;

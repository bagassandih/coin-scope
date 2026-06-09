-- Migration: Add percent_change_30d to snapshots table
-- Date: 2026-06-09
-- Description: Add 30d trend data for 1-month spot trading scoring

-- Add column to snapshots table
ALTER TABLE snapshots
ADD COLUMN IF NOT EXISTS percent_change_30d DECIMAL(10, 2);

-- Update the view to include 30d data
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
    s.percent_change_30d,
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

-- Comment to document the change
COMMENT ON COLUMN snapshots.percent_change_30d IS '30-day price change percentage - PRIMARY indicator (40% weight) for 1-month spot trading';

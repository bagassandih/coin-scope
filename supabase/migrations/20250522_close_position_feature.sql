-- Migration: Close Position Feature & Snapshot Count
-- Date: 2025-05-22
-- Description: Add status tracking for closed positions and snapshot count display

-- Drop existing view first
DROP VIEW IF EXISTS tracked_with_latest_snapshot;

-- Add new columns to tracked_coins for close position feature
ALTER TABLE tracked_coins
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed'));

ALTER TABLE tracked_coins
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE tracked_coins
ADD COLUMN IF NOT EXISTS close_reason TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tracked_coins_status ON tracked_coins(status);
CREATE INDEX IF NOT EXISTS idx_tracked_coins_closed_at ON tracked_coins(closed_at DESC);

-- Recreate view with new columns and snapshot count
CREATE VIEW tracked_with_latest_snapshot AS
SELECT
  tc.id,
  tc.symbol,
  tc.name,
  tc.tracking_mode,
  tc.entry_price,
  tc.entry_timestamp,
  tc.added_at,
  tc.status,
  tc.closed_at,
  tc.close_reason,
  s.price,
  s.percent_change_7d,
  s.percent_change_24h,
  s.volume_24h,
  s.market_cap,
  s.tier,
  s.tier_label,
  s.score,
  s.timestamp as snapshot_timestamp,
  (SELECT COUNT(*) FROM snapshots sn WHERE sn.coin_id = tc.id) as snapshot_count
FROM tracked_coins tc
LEFT JOIN LATERAL (
  SELECT *
  FROM snapshots
  WHERE snapshots.coin_id = tc.id
  ORDER BY timestamp DESC
  LIMIT 1
) s ON true
WHERE tc.status = 'active';

-- Comments for documentation
COMMENT ON COLUMN tracked_coins.status IS 'Position status: active (currently tracked) or closed (no longer tracked)';
COMMENT ON COLUMN tracked_coins.closed_at IS 'Timestamp when position was closed';
COMMENT ON COLUMN tracked_coins.close_reason IS 'Reason for closing: take_profit, cutloss, stagnant, or custom text';

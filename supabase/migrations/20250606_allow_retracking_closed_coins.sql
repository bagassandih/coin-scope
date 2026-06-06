-- Migration: Allow Re-tracking Closed Coins
-- Date: 2026-06-06
-- Description: Change primary key from CMC coin ID to UUID to allow multiple tracking cycles per coin

-- Step 1: Drop existing views and functions that depend on the table
DROP VIEW IF EXISTS tracked_with_latest_snapshot;
DROP FUNCTION IF EXISTS upsert_tracked_coin;

-- Step 2: Add a new UUID column that will become the primary key
ALTER TABLE tracked_coins
ADD COLUMN IF NOT EXISTS tracking_id UUID DEFAULT uuid_generate_v4() NOT NULL;

-- Step 3: Make the new UUID column the primary key
-- First drop the existing primary key constraint
ALTER TABLE tracked_coins
DROP CONSTRAINT tracked_coins_pkey;

-- Add new primary key on tracking_id
ALTER TABLE tracked_coins
ADD PRIMARY KEY (tracking_id);

-- Step 4: Rename the old 'id' column to 'coin_id' (CMC coin ID reference)
-- and ensure it's NOT NULL
ALTER TABLE tracked_coins
RENAME COLUMN id TO coin_id;

ALTER TABLE tracked_coins
ALTER COLUMN coin_id SET NOT NULL;

-- Step 5: Update indexes to use the new structure
DROP INDEX IF EXISTS idx_tracked_coins_id;
CREATE INDEX idx_tracked_coins_coin_id ON tracked_coins(coin_id);
CREATE INDEX idx_tracked_coins_coin_status ON tracked_coins(coin_id, status);

-- Step 6: Update the snapshots table to reference tracking_id instead of coin_id
-- This keeps snapshots tied to specific tracking cycles
ALTER TABLE snapshots
DROP CONSTRAINT IF EXISTS snapshots_coin_id_fkey;

ALTER TABLE snapshots
RENAME COLUMN coin_id TO tracking_id;

-- Add foreign key constraint
ALTER TABLE snapshots
ADD CONSTRAINT snapshots_tracking_id_fkey
FOREIGN KEY (tracking_id) REFERENCES tracked_coins(tracking_id) ON DELETE CASCADE;

-- Update indexes on snapshots
DROP INDEX IF EXISTS idx_snapshots_coin_id;
DROP INDEX IF EXISTS idx_snapshots_coin_timestamp;
CREATE INDEX idx_snapshots_tracking_id ON snapshots(tracking_id);
CREATE INDEX idx_snapshots_tracking_timestamp ON snapshots(tracking_id, timestamp DESC);

-- Step 7: Recreate the view with new structure
CREATE VIEW tracked_with_latest_snapshot AS
SELECT
  tc.tracking_id as id,
  tc.coin_id,
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
  (SELECT COUNT(*) FROM snapshots sn WHERE sn.tracking_id = tc.tracking_id) as snapshot_count
FROM tracked_coins tc
LEFT JOIN LATERAL (
  SELECT *
  FROM snapshots
  WHERE snapshots.tracking_id = tc.tracking_id
  ORDER BY timestamp DESC
  LIMIT 1
) s ON true
WHERE tc.status = 'active';

-- Step 8: Create new function for adding tracked coins (always insert, never update)
CREATE OR REPLACE FUNCTION add_tracked_coin(
  p_coin_id INTEGER,
  p_symbol VARCHAR(20),
  p_name VARCHAR(100),
  p_tracking_mode VARCHAR(10),
  p_entry_price DECIMAL(20, 8) DEFAULT NULL
)
RETURNS TABLE (tracking_id UUID, coin_id INTEGER, symbol VARCHAR(20), name VARCHAR(100)) AS $$
DECLARE
  v_tracking_id UUID;
BEGIN
  -- Always insert a new row (never update existing ones)
  -- This allows multiple tracking cycles for the same coin
  INSERT INTO tracked_coins (
    coin_id,
    symbol,
    name,
    tracking_mode,
    entry_price,
    entry_timestamp,
    status
  )
  VALUES (
    p_coin_id,
    p_symbol,
    p_name,
    p_tracking_mode,
    CASE WHEN p_tracking_mode = 'entry' THEN p_entry_price ELSE NULL END,
    CASE WHEN p_tracking_mode = 'entry' THEN NOW() ELSE NULL END,
    'active'
  )
  RETURNING tracking_id, coin_id, symbol, name
  INTO v_tracking_id, p_coin_id, p_symbol, p_name;

  RETURN QUERY SELECT v_tracking_id, p_coin_id, p_symbol, p_name;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Update the close position function to use tracking_id
CREATE OR REPLACE FUNCTION close_tracked_position(
  p_tracking_id UUID,
  p_reason TEXT
)
RETURNS TABLE (tracking_id UUID, symbol VARCHAR(20), name VARCHAR(100)) AS $$
BEGIN
  UPDATE tracked_coins
  SET
    status = 'closed',
    closed_at = NOW(),
    close_reason = p_reason
  WHERE tracking_id = p_tracking_id
  RETURNING tracking_id, symbol, name;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN tracked_coins.tracking_id IS 'Unique identifier for each tracking cycle (UUID primary key)';
COMMENT ON COLUMN tracked_coins.coin_id IS 'Reference to CMC coin ID - same coin can have multiple tracking cycles';
COMMENT ON COLUMN snapshots.tracking_id IS 'References tracked_coins.tracking_id - snapshots belong to specific tracking cycles';

-- Fix snapshots.tracking_id to be UUID type
-- This is a follow-up migration because the column rename didn't change the type

-- Step 1: Create a new UUID column
ALTER TABLE snapshots
ADD COLUMN tracking_id_new UUID;

-- Step 2: Update the new column with matching tracking_ids from tracked_coins
-- For each snapshot, find the matching tracked_coins entry by the old integer ID
UPDATE snapshots s
SET tracking_id_new = tc.tracking_id
FROM tracked_coins tc
WHERE s.tracking_id = tc.coin_id;  -- Note: s.tracking_id is still the old integer (coin_id)

-- Step 3: Drop the old column and rename the new one
ALTER TABLE snapshots
DROP COLUMN tracking_id;

ALTER TABLE snapshots
RENAME COLUMN tracking_id_new TO tracking_id;

-- Step 4: Make it NOT NULL
ALTER TABLE snapshots
ALTER COLUMN tracking_id SET NOT NULL;

-- Step 5: Recreate foreign key constraint
ALTER TABLE snapshots
ADD CONSTRAINT snapshots_tracking_id_fkey
FOREIGN KEY (tracking_id) REFERENCES tracked_coins(tracking_id) ON DELETE CASCADE;

-- Step 6: Recreate indexes
DROP INDEX IF EXISTS idx_snapshots_tracking_id;
DROP INDEX IF EXISTS idx_snapshots_tracking_timestamp;
CREATE INDEX idx_snapshots_tracking_id ON snapshots(tracking_id);
CREATE INDEX idx_snapshots_tracking_timestamp ON snapshots(tracking_id, timestamp DESC);

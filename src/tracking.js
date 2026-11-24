// Tracking module - now using Supabase
// All database operations delegated to db.js

import * as db from './db.js';

// Get tracked coins list
export function getTrackedCoins() {
  return db.getTrackedCoins();
}

// Get closed positions
export function getClosedPositions(filterReason = null) {
  return db.getClosedPositions(filterReason);
}

// Close a position (move to closed)
export function closePosition(coinId, reason) {
  return db.closePosition(coinId, reason);
}

// Resume a closed position (move back to active)
export function resumePosition(coinId) {
  return db.resumePosition(coinId);
}

// Add coin to tracking
// mode: 'cmc' (use CMC live data) or 'entry' (track profit from entry price)
export function addTrackedCoin(coin, mode = 'cmc', entryPrice = null) {
  return db.addTrackedCoin(coin, mode, entryPrice);
}

// Remove coin from tracking
export function removeTrackedCoin(coinId) {
  return db.removeTrackedCoin(coinId);
}

// Check if coin is tracked
export function isCoinTracked(coinId) {
  return db.isCoinTracked(coinId);
}

// Save snapshot for tracked coins (batch or single)
export function saveSnapshot(coins) {
  if (Array.isArray(coins)) {
    return db.saveSnapshots(coins);
  }
  return db.saveSnapshots([coins]);
}

// Get all snapshots
export function getSnapshots(coinId = null) {
  return db.getSnapshots(coinId);
}

// Get snapshots for a specific coin
export function getCoinSnapshots(coinId) {
  return db.getCoinSnapshots(coinId);
}

// Get snapshots for many tracking_ids at once (batch, avoid N+1)
export function getSnapshotsForTrackingIds(trackingIds) {
  return db.getSnapshotsForTrackingIds(trackingIds);
}

// Get latest snapshot for each tracked coin
export async function getLatestSnapshots() {
  return db.getTrackedWithLatestSnapshot();
}

// Calculate performance from first snapshot
export async function getCoinPerformance(coinId) {
  return db.getCoinPerformance(coinId);
}

// Get snapshot history for a coin
export async function getSnapshotHistory(coinId, limit = 30) {
  return db.getSnapshotHistory(coinId, limit);
}

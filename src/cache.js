// Cache module - Hybrid approach
// CMC API data: File-based (large JSON)
// Small cache items: Supabase

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { config } from './config.js';
import * as db from './db.js';

const CACHE_FILE = `${config.cacheDir}/cmc-data.json`;

// ============================================
// CMC API Cache (File-based)
// Reason: Large JSON response, better stored in file
// ============================================

export function getCachedData() {
  if (!existsSync(CACHE_FILE)) {
    return null;
  }

  try {
    const data = readFileSync(CACHE_FILE, 'utf8');
    const cached = JSON.parse(data);

    const now = Math.floor(Date.now() / 1000);
    const age = now - cached.timestamp;

    if (age < config.cacheTtl) {
      return cached;
    }
  } catch (err) {
    console.error('Error reading cache:', err.message);
  }

  return null;
}

export function setCachedData(data) {
  try {
    if (!existsSync(config.cacheDir)) {
      mkdirSync(config.cacheDir, { recursive: true });
    }

    const cached = {
      timestamp: Math.floor(Date.now() / 1000),
      data,
    };

    writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2));
  } catch (err) {
    console.error('Error writing cache:', err.message);
  }
}

export function getCacheAge() {
  if (!existsSync(CACHE_FILE)) {
    return null;
  }

  try {
    const data = readFileSync(CACHE_FILE, 'utf8');
    const cached = JSON.parse(data);
    const now = Math.floor(Date.now() / 1000);
    return now - cached.timestamp;
  } catch {
    return null;
  }
}

// ============================================
// Supabase Cache (for small items)
// ============================================

export async function getDbCachedData(key) {
  return db.getCachedData(key);
}

export async function setDbCachedData(key, data, ttlSeconds = 3600) {
  return db.setCachedData(key, data, ttlSeconds);
}

export async function getDbCacheAge(key) {
  return db.getCacheAge(key);
}

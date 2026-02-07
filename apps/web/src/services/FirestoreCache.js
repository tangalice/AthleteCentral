// src/services/FirestoreCache.js
//
// Drop-in caching layer for Firestore reads.
// Wrap your getDocs / getDoc calls with these helpers and repeat visits
// to any page become instant (served from memory).
//
// Usage:
//   import { cachedGetDocs, cachedGetDoc, invalidate, invalidatePrefix } from "../services/FirestoreCache";
//
//   // Instead of:  const snap = await getDocs(query(...));
//   // Use:         const snap = await cachedGetDocs(query(...), "team-athletes-" + teamId);
//
//   // Instead of:  const snap = await getDoc(doc(db, "users", uid));
//   // Use:         const snap = await cachedGetDoc(doc(db, "users", uid));
//
//   // Invalidate after a write:
//   invalidate("team-athletes-" + teamId);
//   invalidatePrefix("team-athletes-");  // clears all keys starting with prefix

import { getDocs, getDoc } from "firebase/firestore";

// ── Cache store ──
const cache = new Map();

// Default time-to-live: 5 minutes (in ms)
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Generate a cache key from a Firestore Query object.
 * Falls back to the provided manual key if given.
 */
function queryKey(queryOrRef) {
  // Firestore query objects have a _query property in v9 modular SDK
  // but it's not stable across versions, so we use toString-ish approach
  try {
    const path = queryOrRef?.firestore
      ? `${queryOrRef.type || "query"}-${queryOrRef._query?.path?.toString() || queryOrRef.path || "unknown"}`
      : String(queryOrRef);
    return path;
  } catch {
    return String(Math.random());
  }
}

/**
 * Cached version of getDocs().
 *
 * @param {Query} query - Firestore query
 * @param {string} [key] - Optional manual cache key (recommended for clarity)
 * @param {number} [ttl] - Time to live in ms (default 5 min)
 * @returns {QuerySnapshot}
 */
export async function cachedGetDocs(query, key, ttl = DEFAULT_TTL) {
  const cacheKey = key || queryKey(query);
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const snap = await getDocs(query);
  cache.set(cacheKey, { data: snap, timestamp: Date.now() });
  return snap;
}

/**
 * Cached version of getDoc().
 *
 * @param {DocumentReference} ref - Firestore document reference
 * @param {string} [key] - Optional manual cache key
 * @param {number} [ttl] - Time to live in ms (default 5 min)
 * @returns {DocumentSnapshot}
 */
export async function cachedGetDoc(ref, key, ttl = DEFAULT_TTL) {
  const cacheKey = key || `doc-${ref.path}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const snap = await getDoc(ref);
  cache.set(cacheKey, { data: snap, timestamp: Date.now() });
  return snap;
}

/**
 * Invalidate a specific cache key (call after writes).
 */
export function invalidate(key) {
  cache.delete(key);
}

/**
 * Invalidate all cache keys that start with a given prefix.
 * Useful for clearing all entries related to a team, user, etc.
 */
export function invalidatePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache stats (for debugging).
 */
export function cacheStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  for (const [, entry] of cache) {
    if (now - entry.timestamp < DEFAULT_TTL) active++;
    else expired++;
  }
  return { total: cache.size, active, expired };
}
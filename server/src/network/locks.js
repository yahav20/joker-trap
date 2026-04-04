/**
 * locks.js
 * In-memory mutex for single-instance synchronous atomicity.
 *
 * ─────────────────────────────────────────────────────────────────
 *  SCALING NOTE — how to swap this for Redis in the future:
 *
 *  This module exposes exactly TWO public functions: acquireLock and
 *  releaseLock. No other file in the codebase calls the underlying
 *  `inMemoryLocks` Set directly.
 *
 *  To scale horizontally (multiple Node.js processes / containers),
 *  replace the body of both functions with calls to a Redis-backed
 *  distributed lock library such as `redlock`:
 *
 *      const Redlock = require('redlock');
 *      const redlock = new Redlock([redisClient], { retryCount: 10 });
 *
 *      async function acquireLock(roomId) {
 *          try {
 *              const lock = await redlock.acquire([`lock:${roomId}`], 5000);
 *              lockHandles.set(roomId, lock);
 *              return true;
 *          } catch { return false; }
 *      }
 *
 *      async function releaseLock(roomId) {
 *          const lock = lockHandles.get(roomId);
 *          if (lock) { await lock.release(); lockHandles.delete(roomId); }
 *      }
 *
 *  The rest of the codebase (gameExecution.js, handlers.js, roomStore.js)
 *  does NOT need to change — the interface is identical.
 * ─────────────────────────────────────────────────────────────────
 *
 *  Atomicity guarantee (single-instance):
 *  Node.js is single-threaded.  The check-then-add in acquireLock
 *  (`has` → `add`) cannot interleave with any other JS synchronous
 *  code, so the in-memory Set is a correct, zero-overhead mutex here.
 */

const inMemoryLocks = new Set();

/**
 * Attempts to acquire a lock for the given room.
 * Retries up to 10 times with 50 ms intervals (max ~500 ms wait).
 *
 * ⚠️  To scale horizontally: replace this body with a Redlock `acquire` call.
 *
 * @param {string} roomId
 * @returns {Promise<boolean>} true if acquired, false if timed out
 */
async function acquireLock(roomId) {
    for (let i = 0; i < 10; i++) {
        if (!inMemoryLocks.has(roomId)) {
            inMemoryLocks.add(roomId);
            return true;
        }
        await new Promise(r => setTimeout(r, 50));
    }
    return false;
}

/**
 * Releases the lock for the given room.
 * Must always be called in a `finally` block to avoid dead-locks.
 *
 * ⚠️  To scale horizontally: replace this body with a Redlock `release` call.
 *
 * @param {string} roomId
 */
async function releaseLock(roomId) {
    inMemoryLocks.delete(roomId);
}

module.exports = { acquireLock, releaseLock };

/**
 * locks.js
 * In-memory mutex for single-instance synchronous atomicity.
 * Node.js is single-threaded, so a simple Set is sufficient.
 */

const inMemoryLocks = new Set();

/**
 * Attempts to acquire a lock for the given room.
 * Retries up to 10 times with 50ms intervals.
 * @returns {Promise<boolean>} true if acquired
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
 */
async function releaseLock(roomId) {
    inMemoryLocks.delete(roomId);
}

module.exports = { acquireLock, releaseLock };

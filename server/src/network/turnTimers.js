/**
 * turnTimers.js
 * Manages per-room turn timers.
 *
 * Each room may have at most ONE active timer at a time.
 * A timer fires a fully-encapsulated fallback action when a player
 * fails to act within TURN_TIMEOUT_MS.
 *
 * Contract:
 *   setTurnTimer(roomId, callbackFn, durationMs)   – cancel any previous timer, start a new one.
 *   clearTurnTimer(roomId)                          – cancel the active timer for this room.
 *   getDeadline(roomId)                             – return the Unix-ms deadline (or null).
 *   clearAllTurnTimers()                            – cancel everything (used on server shutdown).
 */

const logger = require('../utils/logger');

/**
 * @typedef {{ timerId: ReturnType<typeof setTimeout>, deadline: number }} TimerEntry
 * @type {Map<string, TimerEntry>}
 */
const activeTimers = new Map();

/**
 * Starts (or replaces) the turn timer for `roomId`.
 * @param {string} roomId
 * @param {() => void} callbackFn – fired after duration with no lock held
 * @param {number} durationMs
 */
function setTurnTimer(roomId, callbackFn, durationMs) {
    clearTurnTimer(roomId); // always cancel the previous one first

    const deadline = Date.now() + durationMs;

    const timerId = setTimeout(() => {
        activeTimers.delete(roomId);
        logger.info(`Turn timer expired for room ${roomId}. Applying fallback action.`);
        callbackFn();
    }, durationMs);

    activeTimers.set(roomId, { timerId, deadline });
}

/**
 * Cancels the active timer for `roomId` (if any).
 * Call this before applying any action so a late-firing timer cannot
 * overwrite the state that was just mutated.
 * @param {string} roomId
 */
function clearTurnTimer(roomId) {
    const entry = activeTimers.get(roomId);
    if (entry) {
        clearTimeout(entry.timerId);
        activeTimers.delete(roomId);
    }
}

/**
 * Returns the Unix-ms deadline for the active timer in `roomId`, or null.
 * This value is embedded in every `game_update` broadcast so clients can
 * render their own countdown without relying on WS RTT.
 * @param {string} roomId
 * @returns {number | null}
 */
function getDeadline(roomId) {
    const entry = activeTimers.get(roomId);
    return entry ? entry.deadline : null;
}

/**
 * Clears all timers. Called during graceful server shutdown so that no
 * pending callbacks fire against a closed event loop.
 */
function clearAllTurnTimers() {
    for (const { timerId } of activeTimers.values()) {
        clearTimeout(timerId);
    }
    activeTimers.clear();
    logger.info('All turn timers cleared.');
}

module.exports = { setTurnTimer, clearTurnTimer, getDeadline, clearAllTurnTimers };

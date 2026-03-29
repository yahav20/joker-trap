/**
 * roomStore.js
 * In-memory room state cache with debounced background Redis sync.
 */

const logger = require("../utils/logger");
const { redisClient } = require("./redisClient");

/** Primary in-memory room cache. */
const localRooms = new Map();

/** Rooms flagged dirty by human actions, pending background Redis sync. */
const dirtyRooms = new Set();

let backgroundSaverTimer = null;

/**
 * Retrieves room state. Checks in-memory first; falls back to Redis once per room.
 */
async function getRoomState(roomId) {
    if (localRooms.has(roomId)) {
        return localRooms.get(roomId);
    }
    if (redisClient.status === 'ready') {
        try {
            const raw = await redisClient.get(`room_state:${roomId}`);
            if (raw) {
                const state = JSON.parse(raw);
                localRooms.set(roomId, state);
                return state;
            }
        } catch (err) {
            logger.warn(`Redis fallback activated on read: ${err.message}`);
        }
    }
    return null;
}

/**
 * Saves room state to in-memory cache. Flags dirty for Redis sync if human action.
 */
async function saveRoomState(roomId, roomState, isHumanAction = true) {
    localRooms.set(roomId, roomState);
    if (isHumanAction) {
        dirtyRooms.add(roomId);
    }
}

/**
 * Deletes room state from in-memory cache and Redis.
 */
async function deleteRoomState(roomId) {
    localRooms.delete(roomId);
    dirtyRooms.delete(roomId);

    if (redisClient.status === 'ready') {
        try {
            await redisClient.del(`room_state:${roomId}`);
        } catch (err) {
            logger.warn(`Redis fallback activated on delete: ${err.message}`);
        }
    }
}

/**
 * Starts the background interval that bulk-writes dirty rooms to Redis every 10s.
 * Each write uses EX 3600 to auto-expire abandoned rooms after 1 hour.
 */
function startBackgroundSaver() {
    backgroundSaverTimer = setInterval(async () => {
        if (redisClient.status !== 'ready' || dirtyRooms.size === 0) return;

        const roomsToSave = Array.from(dirtyRooms);
        dirtyRooms.clear();

        for (const roomId of roomsToSave) {
            const roomState = localRooms.get(roomId);
            if (roomState) {
                try {
                    await redisClient.set(`room_state:${roomId}`, JSON.stringify(roomState), "EX", 3600);
                } catch (e) {
                    logger.warn(`Background save failed for ${roomId}: ${e.message}`);
                }
            }
        }
    }, 10000);
}

/**
 * Stops the background saver interval.
 */
function stopBackgroundSaver() {
    if (backgroundSaverTimer) {
        clearInterval(backgroundSaverTimer);
        backgroundSaverTimer = null;
    }
}

module.exports = {
    getRoomState,
    saveRoomState,
    deleteRoomState,
    startBackgroundSaver,
    stopBackgroundSaver
};

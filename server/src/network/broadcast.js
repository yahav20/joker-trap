/**
 * broadcast.js
 * Local WebSocket broadcast utilities.
 * Bypasses Redis pub/sub for single-instance deployments.
 */

const WebSocket = require("ws");

/** Set of all connected WebSocket clients on this server instance. */
const localClients = new Set();

/**
 * Broadcasts or unicasts a JSON event to WebSocket clients in a specific room.
 * @param {string} roomId
 * @param {string} event
 * @param {object} payload
 * @param {number} [targetPlayerId] - If undefined, broadcasts to all players in the room.
 */
function publishEvent(roomId, event, payload, targetPlayerId = undefined) {
    for (const ws of localClients) {
        if (ws.readyState === WebSocket.OPEN && ws.roomId === roomId) {
            if (targetPlayerId === undefined || targetPlayerId === ws.playerId) {
                ws.send(JSON.stringify({ event, payload }));
            }
        }
    }
}

/**
 * Sends a JSON error event to a single WebSocket client.
 */
function sendError(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "error", payload: { message } }));
    }
}

module.exports = { localClients, publishEvent, sendError };

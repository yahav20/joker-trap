/**
 * broadcast.js
 * Local WebSocket broadcast utilities.
 * Bypasses Redis pub/sub for single-instance deployments.
 *
 * ─────────────────────────────────────────────────────────────────
 *  SCALING NOTE — how to add Redis Pub/Sub in the future:
 *
 *  All outgoing events flow through the single `publishEvent` function
 *  below. No caller in the codebase bypasses it.
 *
 *  When the server is split across multiple instances (e.g. behind a
 *  load balancer), players in the same room may be connected to
 *  different Node.js processes.  The local `localClients` Set will
 *  only contain clients on THIS instance, so a direct WS send will
 *  miss clients on other instances.
 *
 *  Fix: publish the event to a Redis channel so all instances receive
 *  it and can forward it to their local clients:
 *
 *      // TODO (Redis Pub/Sub): Inside `publishEvent`, BEFORE the
 *      // `for (const ws of localClients)` loop, also publish a copy
 *      // of the event to a Redis channel keyed by roomId:
 *      //
 *      //   redisPub.publish(`room:${roomId}`, JSON.stringify({ event, payload, targetPlayerId }));
 *      //
 *      // Each server instance subscribes to the relevant room channels
 *      // and calls the existing `for (const ws of localClients)` loop
 *      // when a message arrives from Redis — delivering to its own clients.
 *      //
 *      // The local loop below can then be kept as-is; it handles
 *      // clients that are on THIS instance (which is still valid).
 *
 * ─────────────────────────────────────────────────────────────────
 */

const WebSocket = require("ws");

/** Set of all connected WebSocket clients on this server instance. */
const localClients = new Set();

/**
 * Broadcasts or unicasts a JSON event to WebSocket clients in a specific room.
 *
 * Single-instance: iterates `localClients` directly.
 * Multi-instance:  also publish to Redis Pub/Sub (see SCALING NOTE above).
 *
 * @param {string} roomId
 * @param {string} event
 * @param {object} payload
 * @param {number} [targetPlayerId] - If undefined, broadcasts to all players in the room.
 */
function publishEvent(roomId, event, payload, targetPlayerId = undefined) {
    // TODO (Redis Pub/Sub): publish to `room:${roomId}` channel here before the local loop.

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

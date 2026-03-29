/**
 * handlers.js
 * WebSocket event handlers for room management and player lifecycle.
 */

const GameState = require("../game/GameState");
const BotAdapter = require("../ai/BotAdapter");
const logger = require("../utils/logger");
const { PLAYER_COUNT } = require("../config/constant");
const { generateRoomCode } = require("../utils/roomIdFormatter");
const { acquireLock, releaseLock } = require("./locks");
const { getRoomState, saveRoomState } = require("./roomStore");
const { publishEvent, sendError } = require("./broadcast");
const { executeActionOnRoom, checkRoomStart, checkRoomRestart } = require("./gameExecution");

/** Timer map for disconnect grace periods: key is `${roomId}_${playerId}` */
const botTimeouts = new Map();

// -----------------------------------------------------------------------------
// ROOM LIFECYCLE
// -----------------------------------------------------------------------------

async function handleCreateRoom(ws, payload) {
    if (ws.roomId) return sendError(ws, "You are already in a room.");

    let botCount = parseInt(payload.botCount || 0, 10);
    if (isNaN(botCount) || botCount < 0 || botCount > 3) botCount = 0;

    const roomId = generateRoomCode(5);
    const sessionToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);

    const roomState = {
        id: roomId,
        botCount,
        clientsInfo: [{ id: ws.id, playerId: 0, sessionToken, connected: true, readyForRestart: false }],
        botsConfig: [],
        gameData: null
    };

    const locked = await acquireLock(roomId);
    if (!locked) return sendError(ws, "Could not acquire lock for new room.");

    try {
        await saveRoomState(roomId, roomState, true);
        ws.roomId = roomId;
        ws.playerId = 0;

        ws.send(JSON.stringify({
            event: "room_created",
            payload: { roomId, botCount, sessionToken, message: `Room created. Code: ${roomId}` }
        }));

        await checkRoomStart(roomState);
    } finally {
        await releaseLock(roomId);
    }
}

async function handleJoinRoom(ws, payload) {
    if (ws.roomId) return sendError(ws, "You are already in a room.");

    const roomId = (payload.roomId || "").trim().toUpperCase();

    const locked = await acquireLock(roomId);
    if (!locked) return sendError(ws, `Cannot join room ${roomId} currently.`);

    try {
        const roomState = await getRoomState(roomId);
        if (!roomState) return sendError(ws, `Room not found: ${roomId}`);

        if (roomState.gameData && !roomState.gameData.over) {
            return sendError(ws, "Game already in progress.");
        }

        const maxHumans = PLAYER_COUNT - roomState.botCount;
        if (roomState.clientsInfo.length >= maxHumans) {
            return sendError(ws, "Room is full.");
        }

        const newPlayerId = roomState.clientsInfo.length;
        const sessionToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);

        ws.roomId = roomId;
        ws.playerId = newPlayerId;

        roomState.clientsInfo.push({ id: ws.id, playerId: newPlayerId, sessionToken, connected: true, readyForRestart: false });
        await saveRoomState(roomId, roomState, true);

        ws.send(JSON.stringify({
            event: "room_joined",
            payload: { roomId, botCount: roomState.botCount, sessionToken, message: `Joined room ${roomId}` }
        }));

        await checkRoomStart(roomState);
    } finally {
        await releaseLock(roomId);
    }
}

async function handleRestartGame(ws) {
    if (!ws.roomId) return;
    const roomId = ws.roomId;

    const locked = await acquireLock(roomId);
    if (!locked) return;

    try {
        const roomState = await getRoomState(roomId);
        if (!roomState) return;

        if (roomState.gameData && roomState.gameData.over) {
            const clientInfo = roomState.clientsInfo.find(c => c.playerId === ws.playerId);
            if (clientInfo) clientInfo.readyForRestart = true;
            await saveRoomState(roomId, roomState, true);
            await checkRoomRestart(roomState);
        }
    } finally {
        await releaseLock(roomId);
    }
}

async function handleResumeRoom(ws, payload) {
    if (ws.roomId) return sendError(ws, "You are already in a room.");

    const { roomId, sessionToken } = payload;
    if (!roomId || !sessionToken) return sendError(ws, "Missing room or session token.");

    const locked = await acquireLock(roomId);
    if (!locked) return sendError(ws, `Cannot resume room ${roomId} currently.`);

    try {
        const roomState = await getRoomState(roomId);
        if (!roomState) return sendError(ws, `Room expired or not found.`);

        const clientInfo = roomState.clientsInfo.find(c => c.sessionToken === sessionToken);
        if (!clientInfo) return sendError(ws, "Invalid session token.");

        // Clear any bot-replacement timeout since player returned
        const timeoutKey = `${roomId}_${clientInfo.playerId}`;
        if (botTimeouts.has(timeoutKey)) {
            clearTimeout(botTimeouts.get(timeoutKey));
            botTimeouts.delete(timeoutKey);
        }

        // Re-bind to room
        clientInfo.connected = true;
        clientInfo.id = ws.id;
        ws.roomId = roomId;
        ws.playerId = clientInfo.playerId;

        await saveRoomState(roomId, roomState, true);

        // Send full state to client
        if (roomState.gameData && !roomState.gameData.over) {
            const adapters = roomState.gameData.players.map(pData => ({
                id: pData.id,
                send: (event, eventPayload) => {
                    if (pData.id === clientInfo.playerId && event === "game_update") {
                        eventPayload.message = "Resumed game successfully.";
                        ws.send(JSON.stringify({ event, payload: eventPayload }));
                    }
                }
            }));
            const game = GameState.fromJSON(roomState.gameData, adapters);
            game.sendStateUpdate();
        } else {
            ws.send(JSON.stringify({
                event: "room_resumed",
                payload: { roomId, botCount: roomState.botCount, message: "Welcome back to the room." }
            }));
        }

        publishEvent(roomId, "game_update", { message: `Player ${clientInfo.playerId} reconnected.` });

        // Trigger lobby check if resuming inside lobby
        if (!roomState.gameData || roomState.gameData.over) {
            await checkRoomRestart(roomState);
        }
    } finally {
        await releaseLock(roomId);
    }
}

async function handleGameAction(ws, event, payload) {
    if (!ws.roomId) return sendError(ws, "You must create or join a room first.");
    await executeActionOnRoom(ws.roomId, ws.playerId, event, payload);
}

// -----------------------------------------------------------------------------
// DISCONNECT & BOT TAKEOVER
// -----------------------------------------------------------------------------

async function handleDisconnect(ws) {
    const roomId = ws.roomId;

    const locked = await acquireLock(roomId);
    if (!locked) return;

    try {
        const roomState = await getRoomState(roomId);
        if (!roomState) return;

        const clientInfo = roomState.clientsInfo.find(c => c.playerId === ws.playerId);
        if (!clientInfo) return;

        clientInfo.connected = false;

        const connectedHumans = roomState.clientsInfo.filter(c => c.connected).length;
        if (connectedHumans === 0) {
            logger.info(`All players offline in room ${roomId}. State sleeping in RAM/Redis.`);
            await saveRoomState(roomId, roomState, true);
            return;
        }

        if (roomState.gameData && !roomState.gameData.over) {
            publishEvent(roomId, "game_update", { message: `Player ${ws.playerId} disconnected. Waiting 30s to reconnect...` });

            const timeoutKey = `${roomId}_${ws.playerId}`;
            const timeout = setTimeout(() => {
                replacePlayerWithBot(roomId, ws.playerId).catch(e => logger.error(e));
            }, 30000);

            botTimeouts.set(timeoutKey, timeout);
        } else {
            roomState.clientsInfo = roomState.clientsInfo.filter(c => c.playerId !== ws.playerId);
            roomState.botCount++;
            await checkRoomRestart(roomState);
        }

        await saveRoomState(roomId, roomState, true);
    } finally {
        await releaseLock(roomId);
    }
}

async function replacePlayerWithBot(roomId, playerId) {
    const locked = await acquireLock(roomId);
    if (!locked) return;
    try {
        const roomState = await getRoomState(roomId);
        if (!roomState) return;

        const clientInfo = roomState.clientsInfo.find(c => c.playerId === playerId);
        if (!clientInfo || clientInfo.connected) return; // They reconnected in time!

        logger.info(`Player ${playerId} idle timeout in room ${roomId}. Replacing with Bot.`);
        roomState.clientsInfo = roomState.clientsInfo.filter(c => c.playerId !== playerId);
        roomState.botCount++;

        const bot = new BotAdapter(playerId, 'medium', 0.25, PLAYER_COUNT);
        const savedPlayer = roomState.gameData.players.find(p => p.id === playerId);
        if (savedPlayer) bot.hand = savedPlayer.hand;

        roomState.botsConfig.push(bot.toJSON());
        await saveRoomState(roomId, roomState, true);

        publishEvent(roomId, "game_update", { message: `Player ${playerId} abandoned. A bot took over.` });
        await executeActionOnRoom(roomId, playerId, "RESUME_BOT", {}, false);
    } catch (err) {
        logger.error(`Error replacing suspended player with bot: ${err.message}`);
    } finally {
        await releaseLock(roomId);
    }
}

/**
 * Clears all pending bot-replacement timeouts (used during server shutdown).
 */
function clearAllBotTimeouts() {
    for (const timeout of botTimeouts.values()) {
        clearTimeout(timeout);
    }
    botTimeouts.clear();
}

module.exports = {
    handleCreateRoom,
    handleJoinRoom,
    handleRestartGame,
    handleResumeRoom,
    handleGameAction,
    handleDisconnect,
    clearAllBotTimeouts
};

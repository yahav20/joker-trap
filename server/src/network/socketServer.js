/**
 * socketServer.js
 * Thin entry point: WebSocket server setup and message routing.
 * All business logic delegated to dedicated modules.
 */

const WebSocket = require("ws");
const logger = require("../utils/logger");
const { PORT } = require("../config/constant");
const { redisClient } = require("./redisClient");
const { localClients, sendError } = require("./broadcast");
const { startBackgroundSaver, stopBackgroundSaver } = require("./roomStore");
const {
    handleCreateRoom,
    handleJoinRoom,
    handleRestartGame,
    handleResumeRoom,
    handleGameAction,
    handleDisconnect,
    handleLeaveRoom,
    clearAllBotTimeouts
} = require("./handlers");

let wss = null;

/**
 * Creates and starts the WebSocket server.
 */
function startServer(port = PORT) {
    wss = new WebSocket.Server({ 
        port, 
        host: '0.0.0.0',
        maxPayload: 500 * 1024, // 500KB limit
        clientTracking: true
    });
    logger.info(`Joker Trap WebSocket Server running on ws://0.0.0.0:${port}`);

    startBackgroundSaver();

    // Ping every 30s to keep NAT connections alive
    const pingInterval = setInterval(() => {
        wss.clients.forEach(ws => {
            if (ws.alive === false) { 
                return ws.terminate(); 
            }
            ws.alive = false;
            ws.ping();
        });
    }, 30000);

    wss.on("close", () => {
        clearInterval(pingInterval);
    });

    wss.on("connection", (ws) => {
        ws.alive = true;
        ws.on("pong", () => { ws.alive = true; });

        ws.id = Math.random().toString(36).substring(2, 9);
        ws.roomId = null;
        localClients.add(ws);

        ws.send(JSON.stringify({
            event: "connected",
            payload: { message: "Connected to server. Create or join a room." },
        }));

        ws.on("message", async (raw) => {
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                ws.send(JSON.stringify({ event: "error", payload: { message: "Invalid JSON." } }));
                return;
            }

            const { event, payload = {} } = data;

            try {
                if (event === "create_room") {
                    await handleCreateRoom(ws, payload);
                } else if (event === "join_room") {
                    await handleJoinRoom(ws, payload);
                } else if (event === "resume_room") {
                    await handleResumeRoom(ws, payload);
                } else if (event === "restart_game") {
                    await handleRestartGame(ws);
                } else if (event === "leave_room") {
                    await handleLeaveRoom(ws);
                } else {
                    await handleGameAction(ws, event, payload);
                }
            } catch (err) {
                logger.error(`Error handling event ${event}: ${err.message}\n${err.stack}`);
                sendError(ws, `Server Error: ${err.message}`);
            }
        });

        ws.on("close", async () => {
            localClients.delete(ws);
            if (ws.roomId && !ws.leaving) {
                await handleDisconnect(ws);
            }
        });
    });

    return wss;
}

function closeServer() {
    stopBackgroundSaver();
    if (wss) wss.close();
    redisClient.quit();
    clearAllBotTimeouts();
}

module.exports = { startServer, closeServer };

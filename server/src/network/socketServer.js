/**
 * socketServer.js
 * WebSocket glue layer. Manages connections, rooms, and routes client messages
 * to their respective GameState machine.
 */

const WebSocket = require("ws");
const GameState = require("../game/GameState");
const BotAdapter = require("../ai/BotAdapter");
const logger = require("../utils/logger");
const { PORT, PLAYER_COUNT } = require("../config/constant");
const { generateRoomCode } = require("../utils/roomIdFormatter");

// In-memory map of active rooms: Map<string, RoomObject>
const rooms = new Map();

let wss = null;

/**
 * Creates and starts the WebSocket server.
 *
 * @param {number} [port=PORT]
 */
function startServer(port = PORT) {
    wss = new WebSocket.Server({ port, host: '0.0.0.0' });
    logger.info(`Joker Trap WebSocket Server running on ws://0.0.0.0:${port}`);

    wss.on("connection", (ws) => {
        // Assign a temporary unique ID for tracking before joining a room
        ws.id = Math.random().toString(36).substring(2, 9);
        ws.roomId = null; // The room this client belongs to

        ws.send(JSON.stringify({
            event: "connected",
            payload: { message: "Connected to server. Create or join a room." },
        }));

        ws.on("message", (raw) => {
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                ws.send(JSON.stringify({ event: "error", payload: { message: "Invalid JSON." } }));
                return;
            }

            const { event, payload = {} } = data;

            // Handle Room Creation
            if (event === "create_room") {
                if (ws.roomId) return _sendError(ws, "You are already in a room.");

                let botCount = parseInt(payload.botCount || 0, 10);
                if (isNaN(botCount) || botCount < 0 || botCount > 3) botCount = 0;

                const roomId = generateRoomCode(5);
                const newRoom = {
                    id: roomId,
                    botCount,
                    clients: [ws],
                    bots: [],
                    game: null,
                };

                rooms.set(roomId, newRoom);
                ws.roomId = roomId;
                ws.playerId = 0; // Creator is always Player 0 initially

                logger.info(`Room created: ${roomId} (bots: ${botCount}) by client ${ws.id}`);

                ws.send(JSON.stringify({
                    event: "room_created",
                    payload: { roomId, botCount, message: `Room created. Code: ${roomId}` }
                }));

                _checkRoomStart(newRoom);
                return;
            }

            // Handle Room Joining
            if (event === "join_room") {
                if (ws.roomId) return _sendError(ws, "You are already in a room.");

                const roomId = (payload.roomId || "").trim().toUpperCase();
                const room = rooms.get(roomId);

                if (!room) return _sendError(ws, `Room not found: ${roomId}`);
                if (room.game && !room.game.over) return _sendError(ws, "Game already in progress.");

                const maxHumans = PLAYER_COUNT - room.botCount;
                if (room.clients.length >= maxHumans) return _sendError(ws, "Room is full.");

                room.clients.push(ws);
                ws.roomId = roomId;
                ws.playerId = room.clients.length - 1;

                logger.info(`Client ${ws.id} joined room ${roomId} (Player ${ws.playerId})`);

                ws.send(JSON.stringify({
                    event: "room_joined",
                    payload: { roomId, botCount: room.botCount, message: `Joined room ${roomId}` }
                }));

                _checkRoomStart(room);
                return;
            }

            // Must be in a room for all other events
            if (!ws.roomId) {
                return _sendError(ws, "You must create or join a room first.");
            }

            const room = rooms.get(ws.roomId);
            if (!room) {
                ws.roomId = null;
                return _sendError(ws, "Your room no longer exists.");
            }

            const game = room.game;

            // Handle Restart even if game is over
            if (event === "restart_game") {
                if (game && game.over) {
                    logger.info(`Restart requested by Player ${ws.playerId} in room ${room.id}.`);
                    ws.readyForRestart = true;
                    _checkRoomRestart(room);
                }
                return;
            }

            if (!game || game.over) return;

            // Find which player in the GameState corresponds to this WebSocket
            const player = game.players.find(p => p.id === ws.playerId);
            if (!player) return;

            switch (event) {
                case "request_card":
                    game.handleRequestCard(player.id, payload.rank);
                    break;
                case "offer_card":
                    game.handleOfferCard(player.id, payload.cardIndex);
                    break;
                case "make_decision":
                    game.handleDecision(player.id, payload.decision);
                    break;
                default:
                    ws.send(JSON.stringify({
                        event: "error",
                        payload: { message: `Unknown event: "${event}"` },
                    }));
            }
        });

        ws.on("close", () => {
            if (ws.roomId) {
                const room = rooms.get(ws.roomId);
                if (room) {
                    room.clients = room.clients.filter(c => c !== ws);
                    logger.info(`Client ${ws.id} disconnected from room ${ws.roomId}.`);

                    if (room.game && !room.game.over) {
                        logger.info(`Player ${ws.playerId} disconnected mid-game. Replacing with Bot.`);
                        room.botCount++;

                        const bot = new BotAdapter(ws.playerId, 'medium', 0.25, PLAYER_COUNT);
                        room.bots.push(bot);

                        const oldAdapterIndex = room.game.players.findIndex(p => p.id === ws.playerId);
                        if (oldAdapterIndex !== -1) {
                            const oldAdapter = room.game.players[oldAdapterIndex];
                            bot.hand = [...oldAdapter.hand];
                            // Redirect output calls to the bot
                            oldAdapter.send = bot.send;
                        }

                        bot.attachGame(room.game);
                        bot.resumeTurn();

                        // Notify remaining players
                        room.game._broadcastGameState({ message: `Player ${ws.playerId} disconnected. A bot took over.` });
                    } else if (room.game && room.game.over) {
                        logger.info(`Player ${ws.playerId} disconnected while waiting for restart. Replacements will be bots.`);
                        room.botCount++;
                        // Might trigger restart if this player was the last one we were waiting for
                        _checkRoomRestart(room);
                    }

                    // Cleanup empty rooms
                    if (room.clients.length === 0) {
                        logger.info(`Room ${ws.roomId} is empty. Deleting game and room.`);
                        room.bots.forEach(b => b.destroy());
                        rooms.delete(ws.roomId);
                    }
                }
            }
        });
    });

    return wss;
}

/**
 * Checks if a room has enough human players to start, and starts the game if so.
 *
 * @param {Object} room
 */
function _checkRoomStart(room) {
    const requiredHumans = PLAYER_COUNT - room.botCount;
    const currentHumans = room.clients.length;

    if (currentHumans < requiredHumans) {
        // Still waiting
        const waitingFor = requiredHumans - currentHumans;
        const msg = JSON.stringify({
            event: "waiting",
            payload: {
                message: `Waiting for ${waitingFor} more human player(s) to join...`,
            },
        });
        room.clients.forEach(c => c.send(msg));
    } else if (currentHumans === requiredHumans) {
        // Start game
        logger.info(`Room ${room.id} is full. Starting game with ${room.botCount} bots.`);
        _startGame(room);
    }
}

/**
 * Checks if all human clients in the room are ready to restart.
 */
function _checkRoomRestart(room) {
    if (!room.game || !room.game.over) return;

    // Safety against an empty room trying to restart itself
    if (room.clients.length === 0) return;

    const allReady = room.clients.every(c => c.readyForRestart);
    if (allReady) {
        logger.info(`All players ready in room ${room.id}. Re-initializing game...`);
        room.clients.forEach(c => c.readyForRestart = false);
        _startGame(room);
    } else {
        const readyCount = room.clients.filter(c => c.readyForRestart).length;
        const total = room.clients.length;
        const waitingFor = total - readyCount;
        const msg = JSON.stringify({
            event: "waiting",
            payload: {
                message: `Waiting for ${waitingFor} other player(s) to hit Play Again...`,
            },
        });
        room.clients.forEach(c => {
            if (c.readyForRestart) c.send(msg);
        });
    }
}

/**
 * Instantiates the Game State and begins the round.
 * 
 * @param {Object} room 
 */
function _startGame(room) {
    const adapters = _buildAdapters([...room.clients]);
    const bots = [];

    // Make sure we have enough bots to fill the rest of the game
    const botCount = PLAYER_COUNT - room.clients.length;

    for (let b = 0; b < botCount; b++) {
        const botId = room.clients.length + b;
        // Basic bot setup. We can map difficulty here if needed in future
        const difficulty = b === 0 ? 'hard' : 'medium';
        const bot = new BotAdapter(botId, difficulty, 0.25, PLAYER_COUNT);
        adapters.push(bot);
        room.bots.push(bot);
    }

    room.game = new GameState(adapters);

    for (const bot of room.bots) {
        bot.attachGame(room.game);
    }

    room.game.start("Game started!");
}

/**
 * Sends a generic error.
 */
function _sendError(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "error", payload: { message } }));
    }
}

/**
 * Builds adapter objects from WebSocket connections.
 * Each adapter wraps ws.send() so GameState never imports 'ws' directly.
 *
 * @param {WebSocket[]} clients
 * @returns {Array<{ id: number, send: Function }>}
 */
function _buildAdapters(clients) {
    return clients.map((ws) => ({
        id: ws.playerId,
        send(event, payload) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event, payload }));
            }
        },
    }));
}

/**
 * Gracefully closes the server (used in tests or shutdown hooks).
 */
function closeServer() {
    if (wss) wss.close();
    for (const room of rooms.values()) {
        room.bots.forEach(b => b.destroy());
    }
    rooms.clear();
}

module.exports = { startServer, closeServer };

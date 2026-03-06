/**
 * socketServer.js
 * WebSocket glue layer. Manages connections and routes client messages
 * to the GameState machine. Does NOT contain any game logic.
 */

const WebSocket = require("ws");
const GameState = require("../game/GameState");
const BotAdapter = require("../ai/BotAdapter");
const logger = require("../utils/logger");
const { PORT, PLAYER_COUNT } = require("../config/constant");

let wss = null;
let connectedClients = [];
let game = null;

/**
 * Creates and starts the WebSocket server.
 *
 * @param {number} [port=PORT]
 * @param {number} [botCount=0]  How many bot players to auto-fill.
 *   Set to (PLAYER_COUNT - 1) to allow a single human to play against all bots.
 *   Bots are always assigned the highest player IDs.
 */
function startServer(port = PORT, botCount = 0) {
    wss = new WebSocket.Server({ port, host: '0.0.0.0' });
    logger.info(`Joker Trap WebSocket Server running on ws://0.0.0.0:${port} (bots: ${botCount})`);

    wss.on("connection", (ws) => {
        // Reject if game in progress or room full
        if ((game && !game.over) || connectedClients.length >= PLAYER_COUNT) {
            ws.send(JSON.stringify({
                event: "error",
                payload: { message: "Room is full or game already in progress." },
            }));
            ws.close();
            return;
        }

        connectedClients.push(ws);
        const playerIndex = connectedClients.length - 1;
        logger.info(`Player ${playerIndex} connected (${connectedClients.length}/${PLAYER_COUNT})`);
        ws.playerId = playerIndex;

        // Update the waiting message with remaining human slots needed
        const humanSlotsNeeded = PLAYER_COUNT - botCount - connectedClients.length;
        ws.send(JSON.stringify({
            event: "waiting",
            payload: {
                message: `You are Player ${playerIndex}. Waiting for ${Math.max(0, humanSlotsNeeded)} more human player(s)...`,
            },
        }));

        // Start when enough humans have connected to fill the non-bot slots
        const humanSlotsRequired = PLAYER_COUNT - botCount;
        if (connectedClients.length === humanSlotsRequired) {
            logger.info(`All human players connected (${connectedClients.length}/${humanSlotsRequired}) – adding ${botCount} bot(s) and starting game!`);

            // Build human adapters first (IDs 0…humanCount-1)
            const adapters = _buildAdapters([...connectedClients]);

            // Build bot adapters (IDs humanCount…PLAYER_COUNT-1)
            const bots = [];
            for (let b = 0; b < botCount; b++) {
                const botId = connectedClients.length + b;
                const bot = new BotAdapter(botId);
                adapters.push(bot);
                bots.push(bot);
            }

            game = new GameState(adapters);

            // Give each bot a reference to the game so it can call back
            for (const bot of bots) {
                bot.attachGame(game);
            }

            game.start("Game started!");
        }

        ws.on("message", (raw) => {
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                ws.send(JSON.stringify({ event: "error", payload: { message: "Invalid JSON." } }));
                return;
            }

            const { event, payload = {} } = data;

            // Handle Restart even if game is over
            if (event === "restart_game") {
                if (game && game.over) {
                    logger.info("Restart requested. Re-initializing game...");
                    const humanCount = connectedClients.length;
                    const botCount = PLAYER_COUNT - humanCount;

                    // Assign difficulty levels to bots
                    const adapters = _buildAdapters([...connectedClients]);
                    const bots = [];
                    for (let b = 0; b < botCount; b++) {
                        const botId = humanCount + b;
                        // For a harder game, assign 'hard' to at least one bot
                        const difficulty = b === 0 ? 'hard' : 'medium';
                        const bot = new BotAdapter(botId, difficulty, 0.25, PLAYER_COUNT);
                        adapters.push(bot);
                        bots.push(bot);
                    }
                    game = new GameState(adapters);
                    for (const bot of bots) bot.attachGame(game);
                    game.start("Game Restarted!");
                }
                return;
            }

            if (!game || game.over) return;

            // Find which player sent this message
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
                case "restart_game":
                    if (game && game.over) {
                        logger.info("Restart requested. Re-initializing game...");
                        const humanCount = connectedClients.length;
                        const botCount = PLAYER_COUNT - humanCount;
                        const adapters = _buildAdapters([...connectedClients]);
                        const bots = [];
                        for (let b = 0; b < botCount; b++) {
                            const botId = humanCount + b;
                            const bot = new BotAdapter(botId, 0.30, PLAYER_COUNT);
                            adapters.push(bot);
                            bots.push(bot);
                        }
                        game = new GameState(adapters);
                        for (const bot of bots) bot.attachGame(game);
                        game.start("Game Restarted!");
                    }
                    break;
                default:
                    ws.send(JSON.stringify({
                        event: "error",
                        payload: { message: `Unknown event: "${event}"` },
                    }));
            }
        });

        ws.on("close", () => {
            logger.info(`Player ${connectedClients.indexOf(ws)} disconnected.`);
            connectedClients = connectedClients.filter(c => c !== ws);
            if (game && !game.over) {
                game.players.forEach(p =>
                    p.send("error", { message: "A player disconnected. Game aborted." })
                );
                game = null;
            }
        });
    });

    return wss;
}

/**
 * Builds adapter objects from WebSocket connections.
 * Each adapter wraps ws.send() so GameState never imports 'ws' directly.
 *
 * @param {WebSocket[]} clients
 * @returns {Array<{ id: number, send: Function }>}
 */
function _buildAdapters(clients) {
    return clients.map((ws, index) => ({
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
}

module.exports = { startServer, closeServer };

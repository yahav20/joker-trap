/**
 * socketServer.js
 * WebSocket glue layer. Manages connections and routes client messages
 * to the GameState machine. Does NOT contain any game logic.
 */

const WebSocket = require("ws");
const GameState = require("../game/GameState");
const logger = require("../utils/logger");
const { PORT, PLAYER_COUNT } = require("../config/constant");

let wss = null;
let connectedClients = [];
let game = null;

/**
 * Creates and starts the WebSocket server.
 * @param {number} [port=PORT]
 */
function startServer(port = PORT) {
    wss = new WebSocket.Server({ port });
    logger.info(`Joker Trap WebSocket Server running on ws://localhost:${port}`);

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

        ws.send(JSON.stringify({
            event: "waiting",
            payload: {
                message: `You are Player ${playerIndex}. Waiting for ${PLAYER_COUNT - connectedClients.length} more player(s)...`,
            },
        }));

        // Start when room is full
        if (connectedClients.length === PLAYER_COUNT) {
            logger.info("All players connected – starting game!");
            game = new GameState(_buildAdapters([...connectedClients]));
            game.start("Game started! Player 1 requests a card from Player 0 first.");
        }

        ws.on("message", (raw) => {
            if (!game || game.over) return;

            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                ws.send(JSON.stringify({ event: "error", payload: { message: "Invalid JSON." } }));
                return;
            }

            // Find which player sent this message
            const player = game.players.find(p => p.id === ws.playerId);
            if (!player) return;

            const { event, payload = {} } = data;

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

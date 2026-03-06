/**
 * index.js
 * Application entry point for the modular server.
 * Starts the WebSocket server on the configured port.
 *
 * Environment variables:
 *   PORT      – WebSocket port (default: 8080)
 *   BOT_COUNT – Number of bot players to auto-fill (default: 0)
 *               Set to 3 to play solo against three bots.
 */

const { startServer } = require("./network/socketServer");
const { PORT } = require("./config/constant");

startServer(PORT);

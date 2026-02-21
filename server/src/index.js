/**
 * index.js
 * Application entry point for the modular server.
 * Starts the WebSocket server on the configured port.
 */

const { startServer } = require("./network/socketServer");
const { PORT } = require("./config/constant");

startServer(PORT);

/**
 * gameExecution.js
 * Core game action execution, start, and restart logic.
 */

const GameState = require("../game/GameState");
const BotAdapter = require("../ai/BotAdapter");
const logger = require("../utils/logger");
const { PLAYER_COUNT } = require("../config/constant");
const { acquireLock, releaseLock } = require("./locks");
const { getRoomState, saveRoomState } = require("./roomStore");
const { publishEvent } = require("./broadcast");

// -----------------------------------------------------------------------------
// BOT PROXY FACTORY (shared by executeActionOnRoom and startGame)
// -----------------------------------------------------------------------------

/**
 * Creates a Proxy around a GameState that intercepts bot game-method calls
 * and re-routes them as async room actions with isHumanAction=false.
 */
function createBotProxy(game, roomId) {
    return new Proxy(game, {
        get(target, prop) {
            if (['handleRequestCard', 'handleOfferCard', 'handleDecision'].includes(prop)) {
                return (...args) => {
                    const botPlayerId = args[0];
                    let mappedEvent;
                    let botPayload = {};
                    if (prop === 'handleRequestCard') { mappedEvent = 'request_card'; botPayload.rank = args[1]; }
                    if (prop === 'handleOfferCard') { mappedEvent = 'offer_card'; botPayload.cardIndex = args[1]; }
                    if (prop === 'handleDecision') { mappedEvent = 'make_decision'; botPayload.decision = args[1]; }

                    executeActionOnRoom(roomId, botPlayerId, mappedEvent, botPayload, false).catch(e => logger.error(e));
                };
            }
            const val = target[prop];
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
}

/**
 * Feeds buffered outgoing events into bot instances so they can plan their next move.
 */
function relayEventsToBots(outgoingEvents, botInstances) {
    for (const out of outgoingEvents) {
        const isBroadcast = out.targetPlayerId === undefined;
        for (const bot of botInstances) {
            if (isBroadcast || bot.id === out.targetPlayerId) {
                bot.send(out.event, out.payload);
            }
        }
    }
}

// -----------------------------------------------------------------------------
// ACTION EXECUTION
// -----------------------------------------------------------------------------

/**
 * Executes ANY action against the room state atomically.
 * Works for both human WebSocket events and delayed bot actions.
 */
async function executeActionOnRoom(roomId, playerId, actionEvent, payload, isHumanAction = true) {
    const locked = await acquireLock(roomId);
    if (!locked) return logger.warn(`Skipped action ${actionEvent} by ${playerId} (locked)`);

    let outgoingEvents = [];

    try {
        const roomState = await getRoomState(roomId);
        if (!roomState) return;
        if (!roomState.gameData) return;

        // Snapshot turn boundaries BEFORE the action to detect turn completion
        const prevSender = roomState.gameData.turnState.senderIndex;
        const prevReceiver = roomState.gameData.turnState.receiverIndex;
        const wasOver = roomState.gameData.over;

        // Reconstruct GameState from JSON, injecting a buffering send
        const adapters = roomState.gameData.players.map(pData => ({
            id: pData.id,
            send: (event, payload) => {
                outgoingEvents.push({ targetPlayerId: pData.id, event, payload });
            }
        }));

        const game = GameState.fromJSON(roomState.gameData, adapters);
        const botInstances = roomState.botsConfig.map(bData => BotAdapter.fromJSON(bData, PLAYER_COUNT, roomId));
        const gameProxyForBots = createBotProxy(game, roomId);

        for (const bot of botInstances) {
            bot.attachGame(gameProxyForBots);
        }

        // --- APPLY THE ACTION ---
        if (actionEvent === "request_card") {
            game.handleRequestCard(playerId, payload.rank);
        } else if (actionEvent === "offer_card") {
            game.handleOfferCard(playerId, payload.cardIndex);
        } else if (actionEvent === "make_decision") {
            game.handleDecision(playerId, payload.decision);
        } else if (actionEvent === "RESUME_BOT") {
            const botInst = botInstances.find(b => b.id === playerId);
            if (botInst) {
                botInst.resumeTurn();
            }
        }

        // Propagate events to bots so they schedule their next move
        relayEventsToBots(outgoingEvents, botInstances);

        // Save state back to in-memory cache (always instant)
        roomState.gameData = game.toJSON();
        roomState.botsConfig = botInstances.map(b => b.toJSON());

        // Only flag dirty for Redis sync at turn boundaries:
        // turn advanced (sender/receiver changed) or game just ended
        const turnAdvanced = roomState.gameData.turnState.senderIndex !== prevSender
                          || roomState.gameData.turnState.receiverIndex !== prevReceiver;
        const gameJustEnded = !wasOver && roomState.gameData.over;
        const shouldPersist = isHumanAction && (turnAdvanced || gameJustEnded);

        await saveRoomState(roomId, roomState, shouldPersist);

    } finally {
        await releaseLock(roomId);
    }

    // Publish all buffered events to WebSocket clients (outside lock)
    for (const out of outgoingEvents) {
        publishEvent(roomId, out.event, out.payload, out.targetPlayerId);
    }
}

// -----------------------------------------------------------------------------
// GAME START & RESTART LOGIC
// -----------------------------------------------------------------------------

async function checkRoomStart(roomState) {
    const requiredHumans = PLAYER_COUNT - roomState.botCount;
    const currentHumans = roomState.clientsInfo.length;

    if (currentHumans < requiredHumans) {
        const waitingFor = requiredHumans - currentHumans;
        publishEvent(roomState.id, "waiting", { message: `Waiting for ${waitingFor} more human player(s) to join...` });
    } else if (currentHumans === requiredHumans) {
        logger.info(`Room ${roomState.id} is full. Starting game with ${roomState.botCount} bots.`);
        await startGame(roomState);
    }
}

async function checkRoomRestart(roomState) {
    if (!roomState.gameData || !roomState.gameData.over) return;
    if (roomState.clientsInfo.length === 0) return;

    const allReady = roomState.clientsInfo.every(c => c.readyForRestart);
    if (allReady) {
        logger.info(`All players ready in room ${roomState.id}. Re-initializing game...`);
        roomState.clientsInfo.forEach(c => c.readyForRestart = false);
        await startGame(roomState);
    } else {
        const readyCount = roomState.clientsInfo.filter(c => c.readyForRestart).length;
        const total = roomState.clientsInfo.length;
        const waitingFor = total - readyCount;

        roomState.clientsInfo.filter(c => c.readyForRestart).forEach(c => {
            publishEvent(roomState.id, "waiting", { message: `Waiting for ${waitingFor} other player(s) to hit Play Again...` }, c.playerId);
        });
    }
}

async function startGame(roomState) {
    const roomId = roomState.id;
    let outgoingEvents = [];

    const allAdapters = [];
    for (let id = 0; id < PLAYER_COUNT; id++) {
        allAdapters.push({
            id,
            send: (event, payload) => {
                outgoingEvents.push({ targetPlayerId: id, event, payload });
            }
        });
    }

    const game = new GameState(allAdapters);

    // Initialise bots
    const botInstances = [];
    const numBots = PLAYER_COUNT - roomState.clientsInfo.length;

    for (let b = 0; b < numBots; b++) {
        const botId = roomState.clientsInfo.length + b;
        const diff = b === 0 ? 'hard' : 'medium';
        const bot = new BotAdapter(botId, diff, 0.25, PLAYER_COUNT, roomId);
        botInstances.push(bot);
    }

    const gameProxyForBots = createBotProxy(game, roomId);

    for (const bot of botInstances) {
        bot.attachGame(gameProxyForBots);
    }

    game.start("Game started!");

    // Relay startup events to bots immediately
    relayEventsToBots(outgoingEvents, botInstances);

    roomState.gameData = game.toJSON();
    roomState.botsConfig = botInstances.map(b => b.toJSON());

    await saveRoomState(roomId, roomState, true);

    // Publish to WebSocket clients
    for (const out of outgoingEvents) {
        publishEvent(roomId, out.event, out.payload, out.targetPlayerId);
    }
}

module.exports = {
    executeActionOnRoom,
    checkRoomStart,
    checkRoomRestart
};

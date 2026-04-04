/**
 * gameExecution.js
 * Core game action execution, start, and restart logic.
 */

const GameState = require("../game/GameState");
const BotAdapter = require("../ai/BotAdapter");
const logger = require("../utils/logger");
const { PLAYER_COUNT, PHASES, TURN_TIMEOUT_MS } = require("../config/constant");
const { acquireLock, releaseLock } = require("./locks");
const { getRoomState, saveRoomState } = require("./roomStore");
const { publishEvent } = require("./broadcast");
const { setTurnTimer, clearTurnTimer, getDeadline } = require("./turnTimers");

const AVATAR_KEYS = [
    'blackandwhite_joker', 'canday_joker', 'deadpool_joker', 'ghost_joker', 
    'harli_joker', 'ice_joker', 'magic_joker', 'mechinacal_joker', 
    'momie_joker', 'noar_joker', 'pirate_joker', 'purple_joker', 
    'robot_joker', 'wizard_joker', 'wood_joker', 'zombie_joker'
];
function getRandomAvatar() {
    return AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)];
}

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
// TURN TIMER HELPERS
// -----------------------------------------------------------------------------

/**
 * Returns the player ID who must act next and the nature of that action,
 * given the current turn phase and turn state.
 *
 * @returns {{ actorId: number, action: string } | null}
 */
function getNextActor(turnState) {
    const { phase, senderId, receiverId } = turnState;
    switch (phase) {
        case PHASES.WAITING_FOR_REQUEST:
        case PHASES.WAITING_FOR_FIRST_DECISION:
        case PHASES.WAITING_FOR_SECOND_DECISION:
            return { actorId: receiverId, role: 'receiver' };

        case PHASES.WAITING_FOR_FIRST_OFFER:
        case PHASES.WAITING_FOR_SECOND_OFFER:
        case PHASES.WAITING_FOR_THIRD_OFFER:
            return { actorId: senderId, role: 'sender' };

        default:
            return null;
    }
}

/**
 * Builds the fallback action payload for a player who has run out of time.
 * - Sender phases   → offer a random card from the sender's hand
 * - Receiver request → request a random valid rank
 * - Receiver decision (1st) → accept the only card on the table
 * - Receiver decision (2nd) → take the most recently placed card (accept_second)
 *
 * @param {object} turnState
 * @param {Array} players  – game player objects with hand arrays
 * @returns {{ event: string, playerId: number, payload: object }}
 */
function buildFallbackAction(turnState, players) {
    const { phase, senderId, receiverId, tableCards } = turnState;
    const RANKS = ['J', 'Q', 'K', 'A'];

    switch (phase) {
        case PHASES.WAITING_FOR_REQUEST: {
            const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
            return { event: 'request_card', playerId: receiverId, payload: { rank } };
        }

        case PHASES.WAITING_FOR_FIRST_OFFER:
        case PHASES.WAITING_FOR_SECOND_OFFER:
        case PHASES.WAITING_FOR_THIRD_OFFER: {
            const sender = players.find(p => p.id === senderId);
            if (!sender || sender.hand.length === 0) return null;
            const cardIndex = Math.floor(Math.random() * sender.hand.length);
            return { event: 'offer_card', playerId: senderId, payload: { cardIndex } };
        }

        case PHASES.WAITING_FOR_FIRST_DECISION: {
            // tableCards has 1 entry → accept it
            return { event: 'make_decision', playerId: receiverId, payload: { decision: 'accept' } };
        }

        case PHASES.WAITING_FOR_SECOND_DECISION: {
            // tableCards has 2 entries → take the most recent one (second)
            return { event: 'make_decision', playerId: receiverId, payload: { decision: 'accept_second' } };
        }

        default:
            return null;
    }
}

/**
 * Schedules the turn timer for the current phase.
 * A bot-acted turn (isHumanAction=false) also sets a timer so that if a bot
 * somehow stalls (e.g. an unhandled error in BotAdapter), the game doesn't freeze.
 */
function scheduleTurnTimer(roomId, turnState, players) {
    const actor = getNextActor(turnState);
    if (!actor) {
        clearTurnTimer(roomId);
        return;
    }

    setTurnTimer(roomId, () => {
        // Callback fires outside any lock — we must re-enter via executeActionOnRoom
        const fallback = buildFallbackAction(turnState, players);
        if (!fallback) return;

        logger.info(`Fallback action for room ${roomId}: player ${fallback.playerId} did not act in time (${turnState.phase}).`);
        executeActionOnRoom(roomId, fallback.playerId, fallback.event, fallback.payload, false)
            .catch(e => logger.error(`Fallback action error in room ${roomId}: ${e.message}`));
    }, TURN_TIMEOUT_MS);
}

// -----------------------------------------------------------------------------
// ACTION EXECUTION
// -----------------------------------------------------------------------------

/**
 * Executes ANY action against the room state atomically.
 * Works for both human WebSocket events and delayed bot/fallback actions.
 */
async function executeActionOnRoom(roomId, playerId, actionEvent, payload, isHumanAction = true) {
    const locked = await acquireLock(roomId);
    if (!locked) return logger.warn(`Skipped action ${actionEvent} by ${playerId} (locked)`);

    // Cancel the previous turn's timer before we mutate state.
    // This prevents a stale callback from firing after the action completes.
    clearTurnTimer(roomId);

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
            send: (event, eventPayload) => {
                outgoingEvents.push({ targetPlayerId: pData.id, event, payload: eventPayload });
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
        const turnAdvanced = roomState.gameData.turnState.senderIndex !== prevSender
                          || roomState.gameData.turnState.receiverIndex !== prevReceiver;
        const gameJustEnded = !wasOver && roomState.gameData.over;
        const shouldPersist = isHumanAction && (turnAdvanced || gameJustEnded);

        await saveRoomState(roomId, roomState, shouldPersist);

        // ── Schedule the next turn timer (unless the game just ended) ─────────
        if (!roomState.gameData.over) {
            scheduleTurnTimer(roomId, roomState.gameData.turnState, roomState.gameData.players);
        }

        // Inject the deadline into every game_update event so clients can display
        // an accurate countdown even after a late reconnect.
        const deadline = getDeadline(roomId);
        if (deadline !== null) {
            for (const out of outgoingEvents) {
                if (out.event === 'game_update') {
                    out.payload = { ...out.payload, deadline };
                }
            }
        }

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

    // Cancel any lingering turn timer from the previous round
    clearTurnTimer(roomId);

    let outgoingEvents = [];

    // --- SEATING SHUFFLE ---
    const { localClients } = require("./broadcast");
    const seatIds = [0, 1, 2, 3];
    for (let i = seatIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seatIds[i], seatIds[j]] = [seatIds[j], seatIds[i]];
    }

    const humanIds = new Set();
    const oldToNew = [];
    roomState.clientsInfo.forEach((c, index) => {
        const newId = seatIds[index];
        oldToNew.push({ oldId: c.playerId, newId });
        c.playerId = newId;
        humanIds.add(newId);
    });

    for (const mapping of oldToNew) {
        for (const ws of localClients) {
            if (ws.roomId === roomId && ws.playerId === mapping.oldId) {
                if (!ws._shuffled) {
                    ws.playerId = mapping.newId;
                    ws._shuffled = true;
                }
            }
        }
    }
    for (const ws of localClients) {
        if (ws.roomId === roomId) delete ws._shuffled;
    }

    const allAdapters = [];
    for (let id = 0; id < PLAYER_COUNT; id++) {
        allAdapters.push({
            id,
            send: (event, eventPayload) => {
                outgoingEvents.push({ targetPlayerId: id, event, payload: eventPayload });
            }
        });
    }

    const game = new GameState(allAdapters);

    // Initialise bots
    const botInstances = [];
    for (let botId = 0; botId < PLAYER_COUNT; botId++) {
        if (!humanIds.has(botId)) {
            const diff = 'hard';
            const bot = new BotAdapter(botId, diff, 0.25, PLAYER_COUNT, roomId);
            bot.avatar = getRandomAvatar();
            bot.playerName = 'Bot ' + botId;
            botInstances.push(bot);
        }
    }

    const gameProxyForBots = createBotProxy(game, roomId);

    for (const bot of botInstances) {
        bot.attachGame(gameProxyForBots);
    }

    game.start("Game started!");

    relayEventsToBots(outgoingEvents, botInstances);

    roomState.gameData = game.toJSON();
    roomState.botsConfig = botInstances.map(b => b.toJSON());

    // Start the very first turn timer
    scheduleTurnTimer(roomId, roomState.gameData.turnState, roomState.gameData.players);

    // Inject deadline into the initial game_update broadcasts
    const deadline = getDeadline(roomId);
    if (deadline !== null) {
        for (const out of outgoingEvents) {
            if (out.event === 'game_update') {
                out.payload = { ...out.payload, deadline };
            }
        }
    }

    await saveRoomState(roomId, roomState, true);

    const players = [];
    roomState.clientsInfo.forEach(c => {
        players.push({ id: c.playerId, avatar: c.avatar || 'blackandwhite_joker', name: c.playerName || 'Player ' + (c.playerId + 1), isBot: false });
    });
    roomState.botsConfig.forEach(b => {
        players.push({ id: b.id, avatar: b.avatar || 'blackandwhite_joker', name: b.playerName || 'Bot', isBot: true });
    });
    // Let clients know everyone's name and avatars, especially post-shuffle!
    publishEvent(roomId, "room_players_update", { players });

    for (const out of outgoingEvents) {
        publishEvent(roomId, out.event, out.payload, out.targetPlayerId);
    }
}

module.exports = {
    executeActionOnRoom,
    checkRoomStart,
    checkRoomRestart
};

/**
 * BotAdapter.js
 * Bridges the GameState event system with the heuristic AI (SimpleBot + BotMemory).
 *
 * A BotAdapter has exactly the same public shape as a human WebSocket adapter:
 *   { id: number, send: (event, payload) => void }
 *
 * GameState calls `send()` whenever it has a message for this player.
 * The adapter reacts by calling the appropriate SimpleBot decision function
 * and then calling back into GameState (handleRequestCard / handleOfferCard /
 * handleDecision).
 *
 * IMPORTANT: All callbacks are deferred with setImmediate() so the bot never
 * calls back into GameState while GameState is still in the middle of a send()
 * call — that would cause re-entrant state mutation bugs.
 */

const BotMemory = require("./BotMemory");
const {
    decideRequest,
    decideOffer,
    decideFirstDecision,
    decideSecondDecision,
} = require("./SimpleBot");
const {
    decideRequestAdvanced,
    decideOfferAdvanced,
    decideDecisionAdvanced,
} = require("./AdvancedBot");
const { PLAYER_COUNT, PHASES } = require("../config/constant");
const logger = require("../utils/logger");

class BotAdapter {
    /**
     * @param {number} id          Unique player ID assigned to this bot.
     * @param {string} [difficulty='medium']  'easy', 'medium', or 'hard'.
     * @param {number} [bluffChance=0.30]  Probability of passing Joker on first offer.
     * @param {number} [playerCount=PLAYER_COUNT]
     */
    constructor(id, difficulty = 'medium', bluffChance = 0.30, playerCount = PLAYER_COUNT) {
        this.id = id;
        this.difficulty = difficulty;
        this.bluffChance = bluffChance;

        /** @type {import('../game/GameState')|null} */
        this.game = null;

        /** The bot's current hand (kept in sync from game_update / card messages). */
        this.hand = [];

        /** Tracks whether the current offer is a 2nd/3rd offer (post-rejection). */
        this._offerCount = 0;

        /** Track the active timeout so it can be cleanly aborted. */
        this.timeoutId = null;

        /** @type {BotMemory} */
        this.memory = new BotMemory(playerCount, id);

        this.send = this.send.bind(this);

        logger.info(`[Bot ${id}] Created with difficulty=${difficulty}, bluffChance=${bluffChance}`);
    }

    /**
     * Must be called once after GameState is constructed so the bot can call back.
     * @param {import('../game/GameState')} game
     */
    attachGame(game) {
        this.game = game;
    }

    /**
     * Called when a bot replaces a disconnected player mid-game.
     * Evaluates the current game state and synthesizes the correct event
     * to trigger this bot into action if it's currently its turn.
     */
    resumeTurn() {
        if (!this.game) return;
        const ts = this.game.turnState;

        if (ts.receiverIndex === this.id) {
            if (ts.phase === PHASES.WAITING_FOR_REQUEST) {
                this.send("game_update", {
                    yourHand: this.hand,
                    turn: { sender: ts.senderIndex, receiver: ts.receiverIndex, phase: ts.phase }
                });
            } else if (ts.phase === PHASES.WAITING_FOR_FIRST_DECISION) {
                this.send("decision_needed", { offerNumber: 1 });
            } else if (ts.phase === PHASES.WAITING_FOR_SECOND_DECISION) {
                this.send("decision_needed", { offerNumber: 2 });
            }
        } else if (ts.senderIndex === this.id) {
            if (ts.phase === PHASES.WAITING_FOR_FIRST_OFFER) {
                this.send("card_requested", { requestedRank: ts.requestedRank });
            } else if (ts.phase === PHASES.WAITING_FOR_SECOND_OFFER) {
                this.send("second_offer_needed", {});
            } else if (ts.phase === PHASES.WAITING_FOR_THIRD_OFFER) {
                this.send("third_offer_needed", {});
            }
        }
    }

    /** Helper to manage the single active thinking timeout */
    _setTimeout(fn, delay) {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(fn, delay);
    }

    /** Cleanly destroys this bot by aborting any pending background action */
    destroy() {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.game = null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // The "send" interface — GameState → Bot
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Called by GameState for every event directed at this bot.
     * @param {string} event
     * @param {Object} payload
     */
    send(event, payload) {
        switch (event) {
            case "game_update":
                this._onGameUpdate(payload);
                break;

            case "card_requested":
                // Bot is the SENDER; GameState told it what rank was requested.
                this._onCardRequested(payload);
                break;

            case "waiting":
                // Bot is RECEIVER and game is in motion; nothing to do yet.
                break;

            case "decision_needed":
                this._onDecisionNeeded(payload);
                break;

            case "second_offer_needed":
                this._onSecondOfferNeeded(payload);
                break;

            case "third_offer_needed":
                this._onThirdOfferNeeded(payload);
                break;

            case "card_placed_on_table":
                // Sender's hand was updated after placing a card.
                if (payload.yourHand) this.hand = payload.yourHand;
                break;

            case "card_received":
                // Bot (receiver) got a card.
                if (payload.yourHand) this.hand = payload.yourHand;
                this.memory.recordCardReceived(this.id, payload.card);
                this.memory.recordOffer(
                    this._currentSenderId(),
                    this.id,
                    /* accepted */ true,
                    this._offerCount
                );
                this._offerCount = 0;
                logger.info(`[Bot ${this.id}] Received card: ${payload.cardLabel}`);
                break;

            case "card_sent":
                // Bot (sender) confirmation that card was sent.
                if (payload.yourHand) this.hand = payload.yourHand;
                logger.info(`[Bot ${this.id}] Sent card: ${payload.cardLabel}`);
                break;

            case "interaction_update":
                // Spectator notification — record offer outcome for memory.
                this.memory.recordOffer(
                    this._currentSenderId(),
                    this._currentReceiverId(),
                    /* accepted */ true
                );
                break;

            case "game_over":
                logger.info(
                    `[Bot ${this.id}] Game over — loser: ${payload.loserId}, winners: ${payload.winnerIds}`
                );
                break;

            case "error":
                logger.warn(`[Bot ${this.id}] Error from GameState: ${payload.message}`);
                break;

            default:
                // Unknown event — silently ignore.
                break;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private event handlers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * game_update arrives at the start of every turn and on game start.
     * If it's the bot's turn to request (it is the receiver), fire a request.
     */
    _onGameUpdate(payload) {
        if (payload.yourHand) this.hand = payload.yourHand;

        const { sender, receiver, phase } = payload.turn;

        // Sync memory round on every turn change
        this.memory.advanceRound();

        // If bot is the receiver and it's time to request, do so.
        if (receiver === this.id && phase === "waiting_for_request") {
            this._offerCount = 0;
            this._setTimeout(() => this._doRequest(), 1500);
        }
    }

    /** Bot is SENDER — it knows what rank was requested. Now choose a card. */
    _onCardRequested(payload) {
        if (payload.yourHand) this.hand = payload.yourHand;
        const requestedRank = payload.requestedRank;
        const receiverId = this._currentReceiverId();

        // Record the request in memory
        this.memory.recordRequest(receiverId, requestedRank);

        this._offerCount = 1;
        this._setTimeout(() => this._doOffer(/* isSecondOffer */ false), 1500);
    }

    /** Receiver (bot) must decide: accept or reject. */
    _onDecisionNeeded(payload) {
        const offerNumber = payload.offerNumber; // 1 or 2
        const senderId = this._currentSenderId();

        this._setTimeout(() => {
            if (offerNumber === 1) {
                let decision;
                if (this.difficulty === 'hard') {
                    decision = decideDecisionAdvanced(this.memory, senderId, this.game.turnState.requestedRank, 1);
                } else {
                    decision = decideFirstDecision(this.memory, senderId);
                }

                logger.info(`[Bot ${this.id}] First decision (${this.difficulty}): ${decision} (suspicion of P${senderId}: ${this.memory.suspicionOf(senderId).toFixed(2)})`);

                if (decision === "reject") {
                    this.memory.recordOffer(senderId, this.id, false, 1);
                }

                this.game.handleDecision(this.id, decision);
            } else {
                let decision;
                if (this.difficulty === 'hard') {
                    decision = decideDecisionAdvanced(this.memory, senderId, this.game.turnState.requestedRank, 2);
                } else {
                    decision = decideSecondDecision(this.memory, senderId);
                }
                logger.info(`[Bot ${this.id}] Second decision (${this.difficulty}): ${decision}`);
                this.game.handleDecision(this.id, decision);
            }
        }, 1500);
    }

    /** Sender (bot) must offer a second card. */
    _onSecondOfferNeeded(payload) {
        if (payload.yourHand) this.hand = payload.yourHand;
        this._offerCount = 2;
        this._setTimeout(() => this._doOffer(/* isSecondOffer */ true), 1500);
    }

    /** Sender (bot) must offer a mandatory third card. */
    _onThirdOfferNeeded(payload) {
        if (payload.yourHand) this.hand = payload.yourHand;
        this._offerCount = 3;
        // On the 3rd forced offer just pick a card (still use offer logic but it's mandatory)
        this._setTimeout(() => this._doOffer(/* isSecondOffer */ true), 1500);
    }

    // ─── Action helpers ───────────────────────────────────────────────────────

    _doRequest() {
        let rank;
        if (this.difficulty === 'hard') {
            rank = decideRequestAdvanced(this.hand, this.memory);
        } else {
            rank = decideRequest(this.hand);
        }
        logger.info(`[Bot ${this.id}] Requesting rank (${this.difficulty}): ${rank} (hand size: ${this.hand.length})`);
        this.game.handleRequestCard(this.id, rank);
    }

    _doOffer(isSecondOffer) {
        let cardIndex;
        if (this.difficulty === 'hard') {
            cardIndex = decideOfferAdvanced(
                this.hand,
                this.memory,
                this._currentReceiverId(),
                this.game.turnState.requestedRank,
                this.bluffChance,
                this._offerCount || 1
            );
        } else {
            cardIndex = decideOffer(
                this.hand,
                this.memory,
                this.bluffChance,
                isSecondOffer
            );
        }
        const card = this.hand[cardIndex];
        const label = card
            ? (card.rank === "Joker" ? "Joker" : `${card.rank}_${card.suit}`)
            : "?";
        logger.info(`[Bot ${this.id}] Offering card index ${cardIndex} (${label}), isSecondOffer=${isSecondOffer}`);
        this.game.handleOfferCard(this.id, cardIndex);
    }

    // ─── Turn-state helpers ───────────────────────────────────────────────────

    _currentSenderId() {
        return this.game?.turnState?.senderIndex ?? -1;
    }

    _currentReceiverId() {
        return this.game?.turnState?.receiverIndex ?? -1;
    }
}

module.exports = BotAdapter;

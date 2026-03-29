/**
 * GameState.js
 * The heart of Joker Trap: a pure state machine with zero WebSocket dependency.
 *
 * Players are injected as adapter objects:
 *   { id: number, send: (event: string, payload: object) => void }
 *
 * This makes the class fully unit-testable without a live server.
 */

const Deck = require("./Deck");
const { cardLabel, findQuad, validateRank } = require("./rules");
const { PHASES, PLAYER_COUNT } = require("../config/constant");
const logger = require("../utils/logger");

class GameState {
    /**
     * @param {Array<{ id: number, send: Function }>} players
     *   Exactly PLAYER_COUNT adapter objects.
     */
    constructor(players) {
        if (players.length !== PLAYER_COUNT) {
            throw new Error(`GameState requires exactly ${PLAYER_COUNT} players.`);
        }

        const hands = new Deck().build().shuffle().deal(PLAYER_COUNT);

        this.players = players.map((p, i) => ({
            id: p.id,
            send: p.send,
            hand: hands[i],
        }));

        this.over = false;

        /**
         * turnState drives the phase machine.
         * tableCards holds cards the sender has put face-down on the table
         * (removed from sender's hand but not yet given to receiver).
         */
        this.turnState = {
            senderIndex: 0,
            receiverIndex: 1,
            phase: PHASES.WAITING_FOR_REQUEST,
            requestedRank: null,
            tableCards: [],
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Public API – called by socketServer (or tests)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Phase 1 – Receiver declares which rank they want.
     * Transitions: WAITING_FOR_REQUEST → WAITING_FOR_FIRST_OFFER
     */
    handleRequestCard(playerId, rank) {
        const ts = this.turnState;

        if (playerId !== this._receiver().id || ts.phase !== PHASES.WAITING_FOR_REQUEST) {
            return this._errorTo(playerId, "Invalid action for current phase.");
        }

        const normalised = (rank || "").trim().toUpperCase();
        if (!validateRank(normalised)) {
            return this._errorTo(playerId, `Invalid rank: "${rank}". Use J, Q, K or A.`);
        }

        ts.requestedRank = normalised;
        ts.phase = PHASES.WAITING_FOR_FIRST_OFFER;

        logger.game(`Player ${playerId} requested rank: ${normalised}`);

        // Broadcast to everyone that the phase changed to WAITING_FOR_FIRST_OFFER
        this._broadcastGameState();

        // Only the SENDER sees what was requested
        this._sender().send("card_requested", {
            requestedRank: normalised,
            message: `Player ${ts.receiverIndex} requested: ${normalised}. Pick a card to offer face-down.`,
            yourHand: this._sender().hand,
        });

        this._receiver().send("waiting", {
            message: "Waiting for the sender to offer a card...",
        });
    }

    /**
     * Phase 2 / 4 / 6 – Sender places a card face-down on the table.
     * Transitions:
     *   WAITING_FOR_FIRST_OFFER  → WAITING_FOR_FIRST_DECISION
     *   WAITING_FOR_SECOND_OFFER → WAITING_FOR_SECOND_DECISION
     *   WAITING_FOR_THIRD_OFFER  → resolves immediately (mandatory)
     */
    handleOfferCard(playerId, cardIndex) {
        const ts = this.turnState;
        const sender = this._sender();

        if (playerId !== sender.id) {
            return this._errorTo(playerId, "Not your turn to offer a card.");
        }

        const offerPhases = [
            PHASES.WAITING_FOR_FIRST_OFFER,
            PHASES.WAITING_FOR_SECOND_OFFER,
            PHASES.WAITING_FOR_THIRD_OFFER,
        ];
        if (!offerPhases.includes(ts.phase)) {
            return this._errorTo(playerId, "Not the right phase to offer a card.");
        }

        if (cardIndex < 0 || cardIndex >= sender.hand.length) {
            return this._errorTo(playerId, `Invalid card index. You have ${sender.hand.length} cards.`);
        }

        // Remove from sender's hand; put on table
        const offered = sender.hand.splice(cardIndex, 1)[0];
        ts.tableCards.push(offered);

        logger.game(`Player ${playerId} placed card on table (total on table: ${ts.tableCards.length})`);

        const receiver = this._receiver();

        if (ts.phase === PHASES.WAITING_FOR_FIRST_OFFER) {
            ts.phase = PHASES.WAITING_FOR_FIRST_DECISION;
            receiver.send("decision_needed", {
                offerNumber: 1,
                message: "Sender offered a hidden card. [A]ccept or [R]eject?",
            });
        } else if (ts.phase === PHASES.WAITING_FOR_SECOND_OFFER) {
            ts.phase = PHASES.WAITING_FOR_SECOND_DECISION;
            receiver.send("decision_needed", {
                offerNumber: 2,
                message: "Sender offered a second hidden card. Accept 1st / 2nd, or Force 3rd?",
            });
        } else if (ts.phase === PHASES.WAITING_FOR_THIRD_OFFER) {
            // Third card is mandatory – resolve immediately
            this._resolveTransfer(2);
            return; // early return; _resolveTransfer handles sender update
        }

        // Broadcast state so everyone sees the card on the table
        this._broadcastGameState();

        // Update sender's hand view after placing card (legacy explicit)
        sender.send("card_placed_on_table", {
            yourHand: sender.hand,
            tableCount: ts.tableCards.length,
        });
    }

    /**
     * Phase 3 / 5 – Receiver decides what to take from the table.
     * Valid decisions:
     *   "accept"        – take the only card on the table (first offer)
     *   "reject"        – reject first offer; sender must offer 2nd
     *   "accept_first"  – take card[0] from table (second offer)
     *   "accept_second" – take card[1] from table (second offer)
     *   "force_third"   – force sender to offer a 3rd card (mandatory)
     */
    handleDecision(playerId, decision) {
        const ts = this.turnState;

        if (playerId !== this._receiver().id) {
            return this._errorTo(playerId, "Not your turn to decide.");
        }

        const decisionPhases = [
            PHASES.WAITING_FOR_FIRST_DECISION,
            PHASES.WAITING_FOR_SECOND_DECISION,
        ];
        if (!decisionPhases.includes(ts.phase)) {
            return this._errorTo(playerId, "Not the right phase to make a decision.");
        }

        if (ts.phase === PHASES.WAITING_FOR_FIRST_DECISION) {
            if (decision === "accept") {
                this._resolveTransfer(0);
            } else if (decision === "reject") {
                ts.phase = PHASES.WAITING_FOR_SECOND_OFFER;
                this._broadcastGameState();
                this._sender().send("second_offer_needed", {
                    message: "Receiver rejected your first card! Offer a second one.",
                    yourHand: this._sender().hand,
                });
            } else {
                this._errorTo(playerId, `Unknown decision "${decision}" for first offer.`);
            }
        } else if (ts.phase === PHASES.WAITING_FOR_SECOND_DECISION) {
            if (decision === "accept_first") {
                this._resolveTransfer(0);
            } else if (decision === "accept_second") {
                this._resolveTransfer(1);
            } else if (decision === "force_third") {
                ts.phase = PHASES.WAITING_FOR_THIRD_OFFER;
                this._broadcastGameState();
                this._sender().send("third_offer_needed", {
                    message: "Receiver forced a third card! You MUST offer another card.",
                    yourHand: this._sender().hand,
                });
            } else {
                this._errorTo(playerId, `Unknown decision "${decision}" for second offer.`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /** Complete a card transfer: receiver takes tableCards[index], rest return to sender. */
    _resolveTransfer(acceptedIndex) {
        const ts = this.turnState;
        const sender = this._sender();
        const receiver = this._receiver();

        const acceptedCard = ts.tableCards[acceptedIndex];
        const rejectedCards = ts.tableCards.filter((_, i) => i !== acceptedIndex);

        // Move cards
        receiver.hand.push(acceptedCard);
        sender.hand.push(...rejectedCards);
        ts.tableCards = [];

        const label = cardLabel(acceptedCard);
        logger.game(
            `Transfer: Player ${sender.id} → Player ${receiver.id} | card: ${label} | requested: ${ts.requestedRank}`
        );

        // Reveal to receiver only what they actually got
        receiver.send("card_received", {
            card: acceptedCard,
            cardLabel: label,
            requestedRank: ts.requestedRank,
            yourHand: receiver.hand,
        });

        // Confirm to sender
        sender.send("card_sent", {
            cardLabel: label,
            yourHand: sender.hand,
        });

        // Spectators: interaction complete (no card info)
        for (const p of this.players) {
            if (p.id !== sender.id && p.id !== receiver.id) {
                p.send("interaction_update", {
                    message: `Interaction between Player ${sender.id} and Player ${receiver.id} is complete.`,
                });
            }
        }

        // Check for quad after every transfer
        for (const p of this.players) {
            const quadRank = findQuad(p.hand);
            if (quadRank) {
                logger.game(`Player ${p.id} completed a quad of ${quadRank}!`);
                return this._endGame(p.id, quadRank);
            }
        }

        this._advanceTurn();
    }

    /** Advance turn: old receiver becomes new sender; next player clockwise is receiver. */
    _advanceTurn() {
        const ts = this.turnState;
        const oldReceiver = ts.receiverIndex;
        ts.senderIndex = oldReceiver;
        ts.receiverIndex = (oldReceiver + 1) % this.players.length;
        ts.phase = PHASES.WAITING_FOR_REQUEST;
        ts.requestedRank = null;
        ts.tableCards = [];

        logger.game(`Turn advance → Sender: Player ${ts.senderIndex} | Receiver: Player ${ts.receiverIndex}`);

        // Broadcast updated game state to every player
        this._broadcastGameState();
    }

    /** Detect winner, mark game over, broadcast result. */
    _endGame(quadPlayerId, quadRank) {
        this.over = true;

        const jokerHolder = this.players.find(p => p.hand.some(c => c.rank === "Joker"));
        const loserId = jokerHolder ? jokerHolder.id : null;
        const winnerIds = this.players.map(p => p.id).filter(id => id !== loserId);

        logger.game(`GAME OVER — quad by Player ${quadPlayerId} (${quadRank}), Joker: Player ${loserId}`);

        const payload = {
            quadPlayer: quadPlayerId,
            quadRank,
            loserId,
            winnerIds,
            hands: this.players.map(p => ({ id: p.id, hand: p.hand })),
        };
        for (const p of this.players) p.send("game_over", payload);
    }

    /** Send each player their own hand + turn info (requestedRank only to sender). */
    _broadcastGameState(extras = {}) {
        const ts = this.turnState;
        for (const p of this.players) {
            p.send("game_update", {
                playerId: p.id,
                yourHand: p.hand,
                turn: {
                    sender: ts.senderIndex,
                    receiver: ts.receiverIndex,
                    phase: ts.phase,
                    requestedRank: p.id === ts.senderIndex ? ts.requestedRank : undefined,
                },
                tableCount: ts.tableCards.length,
                ...extras,
            });
        }
    }

    /** Send an error event to a specific player (by id). */
    _errorTo(playerId, message) {
        const p = this.players.find(pl => pl.id === playerId);
        if (p) p.send("error", { message });
        logger.warn(`Error to Player ${playerId}: ${message}`);
    }

    _sender() { return this.players[this.turnState.senderIndex]; }
    _receiver() { return this.players[this.turnState.receiverIndex]; }

    // ═══════════════════════════════════════════════════════════════════════════
    // Convenience – call after construction to push the first game_update
    // ═══════════════════════════════════════════════════════════════════════════
    start(message = "Game started!") {
        this._broadcastGameState({ message });
    }

    /**
     * Re-sends the current game state to all player adapters.
     * Used during session resumption — the adapters filter delivery to the target player.
     */
    sendStateUpdate(extras = {}) {
        this._broadcastGameState(extras);
    }

    toJSON() {
        return {
            over: this.over,
            turnState: this.turnState,
            players: this.players.map(p => ({
                id: p.id,
                hand: p.hand,
            }))
        };
    }

    static fromJSON(data, adapterInstances) {
        const state = new GameState(adapterInstances);
        state.over = data.over;
        state.turnState = data.turnState;
        
        state.players = adapterInstances.map(p => {
            const savedPlayer = data.players.find(sp => sp.id === p.id);
            return {
                id: p.id,
                send: p.send,
                hand: savedPlayer ? savedPlayer.hand : []
            };
        });

        return state;
    }
}

module.exports = GameState;

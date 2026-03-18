/**
 * BotMemory.js
 * Tracks the full event history of a game from a single bot's perspective.
 *
 * Since Joker Trap is an incomplete-information game, the bot cannot see other
 * players' hands. BotMemory distils all *observable* events into:
 *   - eventLog      : raw history of every interaction
 *   - jokerSuspicion: 0–1 score per player — how likely they hold the Joker
 *   - rankRequests  : how many times each rank has been requested
 *
 * All methods are pure data mutations — no I/O, fully unit-testable.
 */

class BotMemory {
    /**
     * @param {number} playerCount  Total number of players in the game.
     * @param {number} botId        The ID of the bot that owns this memory.
     */
    constructor(playerCount, botId) {
        this.playerCount = playerCount;
        this.botId = botId;

        /** Track last requested rank of players to detect singleton collecting. */
        this.lastRequestedRank = new Map();

        /** History of accepted offer numbers per player (max 3). */
        this.receiverDecisionHistory = new Map();
        for (let i = 0; i < playerCount; i++) {
            this.receiverDecisionHistory.set(i, []);
        }

        /** @type {Array<Object>} */
        this.eventLog = [];

        /**
         * Joker-suspicion score per player ID (0 = definitely no Joker, 1 = definitely Joker).
         * Initialised uniformly — anyone could have it.
         * @type {Map<number, number>}
         */
        this.jokerSuspicion = new Map();
        for (let i = 0; i < playerCount; i++) {
            this.jokerSuspicion.set(i, 1 / playerCount);
        }

        /**
         * How many times each rank has been publicly requested.
         * @type {Map<string, number>}
         */
        this.rankRequests = new Map();

        /**
         * The player the bot currently knows holds the Joker (confirmed via card_received).
         * null until we have direct evidence.
         * @type {number|null}
         */
        this.confirmedJokerHolder = null;

        /**
         * Tracks which players likely hold which ranks.
         * @type {Map<number, Set<string>>}
         */
        this.knownRanks = new Map();
        for (let i = 0; i < playerCount; i++) {
            this.knownRanks.set(i, new Set());
        }

        /** Round counter — incremented each time the bot observes a turn advance. */
        this.round = 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Recording events
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Record that a receiver publicly requested a rank.
     * Increases the probability that this receiver is chasing a quad of that rank,
     * which means they likely DON'T hold the Joker themselves (distracted player).
     *
     * @param {number} receiverId
     * @param {string} rank
     */
    recordRequest(receiverId, rank) {
        this.eventLog.push({ type: "request", receiverId, rank, round: this.round });
        this.rankRequests.set(rank, (this.rankRequests.get(rank) ?? 0) + 1);

        const lastReq = this.lastRequestedRank.get(receiverId);
        if (lastReq) {
            if (lastReq !== rank) {
                // Changing request -> probably collecting singletons (Joker behaviour)
                this._adjustSuspicion(receiverId, 0.15);
            } else {
                // Consistent request -> probably chasing quad
                this._adjustSuspicion(receiverId, -0.05);
            }
        } else {
            // First time requesting, minor drop in suspicion
            this._adjustSuspicion(receiverId, -0.03);
        }

        this.lastRequestedRank.set(receiverId, rank);
        this._normaliseSuspicion();
    }

    /**
     * Record the outcome of a card offer (accepted or rejected).
     *
     * If a player accepts a card without hesitation, there is a small chance
     * they were tricked into taking the Joker → bump sender's past suspicion slightly.
     * If a player rejects a card, the sender might have tried to pass the Joker.
     *
     * @param {number} senderId
     * @param {number} receiverId
     * @param {boolean} accepted   true = receiver accepted the card
     * @param {number}  offerNum   1, 2  or 3
     */
    recordOffer(senderId, receiverId, accepted, offerNum = 1) {
        this.eventLog.push({
            type: "offer",
            senderId,
            receiverId,
            accepted,
            offerNum,
            round: this.round,
        });

        if (accepted) {
            // Record this decision
            const history = this.receiverDecisionHistory.get(receiverId) || [];
            history.push(offerNum);
            if (history.length > 3) history.shift();
            this.receiverDecisionHistory.set(receiverId, history);

            // Sender gave something away — slight suspicion that they passed the Joker.
            this._adjustSuspicion(senderId, 0.04);
        } else {
            // Receiver rejected: sender may have offered a bad card (possibly Joker).
            // After multiple rejections, bump suspicion further.
            this._adjustSuspicion(senderId, 0.02 * offerNum);
        }

        this._normaliseSuspicion();
    }

    /**
     * Record the card a player actually received.
     * If the card is the Joker, update confirmed holder and pin their suspicion to 1.
     *
     * @param {number} receiverId
     * @param {{ rank: string, suit: string }} card
     */
    recordCardReceived(receiverId, card) {
        this.eventLog.push({
            type: "card_received",
            receiverId,
            isJoker: card.rank === "Joker",
            round: this.round,
        });

        if (card.rank === "Joker") {
            this.confirmedJokerHolder = receiverId;
            // Pin suspicion: this player definitely has the Joker now.
            for (const [id] of this.jokerSuspicion) {
                this.jokerSuspicion.set(id, id === receiverId ? 1 : 0);
            }
        } else {
            // Track known ranks
            if (!this.knownRanks.has(receiverId)) {
                this.knownRanks.set(receiverId, new Set());
            }
            this.knownRanks.get(receiverId).add(card.rank);
        }
    }

    /**
     * Determines which offer number (1, 2, or 3) a receiver most commonly accepts.
     * Defaults to 1 if no history is available.
     * @param {number} receiverId
     * @returns {number}
     */
    getReceiverLikelyOfferNum(receiverId) {
        const history = this.receiverDecisionHistory.get(receiverId);
        if (!history || history.length === 0) return 1;

        const counts = { 1: 0, 2: 0, 3: 0 };
        history.forEach(n => counts[n]++);

        let bestNum = 1;
        let bestCount = -1;
        for (const [num, count] of Object.entries(counts)) {
            if (count > bestCount) {
                bestCount = count;
                bestNum = parseInt(num, 10);
            }
        }
        return bestNum;
    }

    /** Call at the start of each new turn (after _advanceTurn). */
    advanceRound() {
        this.round++;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Queries
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Returns the player ID the bot suspects most of holding the Joker.
     * Returns null if it suspects itself most (can't pass to oneself).
     *
     * @returns {number|null}
     */
    jokerCarrierGuess() {
        if (this.confirmedJokerHolder !== null) return this.confirmedJokerHolder;

        let topId = null;
        let topScore = -Infinity;
        for (const [id, score] of this.jokerSuspicion) {
            if (id !== this.botId && score > topScore) {
                topScore = score;
                topId = id;
            }
        }
        return topId;
    }

    /**
     * Suspicion score (0–1) for a given player.
     * @param {number} playerId
     * @returns {number}
     */
    suspicionOf(playerId) {
        return this.jokerSuspicion.get(playerId) ?? 0;
    }

    /**
     * How many times a given rank has been publicly requested.
     * @param {string} rank
     * @returns {number}
     */
    rankDemandCount(rank) {
        return this.rankRequests.get(rank) ?? 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════════════════════

    _adjustSuspicion(playerId, delta) {
        const current = this.jokerSuspicion.get(playerId) ?? 0;
        this.jokerSuspicion.set(playerId, Math.max(0, Math.min(1, current + delta)));
    }

    /** Re-normalise so all suspicion values sum to 1. */
    _normaliseSuspicion() {
        const total = [...this.jokerSuspicion.values()].reduce((s, v) => s + v, 0);
        if (total === 0) {
            this._resetSuspicion();
            return;
        }
        for (const [id, v] of this.jokerSuspicion) {
            this.jokerSuspicion.set(id, v / total);
        }
    }

    _resetSuspicion() {
        const uniform = 1 / this.playerCount;
        for (const [id] of this.jokerSuspicion) {
            this.jokerSuspicion.set(id, uniform);
        }
    }
}

module.exports = BotMemory;

/**
 * AdvancedBot.js
 * Advanced heuristic decisions for Joker Trap.
 * This bot tracks card flow and optimizes win chances.
 */

const { RANKS } = require("../config/constant");

/**
 * Advanced Request: Ask for what you need MOST, 
 * but prioritize players who haven't shown they LACK that card.
 */
function decideRequestAdvanced(hand, memory) {
    const counts = {};
    for (const rank of RANKS) counts[rank] = 0;
    for (const card of hand) {
        if (card.rank !== "Joker") counts[card.rank]++;
    }

    const hasJoker = hand.some(c => c.rank === "Joker");

    if (hasJoker) {
        // Collect singletons to block others: request a rank we have 0 of
        const missingRanks = RANKS.filter(r => counts[r] === 0);
        if (missingRanks.length > 0) {
            return missingRanks[Math.floor(Math.random() * missingRanks.length)];
        }
    }

    // Sort ranks by what we are closest to (4-count)
    const sortedRanks = RANKS.slice().sort((a, b) => {
        const diff = counts[b] - counts[a];
        return diff !== 0 ? diff : Math.random() - 0.5;
    });

    return sortedRanks[0];
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Returns the index of the least-valuable non-Joker card in the hand.
 * "Least valuable" = the rank with the fewest copies (hard to complete a quad).
 * Used as a decoy when the bot wants to stall or mislead.
 */
function _pickDecoy(hand) {
    const counts = {};
    hand.forEach(c => { if (c.rank !== "Joker") counts[c.rank] = (counts[c.rank] || 0) + 1; });
    let bestIdx = -1, minCount = Infinity;
    hand.forEach((c, i) => {
        if (c.rank !== "Joker" && (counts[c.rank] || 0) < minCount) {
            minCount = counts[c.rank] || 0;
            bestIdx = i;
        }
    });
    return bestIdx !== -1 ? bestIdx : 0;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Advanced Offer:
 * When holding the Joker, use memory to determine the optimal offer-position
 * (1, 2 or 3) at which this receiver is most likely to accept, and stall with
 * decoys on all other positions.
 *
 * The bot improves across turns because:
 *   - Every Joker placement is annotated via memory.noteJokerPlaced().
 *   - recordOffer() correlates the outcome (accepted / rejected) back to that
 *     placement and stores it in jokerPassAttempts.
 *   - suggestJokerPosition() scores positions 1–3 and avoids known failures.
 */
function decideOfferAdvanced(hand, memory, receiverId, requestedRank, bluffChance, offerNum) {
    const jokerIndex = hand.findIndex(c => c.rank === "Joker");
    const hasJoker = jokerIndex !== -1;

    if (hasJoker) {
        // offerNum 3 is forced — the bot must surrender a card. Always the Joker.
        if (offerNum === 3) {
            memory.noteJokerPlaced(receiverId, 3);
            return jokerIndex;
        }

        // Ask memory: which position (1-3) is this receiver most likely to accept?
        // The suggestion learns from general acceptance patterns AND Joker-specific
        // success/failure history, so it adapts after every failed pass attempt.
        const targetPosition = memory.suggestJokerPosition(receiverId);

        // Place the Joker if we've reached the target position.
        // Also occasionally bluff (place it early) to stay unpredictable.
        if (offerNum === targetPosition || Math.random() < bluffChance) {
            memory.noteJokerPlaced(receiverId, offerNum);
            return jokerIndex;
        }

        // Not the right moment yet — send a decoy to stall.
        return _pickDecoy(hand);
    }

    // --- We DON'T have the Joker ---
    // Cooperate: give the requested rank if we have it (helps them collect quads
    // and keeps the Joker moving away from us).
    const requestedIndex = hand.findIndex(c => c.rank === requestedRank);
    if (requestedIndex !== -1) return requestedIndex;

    // Otherwise send the least-valuable decoy.
    return _pickDecoy(hand);
}

/**
 * Advanced Decision:
 * Increase acceptance if the sender is known to have the rank we asked for.
 */
function decideDecisionAdvanced(memory, senderId, requestedRank, offerNumber) {
    const suspicion = memory.suspicionOf(senderId);
    const senderHasRank = memory.knownRanks && memory.knownRanks.get(senderId)?.has(requestedRank);

    let acceptProb = 0.4; // Base
    if (senderHasRank) acceptProb += 0.4; // High boost if they have it
    acceptProb -= suspicion * 0.5; // Penalty for Joker suspicion

    const roll = Math.random();
    if (offerNumber === 1) {
        return roll < acceptProb ? "accept" : "reject";
    } else {
        // 2nd offer logic: if they probably have it, accept one of the first two
        if (roll < acceptProb) return Math.random() < 0.5 ? "accept_first" : "accept_second";
        return "force_third";
    }
}

module.exports = {
    decideRequestAdvanced,
    decideOfferAdvanced,
    decideDecisionAdvanced
};

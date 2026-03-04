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

    // Sort ranks by what we are closest to (4-count)
    const sortedRanks = RANKS.slice().sort((a, b) => counts[b] - counts[a]);

    // For now, return the best rank. 
    // Logic could be expanded to pick WHICH player to ask.
    return sortedRanks[0];
}

/**
 * Advanced Offer:
 * Avoid giving the receiver exactly what they asked for if it helps them win.
 */
function decideOfferAdvanced(hand, memory, receiverId, requestedRank, bluffChance, isSecondOffer) {
    const jokerIndex = hand.findIndex(c => c.rank === "Joker");
    if (jokerIndex !== -1 && (isSecondOffer || Math.random() < bluffChance)) {
        return jokerIndex;
    }

    // Filter cards: try to avoid giving the requestedRank if we have other choices
    const nonRequestedIndices = [];
    hand.forEach((card, index) => {
        if (card.rank !== "Joker" && card.rank !== requestedRank) {
            nonRequestedIndices.push(index);
        }
    });

    if (nonRequestedIndices.length > 0) {
        // Find least valuable from non-requested
        let bestIdx = nonRequestedIndices[0];
        let minCount = 5;
        const counts = {};
        hand.forEach(c => { if (c.rank !== "Joker") counts[c.rank] = (counts[c.rank] || 0) + 1; });

        for (const idx of nonRequestedIndices) {
            if (counts[hand[idx].rank] < minCount) {
                minCount = counts[hand[idx].rank];
                bestIdx = idx;
            }
        }
        return bestIdx;
    }

    // Fallback to least valuable overall (excluding Joker)
    return hand.findIndex(c => c.rank !== "Joker") || 0;
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

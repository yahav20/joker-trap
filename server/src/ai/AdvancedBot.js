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

/**
 * Advanced Offer:
 * Avoid giving the receiver exactly what they asked for if it helps them win.
 */
function decideOfferAdvanced(hand, memory, receiverId, requestedRank, bluffChance, offerNum) {
    const jokerIndex = hand.findIndex(c => c.rank === "Joker");
    const hasJoker = jokerIndex !== -1;

    if (hasJoker) {
        const likelyOffer = memory.getReceiverLikelyOfferNum(receiverId) || 1;

        // Always place Joker on the 3rd forced offer
        if (offerNum === 3) return jokerIndex;

        // If this is the offer they usually take, offer the Joker!
        // Introduce slight randomness so we aren't 100% predictable
        if (offerNum === likelyOffer || Math.random() < bluffChance) {
            return jokerIndex;
        }

        // Otherwise, send a decoy (least valuable non-Joker)
        const counts = {};
        hand.forEach(c => { if (c.rank !== "Joker") counts[c.rank] = (counts[c.rank] || 0) + 1; });
        let bestIdx = -1;
        let minCount = Infinity;
        hand.forEach((c, i) => {
            if (c.rank !== "Joker" && (counts[c.rank] || 0) < minCount) {
                minCount = counts[c.rank] || 0;
                bestIdx = i;
            }
        });
        return bestIdx !== -1 ? bestIdx : 0;
    }

    // --- Cooperative block: We DON'T have the Joker ---
    // If we have the requested rank, GIVE it to them to help them win!
    const requestedIndex = hand.findIndex(c => c.rank === requestedRank);
    if (requestedIndex !== -1) {
        return requestedIndex;
    }

    // Otherwise, offer the least valuable overall (decoy)
    const counts = {};
    hand.forEach(c => { if (c.rank !== "Joker") counts[c.rank] = (counts[c.rank] || 0) + 1; });
    let bestIdx = hand.findIndex(c => c.rank !== "Joker") || 0;
    if (bestIdx === -1) return 0; // safely fallback

    let minCount = counts[hand[bestIdx].rank] || Infinity;
    for (let i = 0; i < hand.length; i++) {
        if (hand[i].rank !== "Joker" && (counts[hand[i].rank] || Infinity) < minCount) {
            minCount = counts[hand[i].rank];
            bestIdx = i;
        }
    }
    return bestIdx;
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

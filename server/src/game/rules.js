/**
 * rules.js
 * Pure game-rule functions. No I/O, no WebSocket, no side-effects.
 * Every function here is deterministic and fully unit-testable.
 */

const { RANKS } = require("../config/constant");

/**
 * Returns a human-readable label for a card.
 * @param {{ rank: string, suit: string }} card
 * @returns {string}  e.g. "J_Hearts" or "Joker"
 */
function cardLabel(card) {
    return card.rank === "Joker" ? "Joker" : `${card.rank}_${card.suit}`;
}

/**
 * Checks whether a hand contains four cards of the same rank.
 * The Joker is intentionally excluded from quad detection.
 *
 * @param {Array<{ rank: string, suit: string }>} hand
 * @returns {string|null}  The winning rank, or null if no quad exists.
 */
function findQuad(hand) {
    const counts = {};
    for (const card of hand) {
        if (card.rank === "Joker") continue;
        counts[card.rank] = (counts[card.rank] || 0) + 1;
    }
    for (const [rank, count] of Object.entries(counts)) {
        if (count >= 4) return rank;
    }
    return null;
}

/**
 * Validates that a rank string is playable.
 * Accepts J, Q, K, A (case-insensitive). Does NOT accept "Joker"
 * as a valid request rank (players request normal ranks, not Joker directly).
 *
 * @param {string} rank
 * @returns {boolean}
 */
function validateRank(rank) {
    if (!rank || typeof rank !== "string") return false;
    return RANKS.includes(rank.trim().toUpperCase());
}

/**
 * Counts all cards across all player hands (useful for conservation checks in tests).
 * @param {Array<{ hand: Array }>} players
 * @returns {number}
 */
function totalCards(players) {
    return players.reduce((sum, p) => sum + p.hand.length, 0);
}

module.exports = { cardLabel, findQuad, validateRank, totalCards };

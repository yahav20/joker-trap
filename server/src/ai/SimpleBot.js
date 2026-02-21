/**
 * SimpleBot.js
 * Pure heuristic decision engine for Joker Trap.
 *
 * Every function is deterministic given a fixed Math.random seed —
 * no I/O, no side-effects, fully unit-testable.
 *
 * Decision philosophy:
 *  - REQUEST : ask for the rank you're closest to completing a quad of.
 *  - OFFER   : if you hold the Joker, try to pass it (with configurable bluff
 *              chance). Otherwise, give away the card you care least about.
 *  - DECIDE  : trust a sender less if memory suspects them of holding the Joker.
 */

const { RANKS } = require("../config/constant");

// ─── Phase 1: Receiver decides which rank to request ─────────────────────────

/**
 * Choose the best rank to request.
 *
 * Strategy: count how many of each rank you already hold.
 * The rank with the highest count is the one you're closest to completing.
 * Ties are broken randomly. If the hand is empty, pick a random rank.
 *
 * @param {Array<{ rank: string, suit: string }>} hand  Bot's current hand.
 * @returns {string}  A rank string from RANKS (J / Q / K / A).
 */
function decideRequest(hand) {
    const counts = {};
    for (const rank of RANKS) counts[rank] = 0;

    for (const card of hand) {
        if (card.rank !== "Joker" && counts[card.rank] !== undefined) {
            counts[card.rank]++;
        }
    }

    // Sort ranks by count descending, with random tie-breaking
    const sorted = RANKS.slice().sort((a, b) => {
        const diff = counts[b] - counts[a];
        return diff !== 0 ? diff : Math.random() - 0.5;
    });

    return sorted[0];
}

// ─── Phase 2 / 4 / 6: Sender decides which card index to offer ───────────────

/**
 * Choose a card index to offer to the receiver.
 *
 * Strategy when the bot holds the Joker:
 *   - With probability `bluffChance`: offer the Joker right away.
 *   - Otherwise: offer a "decoy" — the card with the fewest duplicates
 *     (the card you'd mind losing least). This sets up the receiver to
 *     reject it, after which the Joker is offered on the 2nd/3rd attempt.
 *
 * Strategy when the bot does NOT hold the Joker:
 *   - Offer the card with the lowest group count (least useful card).
 *   - Keep as many matched pairs/triples as possible.
 *
 * @param {Array<{ rank: string, suit: string }>} hand
 * @param {import('./BotMemory')}                  memory
 * @param {number}                                 [bluffChance=0.30]
 * @param {boolean}                                [isSecondOffer=false]
 * @returns {number}  Index into `hand` of the card to offer.
 */
function decideOffer(hand, memory, bluffChance = 0.30, isSecondOffer = false) {
    const jokerIndex = hand.findIndex(c => c.rank === "Joker");
    const hasJoker = jokerIndex !== -1;

    if (hasJoker) {
        // On 2nd/3rd offer, always push the Joker if decoy was rejected.
        if (isSecondOffer) return jokerIndex;

        // On 1st offer: bluff (pass Joker directly) OR send a decoy.
        if (Math.random() < bluffChance) return jokerIndex;

        // Decoy: least-valuable non-Joker card (lowest group count)
        return _leastValuableIndex(hand, /* excludeJoker */ true);
    }

    // No Joker: offer the least-valuable card (keep pairs/triples)
    return _leastValuableIndex(hand, /* excludeJoker */ false);
}

// ─── Phase 3: Receiver decides after first offer ──────────────────────────────

/**
 * Decide whether to accept or reject the first hidden card.
 *
 * Base acceptance probability = 0.50.
 * Penalty applied if the sender is highly suspected of holding the Joker.
 * A small random noise keeps the bot unpredictable.
 *
 * @param {import('./BotMemory')} memory
 * @param {number}                senderIndex  Player ID of the current sender.
 * @returns {"accept"|"reject"}
 */
function decideFirstDecision(memory, senderIndex) {
    const suspicion = memory.suspicionOf(senderIndex); // 0–1
    const acceptProb = 0.50 - suspicion * 0.35 + (Math.random() * 0.20 - 0.10);
    return Math.random() < Math.max(0.10, Math.min(0.90, acceptProb))
        ? "accept"
        : "reject";
}

// ─── Phase 5: Receiver decides after second offer ────────────────────────────

/**
 * Decide between accept_first, accept_second, or force_third.
 *
 * Logic:
 *  - 20% chance to force the third card (chaos / information gathering).
 *  - Otherwise compare suspicion level: if sender is very suspicious,
 *    prefer the 2nd card (the first was offered earlier and might be the Joker
 *    placed by a nervous bot) — though both are hidden, so it's all probabilistic.
 *  - Accept whichever card feels "safer" based on offer order heuristic.
 *
 * @param {import('./BotMemory')} memory
 * @param {number}                senderIndex
 * @returns {"accept_first"|"accept_second"|"force_third"}
 */
function decideSecondDecision(memory, senderIndex) {
    // 20% chaos: force a third card to gain more information
    if (Math.random() < 0.20) return "force_third";

    const suspicion = memory.suspicionOf(senderIndex);

    // High suspicion → the sender may have put the Joker as the first card.
    // Pick second card (later offers are slightly lower-risk heuristically).
    if (suspicion > 0.55) return "accept_second";

    // Low/medium suspicion → accept the first card
    return "accept_first";
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Find the index in `hand` of the card with the lowest group count.
 * "Least valuable" = you have the fewest copies of this rank.
 * This preserves pairs and triples for the bot's quad quest.
 *
 * @param {Array<{ rank: string, suit: string }>} hand
 * @param {boolean} excludeJoker  If true, never return the Joker's index.
 * @returns {number}
 */
function _leastValuableIndex(hand, excludeJoker) {
    const counts = {};
    for (const card of hand) {
        if (card.rank === "Joker") continue;
        counts[card.rank] = (counts[card.rank] ?? 0) + 1;
    }

    let bestIndex = -1;
    let bestCount = Infinity;

    for (let i = 0; i < hand.length; i++) {
        if (hand[i].rank === "Joker") continue; // skip Joker regardless of path

        const c = counts[hand[i].rank] ?? 0;
        // Prefer lower counts; break ties by picking later in hand (random feel)
        if (c < bestCount || (c === bestCount && Math.random() < 0.5)) {
            bestCount = c;
            bestIndex = i;
        }
    }

    // Fallback: if all cards are Joker (shouldn't happen) just return 0
    return bestIndex === -1 ? 0 : bestIndex;
}

module.exports = {
    decideRequest,
    decideOffer,
    decideFirstDecision,
    decideSecondDecision,
};

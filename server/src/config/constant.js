/**
 * constants.js
 * Central source of truth for all game constants.
 * Import from here instead of hard-coding strings/arrays anywhere else.
 */

/** Number of players in a game */
const PLAYER_COUNT = 4;

/** The four card ranks (no Joker here – Joker is special) */
const RANKS = ["J", "Q", "K", "A"];

/** The four suits */
const SUITS = ["Hearts", "Diamonds", "Clubs", "Spades"];

/**
 * All valid turn phases.
 * The state machine in GameState transitions only between these values.
 */
const PHASES = {
    WAITING_FOR_REQUEST: "waiting_for_request",
    WAITING_FOR_FIRST_OFFER: "waiting_for_first_offer",
    WAITING_FOR_FIRST_DECISION: "waiting_for_first_decision",
    WAITING_FOR_SECOND_OFFER: "waiting_for_second_offer",
    WAITING_FOR_SECOND_DECISION: "waiting_for_second_decision",
    WAITING_FOR_THIRD_OFFER: "waiting_for_third_offer",
};

/** WebSocket port */
const PORT = process.env.PORT || 8080;

/** Redis connection URL */
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

module.exports = { PLAYER_COUNT, RANKS, SUITS, PHASES, PORT, REDIS_URL };

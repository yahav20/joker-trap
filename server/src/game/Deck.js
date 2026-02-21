/**
 * Deck.js
 * Responsible solely for creating, shuffling, and dealing the card deck.
 * No game-state awareness – purely a data factory.
 */

const { RANKS, SUITS } = require("../config/constant");

class Deck {
    constructor() {
        this.cards = [];
    }

    /**
     * Builds a fresh 17-card deck: 4 ranks × 4 suits + 1 Joker.
     * @returns {Deck} this (for chaining)
     */
    build() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push({ rank, suit });
            }
        }
        this.cards.push({ rank: "Joker", suit: "Joker" });
        return this;
    }

    /**
     * Fisher-Yates in-place shuffle.
     * @returns {Deck} this (for chaining)
     */
    shuffle() {
        const deck = this.cards;
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return this;
    }

    /**
     * Deals cards to `playerCount` players.
     * Player 0 (first sender) always receives 5 cards; all others receive 4.
     *
     * @param {number} playerCount  Must be >= 1.
     * @returns {Array<Array<{ rank: string, suit: string }>>}
     *          An array of hands, one per player.
     * @throws {Error} If the deck doesn't have enough cards.
     */
    deal(playerCount) {
        const needed = 5 + (playerCount - 1) * 4;
        if (this.cards.length < needed) {
            throw new Error(
                `Not enough cards: need ${needed}, have ${this.cards.length}`
            );
        }

        const hands = [];
        for (let i = 0; i < playerCount; i++) {
            const count = i === 0 ? 5 : 4;
            hands.push(this.cards.splice(0, count));
        }
        return hands;
    }
}

module.exports = Deck;

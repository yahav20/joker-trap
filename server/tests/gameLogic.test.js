/**
 * gameLogic.test.js
 * Tests for the pure logic layer: Deck, rules (findQuad, validateRank, cardLabel),
 * and end-to-end card conservation during transfers.
 */

const Deck = require("../src/game/Deck");
const { cardLabel, findQuad, validateRank, totalCards } = require("../src/game/rules");
const GameState = require("../src/game/GameState");
const { RANKS, SUITS, PLAYER_COUNT } = require("../src/config/constant");

// ─── Helper: build 4 mock players ────────────────────────────────────────────
function makePlayers() {
    return Array.from({ length: PLAYER_COUNT }, (_, i) => {
        const player = { id: i, received: [] };
        // Arrow function ensures 'this' always refers to the player object
        player.send = (event, payload) => {
            player.received.push({ event, payload });
        };
        return player;
    });
}

// ─── Helper: get last message of given event type for a player ────────────────
function lastMsg(player, event) {
    const msgs = player.received.filter(m => m.event === event);
    return msgs.length ? msgs[msgs.length - 1].payload : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECK
// ═══════════════════════════════════════════════════════════════════════════════
describe("Deck", () => {
    test("builds 17 cards (16 rank+suit + 1 Joker)", () => {
        const deck = new Deck().build();
        expect(deck.cards).toHaveLength(17);
    });

    test("contains exactly one Joker", () => {
        const deck = new Deck().build();
        const jokers = deck.cards.filter(c => c.rank === "Joker");
        expect(jokers).toHaveLength(1);
    });

    test("contains all 4 ranks × 4 suits = 16 normal cards", () => {
        const deck = new Deck().build();
        for (const rank of RANKS) {
            for (const suit of SUITS) {
                const found = deck.cards.some(c => c.rank === rank && c.suit === suit);
                expect(found).toBe(true);
            }
        }
    });

    test("shuffle does not change card count", () => {
        const deck = new Deck().build().shuffle();
        expect(deck.cards).toHaveLength(17);
    });

    test("deal: player 0 gets 5 cards, others get 4", () => {
        const hands = new Deck().build().shuffle().deal(PLAYER_COUNT);
        expect(hands).toHaveLength(PLAYER_COUNT);
        expect(hands[0]).toHaveLength(5);
        for (let i = 1; i < PLAYER_COUNT; i++) {
            expect(hands[i]).toHaveLength(4);
        }
    });

    test("deal: total dealt = 5 + 4×3 = 17 cards, none left in deck", () => {
        const deck = new Deck().build().shuffle();
        const hands = deck.deal(PLAYER_COUNT);
        const totalDealt = hands.reduce((s, h) => s + h.length, 0);
        expect(totalDealt).toBe(17);
        expect(deck.cards).toHaveLength(0);
    });

    test("deal throws if deck hasn't been built", () => {
        const deck = new Deck(); // no build()
        expect(() => deck.deal(PLAYER_COUNT)).toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RULES – cardLabel
// ═══════════════════════════════════════════════════════════════════════════════
describe("cardLabel", () => {
    test("formats normal cards as RANK_SUIT", () => {
        expect(cardLabel({ rank: "J", suit: "Hearts" })).toBe("J_Hearts");
        expect(cardLabel({ rank: "A", suit: "Spades" })).toBe("A_Spades");
    });

    test("formats Joker as 'Joker'", () => {
        expect(cardLabel({ rank: "Joker", suit: "Joker" })).toBe("Joker");
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RULES – validateRank
// ═══════════════════════════════════════════════════════════════════════════════
describe("validateRank", () => {
    test.each(["J", "Q", "K", "A"])("accepts %s", r => {
        expect(validateRank(r)).toBe(true);
    });

    test("is case-insensitive", () => {
        expect(validateRank("j")).toBe(true);
        expect(validateRank("a")).toBe(true);
    });

    test.each(["Joker", "X", "1", "", null, undefined])("rejects %s", r => {
        expect(validateRank(r)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RULES – findQuad
// ═══════════════════════════════════════════════════════════════════════════════
describe("findQuad", () => {
    test("detects four cards of the same rank", () => {
        const hand = [
            { rank: "A", suit: "Hearts" },
            { rank: "A", suit: "Diamonds" },
            { rank: "A", suit: "Clubs" },
            { rank: "A", suit: "Spades" },
        ];
        expect(findQuad(hand)).toBe("A");
    });

    test("ignores the Joker when counting", () => {
        const hand = [
            { rank: "Joker", suit: "Joker" },
            { rank: "K", suit: "Hearts" },
            { rank: "K", suit: "Diamonds" },
            { rank: "K", suit: "Clubs" },
        ];
        expect(findQuad(hand)).toBeNull(); // only 3 Kings
    });

    test("returns null for a hand with no quad", () => {
        const hand = [
            { rank: "J", suit: "Hearts" },
            { rank: "Q", suit: "Diamonds" },
            { rank: "K", suit: "Clubs" },
            { rank: "A", suit: "Spades" },
        ];
        expect(findQuad(hand)).toBeNull();
    });

    test("returns null for empty hand", () => {
        expect(findQuad([])).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE – Card Conservation
// ═══════════════════════════════════════════════════════════════════════════════
describe("GameState – card conservation", () => {
    test("total cards across all hands is always 17 after a complete interaction", () => {
        const players = makePlayers();
        const game = new GameState(players);

        const initialTotal = totalCards(game.players);
        expect(initialTotal).toBe(17);

        // Run a full interaction: request → offer → accept
        game.handleRequestCard(1, "J");   // receiver (Player 1) requests J
        game.handleOfferCard(0, 0);        // sender (Player 0) offers card[0]
        game.handleDecision(1, "accept");  // receiver accepts

        const afterTotal = totalCards(game.players);
        expect(afterTotal).toBe(17);      // no card lost or duplicated
    });

    test("rejected cards return to sender after full 3-offer chain", () => {
        const players = makePlayers();
        const game = new GameState(players);

        const senderBefore = game.players[0].hand.length;  // 5

        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);          // offer 1 → on table
        game.handleDecision(1, "reject");    // reject → table still holds card
        game.handleOfferCard(0, 0);          // offer 2 → on table
        game.handleDecision(1, "force_third");
        game.handleOfferCard(0, 0);          // offer 3 → mandatory transfer

        // After transfer: sender has 5-1=4, receiver has 4+1=5
        expect(game.players[0].hand.length).toBe(senderBefore - 1);
        expect(game.players[1].hand.length).toBe(5);
        expect(totalCards(game.players)).toBe(17);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE – End-game detection
// ═══════════════════════════════════════════════════════════════════════════════
describe("GameState – end game", () => {
    test("game_over fires when a player completes a quad", () => {
        const players = makePlayers();
        const game = new GameState(players);

        // Manually give player 1 three of a kind and prepare player 0 to send the 4th
        game.players[1].hand = [
            { rank: "A", suit: "Hearts" },
            { rank: "A", suit: "Diamonds" },
            { rank: "A", suit: "Clubs" },
        ];
        game.players[0].hand = [
            { rank: "A", suit: "Spades" },
            { rank: "J", suit: "Hearts" },
        ];
        // Clear tableCards just in case
        game.turnState.tableCards = [];

        // Use the state machine to transfer the 4th ace
        game.handleRequestCard(1, "A");
        game.handleOfferCard(0, 0);          // send A_Spades (index 0)
        game.handleDecision(1, "accept");

        expect(game.over).toBe(true);

        const gameOverMsgs = players.flatMap(p =>
            p.received.filter(m => m.event === "game_over")
        );
        expect(gameOverMsgs.length).toBeGreaterThan(0);
        expect(gameOverMsgs[0].payload.quadRank).toBe("A");
    });

    test("Joker holder is identified as loser", () => {
        const players = makePlayers();
        const game = new GameState(players);

        // Give player 2 the Joker explicitly
        // First normalise hands to avoid leftover cards
        game.players[0].hand = [{ rank: "Q", suit: "Hearts" }, { rank: "J", suit: "Hearts" }];
        game.players[1].hand = [
            { rank: "A", suit: "Hearts" }, { rank: "A", suit: "Diamonds" }, { rank: "A", suit: "Clubs" },
        ];
        game.players[2].hand = [{ rank: "Joker", suit: "Joker" }];
        game.players[3].hand = [];
        game.turnState.tableCards = [];

        game.handleRequestCard(1, "A");
        game.handleOfferCard(0, 0);          // Q_Hearts (lying)
        game.handleDecision(1, "reject");
        game.handleOfferCard(0, 0);          // J_Hearts (lying again) 
        // At second decision, receiver picks first card
        // Manually inject a proper card so quiz completes
        game.players[0].hand = [{ rank: "A", suit: "Spades" }];
        game.turnState.tableCards = [{ rank: "A", suit: "Hearts" }, { rank: "A", suit: "Diamonds" }];
        game.turnState.phase = "waiting_for_second_decision";

        // Force inject a quad and call endGame directly via resolveTransfer
        game.players[1].hand = [
            { rank: "A", suit: "Hearts" },
            { rank: "A", suit: "Diamonds" },
            { rank: "A", suit: "Clubs" },
        ];
        game.players[0].hand = [{ rank: "A", suit: "Spades" }, { rank: "J", suit: "Hearts" }];
        game.turnState.tableCards = [];
        game.turnState.phase = "waiting_for_first_decision";

        // Replay properly
        game.players[1].hand.push({ rank: "A", suit: "Spades" });

        // Simpler: call _endGame directly with player 1 as quad player
        game._endGame(1, "A");

        const gameOver = lastMsg(players[2], "game_over");
        expect(gameOver).not.toBeNull();
        expect(gameOver.loserId).toBe(2);    // player 2 holds Joker → loses
        expect(gameOver.winnerIds).toContain(1);
    });
});

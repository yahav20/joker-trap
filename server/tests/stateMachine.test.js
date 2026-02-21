/**
 * stateMachine.test.js
 * Tests for every phase transition in GameState's turn state machine.
 * All tests use mock players (adapter objects) – no WebSocket needed.
 *
 * Scenario coverage:
 *  1. Normal accept  (request → offer → accept)
 *  2. Reject path    (request → offer → reject → 2nd offer → accept_first)
 *  3. Accept second  (→ accept_second)
 *  4. Force third    (→ force_third → 3rd offer → auto-transfer)
 *  5. Turn rotation  (sender/receiver advance correctly after each round)
 *  6. Security       (wrong-turn player attempts, wrong-phase attempts)
 *  7. Invalid rank   (receiver requests bad rank)
 */

const GameState = require("../src/game/GameState");
const { PHASES, PLAYER_COUNT } = require("../src/config/constant");

// ─── Helper factories ─────────────────────────────────────────────────────────

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

/** Last payload of a given event received by a player (or null) */
function lastMsg(player, event) {
    const msgs = player.received.filter(m => m.event === event);
    return msgs.length ? msgs[msgs.length - 1].payload : null;
}

/** Create game, then give player 0 exactly [A_Hearts, J_Hearts] and player 1 exactly [Q_Hearts, Q_Diamonds, Q_Clubs] so we never accidentally trigger a quad */
function makeGame() {
    const players = makePlayers();
    const game = new GameState(players);
    // Override hands so we control what gets offered without accidental win
    game.players[0].hand = [
        { rank: "J", suit: "Hearts" },
        { rank: "Q", suit: "Hearts" },
        { rank: "K", suit: "Hearts" },
        { rank: "A", suit: "Hearts" },
        { rank: "J", suit: "Diamonds" },
    ];
    game.players[1].hand = [{ rank: "Q", suit: "Diamonds" }, { rank: "K", suit: "Diamonds" }, { rank: "A", suit: "Diamonds" }, { rank: "J", suit: "Clubs" }];
    game.players[2].hand = [{ rank: "Q", suit: "Clubs" }, { rank: "K", suit: "Clubs" }, { rank: "A", suit: "Clubs" }, { rank: "J", suit: "Spades" }];
    game.players[3].hand = [{ rank: "Q", suit: "Spades" }, { rank: "K", suit: "Spades" }, { rank: "A", suit: "Spades" }, { rank: "Joker", suit: "Joker" }];
    game.turnState.tableCards = [];
    return { game, players };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Phase transitions", () => {

    // ── 1. Request → first offer phase ─────────────────────────────────────────
    test("handleRequestCard transitions to WAITING_FOR_FIRST_OFFER", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_FIRST_OFFER);
        expect(game.turnState.requestedRank).toBe("J");
    });

    // ── Sender receives card_requested; receiver gets waiting ───────────────────
    test("only the sender receives card_requested event after request", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "Q");
        expect(lastMsg(players[0], "card_requested")).not.toBeNull();
        expect(lastMsg(players[1], "card_requested")).toBeNull();
        expect(lastMsg(players[2], "card_requested")).toBeNull();
    });

    // ── 2. First offer → first decision phase ──────────────────────────────────
    test("handleOfferCard (1st) transitions to WAITING_FOR_FIRST_DECISION", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_FIRST_DECISION);
        expect(game.turnState.tableCards).toHaveLength(1);
    });

    // ── Receiver gets decision_needed; sender does NOT ──────────────────────────
    test("only receiver gets decision_needed after first offer", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        expect(lastMsg(players[1], "decision_needed")).not.toBeNull();
        expect(lastMsg(players[0], "decision_needed")).toBeNull();
    });

    // ── 3. Accept first card ────────────────────────────────────────────────────
    test("'accept' resolves transfer and advances turn", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "accept");

        expect(game.turnState.tableCards).toHaveLength(0);
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_REQUEST);
        // Turn advanced: new sender = 1, new receiver = 2
        expect(game.turnState.senderIndex).toBe(1);
        expect(game.turnState.receiverIndex).toBe(2);
    });

    // ── 4. Reject → second offer phase ─────────────────────────────────────────
    test("'reject' transitions to WAITING_FOR_SECOND_OFFER", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "reject");

        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_SECOND_OFFER);
        expect(game.turnState.tableCards).toHaveLength(1); // first card still on table
    });

    test("sender receives second_offer_needed after reject", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "reject");
        expect(lastMsg(players[0], "second_offer_needed")).not.toBeNull();
    });

    // ── 5. Second offer → second decision ──────────────────────────────────────
    test("handleOfferCard (2nd) transitions to WAITING_FOR_SECOND_DECISION", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);     // card 1
        game.handleDecision(1, "reject");
        game.handleOfferCard(0, 0);     // card 2
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_SECOND_DECISION);
        expect(game.turnState.tableCards).toHaveLength(2);
    });

    // ── 6a. Accept first of two ─────────────────────────────────────────────────
    test("'accept_first' gives card[0] to receiver, card[1] back to sender", () => {
        const { game } = makeGame();
        const firstCard = game.players[0].hand[0];
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "reject");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "accept_first");

        // Receiver should now have firstCard
        const receiverHas = game.players[1].hand.some(
            c => c.rank === firstCard.rank && c.suit === firstCard.suit
        );
        expect(receiverHas).toBe(true);
        expect(game.turnState.tableCards).toHaveLength(0);
    });

    // ── 6b. Accept second of two ────────────────────────────────────────────────
    test("'accept_second' gives card[1] to receiver, card[0] back to sender", () => {
        const { game } = makeGame();
        const firstCard = { ...game.players[0].hand[0] };
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);        // card[0]
        const secondCard = { ...game.players[0].hand[0] };
        game.handleDecision(1, "reject");
        game.handleOfferCard(0, 0);        // card[1]
        game.handleDecision(1, "accept_second");

        const receiverHasSecond = game.players[1].hand.some(
            c => c.rank === secondCard.rank && c.suit === secondCard.suit
        );
        expect(receiverHasSecond).toBe(true);
        // First card returned to sender
        const senderHasFirst = game.players[0].hand.some(
            c => c.rank === firstCard.rank && c.suit === firstCard.suit
        );
        expect(senderHasFirst).toBe(true);
    });

    // ── 7. Force third → WAITING_FOR_THIRD_OFFER ───────────────────────────────
    test("'force_third' transitions to WAITING_FOR_THIRD_OFFER", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "reject");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "force_third");
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_THIRD_OFFER);
    });

    test("third offer is mandatory – receiver gets the card automatically", () => {
        const { game } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "reject");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "force_third");
        game.handleOfferCard(0, 0);      // 3rd card – mandatory transfer

        // Table must be cleared, turn advanced
        expect(game.turnState.tableCards).toHaveLength(0);
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_REQUEST);
    });

    // ── 8. Turn rotation ────────────────────────────────────────────────────────
    test("turn rotates clockwise: 0→1, 1→2, 2→3, 3→0", () => {
        const { game } = makeGame();
        const rounds = [
            { sender: 0, receiver: 1 },
            { sender: 1, receiver: 2 },
            { sender: 2, receiver: 3 },
            { sender: 3, receiver: 0 },
        ];
        for (const expected of rounds) {
            expect(game.turnState.senderIndex).toBe(expected.sender);
            expect(game.turnState.receiverIndex).toBe(expected.receiver);
            game.handleRequestCard(expected.receiver, "J");
            game.handleOfferCard(expected.sender, 0);
            game.handleDecision(expected.receiver, "accept");
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY / WRONG-TURN CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Security – wrong turn / wrong phase", () => {

    test("wrong player cannot request a card", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(0, "J");   // Player 0 is SENDER, not receiver
        expect(lastMsg(players[0], "error")).not.toBeNull();
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_REQUEST); // unchanged
    });

    test("wrong player cannot offer a card", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(1, 0);       // Player 1 is RECEIVER, not sender
        expect(lastMsg(players[1], "error")).not.toBeNull();
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_FIRST_OFFER); // unchanged
    });

    test("sender cannot offer a card before receiver has requested", () => {
        const { game, players } = makeGame();
        game.handleOfferCard(0, 0);       // no request yet
        expect(lastMsg(players[0], "error")).not.toBeNull();
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_REQUEST);
    });

    test("receiver cannot decide before an offer exists", () => {
        const { game, players } = makeGame();
        game.handleDecision(1, "accept");  // no offer yet
        expect(lastMsg(players[1], "error")).not.toBeNull();
    });

    test("invalid rank is rejected", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "INVALID");
        expect(lastMsg(players[1], "error")).not.toBeNull();
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_REQUEST);
    });

    test("invalid card index is rejected", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 999);      // index out of bounds
        expect(lastMsg(players[0], "error")).not.toBeNull();
        expect(game.turnState.phase).toBe(PHASES.WAITING_FOR_FIRST_OFFER);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INFORMATION HIDING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Information hiding", () => {

    test("spectators receive interaction_update (not card details) after transfer", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "J");
        game.handleOfferCard(0, 0);
        game.handleDecision(1, "accept");

        // Players 2 & 3 are spectators
        const p2update = lastMsg(players[2], "interaction_update");
        const p3update = lastMsg(players[3], "interaction_update");
        expect(p2update).not.toBeNull();
        expect(p3update).not.toBeNull();
        // They must NOT receive card_received
        expect(lastMsg(players[2], "card_received")).toBeNull();
    });

    test("receiver does not see requestedRank in their own game_update turn info", () => {
        const { game, players } = makeGame();
        // Start broadcasts a game_update to all
        game.start();
        const p1update = lastMsg(players[1], "game_update");
        expect(p1update).not.toBeNull();
        // requestedRank should be undefined for the receiver
        expect(p1update.turn.requestedRank).toBeUndefined();
    });

    test("only sender sees requestedRank in game_update after request", () => {
        const { game, players } = makeGame();
        game.handleRequestCard(1, "K");

        const senderMsg = lastMsg(players[0], "card_requested");
        expect(senderMsg).not.toBeNull();
        expect(senderMsg.requestedRank).toBe("K");

        // Receiver must not have received card_requested
        expect(lastMsg(players[1], "card_requested")).toBeNull();
        expect(lastMsg(players[2], "card_requested")).toBeNull();
        expect(lastMsg(players[3], "card_requested")).toBeNull();
    });
});

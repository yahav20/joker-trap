/**
 * botIntegration.test.js
 * End-to-end integration test: 4 bots play a complete game of Joker Trap
 * without any WebSocket, human input, or mocked game state.
 *
 * Since BotAdapter uses setImmediate() for all callbacks, the game runs
 * asynchronously through the Node.js event loop. Jest's done() callback is
 * used to signal completion when game_over is observed.
 *
 * IMPORTANT: GameState copies `p.send` by value at construction time (see
 * GameState constructor). We must therefore intercept via `game.players[i].send`
 * AFTER construction but BEFORE start(), not via the BotAdapter reference.
 *
 * This file proves:
 *  - Bots attach to a real GameState without crashing
 *  - The game always terminates (reaches game_over)
 *  - Card conservation is maintained throughout
 *  - Winner/loser detection works correctly
 */

const GameState = require("../src/game/GameState");
const BotAdapter = require("../src/ai/BotAdapter");
const { totalCards } = require("../src/game/rules");

// Allow up to 15 s for the bots to finish a full game
jest.setTimeout(15_000);

// ─── Helper: build game + bots, return { game, bots } ────────────────────────
function makeBotGame(bluffChances = [0.10, 0.30, 0.50, 0.20]) {
    const bots = bluffChances.map((b, id) => new BotAdapter(id, b));
    const game = new GameState(bots);
    bots.forEach(bot => bot.attachGame(game));
    return { game, bots };
}

// ═══════════════════════════════════════════════════════════════════════════════
describe("Full Game – Bot Integration", () => {

    // ── 1. Basic completion test ───────────────────────────────────────────────
    test("4 bots play a complete game to completion without crashing", (done) => {
        const { game } = makeBotGame();

        // Intercept game.players[0].send — this is what GameState actually calls
        const origSend = game.players[0].send;
        game.players[0].send = (event, payload) => {
            origSend(event, payload);
            if (event === "game_over") {
                try {
                    expect(game.over).toBe(true);
                    expect(payload.winnerIds).toBeDefined();
                    expect(payload.winnerIds.length).toBeGreaterThan(0);
                    expect(payload.loserId).not.toBeNull();
                    expect([0, 1, 2, 3]).toContain(payload.loserId);
                    // Quad player must not be the Joker holder
                    expect(payload.quadPlayer).not.toBe(payload.loserId);
                    done();
                } catch (err) {
                    done(err);
                }
            }
        };

        game.start();
    });

    // ── 2. All 4 bots receive game_over ───────────────────────────────────────
    test("game_over is broadcast to every bot", (done) => {
        const { game } = makeBotGame([0.30, 0.30, 0.30, 0.30]);

        let receivedCount = 0;
        const total = game.players.length;

        game.players.forEach(player => {
            const orig = player.send;
            player.send = (event, payload) => {
                orig(event, payload);
                if (event === "game_over") {
                    receivedCount++;
                    if (receivedCount === total) {
                        try {
                            expect(game.over).toBe(true);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    }
                }
            };
        });

        game.start();
    });

    // ── 3. Card conservation throughout every transfer ─────────────────────────
    test("card count stays at 17 throughout every turn of a bot game", (done) => {
        const { game } = makeBotGame();

        // Track the first error so we only call done(err) once
        let finished = false;
        const finish = (err) => {
            if (!finished) {
                finished = true;
                done(err);
            }
        };

        game.players.forEach(player => {
            const orig = player.send;
            player.send = (event, payload) => {
                orig(event, payload);

                // After every transfer event verify total cards = 17
                if (["card_received", "card_sent"].includes(event)) {
                    const inHands = totalCards(game.players);
                    const onTable = game.turnState.tableCards.length;
                    if (inHands + onTable !== 17) {
                        finish(new Error(
                            `Card conservation violated after "${event}": hands=${inHands} table=${onTable}`
                        ));
                    }
                }

                if (event === "game_over") finish(undefined);
            };
        });

        game.start();
    });
});

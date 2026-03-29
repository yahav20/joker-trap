const WebSocket = require("ws");

jest.mock("../src/network/redisClient", () => {
    const memoryStore = new Map();
    return {
        redisClient: {
            get: jest.fn(async (key) => memoryStore.get(key) || null),
            set: jest.fn(async (key, val) => {
                memoryStore.set(key, val);
                return "OK";
            }),
            del: jest.fn(async (key) => memoryStore.delete(key)),
            quit: jest.fn(),
        }
    };
});


const { startServer, closeServer } = require("../src/network/socketServer");

describe("Socket Server Integration and Edge Cases", () => {
    let port = 8099;

    beforeAll((done) => {
        startServer(port);
        // Wait briefly for server to bind
        setTimeout(done, 100);
    });

    afterAll(() => {
        closeServer();
    });

    /** Helper: Connects a client and returns the WebSocket instance via Promise */
    function connectClient() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}`);
            ws.on("open", () => resolve(ws));
            ws.on("error", reject);
        });
    }

    /** Helper: Listens for a specific event from a WebSocket */
    function waitForEvent(ws, eventName, timeoutMs = 1000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${eventName}`)), timeoutMs);
            const listener = (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.event === eventName) {
                    clearTimeout(timer);
                    ws.removeListener("message", listener);
                    resolve(data.payload);
                }
            };
            ws.on("message", listener);
        });
    }

    test("Edge Case: Disconnect Bot Handover", async () => {
        const p1 = await connectClient();
        const p2 = await connectClient();

        await new Promise(r => setTimeout(r, 50));

        // P1 creates a room for 2 humans and 2 bots
        const p1Create = waitForEvent(p1, "room_created");
        p1.send(JSON.stringify({ event: "create_room", payload: { botCount: 2 } }));
        const createPayload = await p1Create;
        const roomId = createPayload.roomId;

        // P2 joins the room
        const p2Join = waitForEvent(p2, "room_joined");
        const p1Update = waitForEvent(p1, "game_update");
        const p2Update = waitForEvent(p2, "game_update");

        p2.send(JSON.stringify({ event: "join_room", payload: { roomId } }));
        await p2Join;
        await p1Update;
        await p2Update;

        // P1 abruptly disconnects mid-game
        const p2WaitingMessage = waitForEvent(p2, "game_update");
        p1.close();

        // P2 should receive a game_update containing the waiting message
        const updatePayload = await p2WaitingMessage;
        expect(updatePayload.message).toContain("Waiting 30s to reconnect");

        p2.close();
    });

    test("Edge Case: Restart Synchronisation", async () => {
        const p1 = await connectClient();
        const p2 = await connectClient();

        await new Promise(r => setTimeout(r, 50));

        // P1 creates a 2-human 2-bot room
        const p1Create = waitForEvent(p1, "room_created");
        p1.send(JSON.stringify({ event: "create_room", payload: { botCount: 2 } }));
        const roomPayload = await p1Create;
        const roomId = roomPayload.roomId;

        const p2Join = waitForEvent(p2, "room_joined");
        const p1Update = waitForEvent(p1, "game_update");
        const p2Update = waitForEvent(p2, "game_update");

        p2.send(JSON.stringify({ event: "join_room", payload: { roomId } }));
        await p2Join;
        await Promise.all([p1Update, p2Update]);

        // Sending restart_game during active game should NOT restart
        p1.send(JSON.stringify({ event: "restart_game" }));

        p1.close();
        p2.close();
        await new Promise(r => setTimeout(r, 50));
    });

    test("Session Resume: reconnect with valid sessionToken", async () => {
        const p1 = await connectClient();
        await new Promise(r => setTimeout(r, 50));

        // P1 creates a solo room with 3 bots
        const p1Create = waitForEvent(p1, "room_created");
        p1.send(JSON.stringify({ event: "create_room", payload: { botCount: 3 } }));
        const createPayload = await p1Create;
        const roomId = createPayload.roomId;
        const sessionToken = createPayload.sessionToken;

        expect(sessionToken).toBeDefined();
        expect(typeof sessionToken).toBe("string");

        // Wait for game to start
        await waitForEvent(p1, "game_update");

        // P1 disconnects
        p1.close();
        await new Promise(r => setTimeout(r, 100));

        // P1 reconnects with session token
        const p1Resumed = await connectClient();
        await new Promise(r => setTimeout(r, 50));

        const resumeResult = waitForEvent(p1Resumed, "game_update", 2000);
        p1Resumed.send(JSON.stringify({
            event: "resume_room",
            payload: { roomId, sessionToken }
        }));

        const resumePayload = await resumeResult;
        expect(resumePayload.yourHand).toBeDefined();
        expect(resumePayload.turn).toBeDefined();

        p1Resumed.close();
        await new Promise(r => setTimeout(r, 50));
    });

    test("Session Resume: invalid token returns error", async () => {
        const p1 = await connectClient();
        await new Promise(r => setTimeout(r, 50));

        // Create room first so it exists
        const p1Create = waitForEvent(p1, "room_created");
        p1.send(JSON.stringify({ event: "create_room", payload: { botCount: 3 } }));
        const createPayload = await p1Create;
        const roomId = createPayload.roomId;
        p1.close();
        await new Promise(r => setTimeout(r, 50));

        // Try resuming with a bad token
        const p2 = await connectClient();
        await new Promise(r => setTimeout(r, 50));

        const errorResult = waitForEvent(p2, "error");
        p2.send(JSON.stringify({
            event: "resume_room",
            payload: { roomId, sessionToken: "INVALID_TOKEN_12345" }
        }));

        const errorPayload = await errorResult;
        expect(errorPayload.message).toMatch(/Invalid session token/i);

        p2.close();
    });

    test("Edge Case: Double room join is rejected", async () => {
        const p1 = await connectClient();
        await new Promise(r => setTimeout(r, 50));

        // Create a room
        const created = waitForEvent(p1, "room_created");
        p1.send(JSON.stringify({ event: "create_room", payload: { botCount: 3 } }));
        await created;

        // Try to create another room while already in one
        const errorResult = waitForEvent(p1, "error");
        p1.send(JSON.stringify({ event: "create_room", payload: { botCount: 3 } }));
        const errorPayload = await errorResult;
        expect(errorPayload.message).toMatch(/already in a room/i);

        p1.close();
    });

    test("Edge Case: Action without room returns error", async () => {
        const p1 = await connectClient();
        await new Promise(r => setTimeout(r, 50));

        const errorResult = waitForEvent(p1, "error");
        p1.send(JSON.stringify({ event: "request_card", payload: { rank: "K" } }));
        const errorPayload = await errorResult;
        expect(errorPayload.message).toMatch(/create or join a room/i);

        p1.close();
    });
});


/**
 * broadcast.test.js
 * Unit tests for local WebSocket broadcast utilities.
 */

const WebSocket = require("ws");
const { localClients, publishEvent, sendError } = require("../src/network/broadcast");

/** Creates a mock WebSocket-like object. */
function createMockWs(roomId, playerId, readyState = WebSocket.OPEN) {
    return {
        roomId,
        playerId,
        readyState,
        send: jest.fn(),
    };
}

describe("broadcast — publishEvent", () => {
    afterEach(() => {
        localClients.clear();
    });

    it("broadcasts to all players in a room when no targetPlayerId", () => {
        const ws1 = createMockWs("ROOM1", 0);
        const ws2 = createMockWs("ROOM1", 1);
        const ws3 = createMockWs("ROOM2", 0); // different room
        localClients.add(ws1);
        localClients.add(ws2);
        localClients.add(ws3);

        publishEvent("ROOM1", "game_update", { message: "test" });

        expect(ws1.send).toHaveBeenCalledTimes(1);
        expect(ws2.send).toHaveBeenCalledTimes(1);
        expect(ws3.send).not.toHaveBeenCalled(); // Wrong room
    });

    it("unicasts to a specific player when targetPlayerId is set", () => {
        const ws1 = createMockWs("ROOM1", 0);
        const ws2 = createMockWs("ROOM1", 1);
        localClients.add(ws1);
        localClients.add(ws2);

        publishEvent("ROOM1", "card_received", { card: "K" }, 1);

        expect(ws1.send).not.toHaveBeenCalled();
        expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it("skips clients with CLOSED readyState", () => {
        const closedWs = createMockWs("ROOM1", 0, WebSocket.CLOSED);
        localClients.add(closedWs);

        publishEvent("ROOM1", "game_update", { message: "test" });

        expect(closedWs.send).not.toHaveBeenCalled();
    });

    it("sends correct JSON payload structure", () => {
        const ws = createMockWs("ROOM1", 0);
        localClients.add(ws);

        publishEvent("ROOM1", "waiting", { message: "Waiting for 2 players" });

        const sent = JSON.parse(ws.send.mock.calls[0][0]);
        expect(sent).toEqual({
            event: "waiting",
            payload: { message: "Waiting for 2 players" }
        });
    });

    it("handles empty localClients without error", () => {
        expect(() => publishEvent("ROOM1", "test", {})).not.toThrow();
    });
});

describe("broadcast — sendError", () => {
    it("sends error event to an open client", () => {
        const ws = createMockWs("ROOM1", 0);
        sendError(ws, "Room is full.");

        const sent = JSON.parse(ws.send.mock.calls[0][0]);
        expect(sent.event).toBe("error");
        expect(sent.payload.message).toBe("Room is full.");
    });

    it("does not send to a closed client", () => {
        const ws = createMockWs("ROOM1", 0, WebSocket.CLOSED);
        sendError(ws, "Should not arrive");
        expect(ws.send).not.toHaveBeenCalled();
    });
});

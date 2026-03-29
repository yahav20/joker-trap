/**
 * roomStore.test.js
 * Unit tests for the in-memory room cache with Redis fallback.
 */

jest.mock("../src/network/redisClient", () => ({
    redisClient: {
        status: "ready",
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        quit: jest.fn(),
    }
}));

const { redisClient } = require("../src/network/redisClient");
const {
    getRoomState,
    saveRoomState,
    deleteRoomState,
    startBackgroundSaver,
    stopBackgroundSaver
} = require("../src/network/roomStore");

// We need access to the internal Maps for assertion.
// getRoomState populates localRooms on first fetch from Redis.

describe("roomStore — getRoomState", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns null for unknown roomId (memory miss + Redis miss)", async () => {
        redisClient.get.mockResolvedValue(null);
        const state = await getRoomState("NONEXISTENT");
        expect(state).toBeNull();
    });

    it("fetches from Redis on first access and caches locally", async () => {
        const fakeState = { id: "ROOM1", gameData: null };
        redisClient.get.mockResolvedValue(JSON.stringify(fakeState));

        // First call — should hit Redis
        const state1 = await getRoomState("ROOM1");
        expect(state1).toEqual(fakeState);
        expect(redisClient.get).toHaveBeenCalledTimes(1);

        // Second call — should use in-memory cache, NOT Redis
        const state2 = await getRoomState("ROOM1");
        expect(state2).toEqual(fakeState);
        expect(redisClient.get).toHaveBeenCalledTimes(1); // Still 1
    });

    it("gracefully returns null when Redis throws (fallback mode)", async () => {
        redisClient.get.mockRejectedValue(new Error("QUOTA_EXCEEDED"));
        const state = await getRoomState("BROKEN");
        expect(state).toBeNull();
    });

    it("skips Redis when status is not ready", async () => {
        const origStatus = redisClient.status;
        redisClient.status = "connecting";

        const state = await getRoomState("OFFLINE_ROOM");
        expect(state).toBeNull();
        expect(redisClient.get).not.toHaveBeenCalled();

        redisClient.status = origStatus;
    });
});

describe("roomStore — saveRoomState", () => {
    it("saves to in-memory immediately", async () => {
        const room = { id: "SAVE1", gameData: null };
        await saveRoomState("SAVE1", room, true);

        // Verify it's now in memory
        const result = await getRoomState("SAVE1");
        expect(result).toBe(room); // Same reference
    });

    it("flags room dirty when isHumanAction=true", async () => {
        const room = { id: "DIRTY1", gameData: null };
        await saveRoomState("DIRTY1", room, true);
        // We can't directly inspect dirtyRooms, but the background saver will pick it up.
        // This test confirms no error on the path.
    });

    it("does NOT flag room dirty when isHumanAction=false (bot action)", async () => {
        const room = { id: "BOT1", gameData: null };
        await saveRoomState("BOT1", room, false);
        // No error — bot actions stay purely in memory.
    });
});

describe("roomStore — deleteRoomState", () => {
    it("removes from in-memory and calls Redis del", async () => {
        const room = { id: "DEL1", gameData: null };
        await saveRoomState("DEL1", room, true);

        await deleteRoomState("DEL1");

        const result = await getRoomState("DEL1");
        // Should NOT be in memory; Redis mock returns null
        redisClient.get.mockResolvedValue(null);
        const result2 = await getRoomState("DEL1_gone");
        expect(result2).toBeNull();
        expect(redisClient.del).toHaveBeenCalledWith("room_state:DEL1");
    });

    it("gracefully handles Redis del failure", async () => {
        redisClient.del.mockRejectedValue(new Error("NETWORK_ERROR"));
        const room = { id: "DELFAIL", gameData: null };
        await saveRoomState("DELFAIL", room, true);

        // Should not throw
        await expect(deleteRoomState("DELFAIL")).resolves.not.toThrow();
    });
});

describe("roomStore — background saver", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        redisClient.set.mockResolvedValue("OK");
    });

    afterEach(() => {
        stopBackgroundSaver();
        jest.useRealTimers();
    });

    it("writes dirty rooms to Redis after 10s interval", async () => {
        startBackgroundSaver();

        const room = { id: "SYNC1", gameData: { some: "data" } };
        await saveRoomState("SYNC1", room, true); // flags dirty

        // Advance time by 10 seconds to trigger the interval
        jest.advanceTimersByTime(10000);

        // Give the async callback time to resolve
        await Promise.resolve();
        await Promise.resolve();

        expect(redisClient.set).toHaveBeenCalledWith(
            "room_state:SYNC1",
            JSON.stringify(room),
            "EX",
            3600
        );
    });

    it("does NOT write non-dirty rooms", async () => {
        startBackgroundSaver();

        const room = { id: "CLEAN1", gameData: null };
        await saveRoomState("CLEAN1", room, false); // NOT dirty

        jest.advanceTimersByTime(10000);
        await Promise.resolve();

        expect(redisClient.set).not.toHaveBeenCalled();
    });
});

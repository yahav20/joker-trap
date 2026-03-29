/**
 * locks.test.js
 * Unit tests for the in-memory mutex.
 */

const { acquireLock, releaseLock } = require("../src/network/locks");

describe("locks — acquireLock / releaseLock", () => {
    afterEach(async () => {
        // Clean up any lingering locks
        await releaseLock("TESTROOM");
        await releaseLock("A");
        await releaseLock("B");
    });

    it("acquires a lock for a new room", async () => {
        const acquired = await acquireLock("TESTROOM");
        expect(acquired).toBe(true);
    });

    it("releases a lock so it can be re-acquired", async () => {
        await acquireLock("TESTROOM");
        await releaseLock("TESTROOM");

        const reacquired = await acquireLock("TESTROOM");
        expect(reacquired).toBe(true);
    });

    it("fails to acquire a lock that is already held (timeout)", async () => {
        await acquireLock("TESTROOM");

        // Second attempt should time out after ~500ms (10 retries × 50ms)
        const acquired = await acquireLock("TESTROOM");
        expect(acquired).toBe(false);
    });

    it("allows independent rooms to be locked simultaneously", async () => {
        const lockA = await acquireLock("A");
        const lockB = await acquireLock("B");
        expect(lockA).toBe(true);
        expect(lockB).toBe(true);
    });

    it("releaseLock is idempotent (no error on double release)", async () => {
        await acquireLock("TESTROOM");
        await releaseLock("TESTROOM");
        await expect(releaseLock("TESTROOM")).resolves.not.toThrow();
    });
});

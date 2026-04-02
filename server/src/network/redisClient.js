const Redis = require("ioredis");
const { REDIS_URL } = require("../config/constant");
const logger = require("../utils/logger");

const baseOptions = {
    family: 4, // Force IPv4 (fixes Node 18+ DNS resolution issues)
    maxRetriesPerRequest: null, // Don't crash on high retries, just queue
    retryStrategy(times) {
        // Retry with backing off delay. Max wait time 60 seconds.
        return Math.min(times * 2000, 60000);
    }
};

// Explicitly add TLS config if rediss:// to prevent strict cert failures locally
if (REDIS_URL.startsWith("rediss://")) {
    baseOptions.tls = { rejectUnauthorized: false };
}

// Standard client for reading/writing state
const redisClient = new Redis(REDIS_URL, baseOptions);

redisClient.on("connect", () => {
    logger.info("Connected to Redis");
});

redisClient.on("error", (err) => {
    logger.error(`Redis Client Error: ${err.message || err}`);
});

module.exports = {
    redisClient
};


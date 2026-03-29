// ============================================================
//  Redis Client — Singleton connection
//  Uses ioredis which auto-reconnects and handles errors.
// ============================================================

const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Primary client — for reads/writes
const redis = new Redis(REDIS_URL, {
    retryStrategy(times) {
        // Reconnect: wait 50ms * attempt, max 2 seconds
        const delay = Math.min(times * 50, 2000);
        console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})...`);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
});

redis.on("connect", () => console.log("[Redis] ✅ Connected"));
redis.on("error", (err) => console.error("[Redis] ❌ Error:", err.message));
redis.on("reconnecting", () => console.log("[Redis] 🔄 Reconnecting..."));

// Subscriber client — separate connection needed for pub/sub
// (ioredis: a subscribed client can't do regular commands)
const subscriber = new Redis(REDIS_URL, {
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    },
});

subscriber.on("connect", () => console.log("[Redis:SUB] ✅ Connected"));
subscriber.on("error", (err) => console.error("[Redis:SUB] ❌", err.message));

// Publisher client — for broadcasting to other gateway instances
const publisher = new Redis(REDIS_URL, {
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    },
});

module.exports = { redis, subscriber, publisher };
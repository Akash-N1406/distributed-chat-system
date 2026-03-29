// ============================================================
//  Connection Registry
//
//  Tracks which users are connected to which gateway server.
//  This is what makes horizontal scaling possible — multiple
//  gateway instances share state via Redis.
//
//  Key schema:
//    user:{userId}:server    → "gateway-server-1"   (which server)
//    user:{userId}:status    → "online" | "offline"
//    user:{userId}:lastSeen  → ISO timestamp
//    server:{serverId}:users → Set of userIds on that server
// ============================================================

const { redis } = require("./client");

// TTL for online status — if server crashes, user appears offline after 30s
const ONLINE_TTL = 30; // seconds

const SERVER_ID = process.env.SERVER_ID || `gateway-${process.pid}`;

const ConnectionRegistry = {

    // Called when a user opens a WebSocket connection
    async userConnected(userId) {
        const pipeline = redis.pipeline();

        // Map: user → this server
        pipeline.set(`user:${userId}:server`, SERVER_ID, "EX", ONLINE_TTL);
        // Mark user online
        pipeline.set(`user:${userId}:status`, "online", "EX", ONLINE_TTL);
        // Track all users on this server (for cleanup on shutdown)
        pipeline.sadd(`server:${SERVER_ID}:users`, userId);
        // Store last seen timestamp
        pipeline.set(`user:${userId}:lastSeen`, new Date().toISOString());

        await pipeline.exec();
        console.log(`[Registry] 🟢 User ${userId} connected to ${SERVER_ID}`);
    },

    // Called on heartbeat/ping to refresh TTL (keep user "online")
    async refreshHeartbeat(userId) {
        const pipeline = redis.pipeline();
        pipeline.expire(`user:${userId}:server`, ONLINE_TTL);
        pipeline.expire(`user:${userId}:status`, ONLINE_TTL);
        await pipeline.exec();
    },

    // Called when WebSocket closes
    async userDisconnected(userId) {
        const pipeline = redis.pipeline();

        pipeline.del(`user:${userId}:server`);
        pipeline.set(`user:${userId}:status`, "offline");
        pipeline.set(`user:${userId}:lastSeen`, new Date().toISOString());
        pipeline.srem(`server:${SERVER_ID}:users`, userId);

        await pipeline.exec();
        console.log(`[Registry] 🔴 User ${userId} disconnected`);
    },

    // Find which server a user is on (returns null if offline)
    async getServer(userId) {
        return await redis.get(`user:${userId}:server`);
    },

    // Check if a user is currently online
    async isOnline(userId) {
        const status = await redis.get(`user:${userId}:status`);
        return status === "online";
    },

    // Get multiple users' online status at once (for group chats)
    async getOnlineStatuses(userIds) {
        if (!userIds.length) return {};

        const pipeline = redis.pipeline();
        userIds.forEach((id) => pipeline.get(`user:${id}:status`));
        const results = await pipeline.exec();

        const statuses = {};
        userIds.forEach((id, i) => {
            statuses[id] = results[i][1] === "online";
        });
        return statuses;
    },

    // Get last seen timestamp for a user
    async getLastSeen(userId) {
        return await redis.get(`user:${userId}:lastSeen`);
    },

    // Get all users connected to THIS server (for broadcast)
    async getServerUsers() {
        return await redis.smembers(`server:${SERVER_ID}:users`);
    },

    // Called on server shutdown — clean up all connections
    async cleanupServer() {
        const users = await this.getServerUsers();
        if (!users.length) return;

        const pipeline = redis.pipeline();
        users.forEach((userId) => {
            pipeline.del(`user:${userId}:server`);
            pipeline.set(`user:${userId}:status`, "offline");
            pipeline.set(`user:${userId}:lastSeen`, new Date().toISOString());
        });
        pipeline.del(`server:${SERVER_ID}:users`);
        await pipeline.exec();

        console.log(`[Registry] 🧹 Cleaned up ${users.length} users on shutdown`);
    },
};

module.exports = { ConnectionRegistry, SERVER_ID };
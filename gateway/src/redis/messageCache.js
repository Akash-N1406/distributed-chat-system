// ============================================================
//  Message Cache
//
//  Caches the last N messages per conversation in Redis.
//  When a user opens a chat, we serve from cache first
//  (fast!) and fall back to MongoDB only for older history.
//
//  Key schema:
//    chat:{conversationId}:messages → List (LPUSH/LRANGE)
//    conversation ID format:
//      1:1 chat  → "dm:{smallerId}:{largerId}"  (sorted so A↔B = B↔A)
//      group     → "group:{groupId}"
// ============================================================

const { redis } = require("./client");

const MAX_CACHED_MESSAGES = 50;  // Keep last 50 messages per chat
const CACHE_TTL = 60 * 60 * 24; // 24 hours

const MessageCache = {

    // Build a deterministic key for a 1:1 conversation
    getDMKey(userId1, userId2) {
        const [a, b] = [userId1, userId2].sort();
        return `chat:dm:${a}:${b}:messages`;
    },

    getGroupKey(groupId) {
        return `chat:group:${groupId}:messages`;
    },

    // Store a new message in cache
    async cacheMessage(message) {
        const key = message.group_id
            ? this.getGroupKey(message.group_id)
            : this.getDMKey(message.sender_id, message.receiver_id);

        const serialized = JSON.stringify(message);

        const pipeline = redis.pipeline();
        // LPUSH = insert at head (newest first)
        pipeline.lpush(key, serialized);
        // Trim to max size — evict oldest messages beyond limit
        pipeline.ltrim(key, 0, MAX_CACHED_MESSAGES - 1);
        // Reset TTL each time a message is added
        pipeline.expire(key, CACHE_TTL);

        await pipeline.exec();
    },

    // Get recent messages (default: last 20)
    async getRecentMessages(params, limit = 20) {
        const key = params.groupId
            ? this.getGroupKey(params.groupId)
            : this.getDMKey(params.userId1, params.userId2);

        // LRANGE 0 (limit-1) → get first N items (newest first)
        const raw = await redis.lrange(key, 0, limit - 1);
        return raw.map((r) => JSON.parse(r));
    },

    // Update a message's status in cache (sent → delivered → read)
    // Note: We do a full cache refresh here for simplicity.
    // In production you'd use a hash per message instead.
    async updateMessageStatus(messageId, status, params) {
        const key = params.groupId
            ? this.getGroupKey(params.groupId)
            : this.getDMKey(params.userId1, params.userId2);

        const raw = await redis.lrange(key, 0, -1);
        const messages = raw.map((r) => JSON.parse(r));

        const idx = messages.findIndex((m) => m.message_id === messageId);
        if (idx === -1) return false; // not in cache, update only in DB

        messages[idx].status = status;

        // Rebuild the list — delete and re-push
        const pipeline = redis.pipeline();
        pipeline.del(key);
        // Re-push in reverse order so newest stays at head
        [...messages].reverse().forEach((m) => pipeline.lpush(key, JSON.stringify(m)));
        pipeline.expire(key, CACHE_TTL);
        await pipeline.exec();

        return true;
    },

    // Invalidate a conversation's cache (force DB reload)
    async invalidate(params) {
        const key = params.groupId
            ? this.getGroupKey(params.groupId)
            : this.getDMKey(params.userId1, params.userId2);
        await redis.del(key);
    },
};

module.exports = { MessageCache };
// ============================================================
//  Message Model
//
//  This is the most queried collection. Index design is critical.
//
//  Query patterns we must support efficiently:
//    1. Fetch DM history between two users  (most common)
//    2. Fetch group chat history            (common)
//    3. Fetch undelivered messages          (on reconnect)
//    4. Update delivery status by messageId (frequent)
//    5. Paginate by timestamp               (infinite scroll)
//
//  Compound indexes cover all patterns above.
//  conversationId is a computed field we store for fast lookups.
// ============================================================

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        message_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        // For DM: sender → receiver
        // For group: sender → group
        sender_id: { type: String, required: true },
        receiver_id: { type: String, default: null }, // null for group messages
        group_id: { type: String, default: null }, // null for DMs

        // Computed: "dm:smallerId:largerId" or "group:groupId"
        // Stored so we can query a whole conversation in one index hit
        conversation_id: { type: String, required: true, index: true },

        content: {
            type: String,
            required: true,
            maxlength: 10000,
        },

        // Message type for future media support (Step 9 optional)
        type: {
            type: String,
            enum: ["text", "image", "video", "file", "system"],
            default: "text",
        },

        // Delivery lifecycle: sent → delivered → read
        status: {
            type: String,
            enum: ["sent", "delivered", "read", "failed"],
            default: "sent",
        },

        // Per-user read receipts (for group chats, multiple readers)
        read_by: [{
            user_id: String,
            read_at: Date,
        }],

        delivered_at: { type: Date, default: null },
        read_at: { type: Date, default: null }, // for DMs

        // Optional: reply threading
        reply_to: { type: String, default: null },  // parent message_id
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// ── Indexes ────────────────────────────────────────────────
// Pattern 1 & 2: Fetch conversation history, paginated newest-first
messageSchema.index({ conversation_id: 1, created_at: -1 });

// Pattern 3: Fetch undelivered messages for a user on reconnect
messageSchema.index({ receiver_id: 1, status: 1, created_at: 1 });

// Pattern 4: Update by message_id (already covered by unique index above)

// Pattern 5: Global timeline (admin/search use cases)
messageSchema.index({ created_at: -1 });

// ── Static helpers ─────────────────────────────────────────
// Build a deterministic conversation ID
messageSchema.statics.buildConversationId = function (senderId, receiverId, groupId) {
    if (groupId) return `group:${groupId}`;
    const [a, b] = [senderId, receiverId].sort();
    return `dm:${a}:${b}`;
};

// Fetch paginated history for a conversation
messageSchema.statics.getHistory = function (conversationId, { limit = 20, before = null } = {}) {
    const query = { conversation_id: conversationId };
    if (before) query.created_at = { $lt: new Date(before) };
    return this.find(query)
        .sort({ created_at: -1 })   // newest first
        .limit(limit)
        .lean();                     // plain JS objects, faster than Mongoose docs
};

// Fetch all undelivered messages for a user (offline message catch-up)
messageSchema.statics.getUndelivered = function (userId) {
    return this.find({
        receiver_id: userId,
        status: "sent",             // not yet delivered
    })
        .sort({ created_at: 1 })   // oldest first — deliver in order
        .lean();
};

// Bulk update status for all messages in a conversation
messageSchema.statics.markDelivered = function (conversationId, userId) {
    return this.updateMany(
        {
            conversation_id: conversationId,
            receiver_id: userId,
            status: "sent",
        },
        {
            $set: { status: "delivered", delivered_at: new Date() },
        }
    );
};

messageSchema.statics.markRead = function (conversationId, userId) {
    return this.updateMany(
        {
            conversation_id: conversationId,
            receiver_id: userId,
            status: { $in: ["sent", "delivered"] },
        },
        {
            $set: { status: "read", read_at: new Date() },
            $addToSet: { read_by: { user_id: userId, read_at: new Date() } },
        }
    );
};

module.exports = mongoose.model("Message", messageSchema);
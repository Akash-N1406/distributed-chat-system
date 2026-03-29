// ============================================================
//  Kafka Producer
//
//  The producer is used by the Chat Service to publish events.
//  Key design decisions:
//
//  1. MESSAGE KEY = conversationId
//     Kafka routes messages with the same key to the same
//     partition. This guarantees ordering within a conversation.
//     Without this, message A and B sent in order might arrive
//     in a different order on the consumer side.
//
//  2. ACKS = 'all'
//     The broker only confirms receipt after ALL in-sync
//     replicas have written the message. Prevents data loss
//     if the leader crashes immediately after accepting.
//
//  3. COMPRESSION
//     Snappy compression reduces network bandwidth ~60%
//     with minimal CPU cost. Good for chat messages.
// ============================================================

const { producer } = require("./client");
const { CompressionTypes } = require("kafkajs");

let isConnected = false;

async function connectProducer() {
    if (isConnected) return;
    await producer.connect();
    isConnected = true;
    console.log("[Kafka:Producer] ✅ Connected");
}

async function disconnectProducer() {
    if (!isConnected) return;
    await producer.disconnect();
    isConnected = false;
    console.log("[Kafka:Producer] Disconnected");
}

// ── Core publish function ──────────────────────────────────

async function publishMessage(message) {
    await connectProducer();

    // Build the conversation key for partition routing
    // DM: "dm:userId1:userId2" (sorted for consistency)
    // Group: "group:groupId"
    const partitionKey = message.group_id
        ? `group:${message.group_id}`
        : `dm:${[message.sender_id, message.receiver_id].sort().join(":")}`;

    await producer.send({
        topic: "chat-messages",
        compression: CompressionTypes.GZIP,
        messages: [
            {
                key: partitionKey,           // routes to consistent partition
                value: JSON.stringify(message),
                headers: {
                    messageType: "chat_message",
                    senderId: message.sender_id,
                    timestamp: Date.now().toString(),
                },
            },
        ],
        acks: -1, // -1 = 'all' replicas must acknowledge
    });

    console.log(
        `[Kafka:Producer] 📤 Published message ${message.message_id} to chat-messages`
    );
}

// ── Delivery status updates ────────────────────────────────

async function publishDeliveryStatus(messageId, userId, status) {
    await connectProducer();

    const event = {
        message_id: messageId,
        user_id: userId,
        status,               // "delivered" | "read"
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: "chat-delivery-status",
        messages: [
            {
                key: messageId,  // group all status updates for same message
                value: JSON.stringify(event),
                headers: { eventType: "delivery_status" },
            },
        ],
    });

    console.log(`[Kafka:Producer] 📬 Status update: ${messageId} → ${status}`);
}

// ── Typing indicators ──────────────────────────────────────

async function publishTypingEvent(userId, conversationId, isTyping) {
    await connectProducer();

    const event = {
        user_id: userId,
        conversation_id: conversationId,
        is_typing: isTyping,
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: "chat-typing",
        messages: [
            {
                key: conversationId,
                value: JSON.stringify(event),
            },
        ],
        acks: 1, // typing events: leader ack is enough (low stakes)
    });
}

// ── Notifications ──────────────────────────────────────────

async function publishNotification(userId, notification) {
    await connectProducer();

    const event = {
        user_id: userId,
        ...notification,
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: "chat-notifications",
        messages: [
            {
                key: userId,   // all notifications for user → same partition
                value: JSON.stringify(event),
            },
        ],
    });

    console.log(`[Kafka:Producer] 🔔 Notification queued for user ${userId}`);
}

module.exports = {
    connectProducer,
    disconnectProducer,
    publishMessage,
    publishDeliveryStatus,
    publishTypingEvent,
    publishNotification,
};
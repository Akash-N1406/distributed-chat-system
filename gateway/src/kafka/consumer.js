// ============================================================
//  Kafka Consumer
//
//  The Gateway consumes messages from Kafka and delivers them
//  to the correct WebSocket connection.
//
//  Consumer Group behaviour:
//  - All gateway instances share the group "chat-gateway-consumers"
//  - Kafka assigns partitions across instances automatically
//  - If Gateway-1 handles partition 0 and goes down, Kafka
//    reassigns partition 0 to Gateway-2 (rebalancing)
//
//  Each message type has its own handler registered via
//  the `registerHandler` pattern, keeping this file clean.
// ============================================================

const { consumer } = require("./client");

// Map of topic → handler function
// Handlers are registered by the WebSocket layer (Step 5)
const handlers = new Map();

let isConnected = false;
let isRunning = false;

async function connectConsumer() {
    if (isConnected) return;
    await consumer.connect();
    isConnected = true;
    console.log("[Kafka:Consumer] ✅ Connected");
}

// Register a handler for a specific topic
// e.g. registerHandler("chat-messages", async (message) => { ... })
function registerHandler(topic, handler) {
    handlers.set(topic, handler);
    console.log(`[Kafka:Consumer] 📋 Handler registered for topic: ${topic}`);
}

// Subscribe to all topics that have registered handlers
async function startConsuming() {
    if (isRunning) return;
    await connectConsumer();

    const topics = [...handlers.keys()];
    if (topics.length === 0) {
        console.warn("[Kafka:Consumer] ⚠️  No handlers registered. Nothing to consume.");
        return;
    }

    // Subscribe to all registered topics
    for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
        console.log(`[Kafka:Consumer] 👂 Subscribed to: ${topic}`);
    }

    isRunning = true;

    // Main consume loop
    await consumer.run({
        // Process one message at a time per partition (safe default)
        // For higher throughput, increase eachBatchAutoResolve instead
        eachMessage: async ({ topic, partition, message }) => {
            const startTime = Date.now();

            try {
                // Parse the message value
                const payload = JSON.parse(message.value.toString());
                const key = message.key?.toString();

                console.log(
                    `[Kafka:Consumer] 📨 Received from ${topic}[${partition}] key=${key}`
                );

                // Route to the correct handler
                const handler = handlers.get(topic);
                if (handler) {
                    await handler(payload, { topic, partition, key, message });
                } else {
                    console.warn(`[Kafka:Consumer] No handler for topic: ${topic}`);
                }

                const elapsed = Date.now() - startTime;
                console.log(`[Kafka:Consumer] ✅ Processed in ${elapsed}ms`);

            } catch (err) {
                console.error(
                    `[Kafka:Consumer] ❌ Error processing message from ${topic}:`,
                    err.message
                );
                // In production: send to a Dead Letter Queue (DLQ)
                // For now: log and continue (don't crash the consumer)
            }
        },
    });

    // Handle consumer group rebalancing
    consumer.on(consumer.events.GROUP_JOIN, ({ payload }) => {
        console.log("[Kafka:Consumer] 🔄 Joined consumer group:", payload.groupId);
    });

    consumer.on(consumer.events.REBALANCING, () => {
        console.log("[Kafka:Consumer] ⚖️  Rebalancing partitions...");
    });

    console.log("[Kafka:Consumer] 🚀 Consumer running");
}

async function stopConsuming() {
    if (!isRunning) return;
    await consumer.disconnect();
    isRunning = false;
    isConnected = false;
    console.log("[Kafka:Consumer] Stopped");
}

module.exports = {
    connectConsumer,
    registerHandler,
    startConsuming,
    stopConsuming,
};
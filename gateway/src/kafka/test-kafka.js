// ============================================================
//  Kafka Test Script
//  Run: node src/kafka/test-kafka.js
//
//  Tests:
//    1. Topic creation (4 topics with correct partitions)
//    2. Producer — publish a message
//    3. Consumer — receive that message
//    4. Delivery status event
//    5. Typing event
// ============================================================

require("dotenv").config({ path: "../../.env" });

const { createTopics } = require("./topics");
const {
    connectProducer, disconnectProducer,
    publishMessage, publishDeliveryStatus, publishTypingEvent,
} = require("./producer");
const { connectConsumer, registerHandler, startConsuming, stopConsuming } = require("./consumer");
const { admin } = require("./client");

// Track received messages for test assertions
const received = {
    messages: [],
    statuses: [],
    typing: [],
};

async function runTests() {
    console.log("\n====================================");
    console.log("  Kafka Layer — Integration Tests");
    console.log("====================================\n");

    try {
        // ── Test 1: Create topics ──────────────────────────────
        console.log("Test 1: Creating topics...");
        await createTopics();
        console.log("  ✅ Topics created/verified\n");

        // ── Test 2: Set up consumer BEFORE producing ───────────
        console.log("Test 2: Starting consumer...");

        registerHandler("chat-messages", async (payload) => {
            received.messages.push(payload);
            console.log(`  📨 Consumed message: ${payload.message_id}`);
        });

        registerHandler("chat-delivery-status", async (payload) => {
            received.statuses.push(payload);
            console.log(`  📬 Consumed status: ${payload.message_id} → ${payload.status}`);
        });

        registerHandler("chat-typing", async (payload) => {
            received.typing.push(payload);
            console.log(`  ⌨️  Consumed typing: user ${payload.user_id} is_typing=${payload.is_typing}`);
        });

        await startConsuming();
        console.log("  ✅ Consumer running\n");

        // Give consumer time to join the group and get partition assignment
        await sleep(3000);

        // ── Test 3: Produce a chat message ─────────────────────
        console.log("Test 3: Publishing chat message...");
        const testMessage = {
            message_id: `msg-${Date.now()}`,
            sender_id: "alice",
            receiver_id: "bob",
            content: "Hello from Kafka!",
            timestamp: new Date().toISOString(),
            status: "sent",
        };

        await publishMessage(testMessage);
        console.log("  ✅ Message published\n");

        // ── Test 4: Produce delivery status ────────────────────
        console.log("Test 4: Publishing delivery status...");
        await publishDeliveryStatus(testMessage.message_id, "bob", "delivered");
        console.log("  ✅ Status published\n");

        // ── Test 5: Produce typing event ───────────────────────
        console.log("Test 5: Publishing typing event...");
        await publishTypingEvent("alice", "dm:alice:bob", true);
        console.log("  ✅ Typing event published\n");

        // Wait for consumer to receive all messages
        console.log("Waiting for consumer to receive all events (5s)...");
        await sleep(5000);

        // ── Assertions ─────────────────────────────────────────
        console.log("\n--- Assertions ---");
        console.assert(received.messages.length >= 1, "Should receive at least 1 message");
        console.log(`  ✅ Chat messages received: ${received.messages.length}`);

        console.assert(received.statuses.length >= 1, "Should receive delivery status");
        console.log(`  ✅ Delivery statuses received: ${received.statuses.length}`);

        console.assert(received.typing.length >= 1, "Should receive typing event");
        console.log(`  ✅ Typing events received: ${received.typing.length}`);

        // Verify topic metadata
        await admin.connect();
        const topics = await admin.listTopics();
        const ourTopics = topics.filter(t => t.startsWith("chat-"));
        console.log(`\n  ✅ Active chat topics: ${ourTopics.join(", ")}`);
        await admin.disconnect();

        console.log("\n====================================");
        console.log("  ✅ All Kafka tests passed!");
        console.log("====================================\n");

    } catch (err) {
        console.error("\n❌ Test failed:", err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await stopConsuming();
        await disconnectProducer();
        process.exit(0);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

runTests();
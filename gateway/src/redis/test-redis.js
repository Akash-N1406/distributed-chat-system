// ============================================================
//  Redis Test Script
//  Run with: node src/redis/test-redis.js
//  Tests all Redis operations before wiring up WebSockets.
// ============================================================

require("dotenv").config({ path: "../../.env" });
const { redis } = require("./client");
const { ConnectionRegistry } = require("./connectionRegistry");
const { MessageCache } = require("./messageCache");

async function runTests() {
    console.log("\n====================================");
    console.log("  Redis Layer — Integration Tests");
    console.log("====================================\n");

    try {
        // --- Test 1: Basic connectivity ---
        console.log("Test 1: Ping Redis...");
        const pong = await redis.ping();
        console.assert(pong === "PONG", "Ping failed!");
        console.log("  ✅ PONG received\n");

        // --- Test 2: Connection Registry ---
        console.log("Test 2: Connection Registry...");
        await ConnectionRegistry.userConnected("user-123");

        const server = await ConnectionRegistry.getServer("user-123");
        console.assert(server !== null, "Server should be set");
        console.log(`  ✅ User mapped to server: ${server}`);

        const isOnline = await ConnectionRegistry.isOnline("user-123");
        console.assert(isOnline === true, "User should be online");
        console.log(`  ✅ isOnline: ${isOnline}`);

        await ConnectionRegistry.userDisconnected("user-123");
        const offlineCheck = await ConnectionRegistry.isOnline("user-123");
        console.assert(offlineCheck === false, "User should be offline");
        console.log(`  ✅ After disconnect, isOnline: ${offlineCheck}\n`);

        // --- Test 3: Batch online status ---
        console.log("Test 3: Batch online status...");
        await ConnectionRegistry.userConnected("alice");
        await ConnectionRegistry.userConnected("bob");
        // charlie is NOT connected

        const statuses = await ConnectionRegistry.getOnlineStatuses(["alice", "bob", "charlie"]);
        console.assert(statuses["alice"] === true, "Alice should be online");
        console.assert(statuses["bob"] === true, "Bob should be online");
        console.assert(statuses["charlie"] === false, "Charlie should be offline");
        console.log("  ✅ alice: online, bob: online, charlie: offline\n");

        // Cleanup
        await ConnectionRegistry.userDisconnected("alice");
        await ConnectionRegistry.userDisconnected("bob");

        // --- Test 4: Message Cache ---
        console.log("Test 4: Message Cache...");
        const msg1 = {
            message_id: "msg-001",
            sender_id: "alice",
            receiver_id: "bob",
            content: "Hello Bob!",
            timestamp: new Date().toISOString(),
            status: "sent",
        };
        const msg2 = {
            message_id: "msg-002",
            sender_id: "bob",
            receiver_id: "alice",
            content: "Hey Alice!",
            timestamp: new Date().toISOString(),
            status: "sent",
        };

        await MessageCache.cacheMessage(msg1);
        await MessageCache.cacheMessage(msg2);

        const cached = await MessageCache.getRecentMessages({ userId1: "alice", userId2: "bob" });
        console.assert(cached.length === 2, `Expected 2 messages, got ${cached.length}`);
        console.log(`  ✅ Cached and retrieved ${cached.length} messages`);
        console.log(`  ✅ Latest message: "${cached[0].content}"\n`);

        // --- Test 5: Status update in cache ---
        console.log("Test 5: Status update in cache...");
        await MessageCache.updateMessageStatus("msg-001", "delivered", {
            userId1: "alice",
            userId2: "bob",
        });
        const updated = await MessageCache.getRecentMessages({ userId1: "alice", userId2: "bob" });
        const updatedMsg = updated.find((m) => m.message_id === "msg-001");
        console.assert(updatedMsg.status === "delivered", "Status should be 'delivered'");
        console.log(`  ✅ Message status updated to: ${updatedMsg.status}\n`);

        // Cleanup test data
        await MessageCache.invalidate({ userId1: "alice", userId2: "bob" });

        console.log("====================================");
        console.log("  ✅ All tests passed!");
        console.log("====================================\n");

    } catch (err) {
        console.error("\n❌ Test failed:", err.message);
        process.exit(1);
    } finally {
        await redis.quit();
        process.exit(0);
    }
}

runTests();
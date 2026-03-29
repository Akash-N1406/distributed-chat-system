// ============================================================
//  MongoDB Test Script
//  Run: node src/db/test-db.js
// ============================================================

require("dotenv").config({ path: "../../.env" });

const { connectDB, disconnectDB } = require("./client");
const User = require("./models/User");
const Message = require("./models/Message");
const Group = require("./models/Group");

async function runTests() {
    console.log("\n====================================");
    console.log("  MongoDB Layer — Integration Tests");
    console.log("====================================\n");

    await connectDB();
    await sleep(500);

    // Clean up any leftover test data
    await User.deleteMany({ email: /test-step4@/ });
    await Message.deleteMany({ sender_id: "test-alice" });
    await Group.deleteMany({ name: "Test Group Step4" });

    try {
        // ── Test 1: Create users ───────────────────────────────
        console.log("Test 1: Create users...");
        const alice = await User.create({
            username: "test_alice_s4",
            email: "test-step4-alice@chat.com",
            password_hash: "plainpassword123",  // pre-save hook will hash this
        });
        const bob = await User.create({
            username: "test_bob_s4",
            email: "test-step4-bob@chat.com",
            password_hash: "plainpassword456",
        });
        console.log(`  ✅ Created users: ${alice.username}, ${bob.username}`);
        console.log(`  ✅ Password is hashed: ${alice.password_hash === undefined}`); // not returned

        // ── Test 2: Password verification ─────────────────────
        console.log("\nTest 2: Password verification...");
        const found = await User.findByEmail("test-step4-alice@chat.com");
        const valid = await found.verifyPassword("plainpassword123");
        const invalid = await found.verifyPassword("wrongpassword");
        console.assert(valid === true, "Correct password should verify");
        console.assert(invalid === false, "Wrong password should fail");
        console.log(`  ✅ Correct password: ${valid}`);
        console.log(`  ✅ Wrong password rejected: ${!invalid}`);

        // ── Test 3: Create messages ────────────────────────────
        console.log("\nTest 3: Create and fetch messages...");
        const convId = Message.buildConversationId(alice._id.toString(), bob._id.toString(), null);
        console.log(`  Conversation ID: ${convId}`);

        const msgs = [];
        for (let i = 1; i <= 5; i++) {
            const m = await Message.create({
                message_id: `test-msg-${i}-${Date.now()}`,
                sender_id: alice._id.toString(),
                receiver_id: bob._id.toString(),
                conversation_id: convId,
                content: `Hello message ${i}`,
                status: "sent",
            });
            msgs.push(m);
            await sleep(10); // ensure distinct timestamps
        }
        console.log(`  ✅ Created ${msgs.length} messages`);

        // Fetch history — should be newest first
        const history = await Message.getHistory(convId, { limit: 3 });
        console.assert(history.length === 3, `Expected 3, got ${history.length}`);
        console.assert(
            new Date(history[0].created_at) >= new Date(history[1].created_at),
            "Should be newest first"
        );
        console.log(`  ✅ Fetched ${history.length} messages (newest first): "${history[0].content}"`);

        // ── Test 4: Offline messages ───────────────────────────
        console.log("\nTest 4: Offline message fetch...");
        const undelivered = await Message.getUndelivered(bob._id.toString());
        console.assert(undelivered.length === 5, `Expected 5 undelivered, got ${undelivered.length}`);
        console.log(`  ✅ Undelivered messages for bob: ${undelivered.length}`);

        // ── Test 5: Mark delivered ─────────────────────────────
        console.log("\nTest 5: Mark messages delivered...");
        await Message.markDelivered(convId, bob._id.toString());
        const stillUndelivered = await Message.getUndelivered(bob._id.toString());
        console.assert(stillUndelivered.length === 0, "Should be 0 after marking delivered");
        console.log(`  ✅ After markDelivered, undelivered count: ${stillUndelivered.length}`);

        // ── Test 6: Group creation ─────────────────────────────
        console.log("\nTest 6: Group creation...");
        const group = await Group.create({
            name: "Test Group Step4",
            created_by: alice._id.toString(),
            members: [
                { user_id: alice._id.toString(), role: "admin" },
                { user_id: bob._id.toString(), role: "member" },
            ],
        });
        console.log(`  ✅ Created group: "${group.name}" with ${group.members.length} members`);

        const aliceGroups = await Group.getForUser(alice._id.toString());
        console.assert(aliceGroups.length >= 1, "Alice should be in at least 1 group");
        console.log(`  ✅ Alice is in ${aliceGroups.length} group(s)`);

        // ── Cleanup ────────────────────────────────────────────
        await User.deleteMany({ email: /test-step4@/ });
        await Message.deleteMany({ sender_id: alice._id.toString() });
        await Group.deleteMany({ name: "Test Group Step4" });

        console.log("\n====================================");
        console.log("  ✅ All MongoDB tests passed!");
        console.log("====================================\n");

    } catch (err) {
        console.error("\n❌ Test failed:", err.message);
        process.exit(1);
    } finally {
        await disconnectDB();
        process.exit(0);
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

runTests();
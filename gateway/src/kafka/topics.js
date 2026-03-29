// ============================================================
//  Kafka Topic Definitions & Setup
//
//  We create all topics explicitly (vs auto-create) so we
//  can control partitions and replication precisely.
//
//  Topic design decisions:
//
//  chat-messages
//    - Partitions: 3 (parallelism for 3 gateway instances)
//    - Key: conversationId → same chat always hits same partition
//    - This guarantees message ORDER within a conversation
//
//  chat-delivery-status
//    - Partitions: 3
//    - Key: messageId
//    - For sent/delivered/read receipts
//
//  chat-notifications
//    - Partitions: 2
//    - Key: userId → all notifications for a user → same partition
//    - Consumed by Notification Service (Step 11)
//
//  chat-typing
//    - Partitions: 2
//    - Key: conversationId
//    - Short retention (30s) — typing events expire fast
// ============================================================

const { admin } = require("./client");

const TOPICS = [
    {
        topic: "chat-messages",
        numPartitions: 3,
        replicationFactor: 1, // 1 = dev; use 3 in production
        configEntries: [
            { name: "retention.ms", value: "604800000" }, // 7 days
            { name: "cleanup.policy", value: "delete" },
            { name: "max.message.bytes", value: "10485760" }, // 10MB (for media)
        ],
    },
    {
        topic: "chat-delivery-status",
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
            { name: "retention.ms", value: "604800000" }, // 7 days
            { name: "cleanup.policy", value: "delete" },
        ],
    },
    {
        topic: "chat-notifications",
        numPartitions: 2,
        replicationFactor: 1,
        configEntries: [
            { name: "retention.ms", value: "259200000" }, // 3 days
            { name: "cleanup.policy", value: "delete" },
        ],
    },
    {
        topic: "chat-typing",
        numPartitions: 2,
        replicationFactor: 1,
        configEntries: [
            { name: "retention.ms", value: "30000" }, // 30 seconds only!
            { name: "cleanup.policy", value: "delete" },
        ],
    },
];

async function createTopics() {
    await admin.connect();
    console.log("[Kafka:Admin] ✅ Connected");

    try {
        // Check which topics already exist
        const existingTopics = await admin.listTopics();
        console.log("[Kafka:Admin] Existing topics:", existingTopics);

        const topicsToCreate = TOPICS.filter(
            (t) => !existingTopics.includes(t.topic)
        );

        if (topicsToCreate.length === 0) {
            console.log("[Kafka:Admin] ✅ All topics already exist");
            return;
        }

        const created = await admin.createTopics({
            waitForLeaders: true, // wait until partitions have leaders
            topics: topicsToCreate,
        });

        if (created) {
            topicsToCreate.forEach((t) => {
                console.log(
                    `[Kafka:Admin] ✅ Created topic: ${t.topic} (${t.numPartitions} partitions)`
                );
            });
        }

        // Print final topic metadata
        const metadata = await admin.fetchTopicMetadata({
            topics: TOPICS.map((t) => t.topic),
        });

        console.log("\n[Kafka:Admin] 📋 Topic Summary:");
        metadata.topics.forEach((t) => {
            console.log(`  ${t.name}: ${t.partitions.length} partition(s)`);
        });

    } finally {
        await admin.disconnect();
    }
}

module.exports = { TOPICS, createTopics };
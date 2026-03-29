// ============================================================
//  Kafka Client — Singleton using kafkajs
//
//  kafkajs is the most popular Node.js Kafka client.
//  It handles:
//    - Connection pooling to brokers
//    - Automatic retries
//    - Leader election awareness
//    - Consumer group rebalancing
// ============================================================

const { Kafka, Partitioners, logLevel } = require("kafkajs");

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:29092";

// One Kafka instance shared across the app
const kafka = new Kafka({
    clientId: "chat-gateway",
    brokers: [KAFKA_BROKER],
    logLevel: logLevel.WARN, // reduce noise; change to INFO for debugging

    // Retry config — Kafka might not be ready immediately on startup
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});

// Producer — sends messages INTO Kafka topics
// We use DefaultPartitioner: routes messages with the same key
// (e.g. same conversation) to the same partition → preserves order
const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    allowAutoTopicCreation: false, // we create topics explicitly
    transactionTimeout: 30000,
});

// Consumer — reads messages FROM Kafka topics
// groupId ensures that if we run multiple gateway instances,
// Kafka distributes partitions between them (each message processed once)
const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "chat-gateway-consumers",
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB per partition per fetch
});

// Admin client — used to create/inspect topics
const admin = kafka.admin();

module.exports = { kafka, producer, consumer, admin };
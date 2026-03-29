// ============================================================
//  Pub/Sub — Cross-server message routing
//
//  Problem: User A is on Gateway-1, User B is on Gateway-2.
//  When B sends a message to A, how does Gateway-2 deliver
//  it to Gateway-1 where A's WebSocket lives?
//
//  Solution: Redis Pub/Sub
//    - Each gateway SUBSCRIBES to its own channel
//    - Chat Service PUBLISHES to the target gateway's channel
//    - The target gateway receives it and pushes to the socket
//
//  Channel schema:
//    gateway:{serverId}  → messages for that specific gateway
//    gateway:broadcast   → messages to ALL gateways (e.g. announcements)
// ============================================================

const { subscriber, publisher } = require("./client");
const { SERVER_ID } = require("./connectionRegistry");

// Map of handlers registered by the WebSocket layer
const handlers = new Map();

const PubSub = {

    // Subscribe this gateway to its own channel + broadcast channel
    async subscribe() {
        const myChannel = `gateway:${SERVER_ID}`;
        const broadcastChannel = "gateway:broadcast";

        await subscriber.subscribe(myChannel, broadcastChannel);
        console.log(`[PubSub] 📡 Subscribed to: ${myChannel}, ${broadcastChannel}`);

        subscriber.on("message", (channel, message) => {
            try {
                const event = JSON.parse(message);
                console.log(`[PubSub] 📨 Received on ${channel}:`, event.type);

                const handler = handlers.get(event.type);
                if (handler) {
                    handler(event.payload);
                } else {
                    console.warn(`[PubSub] No handler for event type: ${event.type}`);
                }
            } catch (err) {
                console.error("[PubSub] Failed to parse message:", err.message);
            }
        });
    },

    // Register a handler for an event type
    // e.g. PubSub.on("deliver_message", (payload) => { ... })
    on(eventType, handler) {
        handlers.set(eventType, handler);
    },

    // Publish an event to a specific gateway server
    async publishToServer(targetServerId, eventType, payload) {
        const channel = `gateway:${targetServerId}`;
        const message = JSON.stringify({ type: eventType, payload });
        await publisher.publish(channel, message);
    },

    // Publish to ALL gateway servers (e.g. system announcement)
    async broadcast(eventType, payload) {
        const message = JSON.stringify({ type: eventType, payload });
        await publisher.publish("gateway:broadcast", message);
    },
};

module.exports = { PubSub };
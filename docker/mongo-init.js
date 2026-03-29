// ============================================================
//  MongoDB Init Script
//  Runs once when the container starts for the first time.
//  Creates: DB, collections, indexes, and a test user.
// ============================================================

db = db.getSiblingDB("chatdb");

// ----- USERS collection -----
db.createCollection("users");
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ created_at: -1 });

// ----- MESSAGES collection -----
db.createCollection("messages");

// Query patterns we need to support:
//   1. Fetch conversation between two users  → (sender_id, receiver_id)
//   2. Fetch messages in a group            → group_id
//   3. Fetch messages by timestamp          → timestamp (for pagination)
//   4. Update delivery status               → message_id
db.messages.createIndex({ sender_id: 1, receiver_id: 1, timestamp: -1 });
db.messages.createIndex({ group_id: 1, timestamp: -1 });
db.messages.createIndex({ receiver_id: 1, status: 1 });   // offline message fetch
db.messages.createIndex({ timestamp: -1 });

// ----- GROUPS collection -----
db.createCollection("groups");
db.groups.createIndex({ members: 1 });
db.groups.createIndex({ created_by: 1 });

// ----- SESSIONS collection (track active WebSocket connections) -----
// We use Redis for live sessions, but store device session history here
db.createCollection("sessions");
db.sessions.createIndex({ user_id: 1 });
db.sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index

// ---- Seed: one test user ----
db.users.insertOne({
    _id: ObjectId(),
    username: "testuser",
    email: "test@chat.com",
    password_hash: "$2b$10$placeholder",   // will be replaced by real bcrypt hash
    avatar_url: null,
    is_online: false,
    last_seen: new Date(),
    created_at: new Date()
});

print("✅ chatdb initialized: collections + indexes created");
// ============================================================
//  MongoDB Client — Mongoose connection
//
//  Why Mongoose over raw MongoDB driver?
//  - Schema validation at application level
//  - Middleware hooks (pre-save, post-find)
//  - Cleaner query API
//  - Auto-handles connection pooling (default pool: 5 connections)
// ============================================================

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI ||
    "mongodb://chatadmin:chatpass123@localhost:27017/chatdb?authSource=admin";

let isConnected = false;

async function connectDB() {
    if (isConnected) return mongoose.connection;

    mongoose.connection.on("connected", () => {
        console.log("[MongoDB] ✅ Connected to chatdb");
        isConnected = true;
    });

    mongoose.connection.on("error", (err) => {
        console.error("[MongoDB] ❌ Error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
        console.log("[MongoDB] 🔴 Disconnected");
        isConnected = false;
    });

    await mongoose.connect(MONGO_URI, {
        maxPoolSize: 10,          // max 10 concurrent connections
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });

    return mongoose.connection;
}

async function disconnectDB() {
    if (!isConnected) return;
    await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, mongoose };
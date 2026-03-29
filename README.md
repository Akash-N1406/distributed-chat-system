# 💬 Distributed Chat System

A production-grade real-time chat system built step by step.

## 🏗️ Architecture

```
Client (Web/Mobile)
       │
       │  WebSocket (wss://)
       ▼
┌─────────────────┐
│  WS Gateway     │  ← Node.js + ws library
│  Port: 3000     │    Handles all socket connections
└────────┬────────┘    Stores active users in Redis
         │
         │  HTTP / internal
         ▼
┌─────────────────┐        ┌─────────────┐
│  Chat Service   │ ──────▶│    Redis    │
│  Port: 3001     │        │  Port: 6379 │
└────────┬────────┘        └─────────────┘
         │
         │  Produce events
         ▼
┌─────────────────┐
│     Kafka       │  ← Message queue (async delivery)
│  Port: 29092    │    Topic: chat-messages
└────────┬────────┘
         │
         │  Consume events
         ▼
┌─────────────────┐
│    MongoDB      │  ← Persistent message store
│  Port: 27017    │    Collections: users, messages, groups
└─────────────────┘
```

## 🚀 Quick Start

```bash
# 1. Start all infrastructure
docker compose up -d

# 2. Check everything is running
docker compose ps

# 3. View logs
docker compose logs -f kafka
```

## 🌐 Dashboard URLs

| Service       | URL                        |
|---------------|----------------------------|
| Kafka UI      | http://localhost:8090       |
| Mongo Express | http://localhost:8091       |
| WS Gateway    | ws://localhost:3000 (Step 5)|
| Chat API      | http://localhost:3001       |

## 📦 Services

| Container         | Image                        | Role                        |
|-------------------|------------------------------|-----------------------------|
| chat-redis        | redis:7-alpine               | Session cache               |
| chat-zookeeper    | confluentinc/cp-zookeeper    | Kafka coordinator           |
| chat-kafka        | confluentinc/cp-kafka        | Message queue               |
| chat-kafka-ui     | provectuslabs/kafka-ui       | Kafka dashboard             |
| chat-mongodb      | mongo:7                      | Message/user persistence    |
| chat-mongo-express| mongo-express                | MongoDB dashboard           |

## 🔑 Credentials

| Service  | Username   | Password     |
|----------|------------|--------------|
| MongoDB  | chatadmin  | chatpass123  |

## 📁 Project Structure

```
distributed-chat/
├── docker-compose.yml          ← All infrastructure
├── docker/
│   └── mongo-init.js           ← DB setup script
├── gateway/                    ← WebSocket Gateway (Step 5)
├── chat-service/               ← Chat API (Step 6)
├── notification-service/       ← Push Notifications (Step 11)
└── client/                     ← Test client (Step 5)
```

## 🗺️ Build Steps

- [x] Step 1 — Project structure + Docker Compose
- [ ] Step 2 — Redis integration
- [ ] Step 3 — Kafka topics + producer/consumer
- [ ] Step 4 — MongoDB schema + queries
- [ ] Step 5 — WebSocket Gateway
- [ ] Step 6 — Chat Service API
- [ ] Step 7 — End-to-end message flow
- [ ] Step 8 — Delivery status (sent/delivered/read)
- [ ] Step 9 — Offline messaging
- [ ] Step 10 — Typing indicators
- [ ] Step 11 — Push notifications
- [ ] Step 12 — Load testing
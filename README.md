# 🃏 Joker Trap

A real-time multiplayer bluffing card game built with Node.js and WebSockets, featuring cross-platform clients (Mobile, CLI) and advanced psychological AI bots.

---

## 🎮 Game Rules

### Overview
4 players compete to collect **four cards of the same rank** (a "quad").  
The player holding the **Joker** when someone completes a quad **loses**. Everyone else wins.

### The Deck
| Cards | Count |
|---|---|
| J, Q, K, A × 4 suits | 16 |
| Joker | 1 |
| **Total** | **17** |

**Deal:** Player 0 (first sender) receives **5 cards**. Players 1–3 receive **4 cards** each.

---

### Turn Flow

Each round involves two players — a **Sender** (5 cards) and a **Receiver** (4 cards):

```
Receiver  →  requests a rank (e.g. "K")
Sender    →  picks any card from hand to offer face-down (CAN LIE)
Receiver  →  decides: Accept / Reject / Force 3rd card
```

#### Decision Options

| After offer # | Receiver's choices |
|---|---|
| 1st offer | **Accept** the hidden card · **Reject** (ask for another) |
| 2nd offer | **Accept 1st** card · **Accept 2nd** card · **Force 3rd** (mandatory) |
| 3rd offer | Transfer is **automatic** — no choice |

> **Bluffing:** The sender may offer any card regardless of what was requested.  
> **Privacy:** Spectators only see that an interaction ended — never which card was exchanged.

---

## ✨ Key Features

- **Cross-Platform Clients**: Play seamlessly from the React Native Mobile App (`client-mobile`), or the developer CLI (`client`).
- **Dynamic Rooms**: Create private rooms with custom 5-letter invite codes.
- **Advanced AI Bots**:
  - Automatically fill empty room slots with bots (ranging from `medium` to `hard` difficulty).
  - Bots utilise game theory and memory profiling to pass the Joker ambiguously based on a player's acceptance history.
  - Bots actively try to collect "singletons" to block human players from completing quads if they hold the Joker.
  - If a human disconnects mid-game, a Bot seamlessly takes over their hand and continues playing without aborting the match.
- **Synchronised Restarts**: Games wait for all human players to vote to play again before reloading the room.

---

## 🏗️ Project Structure

```
JokerTrap/
├── server/
│   ├── src/
│   │   ├── index.js           # Production entry point (Render-ready)
│   │   ├── ai/                # BotAdapter, BotMemory, AdvancedBot heuristics
│   │   ├── game/              # Deck, rules, and GameState state machine
│   │   └── network/           # socketServer.js (Rooms, disconnect handovers)
│   └── tests/                 # 75+ Jest unit & socket integration tests
├── client-mobile/             # Expo React Native App (iOS/Android)
└── client-cli/                # CLI testing client
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm
- (Optional) Expo CLI for Mobile app

### Run the Server locally
```bash
cd server
npm install
npm start
```
*The server is also fully configured for cloud deployment (e.g. Render) via `wss://`.*

### Connect a local CLI client
```bash
node client/cli-client.js
```
*(You will be prompted to create or join a room).*

---

## 🧪 Tests

```bash
cd server
npm test
```

**75+ integrated tests** covering:
- **Core game logic:** Deck building, shuffle, deal correctness, quad validation.
- **State Machine:** All 7 protocol phase transitions and rejection of unauthorized actions.
- **Bot Heuristics:** Tests ensuring logic for safe offerings, singleton hoarding, and Joker caching.
- **Socket Integration:** Full WebSocket network simulation checking Room creations, `restart_game` synchronisation, and graceful Bot handover flows.

---

## 🌐 WebSocket Protocol

### Client → Server

| Event | Payload |
|---|---|
| `create_room` | `{ botCount: number }` |
| `join_room` | `{ roomId: string }` |
| `restart_game` | `{}` |
| `request_card` | `{ rank: "J" \| "Q" \| "K" \| "A" }` |
| `offer_card` | `{ cardIndex: number }` |
| `make_decision` | `{ decision: "accept" \| "reject" \| "accept_first" \| "accept_second" \| "force_third" }` |

### Server → Client

| Event | Recipient | Description |
|---|---|---|
| `room_created` / `room_joined` | Event caller | Confirmation of room ID |
| `waiting` | Connecting players | Waiting room messages (e.g. waiting for restarts) |
| `game_update` | All | Broadcasts the updated turn phase, who is acting, and the player's literal hand. |
| `game_over` | All | Final hands, winner IDs, loser ID |

---

## 📜 License
ISC

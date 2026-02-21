# 🃏 Joker Trap

A real-time multiplayer bluffing card game built with Node.js and WebSockets.

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

### Turn Rotation
After each transfer: old receiver → new sender · next player clockwise → new receiver.

---

## 🏗️ Project Structure

```
JokerTrap/
├── package.json
├── client/
│   └── cli-client.js          # CLI client (connect & play in terminal)
└── server/
    ├── src/
    │   ├── index.js           # Entry point
    │   ├── config/
    │   │   └── constant.js    # RANKS, SUITS, PHASES, PLAYER_COUNT, PORT
    │   ├── game/
    │   │   ├── Deck.js        # Build / shuffle / deal
    │   │   ├── rules.js       # cardLabel, findQuad, validateRank
    │   │   └── GameState.js   # Turn state machine (pure, no WebSocket)
    │   ├── network/
    │   │   └── socketServer.js # WebSocket glue layer
    │   └── utils/
    │       └── logger.js      # Tagged console logger
    └── tests/
        ├── gameLogic.test.js  # Deck, rules & card conservation tests
        └── stateMachine.test.js # All 7 phase transitions & security
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm

### Install
```bash
npm install
```

### Start the server
```bash
npm start
```

### Connect clients (open 4 separate terminals)
```bash
node client/cli-client.js
```

The game starts automatically once all 4 players connect.

---

## 🧪 Tests

```bash
npm test
```

**50 tests** covering:
- Deck building, shuffle, deal correctness
- `findQuad` (Joker-aware), `validateRank`, `cardLabel`
- All 7 phase transitions of the state machine
- Turn rotation (4 full clockwise rounds)
- Security: wrong-turn / wrong-phase rejections
- Information hiding: spectators never see card details

---

## 🌐 WebSocket Protocol

### Client → Server

| Event | When | Payload |
|---|---|---|
| `request_card` | Receiver's turn | `{ rank: "J" \| "Q" \| "K" \| "A" }` |
| `offer_card` | Sender's turn | `{ cardIndex: number }` |
| `make_decision` | Receiver deciding | `{ decision: "accept" \| "reject" \| "accept_first" \| "accept_second" \| "force_third" }` |

### Server → Client

| Event | Recipient | Description |
|---|---|---|
| `waiting` | Connecting player | Waiting room status |
| `game_update` | All | Hand + current turn info |
| `card_requested` | **Sender only** | What rank was requested |
| `decision_needed` | **Receiver only** | Prompt to accept/reject |
| `card_received` | **Receiver only** | What card they actually got |
| `card_sent` | **Sender only** | Confirmation of transfer |
| `interaction_update` | **Spectators only** | "Interaction complete" (no card info) |
| `game_over` | All | Final hands, winner IDs, loser ID |

---

## 🔧 Architecture

`GameState` is **pure** — it has no WebSocket dependency. Players are injected as adapter objects:

```js
{ id: number, send: (event, payload) => void }
```

This means the full game logic is testable without a live server, and the network layer (`socketServer.js`) can be swapped independently (e.g., for Socket.IO or HTTP later).

---

## 📜 License
ISC

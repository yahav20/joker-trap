# 🃏 Joker Trap

A high-stakes, real-time multiplayer bluffing card game. Built with **Node.js**, **WebSockets**, and **Redis**, featuring a premium **React Native** mobile experience and advanced AI bots.

---

## 🎮 Game Rules

### Overview
Joker Trap is a game of deception and memory. 4 players compete to collect **four cards of the same rank** (a "quad").  
The player holding the **Joker** when someone completes a quad **loses**. Everyone else wins.

### The Deck
| Cards | Count |
|---|---|
| J, Q, K, A × 4 suits | 16 |
| Joker | 1 |
| **Total** | **17** |

**Deal:** The first player (Sender) receives **5 cards**. All other players receive **4 cards** each.

---

### Turn Flow
Each round involves a **Sender** (5 cards) and a **Receiver** (4 cards):

1. **Request:** Receiver requests a rank (e.g., "K").
2. **Offer:** Sender picks any card from their hand to offer face-down (**Lying is encouraged**).
3. **Decision:** Receiver can:
   - **Accept** the 1st offer.
   - **Reject** and ask for a 2nd offer.
   - **Force 3rd:** If both 1st and 2nd offers are rejected, the 3rd card is transferred automatically.

> **Bluffing:** The sender can offer the Joker even if a "K" was requested.  
> **Victory:** Collect 4 of a kind and don't be the one holding the Joker!

---

## ✨ Features

- **📱 Premium Mobile App**: Modern UI built with React Native and Expo Router.
- **🤖 Advanced AI**: Bots fill empty slots, using game theory to pass the Joker strategically.
- **🔄 Persistence**: Stateless server architecture using **Redis** for room and state recovery.
- **🔌 Robust Networking**: Automatic bot handover if a player disconnects mid-game.
- **🎨 Rich Aesthetics**: Vibrantly designed game table and smooth animations.

---

## 🏗️ Project Structure

```
JokerTrap/
├── server/                # Node.js + WebSocket + Redis Backend
│   ├── src/
│   │   ├── ai/            # Bot logic & heuristics
│   │   ├── game/          # Core game engine (State Machine)
│   │   └── network/       # WebSocket server & Redis RoomStore
│   └── tests/             # Extensive Jest test suite (75+ tests)
├── client-mobile/         # Expo React Native App (iOS/Android)
└── client-cli/            # Developer CLI tool for testing
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **Redis** (Local or Cloud instance)
- **Expo CLI** (for mobile development)

### 1. Setup the Server
```bash
cd server
npm install
# Create a .env file with your REDIS_URL
npm start
```

### 2. Setup the Mobile App
```bash
cd client-mobile
npm install
npx expo start
```

---

## 📦 Deployment & Export (EAS Build)

The mobile app uses **EAS Build** for cloud-based compilation (no Mac required for iOS).

### 🤖 Android (APK/AAB)
- **Generate APK (for sharing/testing):**
  ```bash
  eas build --platform android --profile preview
  ```
- **Generate AAB (for Google Play):**
  ```bash
  eas build --platform android --profile production
  ```

### 🍎 iOS (TestFlight)
*Requires an Apple Developer Account ($99/year).*
- **Build & Submit:**
  ```bash
  eas build --platform ios
  ```
- **Sharing via TestFlight:** After the build completes, use `eas submit` to send it to App Store Connect, then invite testers via their Apple ID.

---

## 🧪 Testing

The project maintains a high standard of reliability with over 75+ integration tests.

```bash
cd server
npm test
```

---

## 📜 License
ISC

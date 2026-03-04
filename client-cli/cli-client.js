const WebSocket = require("ws");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function ask(q) {
  return new Promise((r) => rl.question(q, (a) => r(a.trim())));
}

const ws = new WebSocket("ws://localhost:8080");

let myPlayerId = null;
let myHand = [];
let currentTurn = null;
let isPrompting = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHand(hand) {
  return hand
    .map((card, i) =>
      card.rank === "Joker"
        ? `[${i}] 🃏 JOKER`
        : `[${i}] ${card.rank}_${card.suit}`,
    )
    .join("  |  ");
}

function sep() {
  console.log("\n" + "═".repeat(55));
}
function announce(msg) {
  console.log(`\n  📢  ${msg}`);
}

const VALID_RANKS = ["J", "Q", "K", "A"];

// ─── WebSocket events ────────────────────────────────────────────────────────
ws.on("open", () => console.log("✅ Connected. Waiting for other players..."));

ws.on("message", async (raw) => {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const { event, payload } = parsed;

  switch (event) {
    // ── Waiting room ──────────────────────────────────────────────────────────
    case "waiting":
      console.log(`\n⏳ ${payload.message}`);
      break;

    // ── Main game state (after each turn advance) ─────────────────────────────
    case "game_update": {
      myPlayerId = payload.playerId;
      myHand = payload.yourHand;
      currentTurn = payload.turn;
      if (isPrompting) break;

      sep();
      console.log(`🃏  Game Update — You are Player ${myPlayerId}`);
      console.log(`    Hand: ${formatHand(myHand)}`);
      if (payload.message) console.log(`    ℹ️  ${payload.message}`);
      console.log(
        `    Phase: ${currentTurn.phase} | Sender: ${currentTurn.sender} | Receiver: ${currentTurn.receiver}`,
      );
      sep();

      // Trigger the right prompt
      if (
        currentTurn.receiver === myPlayerId &&
        currentTurn.phase === "waiting_for_request"
      ) {
        await promptRequestCard();
      } else if (
        currentTurn.sender === myPlayerId &&
        currentTurn.phase === "waiting_for_card"
      ) {
        // Should not happen here; handled via "card_requested" event
        console.log(">> Waiting for the receiver to make a request...");
      } else {
        console.log(">> Waiting — it's not your turn.");
      }
      break;
    }

    // ── Sender: receiver has made a request, now sender picks a card ──────────
    case "card_requested": {
      myHand = payload.yourHand;
      if (isPrompting) break;
      sep();
      console.log(
        `📨  Player ${currentTurn ? currentTurn.receiver : "?"} is requesting rank: ${payload.requestedRank}`,
      );
      console.log(`    Your hand: ${formatHand(myHand)}`);
      console.log(`    (You may send any card — you can lie!)`);
      sep();
      await promptSendCard();
      break;
    }

    // ── Receiver: waiting for sender to pick ──────────────────────────────────
    case "waiting_for_sender":
      console.log(`\n⏳ ${payload.message}`);
      break;

    // ── Receiver: card arrived — reveal what they actually got ────────────────
    case "card_received": {
      myHand = payload.yourHand;
      const got = payload.cardLabel;
      const wanted = payload.requestedRank;
      const lied =
        got.toUpperCase() !== wanted &&
        !(got === "Joker" && wanted === "JOKER");
      sep();
      console.log(`📬  You received: ${got}`);
      if (lied) {
        console.log(
          `    ⚠️  You asked for ${wanted} but got ${got} — the sender lied (or didn't have it).`,
        );
      } else {
        console.log(`    ✅ You got exactly what you asked for!`);
      }
      console.log(`    New hand: ${formatHand(myHand)}`);
      sep();
      break;
    }

    // ── Receiver: Needs to make a decision on hidden cards ────────────────────
    case "decision_needed": {
      if (isPrompting) break;
      sep();
      console.log(`❓  ${payload.message}`);
      sep();
      if (payload.offerNumber === 1) {
        await promptFirstDecision();
      } else {
        await promptSecondDecision();
      }
      break;
    }

    // ── Sender: Receiver rejected, offer another ──────────────────────────────
    case "second_offer_needed":
    case "third_offer_needed": {
      if (payload.yourHand) myHand = payload.yourHand; // ← sync hand FIRST
      if (isPrompting) break;
      sep();
      console.log(`⚠️  ${payload.message}`);
      console.log(`    Your hand: ${formatHand(myHand)}`);
      sep();
      await promptSendCard();
      break;
    }

    // ── Sender: confirmation after sending ────────────────────────────────────
    case "card_sent": {
      myHand = payload.yourHand;
      console.log(`\n✉️  You sent: ${payload.cardLabel}`);
      console.log(`   Remaining hand: ${formatHand(myHand)}`);
      break;
    }

    // ── Spectators: just know an interaction completed ─────────────────────────
    case "interaction_update":
      announce(payload.message);
      break;

    // ── Game Over ─────────────────────────────────────────────────────────────
    case "game_over": {
      sep();
      console.log("🏁  GAME OVER!\n");
      console.log(
        `    Player ${payload.quadPlayer} completed a quad of "${payload.quadRank}"!\n`,
      );
      console.log("    Final hands:");
      for (const p of payload.hands) {
        const handStr = p.hand
          .map((c) => (c.rank === "Joker" ? "🃏JOKER" : `${c.rank}_${c.suit}`))
          .join(", ");
        const you = p.id === myPlayerId ? " ← YOU" : "";
        console.log(`      Player ${p.id}${you}: ${handStr}`);
      }
      console.log();
      if (payload.loserId === myPlayerId) {
        console.log("  💀  You had the JOKER — you LOSE!");
      } else {
        console.log(
          `  🏆  Winners: ${payload.winnerIds.map((id) => `Player ${id}`).join(", ")}`,
        );
        console.log(`      Loser (Joker holder): Player ${payload.loserId}`);
        console.log("  🎉  You WIN!");
      }
      sep();
      rl.close();
      setTimeout(() => process.exit(0), 500);
      break;
    }

    case "error":
      console.error(`\n❌  ${payload.message}`);
      break;
  }
});

// ─── Prompts ──────────────────────────────────────────────────────────────────

/** Receiver asks for a rank */
async function promptRequestCard() {
  isPrompting = true;
  try {
    console.log("\n🎯  It's your turn to REQUEST a card.");
    console.log(`    Your hand: ${formatHand(myHand)}`);
    console.log(`    Valid ranks: ${VALID_RANKS.join(", ")}`);
    while (true) {
      const input = await ask("    Which rank do you want to ask for? ");
      const rank = input.toUpperCase();
      if (VALID_RANKS.includes(rank)) {
        sendToServer("request_card", { rank });
        break;
      }
      console.log(
        `    ⚠️  Invalid rank. Choose from: ${VALID_RANKS.join(", ")}`,
      );
    }
  } finally {
    isPrompting = false;
  }
}

/** Sender picks which card to send (can lie) */
async function promptSendCard() {
  isPrompting = true;
  try {
    while (true) {
      const input = await ask("    Enter card index to send: ");
      const idx = parseInt(input, 10);
      if (!isNaN(idx) && idx >= 0 && idx < myHand.length) {
        sendToServer("offer_card", { cardIndex: idx });
        break;
      }
      console.log(
        `    ⚠️  Invalid index. Choose between 0 and ${myHand.length - 1}.`,
      );
    }
  } finally {
    isPrompting = false;
  }
}

async function promptFirstDecision() {
  isPrompting = true;
  try {
    while (true) {
      const input = await ask(
        "    Type [A] to Accept the hidden card, or [R] to Reject it: ",
      );
      const choice = input.toUpperCase();
      if (choice === "A") {
        sendToServer("make_decision", { decision: "accept" });
        break;
      } else if (choice === "R") {
        sendToServer("make_decision", { decision: "reject" });
        break;
      }
    }
  } finally {
    isPrompting = false;
  }
}

async function promptSecondDecision() {
  isPrompting = true;
  try {
    console.log(
      "    Options: [1] Accept 1st card | [2] Accept 2nd card | [3] Force 3rd card",
    );
    while (true) {
      const input = await ask("    Your choice (1/2/3): ");
      if (input === "1") {
        sendToServer("make_decision", { decision: "accept_first" });
        break;
      } else if (input === "2") {
        sendToServer("make_decision", { decision: "accept_second" });
        break;
      } else if (input === "3") {
        sendToServer("make_decision", { decision: "force_third" });
        break;
      }
    }
  } finally {
    isPrompting = false;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function sendToServer(event, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

ws.on("error", (err) => console.error("WebSocket error:", err.message));
ws.on("close", () => {
  console.log("\nDisconnected.");
  rl.close();
  process.exit(0);
});

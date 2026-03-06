import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Fallback WebSocket URL for Android Emulator.
 * - 10.0.2.2 maps to the host machine's loopback interface from an Android emulator.
 * - Override via the EXPO_PUBLIC_WS_URL environment variable for physical devices or prod.
 */
const SERVER_URL = "ws://joker-trap.onrender.com";

/**
 * A single playing card.
 * `null` represents a face-down (unknown) card — used for table cards and opponents' hands.
 */
type Card = { rank: string, suit: string } | null;

/** Lightweight summary of an opponent visible to this client. */
type PlayerInfo = {
    id: number;
    /** Number of cards in this player's hand (we never see exact cards of opponents). */
    handCount: number;
};

/**
 * Payload received with a `game_update` server event.
 * Contains the full game state as seen by this player.
 */
type GameStatePayload = {
    playerId: number;
    yourHand: Card[];
    turn: {
        /** The player who is currently offering cards. */
        sender: number;
        /** The player who is currently choosing / accepting cards. */
        receiver: number;
        /**
         * Current phase of the turn. Possible values:
         *   'lobby'                    – waiting for players
         *   'waiting_for_request'       – receiver must pick a rank to ask for
         *   'waiting_for_first_offer'   – sender must pick a card to offer
         *   'waiting_for_first_decision'– receiver must accept or reject 1st offer
         *   'waiting_for_second_offer'  – sender must pick a 2nd card to offer
         *   'waiting_for_second_decision'- receiver must accept 1st, 2nd, or force 3rd
         *   'waiting_for_third_offer'   – sender must pick final forced card
         */
        phase: string;
        /** The rank the receiver requested (set after 'card_requested' event). */
        requestedRank?: string;
    };
};

/**
 * Payload received with a `game_over` server event.
 * Contains the final round results shown in the GameOverModal.
 */
export type GameOverPayload = {
    /** Player who completed a Quad (four-of-a-kind) and triggered game over. */
    quadPlayer: number;
    /** The rank that was completed (e.g. 'K', 'A'). */
    quadRank: string;
    /** Player who was left holding the Joker — the loser. `null` if no Joker was in play. */
    loserId: number | null;
    /** Players who stayed in the game (didn't hold the Joker). */
    winnerIds: number[];
    /** Final revealed hands of every player, used to display the end-of-round summary. */
    hands: { id: number; hand: Card[] }[];
};

/**
 * Core game hook. Opens and maintains a WebSocket connection to the game server,
 * parses every server event, and exposes all the state components need to render.
 *
 * Returns:
 *  - `myHand`          – the local player's current hand
 *  - `tableCards`      – face-down cards placed in the centre of the board
 *  - `gameMessage`     – latest narrative status string shown to the user
 *  - `toastMessage`    – transient notification (auto-clears after 3 s)
 *  - `gameOverPayload` – non-null when the round has ended
 *  - `currentTurn`     – sender/receiver/phase of the active turn
 *  - `opponents`       – lightweight list of opponent hand-counts
 *  - `myPlayerId`      – assigned player ID (0–3)
 *  - `sendAction`      – send a game action to the server
 *  - `connected`       – whether the socket is currently open
 *  - `reconnect`       – manually re-initiate the WebSocket connection
 */
export const useGameSocket = (action?: string, roomIdParam?: string, botsParam?: string) => {
    const [roomCode, setRoomCode] = useState<string | null>(null);
    /** This player's unique seat ID (0–3), assigned by the server after connection. */
    const [myPlayerId, setMyPlayerId] = useState<number | null>(null);

    /** The local player's actual hand (cards with rank/suit). */
    const [myHand, setMyHand] = useState<Card[]>([]);

    /** Face-down cards currently on the table. Each element is `null` (unknown). */
    const [tableCards, setTableCards] = useState<any[]>([]);

    /** Human-readable status message displayed in the centre of the board. */
    const [gameMessage, setGameMessage] = useState('Connecting to server...');

    /** Short-lived notification (3 s) — e.g. "Opponent lied!". `null` when hidden. */
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    /** Non-null when the server sends `game_over`; drives the GameOverModal. */
    const [gameOverPayload, setGameOverPayload] = useState<GameOverPayload | null>(null);

    /**
     * Snapshot of the active turn.
     * Starts in 'lobby' with sentinel values for sender/receiver (-1).
     */
    const [currentTurn, setCurrentTurn] = useState<GameStatePayload['turn']>({ phase: 'lobby', sender: -1, receiver: -1 });

    /** True while the WebSocket is in OPEN state. Drives the DisconnectedOverlay. */
    const [connected, setConnected] = useState(false);

    /** Lightweight list of opponents — only hand count is known, not the actual cards. */
    const [opponents, setOpponents] = useState<PlayerInfo[]>([]);

    /**
     * We keep a ref that mirrors `currentTurn` so that the `onmessage` closure
     * (created once via useCallback) can always read the latest turn value
     * without needing to be recreated on every state change.
     */
    const currentTurnRef = useRef(currentTurn);
    useEffect(() => {
        currentTurnRef.current = currentTurn;
    }, [currentTurn]);

    /** Persistent ref to the WebSocket instance — avoids re-renders on WS changes. */
    const ws = useRef<WebSocket | null>(null);

    /** Ref for the toast timeout to clear it cleanly on unmount. */
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Opens (or re-opens) the WebSocket connection.
     * The host URL is read from the `EXPO_PUBLIC_WS_URL` environment variable so
     * that development, emulator, and physical-device builds can each point to the
     * correct server without touching the source code.
     *
     * Wrapped in `useCallback` so that the reference is stable across renders,
     * which prevents the mount `useEffect` below from running more than once.
     */
    const connect = useCallback(() => {
        const HOST = process.env.EXPO_PUBLIC_WS_URL || SERVER_URL;
        console.log('Connecting to:', HOST);
        setGameMessage('Connecting to server...');

        ws.current = new WebSocket(HOST);

        /** Called once the socket handshake completes. */
        ws.current.onopen = () => {
            setConnected(true);
            setGameMessage('Connected. Joining room...');

            // Send the initial room request
            if (action === 'create') {
                ws.current?.send(JSON.stringify({ event: 'create_room', payload: { botCount: parseInt(botsParam || '0', 10) } }));
            } else if (action === 'join' && roomIdParam) {
                ws.current?.send(JSON.stringify({ event: 'join_room', payload: { roomId: roomIdParam } }));
            }
        };

        /**
         * Handles every incoming server message.
         * Messages follow the shape `{ event: string, payload: object }`.
         * Unknown events are silently ignored; JSON parse errors are caught and logged.
         */
        ws.current.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                const { event: action, payload } = parsed;

                /** Displays a transient toast that disappears after 3 seconds. */
                const showToast = (msg: string) => {
                    setToastMessage(msg);
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
                };

                switch (action) {
                    /**
                     * 'room_created' — the server successfully created a new room.
                     * We store the room code so it can be displayed in the lobby.
                     */
                    case 'room_created':
                        setRoomCode(payload.roomId);
                        setGameMessage(payload.message || `Room Code: ${payload.roomId}`);
                        break;

                    /**
                     * 'room_joined' — the server successfully added us to an existing room.
                     * We store the room code so it can be displayed in the lobby.
                     */
                    case 'room_joined':
                        setRoomCode(payload.roomId);
                        setGameMessage(payload.message || `Joined Room: ${payload.roomId}`);
                        break;

                    /**
                     * 'waiting' — server reports the lobby is not yet full.
                     * We update the status message but stay in the lobby phase.
                     */
                    case 'waiting':
                        setGameMessage(payload.message || 'Waiting...');
                        if (currentTurnRef.current.phase !== 'lobby') {
                            // Transitional waiting message between turns (not lobby)
                            setGameMessage(payload.message);
                        }
                        break;

                    /**
                     * 'game_update' — full game-state snapshot from the server.
                     * Also clears any stale game-over data if the round was restarted.
                     */
                    case 'game_update':
                        setGameOverPayload(null); // Clear previous round result
                        setMyPlayerId(payload.playerId);
                        setMyHand(payload.yourHand);
                        setCurrentTurn(payload.turn);

                        // TODO: The server currently does not broadcast opponent hand-sizes.
                        // We derive them by assuming a fixed 4-player game and assign each
                        // opponent a dummy count of 4 cards.  Replace with real data once
                        // the server supports a `handSizes` field in the payload.
                        const activeOpponents = [];
                        for (let i = 1; i < 4; i++) {
                            activeOpponents.push({ id: (payload.playerId + i) % 4, handCount: 4 });
                        }
                        setOpponents(activeOpponents);

                        // Sync the count of visible (face-down) table cards.
                        if (payload.tableCount !== undefined) {
                            setTableCards(Array(payload.tableCount).fill(null));
                        }

                        if (payload.message) setGameMessage(payload.message);
                        else if (payload.turn.phase === 'waiting_for_request') {
                            setGameMessage(`Player ${payload.turn.receiver} is requesting...`);
                        }
                        break;

                    /**
                     * 'card_requested' — the receiver has chosen a rank to ask for.
                     * Transitions the turn to `waiting_for_first_offer` so the sender
                     * knows to pick a card to place on the table.
                     */
                    case 'card_requested':
                        setMyHand(payload.yourHand);
                        setCurrentTurn(prev => ({
                            ...prev,
                            requestedRank: payload.requestedRank,
                            phase: 'waiting_for_first_offer'
                        }));
                        setGameMessage(payload.message || `Player ${payload.receiver || currentTurnRef.current.receiver} requested: ${payload.requestedRank}.`);
                        break;

                    /**
                     * 'decision_needed' — the sender placed a card face-down on the table.
                     * The receiver must now accept it, reject it (ask another), or force a 3rd.
                     * `offerNumber` is 1 for the first card and 2 for the second.
                     */
                    case 'decision_needed':
                        setGameMessage(payload.message || 'Decision needed.');
                        // Append a placeholder null to visualise the newly placed face-down card.
                        setTableCards(prev => [...prev, null]);
                        setCurrentTurn(prev => ({
                            ...prev,
                            offerNumber: payload.offerNumber,
                            phase: payload.offerNumber === 1 ? 'waiting_for_first_decision' : 'waiting_for_second_decision'
                        }));
                        break;

                    /**
                     * 'card_placed_on_table' — confirmation sent only to the sender
                     * after they successfully placed a card face-down.
                     * We refresh the hand and sync the table card count.
                     */
                    case 'card_placed_on_table':
                        setMyHand(payload.yourHand);
                        setTableCards(Array(payload.tableCount).fill(null));
                        break;

                    /**
                     * 'card_received' — sent to the receiver after they accept a card.
                     * We clear the table (cards move to player hands) and check if the
                     * sender lied (i.e. gave a different rank than what was requested).
                     *
                     * Lie detection: compare the received rank against `requestedRank`.
                     * Special case: the string "Joker" must match the requested "JOKER" rank.
                     */
                    case 'card_received':
                        setMyHand(payload.yourHand);
                        setTableCards([]); // Cards move off the table into players' hands
                        setGameMessage(`Received: ${payload.cardLabel}`);

                        // Detect a lie by comparing what was received vs. what was asked for.
                        const got = payload.cardLabel;
                        const wanted = currentTurnRef.current.requestedRank;
                        const lied =
                            got.toUpperCase() !== wanted &&
                            !(got === "Joker" && wanted === "JOKER");

                        if (lied) {
                            showToast(`Opponent lied! You asked for ${wanted} but got ${got}.`);
                        } else {
                            showToast(`Received exactly what you asked for: ${got}.`);
                        }
                        break;

                    /**
                     * 'card_sent' — mirror of 'card_received' but from the sender's perspective.
                     * Their hand has changed (they lost the offered card) and the table is cleared.
                     */
                    case 'card_sent':
                        setMyHand(payload.yourHand);
                        setTableCards([]); // Table cleared — card moved to receiver's hand
                        setGameMessage(`Sent: ${payload.cardLabel}`);
                        showToast(`You sent: ${payload.cardLabel}`);
                        break;

                    /**
                     * 'second_offer_needed' — the receiver rejected the first offer.
                     * The sender must now place a second card face-down.
                     */
                    case 'second_offer_needed':
                        setMyHand(payload.yourHand);
                        setGameMessage(payload.message);
                        setCurrentTurn(prev => ({ ...prev, phase: 'waiting_for_second_offer' }));
                        break;

                    /**
                     * 'third_offer_needed' — the receiver forced a 3rd card.
                     * The sender must reveal one more card (no further negotiation).
                     */
                    case 'third_offer_needed':
                        setMyHand(payload.yourHand);
                        setGameMessage(payload.message);
                        setCurrentTurn(prev => ({ ...prev, phase: 'waiting_for_third_offer' }));
                        break;

                    /**
                     * 'interaction_update' — generic narrative event (e.g. "P2 asked for K").
                     * Shown as both the main message and a toast for visibility.
                     */
                    case 'interaction_update':
                        setGameMessage(payload.message);
                        showToast(payload.message);
                        break;

                    /**
                     * 'game_over' — the round has ended because a player completed a Quad.
                     * Setting `gameOverPayload` makes the GameOverModal appear.
                     */
                    case 'game_over':
                        setGameMessage(`Game Over: Player ${payload.quadPlayer} completed a Quad!`);
                        setGameOverPayload(payload);
                        break;

                    /**
                     * 'error' — the server rejected an action (e.g. invalid card index).
                     * Shown in the message area and as a toast.
                     */
                    case 'error':
                        setGameMessage(payload.message);
                        showToast(`Error: ${payload.message}`);
                        break;
                }
            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        };

        /**
         * Called whenever the socket closes — either intentionally (e.g. on unmount)
         * or unexpectedly (network drop, server restart).
         * Setting `connected = false` shows the DisconnectedOverlay.
         */
        ws.current.onclose = (e) => {
            setConnected(false);
            setGameMessage('Disconnected from server.');
            console.log('WS Closed:', e.code, e.reason);
        };

        /**
         * Called on low-level WebSocket errors (e.g. refused connection).
         * The `onclose` event fires immediately after, so the UI only needs to
         * respond to `onclose` for the disconnection state.
         */
        ws.current.onerror = (e) => {
            console.error('WS Error:', e);
            setGameMessage('Connection error.');
        };
    }, []);

    /**
     * Mounts the WebSocket on first render and closes it on unmount.
     * `connect` is stable (useCallback with no deps) so this effect runs only once.
     */
    useEffect(() => {
        connect();
        return () => {
            // Clean up the socket when the game screen is unmounted to avoid memory leaks.
            ws.current?.close();
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        };
    }, [connect]);

    /**
     * Sends a structured action message to the server.
     * The server expects `{ event: string, payload: object }`.
     * Silently no-ops if the socket is not currently OPEN — this prevents
     * crashes when a player tries to act after a disconnection.
     */
    const sendAction = useCallback((action: string, data: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ event: action, payload: data }));
        } else {
            console.log('Cannot send. WS not open:', action, data);
        }
    }, []);

    return {
        myHand, tableCards, gameMessage, toastMessage, gameOverPayload,
        currentTurn, opponents, myPlayerId, sendAction, connected, roomCode,
        reconnect: connect
    };
};

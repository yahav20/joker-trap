import { useState, useEffect, useCallback, useRef } from 'react';

// Adjust this URL if you test on a physical device, e.g., 'ws://192.168.x.x:8080'
const WS_URL = 'ws://10.0.2.2:8080'; // Common for Android Emulator to host loopback, or 'ws://localhost:8080'

type Card = { rank: string, suit: string } | null;

type PlayerInfo = {
    id: number;
    handCount: number; // We track others' hand counts (not exact cards)
};

type GameStatePayload = {
    playerId: number;
    yourHand: Card[];
    turn: {
        sender: number;
        receiver: number;
        phase: string;
        requestedRank?: string;
    };
};

export type GameOverPayload = {
    quadPlayer: number;
    quadRank: string;
    loserId: number | null;
    winnerIds: number[];
    hands: { id: number; hand: Card[] }[];
};

export const useGameSocket = () => {
    const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
    const [myHand, setMyHand] = useState<Card[]>([]);
    const [tableCards, setTableCards] = useState<any[]>([]);
    const [gameMessage, setGameMessage] = useState('Connecting to server...');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [gameOverPayload, setGameOverPayload] = useState<GameOverPayload | null>(null);
    const [currentTurn, setCurrentTurn] = useState<GameStatePayload['turn']>({ phase: 'lobby', sender: -1, receiver: -1 });
    const [connected, setConnected] = useState(false);
    const [opponents, setOpponents] = useState<PlayerInfo[]>([]);

    const currentTurnRef = useRef(currentTurn);
    useEffect(() => {
        currentTurnRef.current = currentTurn;
    }, [currentTurn]);

    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        // 1. Establish standard connection to local server
        const HOST = process.env.EXPO_PUBLIC_WS_URL || 'ws://10.100.102.1:8080'; // fallback to IP or localhost
        ws.current = new WebSocket(HOST);

        ws.current.onopen = () => {
            setConnected(true);
            setGameMessage('Connected. Waiting for players...');
        };

        ws.current.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                const { event: action, payload } = parsed;

                const showToast = (msg: string) => {
                    setToastMessage(msg);
                    setTimeout(() => setToastMessage(null), 3000);
                };

                switch (action) {
                    case 'waiting':
                        setGameMessage(payload.message || 'Waiting...');
                        if (currentTurnRef.current.phase !== 'lobby') {
                            // Not purely lobby, just a transitional waiting
                            setGameMessage(payload.message);
                        }
                        break;

                    case 'game_update':
                        setGameOverPayload(null);
                        setMyPlayerId(payload.playerId);
                        setMyHand(payload.yourHand);
                        setCurrentTurn(payload.turn);

                        // Mock syncing opponent data for now.
                        // On a real server, we might broadcast all hand sizes.
                        // Assuming 4-player game mapping for UI demo completeness:
                        // Calculate active opponent objects relative to our ID
                        const activeOpponents = [];
                        for (let i = 1; i < 4; i++) {
                            activeOpponents.push({ id: (payload.playerId + i) % 4, handCount: 4 });
                        }
                        setOpponents(activeOpponents);

                        if (payload.tableCount !== undefined) {
                            setTableCards(Array(payload.tableCount).fill(null));
                        }

                        if (payload.message) setGameMessage(payload.message);
                        else if (payload.turn.phase === 'waiting_for_request') {
                            setGameMessage(`Player ${payload.turn.receiver} is requesting...`);
                        }
                        break;

                    case 'card_requested':
                        setMyHand(payload.yourHand);
                        setCurrentTurn(prev => ({
                            ...prev,
                            requestedRank: payload.requestedRank,
                            phase: 'waiting_for_first_offer'
                        }));
                        setGameMessage(payload.message || `Player ${payload.receiver || currentTurnRef.current.receiver} requested: ${payload.requestedRank}.`);
                        break;

                    case 'decision_needed':
                        setGameMessage(payload.message || 'Decision needed.');
                        // Add a face-down card to the table
                        setTableCards(prev => [...prev, null]);
                        setCurrentTurn(prev => ({
                            ...prev,
                            offerNumber: payload.offerNumber,
                            phase: payload.offerNumber === 1 ? 'waiting_for_first_decision' : 'waiting_for_second_decision'
                        }));
                        break;

                    case 'card_placed_on_table':
                        // Sender's view after placing
                        setMyHand(payload.yourHand);
                        setTableCards(Array(payload.tableCount).fill(null));
                        break;

                    case 'card_received':
                        setMyHand(payload.yourHand);
                        setTableCards([]); // Sweep table cards to hands
                        setGameMessage(`Received: ${payload.cardLabel}`);

                        // Check for lying
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

                    case 'card_sent':
                        setMyHand(payload.yourHand);
                        setTableCards([]); // Sweep table cards to hands
                        setGameMessage(`Sent: ${payload.cardLabel}`);
                        showToast(`You sent: ${payload.cardLabel}`);
                        break;

                    case 'second_offer_needed':
                        setMyHand(payload.yourHand);
                        setGameMessage(payload.message);
                        setCurrentTurn(prev => ({ ...prev, phase: 'waiting_for_second_offer' }));
                        break;

                    case 'third_offer_needed':
                        setMyHand(payload.yourHand);
                        setGameMessage(payload.message);
                        setCurrentTurn(prev => ({ ...prev, phase: 'waiting_for_third_offer' }));
                        break;

                    case 'interaction_update':
                        setGameMessage(payload.message);
                        showToast(payload.message);
                        break;

                    case 'game_over':
                        setGameMessage(`Game Over: Player ${payload.quadPlayer} completed a Quad!`);
                        setGameOverPayload(payload);
                        break;

                    case 'error':
                        setGameMessage(payload.message);
                        showToast(`Error: ${payload.message}`);
                        break;
                }
            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        };

        ws.current.onclose = () => {
            setConnected(false);
            setGameMessage('Disconnected. Reconnecting...');
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const sendAction = useCallback((action: string, data: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ event: action, payload: data }));
        } else {
            console.log('Cannot send. WS not open:', action, data);
        }
    }, []);

    return { myHand, tableCards, gameMessage, toastMessage, gameOverPayload, currentTurn, opponents, myPlayerId, sendAction, connected };
};

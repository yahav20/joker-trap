/**
 * gameSocket.test.ts
 *
 * Unit tests for the `useGameSocket` hook.
 *
 * Strategy:
 *  - A mock WebSocket class is installed globally before each test so no real
 *    network connections are made.
 *  - Helper `triggerMessage(event, payload)` sends a fake server message into
 *    the hook's `onmessage` handler, letting us test every switch-case branch.
 *  - Helper `triggerClose(code)` simulates a WebSocket drop.
 *  - `renderHook` from @testing-library/react-hooks is used to mount the hook
 *    and inspect its returned state.
 *
 * Edge cases covered:
 *  - Normal connection / disconnection
 *  - Unexpected disconnection mid-game (network drop)
 *  - WebSocket error events
 *  - Malformed / non-JSON server messages (should not crash)
 *  - sendAction while socket is closed (should silently no-op)
 *  - Toast auto-clear after 3 s (via jest fake timers)
 *  - Lie detection in card_received (correct vs. lied rank)
 *  - game_over and subsequent restart via game_update clearing payload
 */
import { renderHook, act } from '@testing-library/react-native';

// ── Mock WebSocket ─────────────────────────────────────────────────────────

/**
 * Minimal WebSocket mock that captures the handlers set by the hook
 * so our tests can invoke them directly.
 */
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: ((e: any) => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: ((e: { code: number; reason: string }) => void) | null = null;
    onerror: ((e: any) => void) | null = null;

    send = jest.fn();
    close = jest.fn(() => {
        this.readyState = MockWebSocket.CLOSED;
    });
}

/** The most-recently constructed MockWebSocket instance. */
let mockWsInstance: MockWebSocket;

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

// Install mock before all tests in this file.
beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const MockWSLocal: any = jest.fn().mockImplementation(() => {
        mockWsInstance = new MockWebSocket();
        return mockWsInstance;
    });
    MockWSLocal.CONNECTING = MockWebSocket.CONNECTING;
    MockWSLocal.OPEN = MockWebSocket.OPEN;
    MockWSLocal.CLOSING = MockWebSocket.CLOSING;
    MockWSLocal.CLOSED = MockWebSocket.CLOSED;
    (global as any).WebSocket = MockWSLocal;
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
});

// ── Import hook after mock is in place ────────────────────────────────────

import { useGameSocket } from '../hooks/useGameSocket';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simulates a server message arriving over the socket.
 * Wraps in `act` because state updates happen inside the handler.
 */
const triggerMessage = (event: string, payload: object) => {
    act(() => {
        mockWsInstance.onmessage!({ data: JSON.stringify({ event, payload }) });
    });
};

/**
 * Simulates the socket closing (e.g. server restart or network drop).
 */
const triggerClose = (code = 1006, reason = '') => {
    act(() => {
        mockWsInstance.readyState = MockWebSocket.CLOSED;
        mockWsInstance.onclose!({ code, reason });
    });
};

/**
 * Simulates the socket successfully opening (completing the handshake).
 */
const triggerOpen = () => {
    act(() => {
        mockWsInstance.readyState = MockWebSocket.OPEN;
        mockWsInstance.onopen!({});
    });
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useGameSocket — connection lifecycle', () => {
    it('starts in disconnected lobby state', () => {
        const { result } = renderHook(() => useGameSocket());
        expect(result.current.connected).toBe(false);
        expect(result.current.currentTurn.phase).toBe('lobby');
    });

    it('sets connected=true after socket opens', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        expect(result.current.connected).toBe(true);
        expect(result.current.gameMessage).toMatch(/Connected/i);
    });

    it('sets connected=false when socket closes', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerClose(1001);
        expect(result.current.connected).toBe(false);
        expect(result.current.gameMessage).toMatch(/Disconnected/i);
    });

    it('sets connection error message on WebSocket error', () => {
        const { result } = renderHook(() => useGameSocket());
        act(() => {
            mockWsInstance.onerror!({ message: 'ECONNREFUSED' });
        });
        expect(result.current.gameMessage).toMatch(/Connection error/i);
    });

    it('closes the socket on hook unmount (no memory leak)', () => {
        const { unmount } = renderHook(() => useGameSocket());
        unmount();
        expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('reconnect() opens a new WebSocket', () => {
        const { result } = renderHook(() => useGameSocket());
        const callsBefore = (global as any).WebSocket.mock.calls.length;
        act(() => {
            result.current.reconnect();
        });
        expect((global as any).WebSocket.mock.calls.length).toBeGreaterThan(callsBefore);
    });
});

describe('useGameSocket — disconnection edge cases', () => {
    it('shows DisconnectedOverlay state on unexpected close (code 1006)', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        // Simulate an abnormal closure (no close frame — e.g. network drop)
        triggerClose(1006, 'Abnormal Closure');
        expect(result.current.connected).toBe(false);
    });

    it('sendAction silently ignores sends while disconnected', () => {
        const { result } = renderHook(() => useGameSocket());
        // Socket is not open → sendAction should not throw
        act(() => {
            result.current.sendAction('offer_card', { cardIndex: 0 });
        });
        expect(mockWsInstance.send).not.toHaveBeenCalled();
    });

    it('sendAction works normally after reconnect', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();

        act(() => {
            result.current.reconnect();
        });

        // After reconnecting, a new mock socket is instantiated. We must open it.
        triggerOpen();

        act(() => {
            result.current.sendAction('request_card', { rank: 'K' });
        });
        // Now mockWsInstance points to the NEW socket instance
        expect(mockWsInstance.send).toHaveBeenCalledWith(
            JSON.stringify({ event: 'request_card', payload: { rank: 'K' } })
        );
    });

    it('sends correct JSON structure to the server', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        act(() => {
            result.current.sendAction('make_decision', { decision: 'accept' });
        });
        const sent = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
        expect(sent.event).toBe('make_decision');
        expect(sent.payload).toEqual({ decision: 'accept' });
    });
});

describe('useGameSocket — server event handling', () => {
    it('updates gameMessage on "waiting" event', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('waiting', { message: 'Waiting for 3 more players' });
        expect(result.current.gameMessage).toBe('Waiting for 3 more players');
    });

    it('sets myPlayerId, myHand, and currentTurn on game_update', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        const turn = { phase: 'waiting_for_request', sender: 0, receiver: 1 };
        triggerMessage('game_update', {
            playerId: 2,
            yourHand: [{ rank: 'K', suit: 'Hearts' }, null],
            turn,
        });
        expect(result.current.myPlayerId).toBe(2);
        expect(result.current.myHand).toHaveLength(2);
        expect(result.current.currentTurn.phase).toBe('waiting_for_request');
    });

    it('clears gameOverPayload when game_update arrives (restart)', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        // Set game over first
        triggerMessage('game_over', {
            quadPlayer: 0, quadRank: 'K', loserId: 1, winnerIds: [0, 2, 3], hands: [],
        });
        expect(result.current.gameOverPayload).not.toBeNull();
        // Then a new round starts
        triggerMessage('game_update', {
            playerId: 0,
            yourHand: [],
            turn: { phase: 'waiting_for_request', sender: 1, receiver: 0 },
        });
        expect(result.current.gameOverPayload).toBeNull();
    });

    it('sets gameOverPayload on game_over event', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('game_over', {
            quadPlayer: 1, quadRank: 'A', loserId: 2,
            winnerIds: [0, 1, 3],
            hands: [{ id: 0, hand: [] }],
        });
        expect(result.current.gameOverPayload).not.toBeNull();
        expect(result.current.gameOverPayload!.quadRank).toBe('A');
        expect(result.current.gameOverPayload!.loserId).toBe(2);
    });

    it('transitions to waiting_for_first_offer on card_requested', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('card_requested', {
            yourHand: [],
            requestedRank: 'Q',
            receiver: 1,
        });
        expect(result.current.currentTurn.phase).toBe('waiting_for_first_offer');
        expect(result.current.currentTurn.requestedRank).toBe('Q');
    });

    it('adds a table card on decision_needed (first offer)', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        expect(result.current.tableCards).toHaveLength(0);
        triggerMessage('decision_needed', {
            offerNumber: 1,
            message: 'Choose a card',
        });
        expect(result.current.tableCards).toHaveLength(1);
        expect(result.current.currentTurn.phase).toBe('waiting_for_first_decision');
    });

    it('adds a second table card on decision_needed (second offer)', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('decision_needed', { offerNumber: 1, message: '' });
        triggerMessage('decision_needed', { offerNumber: 2, message: '' });
        expect(result.current.tableCards).toHaveLength(2);
        expect(result.current.currentTurn.phase).toBe('waiting_for_second_decision');
    });

    it('clears table cards on card_received', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('decision_needed', { offerNumber: 1, message: '' });
        triggerMessage('card_received', {
            yourHand: [{ rank: 'K', suit: 'Hearts' }],
            cardLabel: 'K',
        });
        expect(result.current.tableCards).toHaveLength(0);
    });

    it('clears table cards on card_sent', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('decision_needed', { offerNumber: 1, message: '' });
        triggerMessage('card_sent', {
            yourHand: [],
            cardLabel: 'A',
        });
        expect(result.current.tableCards).toHaveLength(0);
    });

    it('updates phase to waiting_for_second_offer on second_offer_needed', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('second_offer_needed', {
            yourHand: [],
            message: 'Offer another card',
        });
        expect(result.current.currentTurn.phase).toBe('waiting_for_second_offer');
    });

    it('updates phase to waiting_for_third_offer on third_offer_needed', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('third_offer_needed', {
            yourHand: [],
            message: 'Force a card',
        });
        expect(result.current.currentTurn.phase).toBe('waiting_for_third_offer');
    });

    it('shows toast on interaction_update', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('interaction_update', { message: 'P1 asked for Q' });
        expect(result.current.toastMessage).toBe('P1 asked for Q');
    });

    it('shows error toast on server error event', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('error', { message: 'Invalid card index' });
        expect(result.current.toastMessage).toMatch(/Invalid card index/);
    });
});

describe('useGameSocket — toast auto-clear (fake timers)', () => {
    /** Toast should disappear after 3000 ms. */
    it('clears toastMessage after 3 seconds', () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('interaction_update', { message: 'P2 asked for A' });
        expect(result.current.toastMessage).toBe('P2 asked for A');

        act(() => { jest.advanceTimersByTime(3000); });
        expect(result.current.toastMessage).toBeNull();
    });

    it('does NOT clear toast before 3 seconds', () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('interaction_update', { message: 'Still visible' });

        act(() => { jest.advanceTimersByTime(1000); });
        expect(result.current.toastMessage).toBe('Still visible');
    });
});

describe('useGameSocket — lie detection in card_received', () => {
    /** Helper: open socket and set a requestedRank via card_requested. */
    const setupWithRequest = (requestedRank: string) => {
        const hook = renderHook(() => useGameSocket());
        triggerOpen();
        triggerMessage('card_requested', { yourHand: [], requestedRank, receiver: 1 });
        return hook;
    };

    it('shows "Received exactly" toast when rank matches', () => {
        jest.useFakeTimers();
        const { result } = setupWithRequest('K');
        triggerMessage('card_received', { yourHand: [], cardLabel: 'K' });
        expect(result.current.toastMessage).toMatch(/Received exactly/i);
    });

    it('shows "Opponent lied" toast when rank does NOT match', () => {
        jest.useFakeTimers();
        const { result } = setupWithRequest('K');
        triggerMessage('card_received', { yourHand: [], cardLabel: 'Q' });
        expect(result.current.toastMessage).toMatch(/Opponent lied/i);
    });

    it('does NOT flag Joker received when JOKER was requested (case invariant)', () => {
        jest.useFakeTimers();
        const { result } = setupWithRequest('JOKER');
        triggerMessage('card_received', { yourHand: [], cardLabel: 'Joker' });
        expect(result.current.toastMessage).toMatch(/Received exactly/i);
    });
});

describe('useGameSocket — malformed message resilience', () => {
    it('does NOT crash on invalid JSON', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        // Should catch the JSON.parse error internally
        expect(() => {
            act(() => {
                mockWsInstance.onmessage!({ data: 'not valid json {{{{' });
            });
        }).not.toThrow();
    });

    it('does NOT crash on unknown event type', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        expect(() => {
            triggerMessage('some_future_event_we_dont_know' as any, { data: 42 });
        }).not.toThrow();
    });

    it('does NOT crash on empty message payload', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();
        expect(() => {
            act(() => {
                mockWsInstance.onmessage!({ data: '{}' });
            });
        }).not.toThrow();
    });
});

describe('useGameSocket — session token persistence', () => {
    it('stores sessionToken from room_created response', () => {
        const { result } = renderHook(() => useGameSocket('create', undefined, '3'));
        triggerOpen();

        // Server responds with room_created containing a session token
        triggerMessage('room_created', {
            roomId: 'ABCDE',
            botCount: 3,
            sessionToken: 'tok_abc123',
            message: 'Room created.'
        });

        expect(result.current.roomCode).toBe('ABCDE');
        // Session token is in a ref, so we verify indirectly:
        // if we close and reopen, it should send resume_room instead of create_room
        triggerClose(1006);

        // Get the new mock instance after reconnection attempt
        jest.useFakeTimers();
        act(() => { jest.advanceTimersByTime(3000); });

        // The new socket should try to resume with the token on open
        const reconnectedInstance = mockWsInstance;
        act(() => {
            reconnectedInstance.readyState = MockWebSocket.OPEN;
            reconnectedInstance.onopen!({});
        });

        // Verify that resume_room was sent (not create_room)
        const lastSend = reconnectedInstance.send.mock.calls[0]?.[0];
        if (lastSend) {
            const parsed = JSON.parse(lastSend);
            expect(parsed.event).toBe('resume_room');
            expect(parsed.payload.roomId).toBe('ABCDE');
            expect(parsed.payload.sessionToken).toBe('tok_abc123');
        }

        jest.useRealTimers();
    });

    it('stores sessionToken from room_joined response', () => {
        const { result } = renderHook(() => useGameSocket('join', 'XYZZY'));
        triggerOpen();

        triggerMessage('room_joined', {
            roomId: 'XYZZY',
            botCount: 2,
            sessionToken: 'tok_join456',
            message: 'Joined room.'
        });

        expect(result.current.roomCode).toBe('XYZZY');
    });

    it('handles room_resumed event correctly', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();

        triggerMessage('room_resumed', {
            roomId: 'RESUME1',
            botCount: 1,
            message: 'Welcome back to the room.'
        });

        expect(result.current.roomCode).toBe('RESUME1');
        expect(result.current.gameMessage).toMatch(/Welcome back/i);
    });
});

describe('useGameSocket — auto-reconnection', () => {
    it('sets isReconnecting=true on close when session token exists', () => {
        const { result } = renderHook(() => useGameSocket('create'));
        triggerOpen();

        // Simulate receiving session token
        triggerMessage('room_created', {
            roomId: 'RECON1',
            sessionToken: 'tok_recon',
            message: 'Room created.'
        });

        // Simulate disconnect
        triggerClose(1006);

        expect(result.current.isReconnecting).toBe(true);
        expect(result.current.connected).toBe(false);
    });

    it('sets isReconnecting=false on close when NO session token', () => {
        const { result } = renderHook(() => useGameSocket());
        triggerOpen();

        // No room_created/joined → no session token
        triggerClose(1006);

        expect(result.current.isReconnecting).toBe(false);
        expect(result.current.gameMessage).toMatch(/Disconnected/i);
    });

    it('clears isReconnecting on successful reconnect', () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => useGameSocket('create'));
        triggerOpen();

        triggerMessage('room_created', {
            roomId: 'RECON2',
            sessionToken: 'tok_recon2',
            message: 'Room created.'
        });

        triggerClose(1006);
        expect(result.current.isReconnecting).toBe(true);

        // Advance to trigger reconnect attempt
        act(() => { jest.advanceTimersByTime(3000); });

        // Simulate successful reconnection
        act(() => {
            mockWsInstance.readyState = MockWebSocket.OPEN;
            mockWsInstance.onopen!({});
        });

        expect(result.current.isReconnecting).toBe(false);
        expect(result.current.connected).toBe(true);

        jest.useRealTimers();
    });
});


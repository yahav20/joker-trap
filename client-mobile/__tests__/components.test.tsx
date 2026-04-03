/**
 * components.test.tsx
 *
 * UI unit tests for every Joker Trap component.
 * Tests cover:
 *  - Normal rendering with typical props
 *  - Hidden/null states (components that return null when inactive)
 *  - Edge cases: empty hands, no payload, decision phase buttons, etc.
 *  - User interaction: button presses fire the correct callbacks
 *
 * All external dependencies (expo-router, image assets) are mocked below.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ── Shared mocks ───────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
}));

jest.mock('../constants/Cards', () => ({
    getCardImage: () => ({ uri: 'card_back' }),
    BACKGROUND: { uri: 'background' },
}));

// Mock gameStyles so components that import it don't crash in test
jest.mock('../styles/gameStyles', () => ({
    styles: {
        playerLabel: {},
        modalOverlay: {},
        modalContent: {},
        modalTitle: {},
        modalSubText: {},
        actionButton: {},
        acceptBtn: {},
        rejectBtn: {},
        actionBtnText: {},
    },
    theme: {},
}));

// ImageBackground passes children through
jest.mock('react-native/Libraries/Image/ImageBackground', () => {
    const { View } = require('react-native');
    return ({ children, ...props }: any) => <View {...props}>{children}</View>;
});

// ── Helper factories ───────────────────────────────────────────────────────

/** Build a minimal game-over payload for GameOverModal tests. */
const makeGameOverPayload = (loserId: number | null = 1) => ({
    quadPlayer: 0,
    quadRank: 'K',
    loserId,
    winnerIds: [0, 2, 3],
    hands: [
        { id: 0, hand: [] },
        { id: 1, hand: [{ rank: 'Joker', suit: '' }] },
        { id: 2, hand: [] },
        { id: 3, hand: [] },
    ],
});

// ── Card ───────────────────────────────────────────────────────────────────

describe('Card component', () => {
    const { Card } = require('../components/joker-trap/Card');

    it('renders a face-down card (null card)', () => {
        const { UNSAFE_getByType } = render(<Card card={null} />);
        // Should render an Image element
        const { Image } = require('react-native');
        expect(UNSAFE_getByType(Image)).toBeTruthy();
    });

    it('renders a face-up card with rank and suit', () => {
        const { UNSAFE_getByType } = render(<Card card={{ rank: 'K', suit: 'Hearts' }} />);
        const { Image } = require('react-native');
        expect(UNSAFE_getByType(Image)).toBeTruthy();
    });

    it('calls onPress when tapped', () => {
        const onPress = jest.fn();
        const { UNSAFE_getByType } = render(<Card card={null} onPress={onPress} />);
        const { TouchableOpacity } = require('react-native');
        fireEvent.press(UNSAFE_getByType(TouchableOpacity));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onPress when disabled', () => {
        const onPress = jest.fn();
        const { UNSAFE_getByType } = render(<Card card={null} onPress={onPress} disabled />);
        const { TouchableOpacity } = require('react-native');
        fireEvent.press(UNSAFE_getByType(TouchableOpacity));
        // disabled prop prevents the callback from firing
        expect(onPress).not.toHaveBeenCalled();
    });

    it('renders without a press handler (no TouchableOpacity wrapper)', () => {
        const { UNSAFE_queryByType } = render(<Card card={null} />);
        const { TouchableOpacity } = require('react-native');
        expect(UNSAFE_queryByType(TouchableOpacity)).toBeNull();
    });
});

// ── DisconnectedOverlay ────────────────────────────────────────────────────

describe('DisconnectedOverlay component', () => {
    const { DisconnectedOverlay } = require('../components/joker-trap/DisconnectedOverlay');

    it('renders OFFLINE message', () => {
        const { getByText } = render(<DisconnectedOverlay onReturnHome={jest.fn()} />);
        expect(getByText('OFFLINE')).toBeTruthy();
    });

    it('renders the Return to Home button', () => {
        const { getByText } = render(<DisconnectedOverlay onReturnHome={jest.fn()} />);
        expect(getByText('Return to Home')).toBeTruthy();
    });

    it('calls onReturnHome when Return to Home is tapped', () => {
        const onReturnHome = jest.fn();
        const { getByText } = render(<DisconnectedOverlay onReturnHome={onReturnHome} />);
        fireEvent.press(getByText('Return to Home'));
        expect(onReturnHome).toHaveBeenCalledTimes(1);
    });

    it('shows RECONNECTING message when isReconnecting=true', () => {
        const { getByText } = render(<DisconnectedOverlay onReturnHome={jest.fn()} isReconnecting />);
        expect(getByText('RECONNECTING')).toBeTruthy();
    });

    it('shows "Cancel & Leave" button when isReconnecting=true', () => {
        const { getByText } = render(<DisconnectedOverlay onReturnHome={jest.fn()} isReconnecting />);
        expect(getByText('Cancel & Leave')).toBeTruthy();
    });
});

// ── Lobby ──────────────────────────────────────────────────────────────────

describe('Lobby component', () => {
    const { Lobby } = require('../components/joker-trap/Lobby');

    it('shows spinner and "Connecting" when not connected', () => {
        const { getByText } = render(<Lobby connected={false} gameMessage="Fetching status..." />);
        expect(getByText('Connecting to server...')).toBeTruthy();
        expect(getByText('Fetching status...')).toBeTruthy();
    });

    it('shows "Waiting for players" when connected', () => {
        const { getByText } = render(<Lobby connected gameMessage="Lobby" />);
        expect(getByText(/Waiting for players/i)).toBeTruthy();
    });

    it('renders the server game message as sub-text', () => {
        const { getByText } = render(<Lobby connected gameMessage="2 players joined" />);
        expect(getByText('2 players joined')).toBeTruthy();
    });

    it('renders the game title', () => {
        const { getByText } = render(<Lobby connected gameMessage="" />);
        expect(getByText('Joker Trap')).toBeTruthy();
    });

    it('does NOT show ActivityIndicator when connected', () => {
        const { UNSAFE_queryByType } = render(<Lobby connected gameMessage="" />);
        const { ActivityIndicator } = require('react-native');
        expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    });

    it('shows ActivityIndicator when not connected', () => {
        const { UNSAFE_getByType } = render(<Lobby connected={false} gameMessage="" />);
        const { ActivityIndicator } = require('react-native');
        expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
});

// ── RequestModal ───────────────────────────────────────────────────────────

describe('RequestModal component', () => {
    const { RequestModal } = require('../components/joker-trap/RequestModal');

    it('renders nothing when visible=false', () => {
        const { queryByText } = render(
            <RequestModal visible={false} senderId={1} onSelectRank={jest.fn()} />
        );
        expect(queryByText('Request a Card')).toBeNull();
    });

    it('renders the modal title when visible=true', () => {
        const { getByText } = render(
            <RequestModal visible senderId={1} onSelectRank={jest.fn()} />
        );
        expect(getByText('Request a Card')).toBeTruthy();
    });

    it('shows all four rank buttons: J, Q, K, A', () => {
        const { getByText } = render(
            <RequestModal visible senderId={2} onSelectRank={jest.fn()} />
        );
        ['J', 'Q', 'K', 'A'].forEach(rank => {
            expect(getByText(rank)).toBeTruthy();
        });
    });

    it('calls onSelectRank with the correct rank when a button is tapped', () => {
        const onSelectRank = jest.fn();
        const { getByText } = render(
            <RequestModal visible senderId={2} onSelectRank={onSelectRank} />
        );
        fireEvent.press(getByText('K'));
        expect(onSelectRank).toHaveBeenCalledWith('K');
    });

    it('shows the sender player ID in the subtitle', () => {
        const { getByText } = render(
            <RequestModal visible senderId={3} onSelectRank={jest.fn()} />
        );
        expect(getByText(/P3/)).toBeTruthy();
    });

    /** Edge case: senderId is null (race condition before game updates arrive) */
    it('renders gracefully when senderId is null', () => {
        const { getByText } = render(
            <RequestModal visible senderId={null} onSelectRank={jest.fn()} />
        );
        expect(getByText('Request a Card')).toBeTruthy();
    });
});

// ── GameOverModal ──────────────────────────────────────────────────────────

describe('GameOverModal component', () => {
    const { GameOverModal } = require('../components/joker-trap/GameOverModal');

    it('renders nothing when payload is null', () => {
        const { queryByText } = render(
            <GameOverModal payload={null} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(queryByText(/YOU WIN|YOU LOSE/i)).toBeNull();
    });

    it('shows YOU WIN when this player won', () => {
        const { getByText } = render(
            <GameOverModal payload={makeGameOverPayload(1)} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(getByText(/YOU WIN/i)).toBeTruthy();
    });

    it('shows YOU LOSE when this player is the loser', () => {
        const { getByText } = render(
            <GameOverModal payload={makeGameOverPayload(0)} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(getByText(/YOU LOSE/i)).toBeTruthy();
    });

    it('shows the Quad player summary', () => {
        const { getByText } = render(
            <GameOverModal payload={makeGameOverPayload(1)} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(getByText(/Player 0/)).toBeTruthy();
        expect(getByText(/"K"/)).toBeTruthy();
    });

    it('shows the Joker loser line when loserId is set', () => {
        const { getByText } = render(
            <GameOverModal payload={makeGameOverPayload(1)} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(getByText(/Player 1/)).toBeTruthy();
        expect(getByText(/Joker/)).toBeTruthy();
    });

    it('does NOT show Joker line when loserId is null', () => {
        const { queryByText } = render(
            <GameOverModal payload={makeGameOverPayload(null)} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(queryByText(/Joker/i)).toBeNull();
    });

    it('calls onRestart when Restart button is pressed', () => {
        const onRestart = jest.fn();
        const { getByLabelText } = render(
            <GameOverModal payload={makeGameOverPayload(1)} myPlayerId={0} onRestart={onRestart} />
        );
        fireEvent.press(getByLabelText('Restart'));
        expect(onRestart).toHaveBeenCalledTimes(1);
    });

    it('navigates home when Home button is pressed', () => {
        const mockReplace = jest.fn();
        jest.spyOn(require('expo-router'), 'useRouter').mockReturnValueOnce({
            push: jest.fn(),
            replace: mockReplace,
            back: jest.fn(),
        });
        const { GameOverModal: GM } = require('../components/joker-trap/GameOverModal');
        const { getByLabelText } = render(
            <GM payload={makeGameOverPayload(1)} myPlayerId={0} onRestart={jest.fn()} />
        );
        fireEvent.press(getByLabelText('Home'));
        expect(mockReplace).toHaveBeenCalledWith('/');
    });

    /** Edge case: a player with an empty hand (already discarded their quad) */
    it('renders "Empty" label for players with no cards in final hands', () => {
        const { getAllByText } = render(
            <GameOverModal payload={makeGameOverPayload(1)} myPlayerId={0} onRestart={jest.fn()} />
        );
        // Three of the four players have empty hands in the mock payload
        expect(getAllByText('Empty').length).toBeGreaterThanOrEqual(1);
    });
});

// ── PlayerZone ─────────────────────────────────────────────────────────────

describe('PlayerZone component', () => {
    const { PlayerZone } = require('../components/joker-trap/PlayerZone');

    it('renders the player label', () => {
        const { getByText } = render(
            <PlayerZone playerId={2} hand={[null, null]} />
        );
        expect(getByText('P3')).toBeTruthy();
    });

    it('renders "Empty" when hand is empty', () => {
        const { getByText } = render(
            <PlayerZone playerId={1} hand={[]} />
        );
        expect(getByText(/Empty/i)).toBeTruthy();
    });

    it('renders the correct number of cards', () => {
        const { UNSAFE_getAllByType } = render(
            <PlayerZone playerId={0} hand={[null, null, null]} />
        );
        const { Image } = require('react-native');
        expect(UNSAFE_getAllByType(Image).length).toBe(3);
    });

    it('renders vertical layout without crashing', () => {
        const { getByText } = render(
            <PlayerZone playerId={3} hand={[null, null]} vertical />
        );
        expect(getByText('P4')).toBeTruthy();
    });
});

// ── TableArea ──────────────────────────────────────────────────────────────

describe('TableArea component', () => {
    const { TableArea } = require('../components/joker-trap/TableArea');

    const baseTurn = { phase: 'idle', sender: 0, receiver: 1 };

    it('shows the game message', () => {
        const { getByText } = render(
            <TableArea
                tableCards={[]}
                gameMessage="Waiting for action"
                currentTurn={baseTurn}
                isDecisionPhase={false}
                gameOver={false}
                onTableCardPress={jest.fn()}
                onDecision={jest.fn()}
            />
        );
        expect(getByText('Waiting for action')).toBeTruthy();
    });

    it('renders face-down table cards', () => {
        const { UNSAFE_getAllByType } = render(
            <TableArea
                tableCards={[null, null]}
                gameMessage=""
                currentTurn={baseTurn}
                isDecisionPhase={false}
                gameOver={false}
                onTableCardPress={jest.fn()}
                onDecision={jest.fn()}
            />
        );
        const { TouchableOpacity } = require('react-native');
        // Two table cards = two touchable wrappers
        expect(UNSAFE_getAllByType(TouchableOpacity).length).toBeGreaterThanOrEqual(2);
    });

    it('shows "Ask Another" button during first decision phase', () => {
        const { getByText } = render(
            <TableArea
                tableCards={[null]}
                gameMessage=""
                currentTurn={{ ...baseTurn, phase: 'waiting_for_first_decision' }}
                isDecisionPhase={true}
                gameOver={false}
                onTableCardPress={jest.fn()}
                onDecision={jest.fn()}
            />
        );
        expect(getByText('Ask Another')).toBeTruthy();
    });

    it('shows "Force 3rd" button during second decision phase', () => {
        const { getByText } = render(
            <TableArea
                tableCards={[null, null]}
                gameMessage=""
                currentTurn={{ ...baseTurn, phase: 'waiting_for_second_decision' }}
                isDecisionPhase={true}
                gameOver={false}
                onTableCardPress={jest.fn()}
                onDecision={jest.fn()}
            />
        );
        expect(getByText('Force 3rd')).toBeTruthy();
    });

    it('hides decision buttons when gameOver=true', () => {
        const { queryByText } = render(
            <TableArea
                tableCards={[null]}
                gameMessage=""
                currentTurn={{ ...baseTurn, phase: 'waiting_for_first_decision' }}
                isDecisionPhase={true}
                gameOver={true}
                onTableCardPress={jest.fn()}
                onDecision={jest.fn()}
            />
        );
        expect(queryByText('Ask Another')).toBeNull();
    });

    it('calls onDecision with "reject" when Ask Another is pressed', () => {
        const onDecision = jest.fn();
        const { getByText } = render(
            <TableArea
                tableCards={[null]}
                gameMessage=""
                currentTurn={{ ...baseTurn, phase: 'waiting_for_first_decision' }}
                isDecisionPhase={true}
                gameOver={false}
                onTableCardPress={jest.fn()}
                onDecision={onDecision}
            />
        );
        fireEvent.press(getByText('Ask Another'));
        expect(onDecision).toHaveBeenCalledWith('reject');
    });

    it('calls onDecision with "force_third" when Force 3rd is pressed', () => {
        const onDecision = jest.fn();
        const { getByText } = render(
            <TableArea
                tableCards={[null, null]}
                gameMessage=""
                currentTurn={{ ...baseTurn, phase: 'waiting_for_second_decision' }}
                isDecisionPhase={true}
                gameOver={false}
                onTableCardPress={jest.fn()}
                onDecision={onDecision}
            />
        );
        fireEvent.press(getByText('Force 3rd'));
        expect(onDecision).toHaveBeenCalledWith('force_third');
    });

    it('calls onTableCardPress with the card index when a table card is tapped', () => {
        const onTableCardPress = jest.fn();
        const { UNSAFE_getAllByType } = render(
            <TableArea
                tableCards={[null, null]}
                gameMessage=""
                currentTurn={baseTurn}
                isDecisionPhase={false}
                gameOver={false}
                onTableCardPress={onTableCardPress}
                onDecision={jest.fn()}
            />
        );
        const { TouchableOpacity } = require('react-native');
        const cards = UNSAFE_getAllByType(TouchableOpacity);
        fireEvent.press(cards[0]);
        expect(onTableCardPress).toHaveBeenCalledWith(0);
    });
});

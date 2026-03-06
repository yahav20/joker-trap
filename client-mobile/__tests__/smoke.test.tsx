/**
 * smoke.test.tsx
 *
 * High-level smoke tests that verify key components render correctly.
 * Tests for app-level screens (index.tsx, game.tsx) are intentionally omitted
 * here because those screens import Expo internals that are out of scope for
 * the Jest transform pipeline (they rely on import.meta / Expo's module graph).
 * Those screens are tested indirectly through the component-level tests in
 * components.test.tsx.
 *
 * These tests act as a CI "green light" — if they fail something fundamental
 * is broken in the test environment or shared mocks.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';

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
    CardData: null,
}));

jest.mock('../styles/gameStyles', () => ({
    styles: {},
    theme: {},
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Smoke Tests', () => {
    /**
     * Verifies that React + @testing-library/react-native are wired up
     * correctly and basic rendering works.
     */
    it('renders a minimal React Native component', () => {
        const { getByText } = render(
            <View>
                <Text>Joker Trap Test</Text>
            </View>
        );
        expect(getByText('Joker Trap Test')).toBeTruthy();
    });

    /**
     * RequestModal must be hidden when visible=false.
     */
    it('RequestModal does not render when visible=false', () => {
        const { RequestModal } = require('../components/joker-trap/RequestModal');
        const { queryByText } = render(
            <RequestModal visible={false} senderId={1} onSelectRank={jest.fn()} />
        );
        expect(queryByText('Request a Card')).toBeNull();
    });

    /**
     * RequestModal renders all rank buttons when visible=true.
     */
    it('RequestModal shows rank buttons when visible=true', () => {
        const { RequestModal } = require('../components/joker-trap/RequestModal');
        const { getByText } = render(
            <RequestModal visible senderId={1} onSelectRank={jest.fn()} />
        );
        ['J', 'Q', 'K', 'A'].forEach(r => expect(getByText(r)).toBeTruthy());
    });

    /**
     * DisconnectedOverlay renders the reconnect button.
     */
    it('DisconnectedOverlay renders and calls onReconnect', () => {
        const { DisconnectedOverlay } = require('../components/joker-trap/DisconnectedOverlay');
        const onReconnect = jest.fn();
        const { getByText } = render(<DisconnectedOverlay onReconnect={onReconnect} />);
        fireEvent.press(getByText('Reconnect Now'));
        expect(onReconnect).toHaveBeenCalledTimes(1);
    });

    /**
     * GameOverModal returns null when payload is null.
     */
    it('GameOverModal renders nothing when payload is null', () => {
        const { GameOverModal } = require('../components/joker-trap/GameOverModal');
        const { queryByText } = render(
            <GameOverModal payload={null} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(queryByText(/YOU WIN|YOU LOSE/i)).toBeNull();
    });

    /**
     * GameOverModal shows win headline for the winner.
     */
    it('GameOverModal shows YOU WIN for the winning player', () => {
        const { GameOverModal } = require('../components/joker-trap/GameOverModal');
        const payload = {
            quadPlayer: 0, quadRank: 'K', loserId: 1, winnerIds: [0],
            hands: [{ id: 0, hand: [] }, { id: 1, hand: [] }],
        };
        const { getByText } = render(
            <GameOverModal payload={payload} myPlayerId={0} onRestart={jest.fn()} />
        );
        expect(getByText(/YOU WIN/i)).toBeTruthy();
    });
});

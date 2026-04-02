import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { CardData } from '../../constants/Cards';
import { styles as gameStyles } from '../../styles/gameStyles';
import { AVATARS } from '../../constants/avatars';
import { Image } from 'react-native';

/**
 * Props for the PlayerZone component.
 */
interface PlayerZoneProps {
    /** Seat ID of the player this zone belongs to. `null` while the game hasn't assigned IDs. */
    /** Seat ID of the player this zone belongs to. `null` while the game hasn't assigned IDs. */
    playerId: number | null;
    /** The player's display name */
    playerName?: string;
    /** The player's avatar icon identifier */
    avatar?: string;
    /**
     * The player's hand to render.
     * Each element is a `CardData` value; opponents always receive `null` (face-down) cards.
     */
    hand: CardData[];
    /** @internal Kept for API compatibility; currently all non-self players are rendered as opponents. */
    isOpponent?: boolean;
    /**
     * CSS `rotate()` value applied to every card image in horizontal mode.
     * Use `'180deg'` for the top opponent to flip their cards upside-down.
     */
    rotation?: string;
    /** When true, renders the zone with a blue highlight (this player is the active sender). */
    isActive?: boolean;
    /** When true, renders the zone with an orange highlight (this player is the active receiver). */
    isReceiver?: boolean;
    /**
     * When true, cards are stacked vertically (column) — used for side opponents (left/right).
     * When false (default), cards are laid out in a horizontal row with optional rotation.
     */
    vertical?: boolean;
}

/**
 * Renders a player's hand inside a themed container.
 *
 * Layout modes:
 *  - **Horizontal** (default, `vertical={false}`): cards are placed side-by-side with
 *    optional CSS rotation (e.g. 180° for the top opponent). Used for top opponent.
 *  - **Vertical** (`vertical={true}`): cards are stacked top-to-bottom with the player
 *    label floating as an absolute overlay above the first card. Used for left/right opponents.
 *
 * Highlight colours:
 *  - Blue border → this player is the current sender (offering cards).
 *  - Orange border → this player is the current receiver (choosing a card).
 */
export const PlayerZone: React.FC<PlayerZoneProps> = ({
    playerId,
    playerName,
    avatar,
    hand,
    isOpponent = true,
    rotation = '0deg',
    isActive,
    isReceiver,
    vertical = false,
}) => {
    const labelString = playerName ? `${playerName} (P${playerId})` : `P${playerId}`;
    // Determine the highlight border/background based on turn role.
    const highlightStyle = isActive
        ? { borderColor: '#4da6ff', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(77,166,255,0.2)' }
        : isReceiver
            ? { borderColor: '#ff6b4a', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(255,107,74,0.2)' }
            : {};

    // Opponents' cards are rendered slightly smaller than the local player's cards.
    const cardW = isOpponent ? 45 : 60;
    const cardH = isOpponent ? 68 : 90;

    return (
        <View style={[highlightStyle, styles.wrapper]}>
            {!vertical && (
                <View style={styles.horizontalLabelRow}>
                    {avatar && AVATARS[avatar] && <Image source={AVATARS[avatar]} style={styles.avatarIcon} />}
                    <Text style={gameStyles.playerLabel}>{labelString}</Text>
                </View>
            )}

            {vertical ? (
                // Portrait stack (column) – label floats over the top card
                <View style={styles.columnWrapper}>
                    <View style={styles.columnStack}>
                        {hand.map((card, i) => (
                            <Card
                                key={`${playerId}-${i}`}
                                card={card}
                                style={{
                                    width: cardW,
                                    height: cardH,
                                    marginTop: i === 0 ? 0 : -cardH * 0.45,
                                }}
                            />
                        ))}
                        {hand.length === 0 && <Text style={styles.emptyText}>Empty</Text>}
                    </View>
                    {/* Floating label moved above the card instead of overlapping */}
                    <View style={styles.verticalLabelBox}>
                        {avatar && AVATARS[avatar] && <Image source={AVATARS[avatar]} style={styles.avatarIconVertical} />}
                        <Text style={styles.floatingLabel}>{labelString}</Text>
                    </View>
                </View>
            ) : (
                // Horizontal row (with optional rotation) – used for top opponent
                <View style={styles.rowStack}>
                    {hand.map((card, i) => (
                        <Card
                            key={`${playerId}-${i}`}
                            card={card}
                            style={{
                                transform: [{ rotate: rotation }],
                                width: cardW,
                                height: cardH,
                                marginHorizontal: -12,
                            }}
                        />
                    ))}
                    {hand.length === 0 && <Text style={styles.emptyText}>Empty</Text>}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        padding: 6,
        alignItems: 'center',
    },
    columnWrapper: {
        position: 'relative',
        alignItems: 'center',
    },
    columnStack: {
        alignItems: 'center',
    },
    verticalLabelBox: {
        alignItems: 'center',
        marginBottom: 8,
        zIndex: 10,
    },
    floatingLabel: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        overflow: 'hidden',
    },
    rowStack: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#aaa',
        fontStyle: 'italic',
        fontSize: 12,
    },
    horizontalLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    avatarIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#fff'
    },
    avatarIconVertical: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#fff',
        marginBottom: 4
    }
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { CardData } from '../../constants/Cards';
import { styles as gameStyles } from '../../styles/gameStyles';

interface PlayerZoneProps {
    playerId: number | null;
    hand: CardData[];
    isOpponent?: boolean;
    rotation?: string;
    isActive?: boolean;
    isReceiver?: boolean;
    /** If true, cards are stacked in a column (portrait, no rotation) for side players */
    vertical?: boolean;
}

/**
 * Renders a player's hand and label inside a themed container
 */
export const PlayerZone: React.FC<PlayerZoneProps> = ({
    playerId,
    hand,
    isOpponent = true,
    rotation = '0deg',
    isActive,
    isReceiver,
    vertical = false,
}) => {
    const highlightStyle = isActive
        ? { borderColor: '#4da6ff', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(77,166,255,0.2)' }
        : isReceiver
            ? { borderColor: '#ff6b4a', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(255,107,74,0.2)' }
            : {};

    const cardW = isOpponent ? 45 : 60;
    const cardH = isOpponent ? 68 : 90;

    return (
        <View style={[highlightStyle, styles.wrapper]}>
            {!vertical && <Text style={gameStyles.playerLabel}>P{playerId}</Text>}

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
                    {/* Floating label over the top edge of the first card */}
                    <View style={styles.floatingLabelBox}>
                        <Text style={styles.floatingLabel}>P{playerId}</Text>
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
    floatingLabelBox: {
        position: 'absolute',
        top: 4,
        left: 0,
        right: 0,
        alignItems: 'center',
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
});

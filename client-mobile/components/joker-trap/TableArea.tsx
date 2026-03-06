import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from './Card';
import { styles as gameStyles, theme } from '../../styles/gameStyles';

/**
 * Props for the TableArea component.
 */
interface TableAreaProps {
    /** Array of face-down table cards. Each element is `null`; we only track quantity. */
    tableCards: any[];
    /** Global status message string displayed to all players. */
    gameMessage: string;
    /** Active turn object from `useGameSocket` (phase, sender, receiver). */
    currentTurn: any;
    /** True if the local player is the receiver and must choose accept/reject. */
    isDecisionPhase: boolean;
    /** Hides decision buttons while the game-over modal is active. */
    gameOver: boolean;
    /** Called when the player taps a face-down table card (implicitly accepts it). */
    onTableCardPress: (index: number) => void;
    /** Called when the player taps an inline decision button ('reject'|'force_third'). */
    onDecision: (decision: string) => void;
}

/**
 * The central game board area.
 *
 * Renders three layers of content:
 *  1. **Table cards** — face-down cards placed by the sender, displayed in a row.
 *     Tapping a card triggers `onTableCardPress(index)` which the parent maps to an
 *     accept decision.
 *  2. **Inline decision buttons** — shown only to the receiver during decision phases:
 *       - `waiting_for_first_decision`: an "Ask Another" button (reject offer 1).
 *       - `waiting_for_second_decision`: a "Force 3rd" button (force the sender's 3rd card).
 *  3. **Message box** — an always-visible status area with the latest `gameMessage`
 *     and turn info (sender/receiver IDs). Rendered with `pointerEvents="none"`
 *     so it never blocks taps on the cards beneath it.
 */
export const TableArea: React.FC<TableAreaProps> = ({
    tableCards,
    gameMessage,
    currentTurn,
    isDecisionPhase,
    gameOver,
    onTableCardPress,
    onDecision
}) => {
    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Table Cards */}
            <View style={styles.cardsRowCenter}>
                {tableCards.map((_, i) => (
                    <TouchableOpacity
                        key={`table-${i}`}
                        onPress={() => onTableCardPress(i)}
                        activeOpacity={0.8}
                        style={{ zIndex: i }}
                    >
                        <Card
                            card={null} // Table cards are face-down
                            style={{
                                width: 55,
                                height: 80,
                                transform: [{ rotate: i % 2 === 0 ? '-5deg' : '5deg' }]
                            }}
                        />
                    </TouchableOpacity>
                ))}

                {/* Inline Action Buttons for Receiver */}
                {!gameOver && isDecisionPhase && (
                    <View style={styles.inlineActions}>
                        {currentTurn.phase === 'waiting_for_first_decision' && (
                            <TouchableOpacity
                                style={[gameStyles.actionButton, gameStyles.rejectBtn]}
                                onPress={() => onDecision('reject')}
                            >
                                <Text style={gameStyles.actionBtnText}>Ask Another</Text>
                            </TouchableOpacity>
                        )}
                        {currentTurn.phase === 'waiting_for_second_decision' && (
                            <TouchableOpacity
                                style={[gameStyles.actionButton, styles.forceBtn]}
                                onPress={() => onDecision('force_third')}
                            >
                                <Text style={gameStyles.actionBtnText}>Force 3rd</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Global Message Box */}
            <View pointerEvents="none" style={styles.messageContainer}>
                <View style={styles.messageBox}>
                    <Text style={styles.messageText}>{gameMessage}</Text>
                    <Text style={styles.turnInfoText}>
                        Sender: P{currentTurn.sender} | Receiver: P{currentTurn.receiver}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    cardsRowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
    },
    inlineActions: {
        marginLeft: 20,
    },
    forceBtn: {
        backgroundColor: '#6c757d',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
    },
    messageContainer: {
        position: 'absolute',
        top: '35%',  // Centered vertically in the table zone
        alignSelf: 'center',
    },
    messageBox: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 10,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 200,
    },
    messageText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    turnInfoText: {
        color: '#ccc',
        fontSize: 12,
        marginTop: 4,
    }
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { styles as gameStyles, theme } from '../../styles/gameStyles';

/**
 * Props for the TableArea component.
 */
interface TableAreaProps {
    tableCards: any[];
    gameMessage: string;
    currentTurn: any;
    isDecisionPhase: boolean;
    gameOver: boolean;
    onTableCardPress: (index: number) => void;
    onDecision: (decision: string) => void;
    myPlayerId?: number | null;
}

export const TableArea: React.FC<TableAreaProps> = ({
    tableCards,
    gameMessage,
    currentTurn,
    isDecisionPhase,
    gameOver,
    onTableCardPress,
    onDecision,
    myPlayerId = null
}) => {
    const getDynamicStyle = () => {
        if (myPlayerId === null || currentTurn.sender === -1 || currentTurn.receiver === -1 || currentTurn.phase === 'lobby') {
            return {};
        }

        const s = currentTurn.sender;
        const r = currentTurn.receiver;

        const B = myPlayerId;
        const L = (myPlayerId + 1) % 4;
        const T = (myPlayerId + 2) % 4;
        const R = (myPlayerId + 3) % 4;

        // Fixed positions: On the "left side" of the player who offers, angled diagonally.
        // Extremely simple, robust, no receiver logic.
        if (s === B) {
            return { bottom: '35%', left: '25%', transform: [{ rotate: '-30deg' }] } as any;
        }
        if (s === T) {
            return { top: '35%', right: '25%', transform: [{ rotate: '150deg' }] } as any;
        }
        if (s === L) {
            return { bottom: '35%', left: '15%', transform: [{ rotate: '60deg' }] } as any;
        }
        if (s === R) {
            return { top: '35%', right: '15%', transform: [{ rotate: '-120deg' }] } as any;
        }

        return {};
    };

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Global Message Box */}
            <View pointerEvents="none" style={styles.messageContainer}>
                <View style={styles.messageBox}>
                    <Text style={styles.messageText}>{gameMessage}</Text>
                    <Text style={styles.turnInfoText}>
                        Sender: P{currentTurn.sender + 1} | Receiver: P{currentTurn.receiver + 1}
                    </Text>
                </View>
            </View>

            {/* Table Cards */}
            <View style={[styles.cardsRowCenter, getDynamicStyle()]}>
                {tableCards.map((_, i) => (
                    <TouchableOpacity
                        key={`table-${i}`}
                        onPress={() => onTableCardPress(i)}
                        activeOpacity={0.8}
                        style={{ zIndex: i }}
                    >
                        <Image
                            source={i === 0 ? require('../../Resources/Card_Back_1.png') : require('../../Resources/Card_Back_2.png')}
                            style={{
                                width: 55,
                                height: 80,
                                resizeMode: 'contain',
                                borderRadius: 8,
                                transform: [{ rotate: i % 2 === 0 ? '-5deg' : '5deg' }]
                            }}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Inline Action Buttons for Receiver */}
            {!gameOver && isDecisionPhase && (
                <View style={styles.decisionContainer}>
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
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        flexDirection: 'row',
        direction: 'ltr', // explicitly force LTR visual ordering for the tilted cards
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
    },
    decisionContainer: {
        position: 'absolute',
        top: '40%', // Renders purely in the center area, completely unrotated!
        alignSelf: 'center',
        flexDirection: 'row',
        direction: 'ltr',
        zIndex: 10,
    },
    forceBtn: {
        backgroundColor: '#6c757d',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
    },
    messageContainer: {
        position: 'absolute',
        top: '32%',
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

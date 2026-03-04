import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Card } from './Card';
import { styles as gameStyles, theme } from '../../styles/gameStyles';

interface GameOverModalProps {
    payload: any;
    myPlayerId: number | null;
    onRestart: () => void;
}

/**
 * Display final results, hands, and winner/loser info
 */
export const GameOverModal: React.FC<GameOverModalProps> = ({ payload, myPlayerId, onRestart }) => {
    if (!payload) return null;

    const isMyLoss = payload.loserId === myPlayerId;

    return (
        <View style={gameStyles.modalOverlay}>
            <View style={[gameStyles.modalContent, styles.fullWidth]}>
                <View style={styles.header}>
                    <Text style={[
                        gameStyles.modalTitle,
                        { color: isMyLoss ? theme.colors.danger : '#FFD700', marginBottom: 0 }
                    ]}>
                        {isMyLoss ? "YOU LOSE!" : "YOU WIN!"}
                    </Text>
                    <TouchableOpacity
                        style={[gameStyles.actionButton, gameStyles.acceptBtn]}
                        onPress={onRestart}
                    >
                        <Text style={gameStyles.actionBtnText}>Restart Game</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.subText}>
                    Player {payload.quadPlayer} completed a Quad of "{payload.quadRank}"
                </Text>

                {payload.loserId !== null && (
                    <Text style={styles.loserText}>
                        Player {payload.loserId} got stuck with the Joker!
                    </Text>
                )}

                <ScrollView contentContainerStyle={styles.handsGrid} horizontal={false}>
                    <View style={styles.handsContainer}>
                        {payload.hands.map((p: any) => {
                            const isWinner = p.id === payload.quadPlayer;
                            const isLoser = p.id === payload.loserId;
                            return (
                                <View
                                    key={`final-${p.id}`}
                                    style={[
                                        styles.playerResult,
                                        isWinner && styles.winnerResult,
                                        isLoser && styles.loserResult
                                    ]}
                                >
                                    <Text style={[
                                        styles.playerName,
                                        { color: p.id === myPlayerId ? '#4da6ff' : 'white' }
                                    ]}>
                                        {p.id === myPlayerId ? 'You (P' + p.id + ')' : 'P' + p.id} {isWinner ? '🏆' : isLoser ? '💀' : ''}
                                    </Text>
                                    <View style={styles.finalHand}>
                                        {p.hand.length === 0 && (
                                            <Text style={styles.emptyText}>Empty</Text>
                                        )}
                                        {p.hand.map((c: any, i: number) => (
                                            <Card
                                                key={`fc-${p.id}-${i}`}
                                                card={c}
                                                style={styles.finalCard}
                                                containerStyle={{ marginHorizontal: -10 }}
                                            />
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    fullWidth: {
        width: '95%',
        maxWidth: 800,
        maxHeight: '95%',
        padding: 15,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
    },
    subText: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 5,
        textAlign: 'center',
    },
    loserText: {
        color: '#ff6b4a',
        fontWeight: 'bold',
        marginBottom: 10,
        fontSize: 14,
        textAlign: 'center',
    },
    handsGrid: {
        width: '100%',
    },
    handsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        width: '100%',
    },
    playerResult: {
        alignItems: 'center',
        margin: 5,
        padding: 10,
        borderRadius: 10,
        width: '45%',
    },
    winnerResult: {
        backgroundColor: 'rgba(40,167,69,0.2)',
        borderWidth: 2,
        borderColor: '#28a745',
    },
    loserResult: {
        backgroundColor: 'rgba(220,53,69,0.2)',
        borderWidth: 2,
        borderColor: '#dc3545',
    },
    playerName: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    finalHand: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    finalCard: {
        width: 45,
        height: 68,
    },
    emptyText: {
        color: '#aaa',
        fontStyle: 'italic',
    }
});

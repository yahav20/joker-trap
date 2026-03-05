import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './Card';
import { theme } from '../../styles/gameStyles';

/**
 * Props for the GameOverModal component.
 */
interface GameOverModalProps {
    /**
     * The game-over payload received from the server.
     * When `null`, the modal renders nothing (hidden state).
     */
    payload: any;
    /** The local player's seat ID — used to personalise win/loss messaging. */
    myPlayerId: number | null;
    /** Called when the player taps "Restart" — should send a `restart_game` action. */
    onRestart: () => void;
}

/**
 * Full-screen modal displayed at the end of every round.
 *
 * Shows:
 *  1. A win/loss headline personalised to the local player.
 *  2. A summary line identifying the player who completed the Quad.
 *  3. The Joker line identifying who was stuck with the Joker (the loser).
 *  4. A scrollable grid of every player's final hand with winner/loser highlights.
 *  5. Action buttons to navigate Home or trigger a restart.
 *
 * The modal is rendered unconditionally by `game.tsx`; it returns null internally
 * when `payload` is null so there is no extra wrapper logic needed in the parent.
 */
export const GameOverModal: React.FC<GameOverModalProps> = ({ payload, myPlayerId, onRestart }) => {
    // Nothing to show until the server sends a game_over event.
    if (!payload) return null;
    const router = useRouter();
    // Determine the local player's outcome to choose the correct headline.
    const isMyLoss = payload.loserId === myPlayerId;

    return (
        <View style={styles.overlay}>
            <View style={styles.panel}>

                {/* ── Title Row ── */}
                <View style={styles.titleRow}>
                    <Text style={[styles.resultTitle, { color: isMyLoss ? '#ff4d4d' : '#FFD700' }]}>
                        {isMyLoss ? '💀 YOU LOSE!' : '🏆 YOU WIN!'}
                    </Text>
                </View>

                {/* ── Summary ── */}
                <Text style={styles.summary}>
                    Player {payload.quadPlayer} completed a Quad of "{payload.quadRank}"
                </Text>
                {payload.loserId !== null && (
                    <Text style={styles.jokerLine}>
                        ☠️  Player {payload.loserId} got stuck with the Joker!
                    </Text>
                )}

                {/* ── Player Hands Grid ── */}
                <ScrollView contentContainerStyle={styles.handsGrid}>
                    {payload.hands.map((p: any) => {
                        const isWinner = p.id === payload.quadPlayer;
                        const isLoser = p.id === payload.loserId;
                        const isMe = p.id === myPlayerId;
                        return (
                            <View
                                key={`final-${p.id}`}
                                style={[
                                    styles.playerCard,
                                    isWinner && styles.winnerCard,
                                    isLoser && styles.loserCard,
                                ]}
                            >
                                <Text style={[styles.playerName, isMe && { color: '#4da6ff' }]}>
                                    {isMe ? `You (P${p.id})` : `P${p.id}`}
                                    {isWinner ? '  🏆' : isLoser ? '  💀' : ''}
                                </Text>
                                <View style={styles.handRow}>
                                    {p.hand.length === 0
                                        ? <Text style={styles.emptyLabel}>Empty</Text>
                                        : p.hand.map((c: any, i: number) => (
                                            <Card
                                                key={`fc-${p.id}-${i}`}
                                                card={c}
                                                style={styles.handCard}
                                                containerStyle={{ marginHorizontal: -8 }}
                                            />
                                        ))
                                    }
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>

                {/* ── Action Row: Home ←  → Restart ── */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.btn, styles.homeBtn]} onPress={() => router.replace('/')}>
                        <Text style={styles.btnText}>🏠</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.restartBtn]} onPress={onRestart}>
                        <Text style={styles.btnText}>↺</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: 12,
    },
    panel: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 18,
        width: '98%',
        maxWidth: 820,
        maxHeight: '96%',
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 16,
    },

    // Title
    titleRow: {
        alignItems: 'center',
        marginBottom: 6,
    },
    resultTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 1,
    },

    // Summary
    summary: {
        color: '#ddd',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 4,
    },
    jokerLine: {
        color: '#ff6b4a',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
    },

    // Hands Grid
    handsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        paddingVertical: 8,
    },
    playerCard: {
        alignItems: 'center',
        margin: 6,
        padding: 10,
        borderRadius: 14,
        width: '45%',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    winnerCard: {
        backgroundColor: 'rgba(40,167,69,0.18)',
        borderColor: '#28a745',
        borderWidth: 2,
    },
    loserCard: {
        backgroundColor: 'rgba(220,53,69,0.18)',
        borderColor: '#dc3545',
        borderWidth: 2,
    },
    playerName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 8,
    },
    handRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    handCard: {
        width: 44,
        height: 66,
    },
    emptyLabel: {
        color: '#666',
        fontStyle: 'italic',
        fontSize: 12,
    },

    // Action row
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        gap: 10,
    },
    btn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
    },
    homeBtn: {
        backgroundColor: '#3a3a3a',
        borderWidth: 1,
        borderColor: '#555',
    },
    restartBtn: {
        backgroundColor: '#28a745',
    },
    btnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

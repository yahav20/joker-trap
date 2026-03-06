import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { styles as gameStyles } from '../../styles/gameStyles';

/**
 * Props for the Lobby component.
 */
interface LobbyProps {
    /** Whether the WebSocket is currently connected to the server. */
    connected: boolean;
    /** Latest server message (e.g. "Waiting for 2 more players..."). */
    gameMessage: string;
    /** The active room code to share with other players. */
    roomCode?: string | null;
}

/**
 * Pre-game Lobby screen displayed while waiting for all 4 players to connect.
 *
 * Shows a spinner while the socket is still connecting, and switches to a
 * "Waiting for players" message once the connection is established.
 * The raw `gameMessage` from the server is shown beneath as a sub-text.
 *
 * Rendered by `game.tsx` when `currentTurn.phase === 'lobby'`.
 */
export const Lobby: React.FC<LobbyProps> = ({ connected, gameMessage, roomCode }) => {
    return (
        <SafeAreaView style={styles.lobbyContainer}>
            <View style={styles.lobbyBox}>
                <Text style={styles.lobbyTitle}>Joker Trap</Text>
                {/* Show an animated spinner while the socket handshake is in progress. */}
                {!connected && (
                    <ActivityIndicator size="large" color="#ffffff" style={styles.loader} />
                )}

                {roomCode && (
                    <View style={styles.roomCodeContainer}>
                        <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
                        <Text style={styles.roomCodeValue}>{roomCode}</Text>
                    </View>
                )}

                <Text style={styles.lobbyText}>
                    {connected ? "Waiting for players to join..." : "Connecting to server..."}
                </Text>
                <Text style={styles.lobbySubText}>{gameMessage}</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    lobbyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lobbyBox: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 40,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#444',
    },
    lobbyTitle: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    lobbyText: {
        color: '#fff',
        fontSize: 18,
        marginTop: 10,
    },
    lobbySubText: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 5,
    },
    loader: {
        marginVertical: 20,
    },
    roomCodeContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginVertical: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        width: '100%',
    },
    roomCodeLabel: {
        color: '#aaa',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 4,
    },
    roomCodeValue: {
        color: '#FFD700',
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 6,
    }
});

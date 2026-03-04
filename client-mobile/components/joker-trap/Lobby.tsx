import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { styles as gameStyles } from '../../styles/gameStyles';

interface LobbyProps {
    connected: boolean;
    gameMessage: string;
}

/**
 * Lobby screen shown before the game starts
 */
export const Lobby: React.FC<LobbyProps> = ({ connected, gameMessage }) => {
    return (
        <SafeAreaView style={styles.lobbyContainer}>
            <View style={styles.lobbyBox}>
                <Text style={styles.lobbyTitle}>Joker Trap</Text>
                {!connected && (
                    <ActivityIndicator size="large" color="#ffffff" style={styles.loader} />
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
});

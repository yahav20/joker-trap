import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface RequestModalProps {
    visible: boolean;
    senderId: number | null;
    onSelectRank: (rank: string) => void;
}

/**
 * Rank selection modal — centered, round buttons, subtitle below
 */
export const RequestModal: React.FC<RequestModalProps> = ({ visible, senderId, onSelectRank }) => {
    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <View style={styles.panel}>
                <Text style={styles.title}>Request a Card</Text>

                {/* Round rank buttons */}
                <View style={styles.buttonRow}>
                    {['J', 'Q', 'K', 'A'].map((rank) => (
                        <TouchableOpacity
                            key={rank}
                            style={styles.rankButton}
                            activeOpacity={0.75}
                            onPress={() => onSelectRank(rank)}
                        >
                            <Text style={styles.rankText}>{rank}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Subtitle below the buttons */}
                <Text style={styles.subtitle}>
                    Choose the rank to ask from P{senderId}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 40,     // Panel appears in the upper area
        zIndex: 500,
    },
    panel: {
        backgroundColor: 'rgba(15,15,15,0.92)',
        borderRadius: 20,
        paddingVertical: 22,
        paddingHorizontal: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 12,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 14,
        marginBottom: 14,
    },
    rankButton: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#2a2a2a',
        borderWidth: 1.5,
        borderColor: '#4da6ff',
        justifyContent: 'center',
        alignItems: 'center',
        // Glow tint
        shadowColor: '#4da6ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 4,
    },
    rankText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#aaa',
        fontSize: 13,
        textAlign: 'center',
    },
});

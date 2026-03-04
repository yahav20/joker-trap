import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ImageBackground, Modal, ScrollView, SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { BACKGROUND } from '../constants/Cards';

const RULES = [
    {
        title: "Overview",
        text: "Joker Trap is a 4-player card game. The goal is to collect a Quad (four cards of the same rank) and discard it. The player left holding the Joker loses."
    },
    {
        title: "The Deck",
        text: "The deck contains 16 cards: J, Q, K, A in all four suits (Clubs, Diamonds, Hearts, Spades) plus one Joker — 17 cards total. Each player receives 4–5 cards."
    },
    {
        title: "How Turns Work",
        text: "On each turn the Sender offers one or two cards face-down to the Receiver. The Receiver chooses one:\n• Accept the first card shown.\n• Ask for another card (see a second option).\n• Force a third card (forces the Sender to reveal a third)."
    },
    {
        title: "Making a Decision",
        text: "When deciding:\n• Tap the face-down card to Accept it.\n• Tap 'Ask Another' to see an alternative.\n• Tap 'Force 3rd' to force the Sender's third card."
    },
    {
        title: "Quads",
        text: "When you have four cards of the same rank, the round ends. The player with the Quad wins. Turn order then determines who held the Joker — that player loses the round."
    },
    {
        title: "Strategy Tips",
        text: "• Hide the Joker: don't let opponents read which card you offer.\n• Track ranks: if you know someone is collecting Ks, avoid giving them one.\n• Force wisely: forcing a 3rd card can help you dodge the Joker."
    },
];

export default function HomeScreen() {
    const router = useRouter();
    const [rulesVisible, setRulesVisible] = useState(false);

    return (
        <ImageBackground source={BACKGROUND} style={styles.background}>
            <SafeAreaView style={styles.container}>

                {/* Logo / Title */}
                <View style={styles.titleBox}>
                    <Text style={styles.title}>Joker Trap</Text>
                    <Text style={styles.subtitle}>The Card Game</Text>
                </View>

                {/* Buttons */}
                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        style={styles.playButton}
                        activeOpacity={0.85}
                        onPress={() => router.push('/game')}
                    >
                        <Text style={styles.playButtonText}>▶  Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.rulesButton}
                        activeOpacity={0.85}
                        onPress={() => setRulesVisible(true)}
                    >
                        <Text style={styles.rulesButtonText}>📖  Game Rules</Text>
                    </TouchableOpacity>
                </View>

            </SafeAreaView>

            {/* Game Rules Modal */}
            <Modal
                visible={rulesVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRulesVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Game Rules</Text>
                        <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
                            {RULES.map((section, i) => (
                                <View key={i} style={styles.ruleSection}>
                                    <Text style={styles.ruleSectionTitle}>{section.title}</Text>
                                    <Text style={styles.ruleSectionText}>{section.text}</Text>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setRulesVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1, resizeMode: 'cover' },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleBox: {
        alignItems: 'center',
        marginBottom: 50,
    },
    title: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#FFD700',
        textShadowColor: '#000',
        textShadowOffset: { width: 3, height: 3 },
        textShadowRadius: 8,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
        letterSpacing: 4,
        textTransform: 'uppercase',
    },
    buttonGroup: {
        gap: 16,
        alignItems: 'center',
    },
    playButton: {
        backgroundColor: '#28a745',
        paddingVertical: 16,
        paddingHorizontal: 60,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#28a745',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    playButtonText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    rulesButton: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 50,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    rulesButtonText: {
        color: '#ddd',
        fontSize: 17,
        fontWeight: '600',
    },
    // Rules Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalBox: {
        backgroundColor: '#1a1a1a',
        borderRadius: 18,
        padding: 24,
        width: '90%',
        maxWidth: 480,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: '#444',
    },
    modalTitle: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    rulesScroll: { marginBottom: 16 },
    ruleSection: { marginBottom: 16 },
    ruleSectionTitle: {
        color: '#4da6ff',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    ruleSectionText: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 20,
    },
    closeButton: {
        backgroundColor: '#333',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#555',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

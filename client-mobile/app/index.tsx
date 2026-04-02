import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ImageBackground, Modal, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { BACKGROUND } from '../constants/Cards';
import { useAvatar } from '../hooks/useAvatar';
import { AvatarPicker } from '../components/joker-trap/AvatarPicker';
import { AVATARS } from '../constants/avatars';
import { Image } from 'react-native';

/**
 * Static game rules content displayed in the in-app rules modal.
 * Each entry has a short `title` and a longer `text` block.
 * New rule sections can be appended here without touching the JSX.
 */
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
    const { avatar, saveAvatar } = useAvatar();
    const [pickerVisible, setPickerVisible] = useState(false);

    // Room logic state
    const [createVisible, setCreateVisible] = useState(false);
    const [joinVisible, setJoinVisible] = useState(false);
    const [botCount, setBotCount] = useState(0);
    const [roomCodeInput, setRoomCodeInput] = useState('');

    const handleCreateRoom = () => {
        setCreateVisible(false);
        router.push({ pathname: '/game', params: { action: 'create', bots: botCount.toString(), avatar: avatar || '' } });
    };

    const handleJoinRoom = () => {
        if (!roomCodeInput.trim()) return;
        setJoinVisible(false);
        router.push({ pathname: '/game', params: { action: 'join', roomId: roomCodeInput.trim().toUpperCase(), avatar: avatar || '' } });
    };

    return (
        <ImageBackground source={BACKGROUND} style={styles.background}>
            <SafeAreaView style={styles.container}>

                {/* Game Rules Icon - Top Left */}
                <TouchableOpacity
                    style={styles.rulesIconButton}
                    activeOpacity={0.7}
                    onPress={() => setRulesVisible(true)}
                >
                    <Text style={styles.rulesIconText}>📖</Text>
                </TouchableOpacity>

                {/* Avatar Icon - Top Right */}
                <TouchableOpacity
                    style={styles.avatarIconButton}
                    activeOpacity={0.7}
                    onPress={() => setPickerVisible(true)}
                >
                    {avatar ? <Image source={AVATARS[avatar]} style={styles.avatarIconImage} /> : <View style={styles.avatarIconPlaceholder} />}
                </TouchableOpacity>

                {/* Logo / Title */}
                <View style={styles.titleBox}>
                    <Text style={styles.title}>Joker Trap</Text>
                    <Text style={styles.subtitle}>The Card Game</Text>
                </View>

                {/* Main Action Buttons */}
                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        style={[styles.playButton, { backgroundColor: '#28a745' }]}
                        activeOpacity={0.85}
                        onPress={() => setCreateVisible(true)}
                    >
                        <Text style={styles.playButtonText}>CREATE{"\n"}ROOM</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.playButton, { backgroundColor: '#004085' }]}
                        activeOpacity={0.85}
                        onPress={() => setJoinVisible(true)}
                    >
                        <Text style={styles.playButtonText}>JOIN ROOM</Text>
                    </TouchableOpacity>
                </View>

            </SafeAreaView>

            {/* Create Room Modal */}
            <Modal visible={createVisible} transparent animationType="fade" onRequestClose={() => setCreateVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.smallModalBox}>
                        <Text style={styles.modalTitle}>Create Room</Text>
                        <Text style={styles.modalSubText}>How many bots should play?</Text>

                        <View style={styles.botSelector}>
                            {[0, 1, 2, 3].map(num => (
                                <TouchableOpacity
                                    key={num}
                                    style={[styles.botOption, botCount === num && styles.botOptionActive]}
                                    onPress={() => setBotCount(num)}
                                >
                                    <Text style={[styles.botOptionText, botCount === num && styles.botOptionTextActive]}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActionRow}>
                            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setCreateVisible(false)}>
                                <Text style={styles.actionButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={handleCreateRoom}>
                                <Text style={styles.actionButtonText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Join Room Modal */}
            <Modal visible={joinVisible} transparent animationType="fade" onRequestClose={() => setJoinVisible(false)}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.smallModalBox}>
                        <Text style={styles.modalTitle}>Join Room</Text>
                        <Text style={styles.modalSubText}>Enter the room code shared with you.</Text>

                        <TextInput
                            style={styles.inputField}
                            placeholder="e.g. A4K9B"
                            placeholderTextColor="#666"
                            autoCapitalize="characters"
                            maxLength={8}
                            value={roomCodeInput}
                            onChangeText={setRoomCodeInput}
                        />

                        <View style={styles.modalActionRow}>
                            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setJoinVisible(false)}>
                                <Text style={styles.actionButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, styles.confirmButton, !roomCodeInput.trim() && { opacity: 0.5 }]} onPress={handleJoinRoom} disabled={!roomCodeInput.trim()}>
                                <Text style={styles.actionButtonText}>Join</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Game Rules Modal */}
            <Modal visible={rulesVisible} transparent animationType="fade" onRequestClose={() => setRulesVisible(false)}>
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
                        <TouchableOpacity style={styles.closeButton} onPress={() => setRulesVisible(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <AvatarPicker 
                visible={pickerVisible}
                currentAvatar={avatar}
                onSelect={(k) => saveAvatar(k)}
                onClose={() => setPickerVisible(false)}
            />

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
        fontSize: 54,
        fontWeight: '900',
        color: '#FFD700',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 14,
        color: '#ffffff',
        marginTop: 4,
        letterSpacing: 4,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    buttonGroup: {
        gap: 16,
        alignItems: 'center',
    },
    playButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 6,
        width: 180,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    playButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
        textTransform: 'uppercase',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    rulesIconButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 10,
    },
    rulesIconText: {
        fontSize: 22,
    },
    avatarIconButton: {
        position: 'absolute',
        top: 24,
        right: 24,
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 10,
        backgroundColor: '#2b2b2b',
        overflow: 'hidden'
    },
    avatarIconImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    avatarIconPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#444'
    },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
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
    smallModalBox: {
        backgroundColor: 'rgba(20,20,25,0.95)',
        borderRadius: 24,
        padding: 30,
        width: '90%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 15,
    },
    modalTitle: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubText: {
        color: '#ccc',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
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

    // Room Config specific
    botSelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 30,
    },
    botOption: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#555'
    },
    botOptionActive: {
        backgroundColor: '#28a745',
        borderColor: '#fff'
    },
    botOptionText: {
        color: '#aaa',
        fontSize: 20,
        fontWeight: 'bold'
    },
    botOptionTextActive: {
        color: '#fff'
    },
    inputField: {
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: '#555',
        borderRadius: 8,
        color: '#fff',
        fontSize: 24,
        paddingVertical: 12,
        paddingHorizontal: 20,
        width: '100%',
        textAlign: 'center',
        marginBottom: 30,
        letterSpacing: 4,
        fontWeight: 'bold'
    },
    modalActionRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        justifyContent: 'space-between'
    },
    actionButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#444',
    },
    confirmButton: {
        backgroundColor: '#007bff',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    }
});

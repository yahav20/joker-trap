import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, Image, ImageBackground, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';

import { useGameSocket } from '../hooks/useGameSocket';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_IMAGES = {
    'Joker': require('../Resources/Joker.png'),
    'A_Clubs': require('../Resources/A_Clubs.png'),
    'A_Diamonds': require('../Resources/A_Diamonds.png'),
    'A_Hearts': require('../Resources/A_Hearts.png'),
    'A_Spades': require('../Resources/A_Spades.png'),
    'J_Clubs': require('../Resources/J_Clubs.png'),
    'J_Diamonds': require('../Resources/J_Diamonds.png'),
    'J_Hearts': require('../Resources/J_Hearts.png'),
    'J_Spades': require('../Resources/J_Spades.png'),
    'K_Clubs': require('../Resources/K_Clubs.png'),
    'K_Diamonds': require('../Resources/K_Diamonds.png'),
    'K_Hearts': require('../Resources/K_Hearts.png'),
    'K_Spades': require('../Resources/K_Spades.png'),
    'Q_Clubs': require('../Resources/Q_Clubs.png'),
    'Q_Diamonds': require('../Resources/Q_Diamonds.png'),
    'Q_Hearts': require('../Resources/Q_Hearts.png'),
    'Q_Spades': require('../Resources/Q_Spades.png'),
};

const CARD_BACK = require('../Resources/Card_Back.png');
const BACKGROUND = require('../Resources/background.png');

const getCardImage = (card: { rank: string; suit: string } | null) => {
    if (!card) return CARD_BACK;
    if (card.rank === 'Joker') return CARD_IMAGES['Joker' as keyof typeof CARD_IMAGES];
    const key = `${card.rank}_${card.suit}`;
    return CARD_IMAGES[key as keyof typeof CARD_IMAGES] || CARD_BACK;
};

export default function App() {
    const { myHand, tableCards, gameMessage, toastMessage, gameOverPayload, currentTurn, myPlayerId, connected, opponents, sendAction } = useGameSocket();

    // Create mock opponent hands (just backs based on hand length, using fixed array right now for UI rendering)
    // Opponents:
    // [0] = Left Opponent: (myPlayerId + 1) % 4
    // [1] = Top Opponent:  (myPlayerId + 2) % 4
    // [2] = Right Opponent:(myPlayerId + 3) % 4

    const leftOpponentId = myPlayerId !== null ? (myPlayerId + 1) % 4 : null;
    const topOpponentId = myPlayerId !== null ? (myPlayerId + 2) % 4 : null;
    const rightOpponentId = myPlayerId !== null ? (myPlayerId + 3) % 4 : null;

    const leftObj = opponents.find(o => o.id === leftOpponentId);
    const topObj = opponents.find(o => o.id === topOpponentId);
    const rightObj = opponents.find(o => o.id === rightOpponentId);

    // Fallbacks if not enough players are mapped out yet
    const leftHand = Array(leftObj ? leftObj.handCount : 4).fill(null);
    const topHand = Array(topObj ? topObj.handCount : 4).fill(null);
    const rightHand = Array(rightObj ? rightObj.handCount : 4).fill(null);

    const handleCardPress = (index: number) => {
        if (currentTurn?.phase?.includes('offer') && currentTurn.sender === myPlayerId) {
            sendAction('offer_card', { cardIndex: index });
        } else {
            console.log("Not your turn to offer!");
        }
    };

    // Smooth UI animations when hands, game phase, or cards change
    React.useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [myHand.length, tableCards.length, currentTurn.phase, currentTurn.sender]);

    const handleTableCardPress = (index: number) => {
        const isDeciding = (currentTurn.phase === 'waiting_for_first_decision' || currentTurn.phase === 'waiting_for_second_decision') && currentTurn.receiver === myPlayerId;
        if (!isDeciding) return;

        if (currentTurn.phase === 'waiting_for_first_decision' && index === 0) {
            sendAction('make_decision', { decision: 'accept' });
        } else if (currentTurn.phase === 'waiting_for_second_decision') {
            if (index === 0) sendAction('make_decision', { decision: 'accept_first' });
            if (index === 1) sendAction('make_decision', { decision: 'accept_second' });
        }
    };

    if (currentTurn?.phase === 'lobby' && !gameOverPayload) {
        return (
            <ImageBackground source={BACKGROUND} style={styles.background}>
                <SafeAreaView style={styles.lobbyContainer}>
                    <View style={styles.lobbyBox}>
                        <Text style={styles.lobbyTitle}>Joker Trap</Text>
                        {!connected ? <ActivityIndicator size="large" color="#ffffff" style={{ marginVertical: 20 }} /> : null}
                        <Text style={styles.lobbyText}>{connected ? "Waiting for players to join..." : "Connecting to server..."}</Text>
                        <Text style={styles.lobbySubText}>{gameMessage}</Text>
                    </View>
                </SafeAreaView>
            </ImageBackground>
        );
    }

    // Determines color for active players (Sender = Blue, Receiver = Orange/Red)
    const getZoneStyle = (playerId: number | null) => {
        if (playerId === null) return {};
        if (currentTurn.sender === playerId) {
            return { borderColor: '#4da6ff', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(77,166,255,0.2)' };
        }
        if (currentTurn.receiver === playerId) {
            return { borderColor: '#ff6b4a', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(255,107,74,0.2)' };
        }
        return {};
    };

    // --- Modals Conditional Rendering ---
    const isRequestingPhase = currentTurn.phase === 'waiting_for_request' && currentTurn.receiver === myPlayerId;
    const isDecisionPhase = (currentTurn.phase === 'waiting_for_first_decision' || currentTurn.phase === 'waiting_for_second_decision') && currentTurn.receiver === myPlayerId;

    return (
        <ImageBackground source={BACKGROUND} style={styles.background}>
            <SafeAreaView style={styles.container}>

                {toastMessage && (
                    <View style={styles.toastContainer}>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </View>
                )}

                <View style={[styles.topZone, getZoneStyle(topOpponentId)]}>
                    <Text style={[styles.playerLabel, { marginRight: 15, marginBottom: 0 }]}>P{topOpponentId}</Text>
                    <View style={{ flexDirection: 'row' }}>
                        {topHand.map((_, i) => (
                            <Image key={`top-${i}`} source={CARD_BACK} style={[styles.opponentCardTop, { transform: [{ rotate: '180deg' }] }]} />
                        ))}
                    </View>
                </View>

                {/* Left Opponent */}
                <View style={[styles.sideZoneLeft, getZoneStyle(leftOpponentId)]}>
                    <Text style={styles.playerLabelLeft}>P{leftOpponentId}</Text>
                    <View style={{ alignItems: 'center' }}>
                        {leftHand.map((_, i) => (
                            <View key={`left-wrap-${i}`} style={{ zIndex: i }}>
                                <Image source={CARD_BACK} style={[styles.opponentCardSide, { transform: [{ rotate: '90deg' }] }]} />
                            </View>
                        ))}
                    </View>
                </View>

                {/* Table Cards Zone */}
                <View style={[styles.tableZone, { zIndex: 2 }]} pointerEvents="box-none">
                    <View style={styles.cardsRowCenter}>
                        {tableCards.map((_, i) => (
                            <TouchableOpacity key={`table-${i}`} onPress={() => handleTableCardPress(i)} activeOpacity={0.8} style={{ zIndex: i }}>
                                <Image
                                    source={CARD_BACK}
                                    style={[styles.tableCard, { transform: [{ rotate: i % 2 === 0 ? '-5deg' : '5deg' }] }]}
                                />
                            </TouchableOpacity>
                        ))}

                        {/* Inline actions directly on the table for Receiver */}
                        {!gameOverPayload && isDecisionPhase && currentTurn.phase === 'waiting_for_first_decision' && (
                            <TouchableOpacity style={[styles.actionButton, styles.rejectBtn, { marginLeft: 20 }]} onPress={() => sendAction('make_decision', { decision: 'reject' })}>
                                <Text style={styles.actionBtnText}>Ask Another</Text>
                            </TouchableOpacity>
                        )}
                        {!gameOverPayload && isDecisionPhase && currentTurn.phase === 'waiting_for_second_decision' && (
                            <TouchableOpacity style={[styles.actionButton, styles.forceBtn, { marginLeft: 20 }]} onPress={() => sendAction('make_decision', { decision: 'force_third' })}>
                                <Text style={styles.actionBtnText}>Force 3rd</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Center Message */}
                <View pointerEvents="none" style={styles.centerContainer}>
                    <View style={styles.messageBoxCenter}>
                        <Text style={styles.messageText}>{gameMessage}</Text>
                        <Text style={styles.turnInfoText}>
                            Sender: P{currentTurn.sender} | Receiver: P{currentTurn.receiver}
                        </Text>
                    </View>
                </View>

                {/* Right Opponent */}
                <View style={[styles.sideZoneRight, getZoneStyle(rightOpponentId)]}>
                    <Text style={styles.playerLabelRight}>P{rightOpponentId}</Text>
                    <View style={{ alignItems: 'center' }}>
                        {rightHand.map((_, i) => (
                            <View key={`right-wrap-${i}`} style={{ zIndex: i }}>
                                <Image source={CARD_BACK} style={[styles.opponentCardSide, { transform: [{ rotate: '-90deg' }] }]} />
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.bottomZone, getZoneStyle(myPlayerId)]}>
                    <Text style={styles.playerLabelBottom}>You</Text>
                    <View style={styles.myHandContainer}>
                        {myHand.map((card, i) => (
                            <TouchableOpacity
                                key={`my-${i}`}
                                onPress={() => handleCardPress(i)}
                                activeOpacity={0.7}
                                style={{ zIndex: i + 10, marginLeft: i === 0 ? 0 : -35 }} // Increased overlap for larger cards
                            >
                                <Image source={getCardImage(card)} style={styles.myCard} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

            </SafeAreaView>

            {/* GAME OVER MODAL */}
            {gameOverPayload && (
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
                    <View style={[styles.modalContent, { width: '95%', maxWidth: 800, maxHeight: '95%', padding: 15 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                            <Text style={[styles.modalTitle, { fontSize: 28, color: gameOverPayload.loserId === myPlayerId ? '#dc3545' : '#FFD700', marginBottom: 0 }]}>
                                {gameOverPayload.loserId === myPlayerId ? "YOU LOSE!" : "YOU WIN!"}
                            </Text>
                            <TouchableOpacity style={[styles.actionButton, styles.acceptBtn]} onPress={() => sendAction('restart_game', {})}>
                                <Text style={styles.actionBtnText}>Restart Game</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSubText, { marginBottom: 5 }]}>
                            Player {gameOverPayload.quadPlayer} completed a Quad of &quot;{gameOverPayload.quadRank}&quot;
                        </Text>
                        {gameOverPayload.loserId !== null && (
                            <Text style={[styles.modalSubText, { color: '#ff6b4a', fontWeight: 'bold', marginBottom: 10 }]}>
                                Player {gameOverPayload.loserId} got stuck with the Joker!
                            </Text>
                        )}

                        <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' }}>
                            {gameOverPayload.hands.map((p) => {
                                const isWinner = p.id === gameOverPayload.quadPlayer;
                                const isLoser = p.id === gameOverPayload.loserId;
                                return (
                                    <View key={`final-${p.id}`} style={{ alignItems: 'center', margin: 5, padding: 10, backgroundColor: isWinner ? 'rgba(40,167,69,0.2)' : isLoser ? 'rgba(220,53,69,0.2)' : 'transparent', borderRadius: 10, borderWidth: isWinner || isLoser ? 2 : 0, borderColor: isWinner ? '#28a745' : '#dc3545' }}>
                                        <Text style={{ color: p.id === myPlayerId ? '#4da6ff' : 'white', fontWeight: 'bold', marginBottom: 5 }}>
                                            {p.id === myPlayerId ? 'You (P' + p.id + ')' : 'P' + p.id} {isWinner ? '🏆' : isLoser ? '💀' : ''}
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {p.hand.length === 0 ? <Text style={{ color: '#aaa', fontStyle: 'italic' }}>Empty</Text> : null}
                                            {p.hand.map((c, i) => (
                                                <Image key={`fc-${p.id}-${i}`} source={getCardImage(c)} style={{ width: 45, height: 68, resizeMode: 'contain', marginHorizontal: -10 }} />
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            )}

            {/* REQUEST/DECISION MODALS */}
            {!gameOverPayload && isRequestingPhase && (
                <View style={[styles.modalOverlay, { backgroundColor: 'transparent', justifyContent: 'center', marginTop: -80 }]} pointerEvents="box-none">
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Request a Card</Text>
                        <Text style={styles.modalSubText}>Select the rank you want to ask from P{currentTurn.sender}:</Text>
                        <View style={styles.buttonRow}>
                            {['J', 'Q', 'K', 'A'].map((rank) => (
                                <TouchableOpacity
                                    key={rank}
                                    style={styles.rankButton}
                                    onPress={() => sendAction('request_card', { rank })}
                                >
                                    <Text style={styles.rankButtonText}>{rank}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            )}

        </ImageBackground>
    );
}

const anchorsMargin = 5;

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,128,255,0.9)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        zIndex: 200,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    toastText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    background: {
        flex: 1,
        resizeMode: 'cover',
    },
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    lobbyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    lobbyBox: {
        backgroundColor: 'rgba(20,20,20,0.85)',
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#444',
    },
    lobbyTitle: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 10,
        textShadowColor: '#000',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5,
    },
    lobbyText: {
        color: 'white',
        fontSize: 18,
        marginTop: 10,
    },
    lobbySubText: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 10,
        fontStyle: 'italic',
    },
    centerContainer: {
        position: 'absolute',
        top: 100, // Float right below P2, revealing the center logo
        left: 0, right: 0,
        alignItems: 'center',
        zIndex: 5,
    },
    messageBoxCenter: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 15,
        alignItems: 'center',
    },
    messageText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    turnInfoText: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 4,
    },
    topZone: {
        position: 'absolute',
        top: 5, // Pin totally to the top
        flexDirection: 'row', // Align P2 text next to cards
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 5,
        alignSelf: 'center',
        zIndex: 10,
    },
    sideZoneLeft: {
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        zIndex: 10,
    },
    sideZoneRight: {
        position: 'absolute',
        right: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        zIndex: 10,
    },
    tableZone: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    cardsRowCenter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: -15, // Overlap table cards
    },
    cardsRowSender: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: -15, // Overlap table cards
        marginTop: 10,
    },
    bottomZone: {
        position: 'absolute',
        bottom: 10,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingTop: 5,
        alignSelf: 'center',
        zIndex: 50,
    },
    myHandContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingTop: 10,
    },
    playerLabel: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    playerLabelLeft: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 25,
    },
    playerLabelRight: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 25,
    },
    playerLabelBottom: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 0,
        zIndex: 100,
        textShadowColor: 'black',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    myCard: {
        width: 90,
        height: 135,
        resizeMode: 'contain',
    },
    opponentCardSide: {
        width: 45,
        height: 68,
        resizeMode: 'contain',
        marginTop: -30, // Stack downwards
    },
    opponentCardTop: {
        width: 45,
        height: 68,
        resizeMode: 'contain',
        marginLeft: -15, // Stack laterally
    },
    tableCard: {
        width: 60,
        height: 90,
        resizeMode: 'contain',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    modalContent: {
        backgroundColor: '#2b2b2b',
        padding: 25,
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#555',
        width: '80%',
        maxWidth: 400,
    },
    modalTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    modalSubText: {
        color: '#ccc',
        fontSize: 16,
        marginBottom: 20,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    rankButton: {
        backgroundColor: '#4da6ff',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    rankButtonText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    decisionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },
    actionButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: '#28a745',
    },
    rejectBtn: {
        backgroundColor: '#dc3545',
    },
    forceBtn: {
        backgroundColor: '#ffc107',
    },
    actionBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    }
});

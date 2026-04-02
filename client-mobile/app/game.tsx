import React from 'react';
import { View, Text, SafeAreaView, ImageBackground, LayoutAnimation, Platform, UIManager, StyleSheet, TouchableOpacity, Alert, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useGameSocket } from '../hooks/useGameSocket';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { BACKGROUND } from '../constants/Cards';
import { styles as gameStyles } from '../styles/gameStyles';

// Components
import { Card } from '../components/joker-trap/Card';
import { PlayerZone } from '../components/joker-trap/PlayerZone';
import { TableArea } from '../components/joker-trap/TableArea';
import { GameOverModal } from '../components/joker-trap/GameOverModal';
import { DisconnectedOverlay } from '../components/joker-trap/DisconnectedOverlay';
import { RequestModal } from '../components/joker-trap/RequestModal';
import { Lobby } from '../components/joker-trap/Lobby';
import { JokerLaughOverlay } from '../components/joker-trap/JokerLaughOverlay';
import { LoadingOverlay } from '../components/joker-trap/LoadingOverlay';
import { AVATARS } from '../constants/avatars';
import { Image } from 'react-native';

/**
 * Enable smooth layout animations on Android.
 * On iOS this is on by default; Android requires an explicit opt-in.
 * Must be called before any component renders.
 */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Main game screen — the primary entry point once a match is in progress.
 *
 * Responsibilities:
 *  - Connects to the WebSocket server via `useGameSocket` and re-exposes all state.
 *  - Maps the 4-player seat IDs to physical UI zones (top / left / right / bottom).
 *  - Delegates action sending to the hook's `sendAction` helper.
 *  - Renders the Lobby while waiting for players, or the full board once a game starts.
 *  - Always renders GameOverModal, RequestModal, and DisconnectedOverlay (each
 *    controls its own visibility internally).
 */
export default function App() {
    const router = useRouter();
    const params = useLocalSearchParams<{ action: string, roomId?: string, bots?: string, avatar?: string, playerName?: string }>();

    const {
        myHand, tableCards, gameMessage, toastMessage, gameOverPayload,
        currentTurn, opponents, myPlayerId, sendAction, connected, roomCode, reconnect, isReconnecting,
        receivedJoker, playersData,
    } = useGameSocket(params.action, params.roomId, params.bots, params.avatar, params.playerName);

    const { playFlip, playLaugh } = useSoundEffects();

    /** Fire the evil-laugh sound exactly once each time the Joker is received. */
    React.useEffect(() => {
        if (receivedJoker) {
            playLaugh();
        }
    }, [receivedJoker]);

    /**
     * Map player seat IDs to the three opponent UI positions.
     * In a 4-player game the seats are numbered 0–3 clockwise starting from "me":
     *   +1 → left opponent
     *   +2 → top opponent (directly opposite)
     *   +3 → right opponent
     * All arithmetic is mod 4 to wrap around the table.
     */
    const leftOppId = myPlayerId !== null ? (myPlayerId + 1) % 4 : null;
    const topOppId = myPlayerId !== null ? (myPlayerId + 2) % 4 : null;
    const rightOppId = myPlayerId !== null ? (myPlayerId + 3) % 4 : null;

    // Resolve opponent objects from the opponents array, defaulting to 4 cards if not yet known.
    const leftObj = opponents.find(o => o.id === leftOppId);
    const topObj = opponents.find(o => o.id === topOppId);
    const rightObj = opponents.find(o => o.id === rightOppId);

    const leftAvatar = playersData.find(p => p.id === leftOppId)?.avatar;
    const topAvatar = playersData.find(p => p.id === topOppId)?.avatar;
    const rightAvatar = playersData.find(p => p.id === rightOppId)?.avatar;
    const myAvatar = playersData.find(p => p.id === myPlayerId)?.avatar || params.avatar;

    const leftName = playersData.find(p => p.id === leftOppId)?.name;
    const topName = playersData.find(p => p.id === topOppId)?.name;
    const rightName = playersData.find(p => p.id === rightOppId)?.name;
    const myName = playersData.find(p => p.id === myPlayerId)?.name || params.playerName || 'You';

    const isMyTurn = (currentTurn.sender === myPlayerId || currentTurn.receiver === myPlayerId) && currentTurn.phase !== 'lobby';
    const showLoading = !connected && !isReconnecting;
    const loadingMessage = "מתחבר לשרת...";

    // Build face-down hand arrays for each opponent zone.
    const leftHand = Array(leftObj ? leftObj.handCount : 4).fill(null);
    const topHand = Array(topObj ? topObj.handCount : 4).fill(null);
    const rightHand = Array(rightObj ? rightObj.handCount : 4).fill(null);

    /**
     * Animate layout changes (hand size, table size, phase) with a smooth ease-in-out.
     * Triggers whenever any of the tracked values change.
     */
    React.useEffect(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }, [myHand.length, tableCards.length, currentTurn.phase, currentTurn.sender]);

    // ── Action Handlers ──────────────────────────────────────────────────────

    /**
     * Called when the local player taps one of their own cards.
     * Only active during offer phases when this player is the sender.
     * Sends the chosen card index to the server.
     */
    const handleCardOffer = (index: number) => {
        if (currentTurn?.phase?.includes('offer') && currentTurn.sender === myPlayerId) {
            playFlip();
            sendAction('offer_card', { cardIndex: index });
        }
    };

    /**
     * Called when the receiver taps a face-down card on the table.
     * The mapping of table card index → decision type:
     *  - First decision, index 0 → 'accept' (take the only card on the table)
     *  - Second decision, index 0/1 → accept the first or second offer respectively
     */
    const handleTableChoice = (index: number) => {
        const isDeciding = (currentTurn.phase === 'waiting_for_first_decision' || currentTurn.phase === 'waiting_for_second_decision') && currentTurn.receiver === myPlayerId;
        if (!isDeciding) return;

        playFlip();

        if (currentTurn.phase === 'waiting_for_first_decision' && index === 0) {
            sendAction('make_decision', { decision: 'accept' });
        } else if (currentTurn.phase === 'waiting_for_second_decision') {
            if (index === 0) sendAction('make_decision', { decision: 'accept_first' });
            if (index === 1) sendAction('make_decision', { decision: 'accept_second' });
        }
    };

    /**
     * Generic decision sender — used by the inline "Ask Another" and "Force 3rd" buttons
     * in TableArea. The `decision` string is passed directly to the server.
     */
    const handleDecisionAction = (decision: string) => {
        sendAction('make_decision', { decision });
    };

    /**
     * Confirms before leaving the game (via hardware back or UI back).
     */
    const handleLeaveGame = React.useCallback(() => {
        Alert.alert(
            "התנתקות מהמשחק",
            "האם אתה בטוח שאתה רוצה להתנתק מהמשחק?",
            [
                { text: "לא", style: "cancel" },
                { 
                    text: "כן",
                    style: "destructive",
                    onPress: () => {
                        sendAction('leave_room', {});
                        router.replace('/');
                    }
                }
            ],
            { cancelable: true }
        );
        return true; // prevent default back
    }, [sendAction, router]);

    React.useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            handleLeaveGame
        );
        return () => backHandler.remove();
    }, [handleLeaveGame]);

    // ── Lobby gate ───────────────────────────────────────────────────────────

    if (currentTurn?.phase === 'lobby' && !gameOverPayload) {
        return (
            <ImageBackground source={BACKGROUND} style={localStyles.background}>
                <Lobby connected={connected} gameMessage={gameMessage} roomCode={roomCode} players={playersData} />
            </ImageBackground>
        );
    }

    /**
     * Derived booleans that drive conditional rendering.
     * Both require the local player to be the receiver AND the phase to match
     * so that the UI only changes for the correct player.
     */
    const isDecisionPhase = (currentTurn.phase === 'waiting_for_first_decision' || currentTurn.phase === 'waiting_for_second_decision') && currentTurn.receiver === myPlayerId;
    const isRequestingPhase = currentTurn.phase === 'waiting_for_request' && currentTurn.receiver === myPlayerId;

    return (
        <ImageBackground source={BACKGROUND} style={localStyles.background}>
            <SafeAreaView style={gameStyles.container}>

                {/* Back to Home button — top left */}
                <TouchableOpacity style={localStyles.backButton} onPress={handleLeaveGame}>
                    <Text style={localStyles.backButtonText}>‹ Home</Text>
                </TouchableOpacity>

                {/* Toast Notification */}
                {toastMessage && (
                    <View style={localStyles.toastContainer}>
                        <Text style={localStyles.toastText}>{toastMessage}</Text>
                    </View>
                )}

                {/* Opponents */}
                <View style={gameStyles.topZone}>
                    <PlayerZone playerId={topOppId} hand={topHand} avatar={topAvatar} playerName={topName} rotation="180deg" isActive={currentTurn.sender === topOppId} isReceiver={currentTurn.receiver === topOppId} />
                </View>

                <View style={gameStyles.leftZone}>
                    <PlayerZone playerId={leftOppId} hand={leftHand} avatar={leftAvatar} playerName={leftName} vertical isActive={currentTurn.sender === leftOppId} isReceiver={currentTurn.receiver === leftOppId} />
                </View>

                <View style={gameStyles.rightZone}>
                    <PlayerZone playerId={rightOppId} hand={rightHand} avatar={rightAvatar} playerName={rightName} vertical isActive={currentTurn.sender === rightOppId} isReceiver={currentTurn.receiver === rightOppId} />
                </View>

                {/* Center Table Area */}
                <TableArea
                    tableCards={tableCards}
                    gameMessage={gameMessage}
                    currentTurn={currentTurn}
                    isDecisionPhase={isDecisionPhase}
                    gameOver={!!gameOverPayload}
                    onTableCardPress={handleTableChoice}
                    onDecision={handleDecisionAction}
                />

                {/* Local Player — pinned to bottom */}
                <View style={gameStyles.bottomZone}>
                    {/* Label + highlight around cards */}
                    <View style={[
                        currentTurn.sender === myPlayerId ? { borderColor: '#4da6ff', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(77,166,255,0.2)', padding: 5 }
                            : currentTurn.receiver === myPlayerId ? { borderColor: '#ff6b4a', borderWidth: 2, borderRadius: 10, backgroundColor: 'rgba(255,107,74,0.2)', padding: 5 }
                                : { padding: 5 },
                        { alignItems: 'center' }
                    ]}>
                        <View style={localStyles.myInfoRow}>
                            {myAvatar && AVATARS[myAvatar] && (
                                <Image source={AVATARS[myAvatar]} style={localStyles.myAvatarIcon} />
                            )}
                            <Text style={localStyles.youLabel}>{myName} (You)</Text>
                        </View>
                        <View style={localStyles.myHandRow}>
                            {myHand.map((card, i) => (
                                <Card
                                    key={`my-${i}`}
                                    card={card}
                                    onPress={() => handleCardOffer(i)}
                                    containerStyle={{ zIndex: i + 10, marginLeft: i === 0 ? 0 : -35 }}
                                    style={{ width: 90, height: 135 }}
                                />
                            ))}
                        </View>
                    </View>
                </View>

            </SafeAreaView>

            {/* Modals */}
            <GameOverModal
                payload={gameOverPayload}
                myPlayerId={myPlayerId}
                onRestart={() => sendAction('restart_game', {})}
            />

            <RequestModal
                visible={isRequestingPhase}
                senderId={currentTurn.sender}
                onSelectRank={(rank) => sendAction('request_card', { rank })}
            />

            <LoadingOverlay 
                visible={showLoading} 
                message={loadingMessage} 
            />

            {/* Joker received — evil laugh + animation */}
            <JokerLaughOverlay visible={receivedJoker} />

        </ImageBackground>
    );
}

const localStyles = StyleSheet.create({
    background: {
        flex: 1,
        resizeMode: 'cover',
    },
    toastContainer: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,128,255,0.9)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        zIndex: 200,
    },
    toastText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    youLabel: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    myInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6
    },
    myAvatarIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: '#fff'
    },
    myHandRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    backButton: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        zIndex: 300,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});

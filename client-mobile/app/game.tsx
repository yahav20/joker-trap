import React from 'react';
import { View, Text, SafeAreaView, ImageBackground, LayoutAnimation, Platform, UIManager, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { useGameSocket } from '../hooks/useGameSocket';
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
    const {
        myHand, tableCards, gameMessage, toastMessage, gameOverPayload,
        currentTurn, opponents, myPlayerId, sendAction, connected, reconnect
    } = useGameSocket();

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

    // ── Lobby gate ───────────────────────────────────────────────────────────

    // Show the lobby screen while the game has not started yet.
    // Once a game_over payload arrives we render the board + GameOverModal instead.
    if (currentTurn?.phase === 'lobby' && !gameOverPayload) {
        return (
            <ImageBackground source={BACKGROUND} style={localStyles.background}>
                <Lobby connected={connected} gameMessage={gameMessage} />
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
                <TouchableOpacity style={localStyles.backButton} onPress={() => router.replace('/')}>
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
                    <PlayerZone playerId={topOppId} hand={topHand} rotation="180deg" isActive={currentTurn.sender === topOppId} isReceiver={currentTurn.receiver === topOppId} />
                </View>

                <View style={gameStyles.leftZone}>
                    <PlayerZone playerId={leftOppId} hand={leftHand} vertical isActive={currentTurn.sender === leftOppId} isReceiver={currentTurn.receiver === leftOppId} />
                </View>

                <View style={gameStyles.rightZone}>
                    <PlayerZone playerId={rightOppId} hand={rightHand} vertical isActive={currentTurn.sender === rightOppId} isReceiver={currentTurn.receiver === rightOppId} />
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
                        <Text style={localStyles.youLabel}>You</Text>
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

            {!connected && (
                <DisconnectedOverlay onReconnect={reconnect} />
            )}

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
        marginBottom: 4,
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
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

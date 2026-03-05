import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles as gameStyles } from '../../styles/gameStyles';

/**
 * Props for the DisconnectedOverlay component.
 */
interface DisconnectedOverlayProps {
    /** Callback triggered when the user taps "Reconnect Now". Should re-open the WebSocket. */
    onReconnect: () => void;
}

/**
 * Fullscreen overlay shown whenever the WebSocket connection is lost.
 *
 * Renders on top of all other game content and blocks interaction until
 * the player taps "Reconnect Now", which calls the `onReconnect` callback
 * (which in turn re-opens the socket via `useGameSocket.reconnect`).
 *
 * The overlay is controlled externally: `game.tsx` renders it conditionally
 * with `{!connected && <DisconnectedOverlay onReconnect={reconnect} />}`.
 */
export const DisconnectedOverlay: React.FC<DisconnectedOverlayProps> = ({ onReconnect }) => {
    return (
        <View style={gameStyles.modalOverlay}>
            <View style={gameStyles.modalContent}>
                <Text style={[gameStyles.modalTitle, { color: '#ff4d4d', fontSize: 32 }]}>
                    OFFLINE
                </Text>
                <Text style={gameStyles.modalSubText}>
                    Connection to server lost.
                </Text>
                <TouchableOpacity
                    style={[gameStyles.actionButton, gameStyles.acceptBtn, { marginTop: 25, paddingHorizontal: 30 }]}
                    onPress={onReconnect}
                >
                    <Text style={gameStyles.actionBtnText}>Reconnect Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

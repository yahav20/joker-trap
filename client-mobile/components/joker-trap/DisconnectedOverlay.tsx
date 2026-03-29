import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles as gameStyles } from '../../styles/gameStyles';

/**
 * Props for the DisconnectedOverlay component.
 */
interface DisconnectedOverlayProps {
    /** Callback triggered when the user taps "Return to Home". */
    onReturnHome: () => void;
    /** Whether the client is actively attempting to recover the session */
    isReconnecting?: boolean;
}

/**
 * Fullscreen overlay shown whenever the WebSocket connection is lost mid-game.
 *
 * Renders on top of all other game content and blocks interaction until
 * the player taps "Return to Home" to go back to the lobby, as their seat
 * has already been taken by a bot on the server.
 */
export const DisconnectedOverlay: React.FC<DisconnectedOverlayProps> = ({ onReturnHome, isReconnecting }) => {
    return (
        <View style={gameStyles.modalOverlay}>
            <View style={gameStyles.modalContent}>
                <Text style={[gameStyles.modalTitle, { color: isReconnecting ? '#FFD700' : '#ff4d4d', fontSize: 32 }]}>
                    {isReconnecting ? 'RECONNECTING' : 'OFFLINE'}
                </Text>
                <Text style={gameStyles.modalSubText}>
                    {isReconnecting ? 'Attempting to restore connection... 🔄' : 'Connection to server lost.'}
                </Text>
                
                {!isReconnecting ? (
                    <TouchableOpacity
                        style={[gameStyles.actionButton, gameStyles.acceptBtn, { marginTop: 25, paddingHorizontal: 30 }]}
                        onPress={onReturnHome}
                    >
                        <Text style={gameStyles.actionBtnText}>Return to Home</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[gameStyles.actionButton, { marginTop: 25, paddingHorizontal: 30, backgroundColor: '#555' }]}
                        onPress={onReturnHome}
                    >
                        <Text style={gameStyles.actionBtnText}>Cancel & Leave</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

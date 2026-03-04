import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles as gameStyles } from '../../styles/gameStyles';

interface DisconnectedOverlayProps {
    onReconnect: () => void;
}

/**
 * Fullscreen overlay when socket connection is lost
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

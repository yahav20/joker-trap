import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface MuteButtonProps {
    isMuted: boolean;
    onToggle: () => void;
}

/**
 * Floating speaker icon rendered top-right of the game screen.
 * Tapping it calls the parent's toggle function from useMute.
 */
export const MuteButton: React.FC<MuteButtonProps> = ({ isMuted, onToggle }) => (
    <TouchableOpacity
        style={styles.button}
        onPress={onToggle}
        accessibilityLabel={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
        <Text style={styles.icon}>{isMuted ? '🔇' : '🔊'}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    button: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.55)',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        zIndex: 300,
    },
    icon: {
        fontSize: 20,
    },
});

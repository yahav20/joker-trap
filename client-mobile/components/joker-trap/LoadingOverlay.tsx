import React from 'react';
import { View, Text, StyleSheet, Modal, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';

interface LoadingOverlayProps {
    visible: boolean;
    message?: string;
}

const { width } = Dimensions.get('window');

/**
 * A professional transparent overlay shown during server connection or opponent turns.
 * Uses a Lottie animation for a smooth, high-quality look.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message = "ממתין לאחרים..." }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.container}>
                <View style={styles.card}>
                    <LottieView
                        source={{ uri: 'https://lottie.host/96dd53dc-7b60-4974-8cec-0b84d19724db/D1sZjpO32T.lottie' }}
                        autoPlay
                        loop
                        style={styles.lottie}
                        // Fallback to JSON if .lottie is not supported by this version's uri loader
                        onAnimationFailure={() => console.warn('Lottie failed to load .lottie file')}
                    />
                    <Text style={styles.text}>{message}</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)', // Semi-transparent as requested
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: width * 0.7,
        padding: 20,
        backgroundColor: 'rgba(30, 30, 35, 0.9)',
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    lottie: {
        width: 150,
        height: 150,
    },
    text: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
    },
});

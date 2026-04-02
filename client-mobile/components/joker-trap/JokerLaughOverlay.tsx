import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';

interface JokerLaughOverlayProps {
    /** When true the overlay is visible. Should pulse true for ~5 s then turn false. */
    visible: boolean;
}

const { width, height } = Dimensions.get('window');

/**
 * Full-screen dramatic overlay displayed when the local player receives the Joker card.
 *
 * Features:
 *  - Dark translucent vignette that fades in/out
 *  - Lottie laughing-joker animation (remote, auto-play, loop)
 *  - Pulsing "YOU GOT THE JOKER! 😈" headline
 *  - Two-line sub-text with an ominous hint
 *
 * The overlay is driven entirely by the `visible` prop — the parent controls timing.
 */
export const JokerLaughOverlay: React.FC<JokerLaughOverlayProps> = ({ visible }) => {
    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const scaleAnim  = useRef(new Animated.Value(0.6)).current;
    const pulseAnim  = useRef(new Animated.Value(1)).current;
    const shakeAnim  = useRef(new Animated.Value(0)).current;

    // Shake sequence for extra drama
    const runShake = () => {
        const shakeSequence = Animated.sequence([
            Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue:  6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
        ]);
        Animated.loop(shakeSequence, { iterations: 3 }).start();
    };

    useEffect(() => {
        if (visible) {
            // Fade + scale in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1, duration: 350,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1, friction: 5, tension: 80,
                    useNativeDriver: true,
                }),
            ]).start(() => runShake());

            // Continuous pulse on the text
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.92, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            // Fade out smoothly
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0, duration: 400,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.6, duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    }, [visible]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>

                {/* Red radial glow vignette overlay */}
                <View style={styles.vignette} />

                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [
                                { scale: scaleAnim },
                                { translateX: shakeAnim },
                            ],
                        },
                    ]}
                >
                    {/* Lottie laughing Joker animation */}
                    <LottieView
                        source={{ uri: 'https://lottie.host/ed9aac97-8527-4b9c-b32a-32d3bd961011/XZludAQhIl.lottie' }}
                        autoPlay
                        loop
                        style={styles.lottie}
                    />

                    {/* Dramatic headline */}
                    <Animated.Text
                        style={[styles.headline, { transform: [{ scale: pulseAnim }] }]}
                    >
                        YOU GOT THE JOKER! 😈
                    </Animated.Text>

                    <Text style={styles.subText}>
                        The Joker laughs at your misfortune...
                    </Text>
                    <Text style={styles.subTextSmall}>
                        Better not be the last one holding it!
                    </Text>
                </Animated.View>

            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    vignette: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        borderWidth: 80,
        borderColor: 'rgba(180, 0, 0, 0.35)',
        borderRadius: 0,
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    lottie: {
        width: Math.min(width * 0.55, 320),
        height: Math.min(width * 0.55, 320),
    },
    headline: {
        color: '#FF2222',
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 1.5,
        textShadowColor: '#000',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 8,
        marginTop: 8,
    },
    subText: {
        color: '#FFD700',
        fontSize: 15,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 10,
        opacity: 0.9,
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
    },
    subTextSmall: {
        color: '#aaa',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 6,
        opacity: 0.8,
    },
});

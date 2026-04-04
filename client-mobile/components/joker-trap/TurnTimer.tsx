import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

/** Duration that was set on the server — used only for display math. */
const TURN_MS = 30000;

/** Below this remaining-ms threshold the bar and text turn red. */
const DANGER_THRESHOLD = 7000;

interface TurnTimerProps {
    /** Server-sent Unix timestamp (ms) when this turn's timer expires. null = no active timer. */
    deadline: number | null;
    /** Hook to play ticking sound */
    playTicking?: (isMuted?: boolean) => void;
    /** Hook to stop ticking sound */
    stopTicking?: () => void;
    /** Current mute state */
    isMuted?: boolean;
    /** Whether it is the local player's action turn. Controls if the ticking sound plays locally */
    isMyTurn?: boolean;
}

/**
 * Animated progress bar that counts down from the server-provided deadline.
 * Uses requestAnimationFrame via React Native's Animated loop to stay smooth
 * on the JS thread while avoiding a `setInterval` per-frame overhead.
 *
 * Turns red in the final ~7 seconds. Disappears instantly when deadline is null.
 */
export const TurnTimer: React.FC<TurnTimerProps> = ({ deadline, playTicking, stopTicking, isMuted = false, isMyTurn = false }) => {
    const rafRef = useRef<number | null>(null);
    const [remaining, setRemaining] = useState<number>(TURN_MS);
    const progressWidth = useSharedValue(1); // 0..1 progress value
    const [isDanger, setIsDanger] = useState(false);

    useEffect(() => {
        if (!deadline) {
            // No active timer — reset and hide
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            setRemaining(TURN_MS);
            progressWidth.value = 1;
            setIsDanger(false);
            if (stopTicking) stopTicking();
            return;
        }

        const tick = () => {
            const left = Math.max(0, deadline - Date.now());
            setRemaining(left);
            const ratio = left / TURN_MS;
            progressWidth.value = withTiming(ratio, { duration: 100, easing: Easing.linear });
            
            const danger = left > 0 && left < DANGER_THRESHOLD;
            setIsDanger(danger);
            
            if (left > 0) {
                rafRef.current = requestAnimationFrame(tick);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => { 
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (stopTicking) stopTicking();
        };
    }, [deadline, progressWidth, stopTicking]);

    useEffect(() => {
        // Tick audibly as long as it's the user's turn
        if (isMyTurn && deadline) {
            if (playTicking) playTicking(isMuted);
        } else {
            if (stopTicking) stopTicking();
        }
    }, [isDanger, isMyTurn, deadline, playTicking, stopTicking, isMuted]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: `${Math.round(progressWidth.value * 100)}%` as any,
    }));

    if (!deadline) return null;

    const secondsLeft = Math.ceil(remaining / 1000);

    return (
        <View style={styles.container}>
            {/* Text countdown */}
            <Text style={[styles.text, isDanger && styles.textDanger]}>
                {secondsLeft}s
            </Text>

            {/* Bar track */}
            <View style={styles.track}>
                <Animated.View
                    style={[
                        styles.fill,
                        isDanger ? styles.fillDanger : styles.fillSafe,
                        animatedStyle,
                    ]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    text: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontWeight: '700',
        minWidth: 26,
        textAlign: 'right',
    },
    textDanger: {
        color: '#ff4d4d',
    },
    track: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 3,
    },
    fillSafe: {
        backgroundColor: '#4da6ff',
    },
    fillDanger: {
        backgroundColor: '#ff4d4d',
    },
});

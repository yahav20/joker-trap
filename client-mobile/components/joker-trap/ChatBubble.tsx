import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';

/**
 * Quick-chat labels keyed by message ID (1-based).
 * Resolve the numeric ID from the server into a display string here.
 * To localise, swap this map or load from a locale file.
 */
export const QUICK_CHAT_LABELS: Record<number, string> = {
    1: 'Try me 😏',
    2: 'I dare you 😈',
    3: 'Pretty please? 🥺',
    4: 'Help me out here 🙏',
    5: 'I trust you… maybe 🤨',
    6: 'Last chance to be honest 😒',
    7: 'I’m watching you 👀',
    8: 'Don’t throw the game 😠',
    9: 'You better not send the Joker 🃏',
    10: 'This is a trap, isn’t it? 🧐',
    11: 'Don’t mess this up 😤',
    12: 'Be honest… just this once 🤥',
    13: 'Feels like a Joker move 🤡',
};

interface ChatBubbleProps {
    /** Numeric quick-chat ID. null / 0 means hidden. */
    messageId: number | null;
    /** Where the bubble appears relative to its position:relative container. */
    position?: 'top' | 'left' | 'top-left';
}

/**
 * A speech-bubble that fades in when a messageId arrives and auto-fades
 * out after 3.5 seconds.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({ messageId, position = 'top' }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!messageId) return;

        // Fade in
        Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();

        // Fade out after 3.5 s
        const timer = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }, 3500);

        return () => clearTimeout(timer);
    }, [messageId, opacity]);

    if (!messageId) return null;

    const bubbleStyle = [
        styles.bubble,
        position === 'top' && styles.bubbleTop,
        position === 'left' && styles.bubbleLeft,
        position === 'top-left' && styles.bubbleTopLeft,
        { opacity }
    ];

    const tailStyle = [
        styles.tail,
        position === 'top' && styles.tailBottomCenter,
        position === 'left' && styles.tailRightCenter,
        position === 'top-left' && styles.tailBottomLeft,
    ];

    return (
        <Animated.View style={bubbleStyle} pointerEvents="none">
            <View style={tailStyle} />
            <Text style={styles.text}>{QUICK_CHAT_LABELS[messageId] ?? '...'}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    bubble: {
        position: 'absolute',
        backgroundColor: 'rgba(30, 30, 60, 0.92)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        minWidth: 90,
        alignItems: 'center',
        zIndex: 500,
    },
    bubbleTop: {
        bottom: '110%',
        alignSelf: 'center',
        marginBottom: 6,
    },
    bubbleLeft: {
        right: '110%',
        top: '10%',
        marginRight: 6,
    },
    bubbleTopLeft: {
        bottom: '110%',
        left: -10,
        marginBottom: 6,
    },
    tail: {
        position: 'absolute',
        width: 0,
        height: 0,
    },
    tailBottomCenter: {
        bottom: -7,
        alignSelf: 'center',
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(30, 30, 60, 0.92)',
    },
    tailRightCenter: {
        right: -7,
        top: '50%',
        marginTop: -7,
        borderTopWidth: 7,
        borderBottomWidth: 7,
        borderLeftWidth: 7,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'rgba(30, 30, 60, 0.92)',
    },
    tailBottomLeft: {
        bottom: -7,
        left: 20,
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(30, 30, 60, 0.92)',
    },
    text: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
});

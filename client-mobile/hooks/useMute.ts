import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTE_KEY = '@joker_trap/muted';

/**
 * Persistent mute toggle backed by AsyncStorage.
 * Returns the current muted state and a toggle function.
 * The setting survives app restarts.
 */
export const useMute = () => {
    const [isMuted, setIsMuted] = useState(false);

    // Load persisted value on mount
    useEffect(() => {
        AsyncStorage.getItem(MUTE_KEY)
            .then(value => {
                if (value === 'true') setIsMuted(true);
            })
            .catch(() => { /* ignore storage errors */ });
    }, []);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const next = !prev;
            AsyncStorage.setItem(MUTE_KEY, String(next)).catch(() => {});
            return next;
        });
    }, []);

    return { isMuted, toggleMute };
};

import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

/**
 * Loads and manages the two game sound effects:
 *  - `flipcard`  → played when a card is offered or accepted
 *  - `evilLaugh` → played when the local player receives the Joker
 *
 * Both sounds are pre-loaded once on mount and unloaded on unmount.
 * `replayAsync` is used so sounds can fire multiple times per session.
 */
export const useSoundEffects = () => {
    const flipRef   = useRef<Audio.Sound | null>(null);
    const laughRef  = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            // Allow sounds to play even when the device is in silent / ring mode.
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

            const { sound: flip } = await Audio.Sound.createAsync(
                require('../assets/sounds/flipcard.mp3'),
                { shouldPlay: false }
            );

            const { sound: laugh } = await Audio.Sound.createAsync(
                require('../assets/sounds/evil-laugh.mp3'),
                { shouldPlay: false }
            );

            if (mounted) {
                flipRef.current  = flip;
                laughRef.current = laugh;
            } else {
                // Component unmounted before load finished — clean up immediately.
                await flip.unloadAsync();
                await laugh.unloadAsync();
            }
        };

        load().catch(console.error);

        return () => {
            mounted = false;
            flipRef.current?.unloadAsync();
            laughRef.current?.unloadAsync();
        };
    }, []);

    /** Play the card-flip sound (restarts from the beginning each call). */
    const playFlip = useCallback(async () => {
        try {
            if (flipRef.current) {
                await flipRef.current.setPositionAsync(0);
                await flipRef.current.playAsync();
            }
        } catch (e) {
            console.warn('playFlip error', e);
        }
    }, []);

    /** Play the evil-laugh sound (restarts from the beginning each call). */
    const playLaugh = useCallback(async () => {
        try {
            if (laughRef.current) {
                await laughRef.current.setPositionAsync(0);
                await laughRef.current.playAsync();
            }
        } catch (e) {
            console.warn('playLaugh error', e);
        }
    }, []);

    return { playFlip, playLaugh };
};

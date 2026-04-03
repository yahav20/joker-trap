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
    const winRef    = useRef<Audio.Sound | null>(null);
    const loseRef   = useRef<Audio.Sound | null>(null);
    const startRef  = useRef<Audio.Sound | null>(null);
    const leaveRef  = useRef<Audio.Sound | null>(null);

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

            const { sound: win } = await Audio.Sound.createAsync(
                require('../assets/sounds/winning.mp3'),
                { shouldPlay: false }
            );

            const { sound: lose } = await Audio.Sound.createAsync(
                require('../assets/sounds/violin-lose.mp3'),
                { shouldPlay: false }
            );

            const { sound: start } = await Audio.Sound.createAsync(
                require('../assets/sounds/game-start.mp3'),
                { shouldPlay: false }
            );

            const { sound: leave } = await Audio.Sound.createAsync(
                require('../assets/sounds/game-over.mp3'),
                { shouldPlay: false }
            );

            if (mounted) {
                flipRef.current  = flip;
                laughRef.current = laugh;
                winRef.current = win;
                loseRef.current = lose;
                startRef.current = start;
                leaveRef.current = leave;
            } else {
                // Component unmounted before load finished — clean up immediately.
                await flip.unloadAsync();
                await laugh.unloadAsync();
                await win.unloadAsync();
                await lose.unloadAsync();
                await start.unloadAsync();
                await leave.unloadAsync();
            }
        };

        load().catch(console.error);

        return () => {
            mounted = false;
            flipRef.current?.unloadAsync();
            laughRef.current?.unloadAsync();
            winRef.current?.unloadAsync();
            loseRef.current?.unloadAsync();
            startRef.current?.unloadAsync();
            leaveRef.current?.unloadAsync();
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

    const playWin = useCallback(async () => {
        try {
            if (winRef.current) {
                await winRef.current.setPositionAsync(0);
                await winRef.current.playAsync();
            }
        } catch (e) {
            console.warn('playWin error', e);
        }
    }, []);

    const playLose = useCallback(async () => {
        try {
            if (loseRef.current) {
                await loseRef.current.setPositionAsync(0);
                await loseRef.current.playAsync();
            }
        } catch (e) {
            console.warn('playLose error', e);
        }
    }, []);

    const playStart = useCallback(async () => {
        try {
            if (startRef.current) {
                await startRef.current.setPositionAsync(0);
                await startRef.current.playAsync();
            }
        } catch (e) {
            console.warn('playStart error', e);
        }
    }, []);

    const playLeaveAlert = useCallback(async () => {
        try {
            if (leaveRef.current) {
                await leaveRef.current.setPositionAsync(0);
                await leaveRef.current.playAsync();
            }
        } catch (e) {
            console.warn('playLeaveAlert error', e);
        }
    }, []);

    return { playFlip, playLaugh, playWin, playLose, playStart, playLeaveAlert };
};

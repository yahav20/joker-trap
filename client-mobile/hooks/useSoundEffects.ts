import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

/**
 * Loads and manages all game sound effects.
 * Every play function accepts an optional `isMuted` boolean.
 * When true the call is a no-op, so the caller just passes the mute state
 * from `useMute` without needing its own guard.
 *
 * Sounds are pre-loaded once on mount and unloaded on unmount.
 */
export const useSoundEffects = () => {
    const flipRef       = useRef<Audio.Sound | null>(null);
    const laughRef      = useRef<Audio.Sound | null>(null);
    const winRef        = useRef<Audio.Sound | null>(null);
    const loseRef       = useRef<Audio.Sound | null>(null);
    const startRef      = useRef<Audio.Sound | null>(null);
    const leaveRef      = useRef<Audio.Sound | null>(null);
    const tickingRef    = useRef<Audio.Sound | null>(null);
    const yourTurnRef   = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

            const { sound: flip }     = await Audio.Sound.createAsync(require('../assets/sounds/flipcard.mp3'),      { shouldPlay: false });
            const { sound: laugh }    = await Audio.Sound.createAsync(require('../assets/sounds/evil-laugh.mp3'),    { shouldPlay: false });
            const { sound: win }      = await Audio.Sound.createAsync(require('../assets/sounds/winning.mp3'),       { shouldPlay: false });
            const { sound: lose }     = await Audio.Sound.createAsync(require('../assets/sounds/violin-lose.mp3'),   { shouldPlay: false });
            const { sound: start }    = await Audio.Sound.createAsync(require('../assets/sounds/game-start.mp3'),    { shouldPlay: false });
            const { sound: leave }    = await Audio.Sound.createAsync(require('../assets/sounds/game-over.mp3'),     { shouldPlay: false });
            const { sound: ticking }  = await Audio.Sound.createAsync(require('../assets/sounds/clock-ticking.mp3'), { shouldPlay: false, isLooping: true });
            const { sound: yourTurn } = await Audio.Sound.createAsync(require('../assets/sounds/your-turn.mp3'),       { shouldPlay: false });

            if (mounted) {
                flipRef.current       = flip;
                laughRef.current      = laugh;
                winRef.current        = win;
                loseRef.current       = lose;
                startRef.current      = start;
                leaveRef.current      = leave;
                tickingRef.current    = ticking;
                yourTurnRef.current   = yourTurn;
            } else {
                await flip.unloadAsync();
                await laugh.unloadAsync();
                await win.unloadAsync();
                await lose.unloadAsync();
                await start.unloadAsync();
                await leave.unloadAsync();
                await ticking.unloadAsync();
                await yourTurn.unloadAsync();
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
            tickingRef.current?.unloadAsync();
            yourTurnRef.current?.unloadAsync();
        };
    }, []);

    const playFlip = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (flipRef.current)  { await flipRef.current.setPositionAsync(0);  await flipRef.current.playAsync(); } }
        catch (e) { console.warn('playFlip error', e); }
    }, []);

    const playLaugh = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (laughRef.current) { await laughRef.current.setPositionAsync(0); await laughRef.current.playAsync(); } }
        catch (e) { console.warn('playLaugh error', e); }
    }, []);

    const playWin = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (winRef.current)   { await winRef.current.setPositionAsync(0);   await winRef.current.playAsync(); } }
        catch (e) { console.warn('playWin error', e); }
    }, []);

    const playLose = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (loseRef.current)  { await loseRef.current.setPositionAsync(0);  await loseRef.current.playAsync(); } }
        catch (e) { console.warn('playLose error', e); }
    }, []);

    const playStart = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (startRef.current) { await startRef.current.setPositionAsync(0); await startRef.current.playAsync(); } }
        catch (e) { console.warn('playStart error', e); }
    }, []);

    const playLeaveAlert = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (leaveRef.current) { await leaveRef.current.setPositionAsync(0); await leaveRef.current.playAsync(); } }
        catch (e) { console.warn('playLeaveAlert error', e); }
    }, []);

    const playTicking = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (tickingRef.current) { await tickingRef.current.setPositionAsync(0); await tickingRef.current.playAsync(); } }
        catch (e) { console.warn('playTicking error', e); }
    }, []);

    const stopTicking = useCallback(async () => {
        try { if (tickingRef.current) { await tickingRef.current.stopAsync(); } }
        catch (e) { console.warn('stopTicking error', e); }
    }, []);

    const playYourTurn = useCallback(async (isMuted = false) => {
        if (isMuted) return;
        try { if (yourTurnRef.current) { await yourTurnRef.current.setPositionAsync(0); await yourTurnRef.current.playAsync(); } }
        catch (e) { console.warn('playYourTurn error', e); }
    }, []);

    return { playFlip, playLaugh, playWin, playLose, playStart, playLeaveAlert, playTicking, stopTicking, playYourTurn };
};

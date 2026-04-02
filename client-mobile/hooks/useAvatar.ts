import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomAvatar } from '../constants/avatars';

const STORAGE_KEY = '@joker_trap_avatar_selection';

/**
 * Module-level variable serves as a singleton fallback.
 * If the app is alive, the selection persists across game navigations even
 * if the native AsyncStorage is having issues.
 */
let memoryAvatar: string | null = null;

export const useAvatar = () => {
    const [avatar, setAvatar] = useState<string | null>(memoryAvatar);

    useEffect(() => {
        const init = async () => {
            if (memoryAvatar) return; // Keep the active selection if we already have it in memory

            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored) {
                    memoryAvatar = stored;
                    setAvatar(stored);
                } else {
                    const rnd = getRandomAvatar();
                    memoryAvatar = rnd;
                    setAvatar(rnd);
                    await AsyncStorage.setItem(STORAGE_KEY, rnd);
                }
            } catch (e) {
                console.warn('AsyncStorage fallback to memory-only: ', e);
                const rnd = getRandomAvatar();
                memoryAvatar = rnd;
                setAvatar(rnd);
            }
        };
        init();
    }, []);

    const saveAvatar = async (newAvatar: string) => {
        try {
            memoryAvatar = newAvatar;
            setAvatar(newAvatar);
            await AsyncStorage.setItem(STORAGE_KEY, newAvatar);
        } catch (e) {
            console.error('Failed to persist avatar: ', e);
        }
    };

    return { avatar, saveAvatar };
};

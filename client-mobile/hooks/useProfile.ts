import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomAvatar } from '../constants/avatars';

const STORAGE_KEY = '@joker_trap_profile';

export interface UserProfile {
    avatar: string | null;
    playerName: string | null;
}

let memoryProfile: UserProfile | null = null;

export const useProfile = () => {
    const [profile, setProfile] = useState<UserProfile>(memoryProfile || { avatar: null, playerName: null });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (memoryProfile) {
                setIsLoaded(true);
                return;
            }

            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    memoryProfile = parsed;
                    setProfile(parsed);
                } else {
                    const rnd = getRandomAvatar();
                    const initialProfile = { avatar: rnd, playerName: '' };
                    memoryProfile = initialProfile;
                    setProfile(initialProfile);
                    // Do not persist empty name immediately, forcing user to pick one
                }
            } catch (e) {
                console.warn('AsyncStorage fallback to memory-only: ', (e as Error).message);
                const rnd = getRandomAvatar();
                const fallbackProfile = { avatar: rnd, playerName: '' };
                memoryProfile = fallbackProfile;
                setProfile(fallbackProfile);
            }
            setIsLoaded(true);
        };
        init();
    }, []);

    const saveProfile = async (newProfile: UserProfile) => {
        try {
            memoryProfile = newProfile;
            setProfile(newProfile);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        } catch (e) {
            console.warn('Failed to persist profile (using memory fallback): ', (e as Error).message);
        }
    };

    return { profile, saveProfile, isLoaded };
};

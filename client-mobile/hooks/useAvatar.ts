import { useState, useEffect } from 'react';
import { getRandomAvatar } from '../constants/avatars';

export const useAvatar = () => {
    const [avatar, setAvatar] = useState<string | null>(null);

    useEffect(() => {
        setAvatar(getRandomAvatar());
    }, []);

    const saveAvatar = (newAvatar: string) => {
        setAvatar(newAvatar);
    };

    return { avatar, saveAvatar };
};

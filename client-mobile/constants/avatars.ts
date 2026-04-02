export const AVATARS: Record<string, any> = {
    'blackandwhite_joker': require('../assets/avatars/blackandwhite_joker.png'),
    'canday_joker': require('../assets/avatars/canday_joker.png'),
    'deadpool_joker': require('../assets/avatars/deadpool_joker.png'),
    'ghost_joker': require('../assets/avatars/ghost_joker.png'),
    'harli_joker': require('../assets/avatars/harli_joker.png'),
    'ice_joker': require('../assets/avatars/ice_joker.png'),
    'magic_joker': require('../assets/avatars/magic_joker.png'),
    'mechinacal_joker': require('../assets/avatars/mechinacal_joker.png'),
    'momie_joker': require('../assets/avatars/momie_joker.png'),
    'noar_joker': require('../assets/avatars/noar_joker.png'),
    'pirate_joker': require('../assets/avatars/pirate_joker.png'),
    'purple_joker': require('../assets/avatars/purple_joker.png'),
    'robot_joker': require('../assets/avatars/robot_joker.png'),
    'wizard_joker': require('../assets/avatars/wizard_joker.png'),
    'wood_joker': require('../assets/avatars/wood_joker.png'),
    'zombie_joker': require('../assets/avatars/zombie_joker.png'),
};

export const AVATAR_KEYS = Object.keys(AVATARS);

export const getRandomAvatar = () => {
    return AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)];
};

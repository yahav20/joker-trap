/**
 * Card assets and helper for Joker Trap
 */

export const CARD_IMAGES = {
    'Joker': require('../Resources/Joker.png'),
    'A_Clubs': require('../Resources/A_Clubs.png'),
    'A_Diamonds': require('../Resources/A_Diamonds.png'),
    'A_Hearts': require('../Resources/A_Hearts.png'),
    'A_Spades': require('../Resources/A_Spades.png'),
    'J_Clubs': require('../Resources/J_Clubs.png'),
    'J_Diamonds': require('../Resources/J_Diamonds.png'),
    'J_Hearts': require('../Resources/J_Hearts.png'),
    'J_Spades': require('../Resources/J_Spades.png'),
    'K_Clubs': require('../Resources/K_Clubs.png'),
    'K_Diamonds': require('../Resources/K_Diamonds.png'),
    'K_Hearts': require('../Resources/K_Hearts.png'),
    'K_Spades': require('../Resources/K_Spades.png'),
    'Q_Clubs': require('../Resources/Q_Clubs.png'),
    'Q_Diamonds': require('../Resources/Q_Diamonds.png'),
    'Q_Hearts': require('../Resources/Q_Hearts.png'),
    'Q_Spades': require('../Resources/Q_Spades.png'),
};

export const CARD_BACK = require('../Resources/Card_Back.png');
export const BACKGROUND = require('../Resources/background.png');

export type CardData = { rank: string; suit: string } | null;

export const getCardImage = (card: CardData) => {
    if (!card) return CARD_BACK;
    if (card.rank === 'Joker') return CARD_IMAGES['Joker' as keyof typeof CARD_IMAGES];
    const key = `${card.rank}_${card.suit}`;
    return CARD_IMAGES[key as keyof typeof CARD_IMAGES] || CARD_BACK;
};

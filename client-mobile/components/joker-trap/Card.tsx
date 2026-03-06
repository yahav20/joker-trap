import React from 'react';
import { Image, TouchableOpacity, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { getCardImage, CardData } from '../../constants/Cards';

/**
 * Props for the Card component.
 */
interface CardProps {
    /**
     * The card to display. Pass `null` for a face-down card
     * (the back-of-card image is shown automatically by `getCardImage`).
     */
    card: CardData;
    /** Optional press handler. When provided, the card is wrapped in a TouchableOpacity. */
    onPress?: () => void;
    /** Custom image style overrides (e.g. different width/height for table vs hand cards). */
    style?: ImageStyle | ImageStyle[];
    /** Style applied to the TouchableOpacity wrapper when `onPress` is provided. */
    containerStyle?: ViewStyle | ViewStyle[];
    /** When true the TouchableOpacity absorbs taps but does not fire `onPress`. */
    disabled?: boolean;
}

/**
 * Reusable Card Component.
 *
 * Displays a playing card image sourced from the local assets via `getCardImage`.
 * - When `onPress` is supplied the card is interactive (wrapped in TouchableOpacity).
 * - When `onPress` is omitted the card is purely decorative (plain Image).
 *
 * Face-down cards (e.g. opponents' hands, table cards) are represented by passing
 * `card={null}`, which causes `getCardImage` to return the card-back asset.
 */
export const Card: React.FC<CardProps> = ({ card, onPress, style, containerStyle, disabled }) => {
    const content = (
        <Image
            source={getCardImage(card)}
            style={[styles.cardImage, style]}
        />
    );

    // If an onPress handler is given, wrap in a touchable so the card can be tapped.
    if (onPress) {
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => !disabled && onPress?.()}
                disabled={disabled}
                style={containerStyle}
            >
                {content}
            </TouchableOpacity>
        );
    }

    // No interaction needed — return the plain image.
    return content;
};

const styles = StyleSheet.create({
    cardImage: {
        width: 60,
        height: 90,
        resizeMode: 'contain',
        borderRadius: 8,
    },
});

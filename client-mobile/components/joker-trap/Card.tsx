import React from 'react';
import { Image, TouchableOpacity, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { getCardImage, CardData } from '../../constants/Cards';

interface CardProps {
    card: CardData;
    onPress?: () => void;
    style?: ImageStyle | ImageStyle[];
    containerStyle?: ViewStyle | ViewStyle[];
    disabled?: boolean;
}

/**
 * Reusable Card Component
 */
export const Card: React.FC<CardProps> = ({ card, onPress, style, containerStyle, disabled }) => {
    const content = (
        <Image
            source={getCardImage(card)}
            style={[styles.cardImage, style]}
        />
    );

    if (onPress) {
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                disabled={disabled}
                style={containerStyle}
            >
                {content}
            </TouchableOpacity>
        );
    }

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

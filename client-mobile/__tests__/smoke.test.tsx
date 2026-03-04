import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';

// Simple test to verify Jest setup
describe('Initial Test Suite', () => {
    it('renders a basic component', () => {
        const { getByText } = render(
            <View>
                <Text>Joker Trap Test</Text>
            </View>
        );
        expect(getByText('Joker Trap Test')).toBeTruthy();
    });
});

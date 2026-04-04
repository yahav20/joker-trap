import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { QUICK_CHAT_LABELS } from './ChatBubble';

interface QuickChatMenuProps {
    /** Called with the chosen message ID (1-5) when the user picks a preset. */
    onSend: (messageId: number) => void;
}

/**
 * Floating chat button (💬) that opens an overlay with quick-chat presets.
 * Selecting a message fires `onSend(id)` and closes the menu.
 * An outside-tap on the backdrop also closes the menu.
 */
export const QuickChatMenu: React.FC<QuickChatMenuProps> = ({ onSend }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (id: number) => {
        onSend(id);
        setOpen(false);
    };

    return (
        <>
            {/* Trigger button */}
            <TouchableOpacity
                style={styles.trigger}
                onPress={() => setOpen(true)}
                accessibilityLabel="Open quick chat"
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Text style={styles.triggerIcon}>💬</Text>
            </TouchableOpacity>

            {/* Popup menu */}
            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.menu}>
                            <Text style={styles.menuTitle}>Quick Chat</Text>
                            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
                                {Object.entries(QUICK_CHAT_LABELS).map(([key, label]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.menuItem}
                                        onPress={() => handleSelect(Number(key))}
                                    >
                                        <Text style={styles.menuText}>{label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    trigger: {
        position: 'absolute',
        bottom: 12,
        right: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        zIndex: 300,
    },
    triggerIcon: {
        fontSize: 22,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
    },
    menuContainer: {
        maxHeight: '70%',
        width: 250,
    },
    menu: {
        backgroundColor: '#1a1a2e',
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 16,
        width: '100%',
        flexShrink: 1,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
    },
    scrollArea: {
        width: '100%',
    },
    scrollContent: {
        paddingVertical: 4,
        gap: 4,
    },
    menuTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    menuItem: {
        width: '100%',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.07)',
    },
    menuText: {
        color: '#fff',
        fontSize: 17, // Increased from 15
        textAlign: 'center',
        fontWeight: '500',
    },
    cancelBtn: {
        marginTop: 6,
        paddingVertical: 8,
    },
    cancelText: {
        color: 'rgba(255,100,100,0.8)',
        fontSize: 15,
        fontWeight: '600',
    },
});

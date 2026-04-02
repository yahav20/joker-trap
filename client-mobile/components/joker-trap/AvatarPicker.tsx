import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { AVATARS, AVATAR_KEYS } from '../../constants/avatars';

interface Props {
    visible: boolean;
    currentAvatar: string | null;
    onSelect: (avatarKey: string) => void;
    onClose: () => void;
}

export const AvatarPicker: React.FC<Props> = ({ visible, currentAvatar, onSelect, onClose }) => {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.title}>Choose Your Avatar</Text>
                    <ScrollView contentContainerStyle={styles.grid}>
                        {AVATAR_KEYS.map((key) => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => {
                                    onSelect(key);
                                    onClose();
                                }}
                                style={[styles.avatarBtn, currentAvatar === key && styles.selected]}
                            >
                                <Image source={AVATARS[key]} style={styles.avatarImg} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: '#2b2b2b', borderRadius: 20, padding: 20, alignItems: 'center' },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    avatarBtn: { margin: 10, borderWidth: 3, borderColor: 'transparent', borderRadius: 50 },
    selected: { borderColor: '#4da6ff' },
    avatarImg: { width: 90, height: 90, borderRadius: 45 },
    closeBtn: { marginTop: 20, backgroundColor: '#4da6ff', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 20 },
    closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

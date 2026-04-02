import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { AVATARS, AVATAR_KEYS } from '../../constants/avatars';
import { UserProfile } from '../../hooks/useProfile';

interface Props {
    visible: boolean;
    currentProfile: UserProfile;
    onSave: (profile: UserProfile) => void;
    onClose: () => void;
}

export const ProfilePicker: React.FC<Props> = ({ visible, currentProfile, onSave, onClose }) => {
    const [draftName, setDraftName] = useState(currentProfile.playerName || '');
    const [draftAvatar, setDraftAvatar] = useState(currentProfile.avatar || AVATAR_KEYS[0]);
    const [showGrid, setShowGrid] = useState(false);

    useEffect(() => {
        if (visible) {
            setDraftName(currentProfile.playerName || '');
            setDraftAvatar(currentProfile.avatar || AVATAR_KEYS[0]);
            setShowGrid(false);
        }
    }, [visible, currentProfile]);

    const handleSave = () => {
        const trimmedName = draftName.trim();
        if (!trimmedName) {
            Alert.alert("Name Required", "Please enter a display name.");
            return;
        }
        onSave({ avatar: draftAvatar, playerName: trimmedName });
        onClose();
    };

    const handleSelectAvatar = (key: string) => {
        setDraftAvatar(key);
        setShowGrid(false);
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={styles.modalContent}>
                    {!showGrid ? (
                        <>
                            <Text style={styles.title}>Edit Profile</Text>

                            <View style={styles.inputSection}>
                                <TextInput
                                    style={styles.nameInput}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#666"
                                    maxLength={20}
                                    value={draftName}
                                    onChangeText={setDraftName}
                                    autoCorrect={false}
                                />
                            </View>

                            <Text style={styles.subtitle}>Choose your avatar</Text>
                            
                            <TouchableOpacity 
                                style={styles.mainAvatarBtn} 
                                onPress={() => setShowGrid(true)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.mainAvatarRing}>
                                     <Image source={AVATARS[draftAvatar]} style={styles.mainAvatarImg} resizeMode="cover" />
                                </View>
                                <View style={styles.editBadge}>
                                    <Text style={styles.editBadgeText}>Tap to change</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleSave} style={styles.saveButton} activeOpacity={0.7}>
                                <Text style={styles.saveButtonText}>Done</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Select Avatar</Text>
                            <View style={styles.scrollWrapper}>
                                <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
                                    {AVATAR_KEYS.map((key) => (
                                        <TouchableOpacity
                                            key={key}
                                            onPress={() => handleSelectAvatar(key)}
                                            style={[styles.avatarBtn, draftAvatar === key && styles.selectedBtn]}
                                        >
                                            <Image source={AVATARS[key]} style={styles.avatarImg} resizeMode="cover" />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                            <TouchableOpacity onPress={() => setShowGrid(false)} style={styles.backBtn}>
                                <Text style={styles.backBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.92)', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    modalContent: { 
        width: '94%', 
        maxWidth: 420,
        backgroundColor: '#1C1C1E', 
        borderRadius: 40, 
        padding: 25, 
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#333',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
        elevation: 25
    },
    title: { 
        color: '#FFD700', 
        fontSize: 22, 
        fontWeight: '900',
        marginBottom: 20,
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    inputSection: {
        width: '100%',
        marginBottom: 25
    },
    nameInput: {
        backgroundColor: '#2C2C2E', 
        borderRadius: 20,
        color: '#fff', 
        fontSize: 20, 
        paddingVertical: 14, 
        width: '100%',
        textAlign: 'center',
        fontWeight: 'bold',
        borderWidth: 1.5,
        borderColor: '#444'
    },
    subtitle: { 
        color: '#888', 
        fontSize: 14, 
        marginBottom: 15, 
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    mainAvatarBtn: {
        alignItems: 'center',
        marginBottom: 35
    },
    mainAvatarRing: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: '#2C2C2E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 5,
        borderColor: '#FFD700',
        overflow: 'hidden',
        shadowColor: "#FFD700",
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    mainAvatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 65, // Circular image shape
    },
    editBadge: {
        position: 'absolute',
        bottom: -5,
        backgroundColor: '#FFD700',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 3,
        borderColor: '#1C1C1E'
    },
    editBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase'
    },
    scrollWrapper: {
        height: 240,
        width: '100%',
        marginBottom: 20
    },
    grid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'center',
        paddingHorizontal: 5
    },
    avatarBtn: { 
        width: 64, 
        height: 64,
        margin: 5,
        borderRadius: 32,
        backgroundColor: '#2C2C2E',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#444'
    },
    selectedBtn: { 
        borderColor: '#FFD700',
        borderWidth: 3
    },
    avatarImg: { 
        width: '100%', 
        height: '100%',
        borderRadius: 32,
    },
    saveButton: { 
        backgroundColor: '#007AFF', 
        paddingHorizontal: 50, 
        paddingVertical: 14, 
        borderRadius: 30,
        shadowColor: "#007AFF",
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8
    },
    saveButtonText: { 
        color: '#fff', 
        fontWeight: 'bold', 
        fontSize: 18,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    backBtn: {
        padding: 15
    },
    backBtnText: {
        color: '#AAA',
        fontSize: 14,
        fontWeight: 'bold'
    }
});

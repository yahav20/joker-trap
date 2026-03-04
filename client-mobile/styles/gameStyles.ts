import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Joker Trap Game Theme & Styles
 */
export const theme = {
    colors: {
        primary: '#0080ff',
        danger: '#ff4d4d',
        success: '#4CAF50',
        overlay: 'rgba(0,0,0,0.7)',
        text: '#ffffff',
        subText: '#dddddd',
        cardBorder: '#ffffff',
    },
    spacing: {
        s: 5,
        m: 10,
        l: 20,
        xl: 30,
    }
};

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    tableZone: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Opponent Zones
    topZone: {
        position: 'absolute',
        top: 20,
        alignSelf: 'center',
    },
    leftZone: {
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightZone: {
        position: 'absolute',
        right: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomZone: {
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
    },
    // Hands & Cards
    handContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: width * 0.4,
    },
    localHandContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 10,
    },
    card: {
        width: 60,
        height: 90,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        marginHorizontal: -15, // Overlapping
    },
    // Labels
    playerLabel: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: theme.spacing.s,
    },
    activePlayerHighlight: {
        borderColor: theme.colors.primary,
        borderWidth: 3,
        padding: 5,
        borderRadius: 12,
    },
    // Modals & Overlays
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        width: '60%',
        backgroundColor: '#1a1a1a',
        padding: theme.spacing.xl,
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444',
    },
    modalTitle: {
        color: theme.colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: theme.spacing.m,
    },
    modalSubText: {
        color: theme.colors.subText,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    // Buttons
    buttonRow: {
        flexDirection: 'row',
        gap: theme.spacing.m,
    },
    actionButton: {
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: theme.colors.success,
    },
    rejectBtn: {
        backgroundColor: theme.colors.danger,
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

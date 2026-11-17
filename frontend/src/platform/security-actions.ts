const SecurityController = {
    update: {
        form: () => ({
            action: 'security-password-update' as const,
            method: 'patch' as const,
        }),
    },
};

export default SecurityController;

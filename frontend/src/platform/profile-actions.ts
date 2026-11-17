const ProfileController = {
    destroy: {
        form: () => ({ action: 'profile-delete' as const, method: 'delete' as const }),
    },
    update: {
        form: () => ({ action: 'profile-update' as const, method: 'patch' as const }),
    },
};

export default ProfileController;

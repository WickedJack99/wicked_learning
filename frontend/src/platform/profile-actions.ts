const ProfileController = {
    update: {
        form: () => ({ action: 'profile-update' as const, method: 'patch' as const }),
    },
};

export default ProfileController;

export const store = {
    form: () => ({
        action: '/api/v1/account/password/confirmation' as const,
        method: 'post' as const,
    }),
};

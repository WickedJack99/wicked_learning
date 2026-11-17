export const store = {
    form: () => ({ action: '/api/v1/registration' as const, method: 'post' as const }),
};

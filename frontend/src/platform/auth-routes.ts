export const store = {
    form: () => ({ action: '/api/v1/session/login' as const, method: 'post' as const }),
};

export function request(): string {
    return '/forgot-password';
}

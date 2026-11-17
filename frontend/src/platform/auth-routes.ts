export const store = {
    form: () => ({ action: '/api/v1/session/login' as const, method: 'post' as const }),
};

export function request(): string {
    return '/forgot-password';
}

export const email = { form: () => ({ action: '/api/v1/password/forgot' as const, method: 'post' as const }) };
export const update = { form: () => ({ action: '/api/v1/password/reset' as const, method: 'post' as const }) };

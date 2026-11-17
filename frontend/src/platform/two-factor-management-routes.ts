export const qrCode = () => ({ method: 'get', url: '/api/v1/account/two-factor/setup' });
export const recoveryCodes = () => ({ method: 'get', url: '/api/v1/account/two-factor/recovery-codes' });
export const secretKey = () => ({ method: 'get', url: '/api/v1/account/two-factor/setup' });
export const enable = {
    form: () => ({ action: 'two-factor-start-setup' as const, method: 'post' as const }),
};
export const disable = {
    form: () => ({ action: 'two-factor-disable' as const, method: 'delete' as const }),
};
export const confirm = {
    form: () => ({ action: 'two-factor-confirm' as const, method: 'post' as const }),
};
export const regenerateRecoveryCodes = {
    form: () => ({ action: 'two-factor-regenerate-codes' as const, method: 'post' as const }),
};

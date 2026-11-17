/**
 * These route descriptors are imported transitively by the copied challenge's
 * OTP-length hook. Account TOTP management is intentionally not mounted by
 * the login challenge slice; `useHttp` rejects these operations explicitly.
 */
export const qrCode = () => ({ method: 'get', url: '/api/v1/account/two-factor/setup' });
export const recoveryCodes = () => ({ method: 'get', url: '/api/v1/account/two-factor/recovery-codes' });
export const secretKey = () => ({ method: 'get', url: '/api/v1/account/two-factor/setup' });

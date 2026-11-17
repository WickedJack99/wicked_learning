/** Exact source URLs used by the copied Welcome page. Destination pages remain unavailable. */
export function login(): string {
    return '/login';
}

export function register(): string {
    return '/register';
}

export function home(): string {
    return '/';
}

/** The copied Settings corner navigation is the only mounted consumer. */
export function logout(): { method: 'post'; url: '/api/v1/session/logout' } {
    return { method: 'post', url: '/api/v1/session/logout' };
}

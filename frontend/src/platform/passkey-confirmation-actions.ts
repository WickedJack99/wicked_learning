export function index() {
    return { url: '/api/v1/account/passkeys/confirmation/options', method: 'post' as const };
}

export function store() {
    return { url: '/api/v1/account/passkeys/confirmation', method: 'post' as const };
}

export const destroy = {
    url: (passkeyId: string | number) =>
        `/api/v1/account/passkeys/${encodeURIComponent(String(passkeyId))}`,
};

import type { LearningTool } from './learning';

export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    role: 'admin' | 'user';
    email_verified_at: string | null;
    login_disabled_at?: string | null;
    banned_until?: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    tools: LearningTool[];
    user: User | null;
};

/* @chisel-passkeys */
export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};
/* @end-chisel-passkeys */

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};

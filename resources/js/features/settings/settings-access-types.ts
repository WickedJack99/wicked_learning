export type UserReference = {
    email: string;
    id: number;
    name: string;
};

export type UserRole = string;

export type PermissionLevel = 'none' | 'ro' | 'ru' | 'rud';

export type PermissionScope = 'none' | 'own' | 'assigned' | 'group' | 'all';

export type PermissionResource = {
    description: string;
    group: string;
    key: string;
    label: string;
};

export type AccessRoleSummary = {
    description: string | null;
    id: number;
    is_system: boolean;
    level: number;
    name: string;
    permissionScopes: Record<string, PermissionScope>;
    permissions: Record<string, PermissionLevel>;
    slug: string;
};

export type RegistrationTokenSummary = {
    created_at: string | null;
    created_by: UserReference | null;
    expires_at: string | null;
    id: number;
    is_expired: boolean;
    is_used: boolean;
    role: UserRole;
    roles: UserRole[];
    used_at: string | null;
    used_by: UserReference | null;
};

export type AdminUser = {
    banned_until: string | null;
    created_at: string | null;
    email: string;
    id: number;
    is_currently_banned: boolean;
    is_login_disabled: boolean;
    login_disabled_at: string | null;
    name: string;
    registration_token: RegistrationTokenSummary | null;
    role: UserRole;
    roles: UserRole[];
};

export type AccessFormState = {
    bannedUntil: string;
    loginDisabled: boolean;
    roles: UserRole[];
};

export type RoleFormState = {
    description: string;
    level: string;
    name: string;
    permissionScopes: Record<string, PermissionScope>;
    permissions: Record<string, PermissionLevel>;
    slug: string;
};

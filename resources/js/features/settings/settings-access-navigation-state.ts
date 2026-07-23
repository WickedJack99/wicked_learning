import type { AccessManagementSection } from '@/features/settings/access-management-navigation';
import type { AccessCapability } from '@/features/settings/settings-navigation';

export function readAccessSectionFromUrl(
    accessCapabilities: Record<string, AccessCapability>,
): AccessManagementSection {
    if (typeof window === 'undefined') {
        return defaultAccessSection(accessCapabilities);
    }

    const section = new URL(window.location.href).searchParams.get('access');

    if (
        isAccessManagementSection(section) &&
        canOpenAccessSection(section, accessCapabilities)
    ) {
        return section;
    }

    return defaultAccessSection(accessCapabilities);
}

export function writeAccessSectionToUrl(
    section: AccessManagementSection,
): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-access');
    url.searchParams.set('access', section);
    window.history.pushState(
        { panel: 'admin-access', access: section },
        '',
        url,
    );
}

function isAccessManagementSection(
    value: string | null,
): value is AccessManagementSection {
    return value === 'groups' || value === 'roles' || value === 'users';
}

function canOpenAccessSection(
    section: AccessManagementSection,
    accessCapabilities: Record<string, AccessCapability>,
): boolean {
    if (section === 'roles') {
        return accessCapabilities.roles?.read ?? false;
    }

    if (section === 'groups') {
        return accessCapabilities.groups?.read ?? false;
    }

    return accessCapabilities.users?.read ?? false;
}

function defaultAccessSection(
    accessCapabilities: Record<string, AccessCapability>,
): AccessManagementSection {
    if (accessCapabilities.users?.read) {
        return 'users';
    }

    if (accessCapabilities.groups?.read) {
        return 'groups';
    }

    return 'roles';
}

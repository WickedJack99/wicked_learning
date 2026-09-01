import { router } from '@inertiajs/react';
import { KeyRound, Link, Shield, Users } from 'lucide-react';
import { SettingsSectionNavigation } from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';

export type AccessManagementSection = 'groups' | 'links' | 'roles' | 'users';

export const accessManagementSections = [
    {
        description: 'Users, roles and registration tokens.',
        icon: Shield,
        key: 'users',
        label: 'User management',
    },
    {
        description: 'Permission roles and access levels.',
        icon: KeyRound,
        key: 'roles',
        label: 'Role management',
    },
    {
        description: 'Shared learner groups and memberships.',
        icon: Users,
        key: 'groups',
        label: 'Groups',
    },
    {
        description: 'Create limited, expiring links for access and grants.',
        icon: Link,
        key: 'links',
        label: 'Access links',
    },
] satisfies SettingsNavigationItem<AccessManagementSection>[];

export function AccessManagementNavigation({
    activeSection,
    canViewGroups = true,
    canViewLinks = true,
    canViewRoles = true,
    canViewUsers = true,
    onSelect,
}: {
    activeSection: AccessManagementSection;
    canViewGroups?: boolean;
    canViewLinks?: boolean;
    canViewRoles?: boolean;
    canViewUsers?: boolean;
    onSelect?: (section: AccessManagementSection) => void;
}) {
    const selectSection = (section: AccessManagementSection) => {
        if (onSelect) {
            onSelect(section);

            return;
        }

        router.visit(accessSectionHref(section));
    };
    const visibleSections = accessManagementSections.filter((section) =>
        section.key === 'users'
            ? canViewUsers
            : section.key === 'roles'
              ? canViewRoles
              : section.key === 'groups'
                ? canViewGroups
                : canViewLinks,
    );

    return (
        <SettingsSectionNavigation
            activeSection={activeSection}
            ariaLabel="Access management sections"
            items={visibleSections}
            onChange={selectSection}
        />
    );
}

function accessSectionHref(section: AccessManagementSection): string {
    return `/settings?panel=admin-access&access=${section}`;
}

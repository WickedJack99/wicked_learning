import { router } from '@inertiajs/react';
import { KeyRound, Shield, Users } from 'lucide-react';
import {
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';

export type AccessManagementSection = 'groups' | 'roles' | 'users';

export function AccessManagementNavigation({
    activeSection,
    canViewGroups = true,
    canViewRoles = true,
    canViewUsers = true,
    onSelect,
}: {
    activeSection: AccessManagementSection;
    canViewGroups?: boolean;
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

    return (
        <SettingsSidebar>
            {canViewUsers ? (
                <SettingsSectionButton<AccessManagementSection>
                    active={activeSection === 'users'}
                    description="Users, roles and registration tokens."
                    icon={Shield}
                    id="users"
                    label="User management"
                    onSelect={selectSection}
                />
            ) : null}
            {canViewRoles ? (
                <SettingsSectionButton<AccessManagementSection>
                    active={activeSection === 'roles'}
                    description="Permission roles and access levels."
                    icon={KeyRound}
                    id="roles"
                    label="Role management"
                    onSelect={selectSection}
                />
            ) : null}
            {canViewGroups ? (
                <SettingsSectionButton<AccessManagementSection>
                    active={activeSection === 'groups'}
                    description="Shared learner groups and memberships."
                    icon={Users}
                    id="groups"
                    label="Groups"
                    onSelect={selectSection}
                />
            ) : null}
        </SettingsSidebar>
    );
}

function accessSectionHref(section: AccessManagementSection): string {
    return `/settings?panel=admin-access&access=${section}`;
}

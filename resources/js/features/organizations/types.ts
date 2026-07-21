export type OrganizationUser = {
    email: string;
    id: number;
    name: string;
};

export type OrganizationMembership = {
    id: number;
    joinedAt: string | null;
    role: 'leader' | 'member';
    user: OrganizationUser;
};

export type OrganizationJoinRequest = {
    createdAt: string | null;
    id: number;
    message: string | null;
    requester: OrganizationUser;
    status: 'approved' | 'declined' | 'pending';
};

export type OrganizationMessage = {
    body: string;
    canDelete: boolean;
    canHide: boolean;
    createdAt: string | null;
    hiddenAt: string | null;
    hiddenBy: OrganizationUser | null;
    id: number;
    user: OrganizationUser;
};

export type OrganizationGovernanceType = 'anarchy' | 'monarchy' | 'random';

export type OrganizationSummary = {
    description: string | null;
    governanceType: OrganizationGovernanceType;
    iconUrl: string | null;
    id: number;
    leadershipRotatedAt: string | null;
    memberCount: number;
    name: string;
    slug: string;
    slogan: string | null;
    viewerJoinRequest: OrganizationJoinRequest | null;
    viewerMembership: OrganizationMembership | null;
};

export type OrganizationDetail = OrganizationSummary & {
    canModerateMessages: boolean;
    canSendMessages: boolean;
    isLeader: boolean;
    joinRequests: OrganizationJoinRequest[];
    members: OrganizationMembership[];
    messages: OrganizationMessage[];
};

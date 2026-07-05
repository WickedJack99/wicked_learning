export type PlatformInfoPageKey = 'about' | 'data-protection' | 'imprint';

type PlatformInfoSection = {
    body: string;
    title: string;
};

export type PlatformInfoPage = {
    eyebrow: string;
    intro: string;
    markdown: string;
    sections: PlatformInfoSection[];
    title: string;
};

export const platformInfoPages: Record<PlatformInfoPageKey, PlatformInfoPage> =
    {
        about: {
            eyebrow: 'Learning philosophy',
            title: 'About Learning Worlds',
            intro: 'Learning Worlds is an open-source experiment in building a learning environment around curiosity, autonomy, competence and meaningful progress instead of points, streaks or leaderboards.',
            markdown: `# About Learning Worlds

Learning Worlds is an open-source experiment in building a learning environment around curiosity, autonomy, competence and meaningful progress instead of points, streaks or leaderboards.

## Self-Determination Theory

Self-Determination Theory describes three basic psychological needs: autonomy, competence and relatedness. This platform uses that lens as a design compass: learners should feel agency, understand their progress and meet content through meaningful interaction rather than pressure loops.

## The current concept

The project explores world maps, nodes, activities, dialogue, questions, reflection and configurable visual themes. A deployment should be able to tell a cyber, fantasy, astronomy or completely abstract story without changing the underlying learning model.

## What this is not

The goal is not to recreate a course catalogue with badges attached. The goal is to investigate how software can support intrinsic motivation, long-term retention, wellbeing and active learning while staying transparent about design decisions that change over time.`,
            sections: [
                {
                    title: 'Self-Determination Theory',
                    body: 'Self-Determination Theory describes three basic psychological needs: autonomy, competence and relatedness. This platform uses that lens as a design compass: learners should feel agency, understand their progress and meet content through meaningful interaction rather than pressure loops.',
                },
                {
                    title: 'The current concept',
                    body: 'The project explores world maps, nodes, activities, dialogue, questions, reflection and configurable visual themes. A deployment should be able to tell a cyber, fantasy, astronomy or completely abstract story without changing the underlying learning model.',
                },
                {
                    title: 'What this is not',
                    body: 'The goal is not to recreate a course catalogue with badges attached. The goal is to investigate how software can support intrinsic motivation, long-term retention, wellbeing and active learning while staying transparent about design decisions that change over time.',
                },
            ],
        },
        imprint: {
            eyebrow: 'Legal information',
            title: 'Imprint',
            intro: 'This page is a placeholder for deployment-specific publisher information.',
            markdown: `# Imprint

This page is a placeholder for deployment-specific publisher information.

## Responsible party

Add the legal name, address and contact details of the person or organization responsible for the deployed instance.

## Project status

Learning Worlds is currently in early development. Public deployments should replace this placeholder text with legally reviewed imprint information for their jurisdiction.`,
            sections: [
                {
                    title: 'Responsible party',
                    body: 'Add the legal name, address and contact details of the person or organization responsible for the deployed instance.',
                },
                {
                    title: 'Project status',
                    body: 'Learning Worlds is currently in early development. Public deployments should replace this placeholder text with legally reviewed imprint information for their jurisdiction.',
                },
            ],
        },
        'data-protection': {
            eyebrow: 'Privacy',
            title: 'Data Protection',
            intro: 'This page is a placeholder for deployment-specific privacy and data protection information.',
            markdown: `# Data Protection

This page is a placeholder for deployment-specific privacy and data protection information.

## Learning data

The platform is intended to use learning progress only where it helps learners continue, reflect or receive useful feedback. Deployments should document which activity, answer and progress data is stored.

## Account data

Registered users currently need account data such as name, email, role and security settings. Administrators should only collect what the learning environment actually needs.

## Future AI features

If AI-assisted feedback or question generation is enabled later, deployments should explain what content is sent to external services, why it is needed and how learners are protected.`,
            sections: [
                {
                    title: 'Learning data',
                    body: 'The platform is intended to use learning progress only where it helps learners continue, reflect or receive useful feedback. Deployments should document which activity, answer and progress data is stored.',
                },
                {
                    title: 'Account data',
                    body: 'Registered users currently need account data such as name, email, role and security settings. Administrators should only collect what the learning environment actually needs.',
                },
                {
                    title: 'Future AI features',
                    body: 'If AI-assisted feedback or question generation is enabled later, deployments should explain what content is sent to external services, why it is needed and how learners are protected.',
                },
            ],
        },
    };

export const platformInfoLinks: Array<{
    href: string;
    key: PlatformInfoPageKey;
    label: string;
    settingsHref: string;
}> = [
    {
        href: '/about',
        key: 'about',
        label: 'About',
        settingsHref: '/settings/about',
    },
    {
        href: '/imprint',
        key: 'imprint',
        label: 'Imprint',
        settingsHref: '/settings/imprint',
    },
    {
        href: '/data-protection',
        key: 'data-protection',
        label: 'Data Protection',
        settingsHref: '/settings/data-protection',
    },
];

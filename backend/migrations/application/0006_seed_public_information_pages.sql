INSERT INTO public_pages (slug, title, body, published_at)
VALUES
    (
        'imprint',
        'Imprint',
        'This page is a placeholder for deployment-specific publisher information.\n\nAdd the legal name, address and contact details of the person or organization responsible for this deployment.',
        NOW()
    ),
    (
        'data-protection',
        'Data Protection',
        'This page is a placeholder for deployment-specific privacy and data protection information.\n\nLearning progress should only be used where it helps learners continue, reflect or receive useful feedback. Each deployment should document which activity, answer and progress data it stores.',
        NOW()
    );

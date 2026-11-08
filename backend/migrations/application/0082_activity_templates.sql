-- Reusable activity templates are private by default. They may be shared with
-- one organization, but always retain the creator as their sole manager.
CREATE TABLE learning_activity_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_activity_templates_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
    CONSTRAINT learning_activity_templates_type_length CHECK (char_length(activity_type) BETWEEN 1 AND 80),
    CONSTRAINT learning_activity_templates_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX learning_activity_templates_owner_name_index
    ON learning_activity_templates (created_by_principal_id, name, id);
CREATE INDEX learning_activity_templates_organization_name_index
    ON learning_activity_templates (organization_id, name, id)
    WHERE organization_id IS NOT NULL;

CREATE TABLE learning_activity_template_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES learning_activity_templates(id) ON DELETE CASCADE,
    created_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_activity_template_revisions_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
    CONSTRAINT learning_activity_template_revisions_type_length CHECK (char_length(activity_type) BETWEEN 1 AND 80),
    CONSTRAINT learning_activity_template_revisions_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX learning_activity_template_revisions_template_created_index
    ON learning_activity_template_revisions (template_id, created_at DESC, id DESC);

COMMENT ON TABLE learning_activity_templates IS
    'Private-or-organization-shared reusable authoring activity snapshots; no Laravel template import.';
COMMENT ON TABLE learning_activity_template_revisions IS
    'Immutable activity-template snapshots used by author-visible restore history.';

ALTER TABLE organizations ADD COLUMN icon_id UUID;
ALTER TABLE organizations ADD COLUMN icon_set_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL;
CREATE TABLE organization_icons (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp')),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE organizations ADD CONSTRAINT organizations_icon_fk FOREIGN KEY (icon_id) REFERENCES organization_icons(id) ON DELETE SET NULL;
CREATE TABLE organization_icon_reports (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reported_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    icon_id UUID REFERENCES organization_icons(id) ON DELETE SET NULL,
    icon_set_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    icon_object_key TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    resolved_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_icon_reports_reason_length CHECK (reason IS NULL OR char_length(reason) <= 1000)
);

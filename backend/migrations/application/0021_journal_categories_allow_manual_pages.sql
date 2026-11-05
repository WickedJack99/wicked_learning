-- The original journal initially made a topic/subtopic category unique, but
-- later removed that restriction when manual pages gained their own titles.
-- A learner may therefore keep several pages in the same category. Reflection
-- persistence still selects the oldest matching page, mirroring the original
-- first-or-create behavior; the supporting index makes that lookup bounded.
ALTER TABLE learner_journal_pages
    DROP CONSTRAINT learner_journal_pages_principal_topic_subtopic_unique;

CREATE INDEX learner_journal_pages_principal_category_created_idx
    ON learner_journal_pages (principal_id, topic, subtopic, created_at ASC, id ASC);

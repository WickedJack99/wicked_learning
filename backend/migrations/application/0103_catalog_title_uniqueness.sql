-- Laravel validates reusable item and tool titles as globally unique. Keep the
-- greenfield catalog race-safe at the database boundary as well as in the
-- authoring command.
CREATE UNIQUE INDEX learning_items_title_unique_idx ON learning_items (title);
CREATE UNIQUE INDEX learning_tools_title_unique_idx ON learning_tools (title);

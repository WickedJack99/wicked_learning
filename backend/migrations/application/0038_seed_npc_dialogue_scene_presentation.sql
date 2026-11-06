-- Keep the local dialogue fixture visually representative of the source player.
-- These are bundled public development assets, not uploaded learner media.
UPDATE learning_npc_dialogue_nodes
SET node_config = node_config || '{
    "backgroundDark":"/images/themes/npc-dialogue-background-dark.svg",
    "backgroundLight":"/images/themes/npc-dialogue-background-light.svg",
    "npcImageDark":"/images/characters/npc-mira-dark.png",
    "npcImageLight":"/images/characters/npc-mira-light.png",
    "npcX":72,
    "npcY":48,
    "slideDirection":"right",
    "slideDurationSeconds":0.35,
    "fadeDurationSeconds":0.25
}'::jsonb
WHERE activity_id = '10000000-0000-4000-8000-000000000003';

UPDATE learning_npc_dialogue_nodes
SET node_config = node_config || '{
    "sceneAssets":[{
        "id":"mira-lantern",
        "imageDark":"/images/characters/golden-lantern-page.png",
        "imageLight":"/images/characters/golden-lantern-page.png",
        "label":"Mira''s lantern",
        "layer":"behind_npc",
        "mirrored":false,
        "width":24,
        "x":30,
        "y":62
    }]
}'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000011';

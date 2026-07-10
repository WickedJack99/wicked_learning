# Obstacle Activities

Obstacle activities are tool-resolved moments inside an activity route.
They are not meant as score gates. They should create a small sense of
exploration: the learner notices a blocker, equips a useful tool, applies it,
and receives contextual feedback through the route itself.

Current direction:

- Obstacles have dark and light background images.
- Obstacles have dark and light obstacle images.
- Obstacles can show an optional prompt bubble that uses the same typewriter
  reveal style as NPC dialogue bubbles.
- Prompt and success bubbles can be hidden by the learner.
- Bubble background color, border color, opacity and typing speed are
  configurable.
- A floating player/tool-belt control is available on map and activity pages.
- Tools are learner-owned capabilities with dark/light images.
- A tool can be selected from the tool belt, then the cursor uses that tool
  image while equipped.
- Each obstacle defines which tool ids can resolve it.
- Successful resolution can play a simple configured success animation and
  then show a success bubble.

Animation decision:

For the first implementation, uploaded animated GIF/WebP assets are preferred
over a custom frame-node animation graph. This keeps configuration familiar
for admins and keeps runtime behavior small. The tool data model still keeps a
`config` field so a later frame-sequence editor can be added without changing
the basic tool concept.

# Feature Overview

Wicked Learning is a domain-agnostic prototype for explorable learning without
points, streak pressure or leaderboards. Deployments configure their own maps,
MapAssets, activity routes, media and public presentation while the learning
and authoring systems remain reusable.

This is the current behavior reference. Product rationale and boundaries live
in [product.md](product.md), implementation structure lives in
[architecture.md](architecture.md), and active work lives in
[roadmap.md](roadmap.md). When this document disagrees with the application or
its tests, verify the behavior and correct the source of truth rather than
silently inventing a new contract.

## Learner Experience

### Public Pages And Accounts

Visitors can open the welcome, About, Imprint, Data Protection and source-code
pages before logging in. Public and authentication surfaces support configurable
light and dark presentation values.

Registration requires a valid registration token. Authenticated users can edit
their profile and language, choose appearance and sound preferences, manage
passwords, passkeys and two-factor authentication, and review notifications.
Successful password changes and two-factor or passkey lifecycle changes also
appear in the administrator's per-user access history without exposing
credentials.

### Freeform World Maps

Learners explore maps made from freely positioned MapAssets. A MapAsset combines
the visible map object with the learning place learners can focus, including
its activities, routes and available interactions.

Current map behavior includes:

- percentage-based X/Y placement, Z depth, size and opacity
- transparent PNG and WebP artwork with overlapping visual layers
- image framing can show the full image or fill and crop its square frame, with
  center, top, right, bottom or left anchoring
- click targets can follow visible artwork instead of transparent image edges
- responsive hit testing shared by the learner map and World Builder preview
- normal, hover and focused visuals with configurable borders, labels, colors
  and optional highlight images
- a focused right-side panel with title, description, bookmark state and route
  choices
- no learner-side dragging of MapAssets
- role-based map access
- locked, hidden, hinted, available, recommended and completed learner states
- unlock rules based on completed MapAssets, tools, learner roles, item
  possession, time and nested AND/OR groups
- authored locked-node prerequisite cycles are rejected when every successful
  path would depend on the cycle; independent OR alternatives remain valid
- World Builder flags locked prerequisites without an authored learner-opening
  path while leaving the human support-opening fallback available
- authorised Learning Support staff with map-node edit access can open a locked
  MapAsset for one visible learner; the opening is reversible and does not alter
  the authored prerequisites
- tool-driven discovery of hidden MapAssets

MapAssets have four interaction modes:

- **Focusable** opens the learner panel and activity routes.
- **Decorative** is visual-only and ignores learner focus.
- **Hide on hover** becomes pointer-transparent while hovered so underlying
  MapAssets can be selected. It remains hidden while an overlapping underlying
  MapAsset stays focused.
- **Toggle state** switches between two configured images when clicked. Each
  state has its own image, X/Y position and size.

### Search And Bookmarks

Map search runs on the server and can find accessible MapAssets on other maps.
Search results navigate to the matching map and focusable place.

Learners can bookmark focusable MapAssets. Bookmarks appear on a personal map
and link back to the original learning place.

The learning desk separates unfinished route progress from recent completed
traces. When the same route has both an active run and an older completion, it
appears only under Continue learning so the desk keeps one clear next step.
Current and recent route rows also retain their authored learning-area links,
so the desk can lead directly to the corresponding competence reading without
presenting the route as a score. Each desk entry also explains its source in
plain language: active work is still in progress, recent work was completed
recently, a revisit was chosen by the learner, and a recall question was kept
for another attempt. Recall rows also retain and show the learner's optional
confidence reflection after feedback, separately from the initial confidence
and correctness result. These reasons describe placement rather than making an
opaque recommendation, and the learner can choose another desk area whenever
it is more useful.
Recent private check-ins are also available as a bounded, paginated reflection
trail. Each entry links back to its activity and retains the learner's optional
feeling, note and chosen next direction without turning them into a score or
recommendation. When the learner chooses to look for something related and the
activity has authored competence areas, those areas become direct links to the
competence map; the desk does not invent or rank additional recommendations.
This keeps the desk from adding a separate progression panel. Desk areas are
switched through a local navigation control whose order remains stable as
different areas become available. The selected area is also kept in the page
URL, so a learner can refresh, share or return to the same desk direction
without losing that choice. Each area control identifies its section and moves
focus to the newly shown heading after an intentional switch. When no area is
specified, the desk opens on the Connections area when saved connections exist,
otherwise on active route work
or the first populated area; an entirely empty desk keeps Connections as its
orientation prompt. Route and revisit
collections are paginated so the desktop desk does not need one growing
collection scroll region. Revisit
invitations explain both when the learner chose to return and when the item
became ready, keeping the spacing decision visible without exposing internal
scheduling details. Paginated collection controls keep their navigation
footprint stable when the last page is shorter and allow a learner or author to
enter a valid page number directly; values outside the available page range are
rejected. Learners can also enter a focus view that hides the
secondary pinned-and-bookmarks rail while keeping the selected desk area and
primary navigation available. The choice is retained locally per signed-in
account and browser, so a refresh does not undo a deliberate presentation
preference; it is not synced learning state, a recommendation or a progress
signal. The normal desk layout returns when focus view is turned off. When time
and purpose filters are selected, the desk remembers that planning lens on the
same device for the signed-in learner and provides a clear action to reset it.
These choices are only a view preference, not synced learning state, a
recommendation or a progress signal. If time and purpose filters leave no
current route visible, the
Show all routes action clears both planning filters so the learner can recover
the complete current-route view in one step.

### Activities And Routes

A focusable MapAsset can expose several route starts. Activities play on a
dedicated page and are connected through a graph rather than a fixed linear
course sequence. Backend route progress preserves the current run and activity
across refreshes; learners can restart or reset routes according to the authored
rules. When a node offers more than three route starts, the learner sees them in
bounded pages with stable controls rather than an expanding route scroll area.
The activity page keeps the global header focused on navigation and shows
the current topic, map, route and place in a compact context panel beside the
player. Its fixed orientation, route-progress, bookmark and empty-state copy
uses the platform translation catalog; authored activity content remains
separate from that generic UI catalog. When the place offers other authored
routes, the context panel can disclose them as a small paginated set; choosing
one starts or resumes that route while leaving the current route saved.
When an author has configured an evidence objective or concept labels, the
activity orientation also shows that learning focus as authored context. It
describes what the activity invites without claiming that completion proves the
objective or turning the labels into a score.

Selecting a route opens that route and resumes its saved position when the
position is still valid; it does not silently switch to another route. Activity
connections have meaningful learner-facing labels, and authors can edit or
remove those labels while the platform supplies a safe default when no label is
authored. Learner playback also carries an authored connection label into the
post-activity action where that transition is known, including the branch chosen
after a question answer or an NPC dialogue exit; the existing conclusion pause
identifies that authored next step when a dialogue ends through a named exit.
Generic action copy remains the fallback when no label is available. Authors can
also add an optional short route description. Learners see
that guidance beside the route wherever they choose a starting point; it provides
orientation without ranking routes or making an automatic recommendation. While
a route is open, the activity page keeps the selected route,
activity and run in its deep link so a refresh returns to the same place
instead of falling back to the node's first route.

The Paths directory shows each route's authored learning areas and links those
areas to the focused competence reading. Routes are returned in bounded server
pages with stable controls as the directory grows. The route remains a
suggested way in, not a required sequence.

Implemented activity types are:

- graph-based NPC dialogue
- questions with correctness and outcome branches
- reflection and explicit Review / revisit pauses
- Markdown page graphs
- shared tasks
- learner message prompts and message walls
- tool grants and item grants
- tool obstacles and item-slot obstacles
- portals
- open practice pauses for learner-directed next steps, with an author-written
  invitation shown before the learner continues

Authors can optionally add a suggested duration in minutes to any activity.
Learners see it as a quiet planning cue before the activity content; it is not
a countdown, deadline, completion condition or timing-based learner measure.
On the Learning Desk, learners can optionally narrow current routes to those
with an authored guide of up to 15 or 30 minutes. Routes without a guide remain
available under Any time; the choice is temporary and does not change progress.
Learners can also temporarily filter current routes by their authored learning
purpose, such as applying, explaining or retrieving an idea. These filters only
change the desk view and do not rank routes or alter progress.

Shared tasks can be authored as a general contribution, a question, or a
reflection. Playback uses that kind to orient the learner and accepted
submissions retain the kind as structured context; it does not grade or rank
the contribution. Authors may also allow an anonymous contribution sample to
be shown to later learners, but each learner opts in per submission. Playback
shows only a small, bounded set of opted-in contributions and does not expose
learner identities.
When a shared task offers anonymous contributions or peer review, playback
separates the contribution form, shared examples and peer-review exchange into
an accessible in-panel area switcher. The prompt and shared progress remain
visible while the learner moves between those distinct workflows, so
cooperation content does not push another workflow out of the activity view.
Authors may optionally add a project brief with a shared goal, a useful outcome
and up to six suggested steps. Learners see this orientation beside the shared
task prompt and can optionally mark those steps as private planning notes for
the current play run. When useful, a learner can optionally associate a
contribution with one authored project step; that label helps peers orient to
the shared work without assigning ownership, affecting completion or replacing
learner choice about how to contribute. The checklist remains private and does
not become a public progress signal.
Authors may also invite one anonymous peer review. A learner who has contributed
can respond once to one other learner's explicitly shared contribution using the
author's prompt. The interaction exposes no learner identities and provides no
ratings, rankings or public quality score.
After submitting, the reviewer can see their own anonymous response privately in
the peer-review area alongside the recorded confirmation; it is not exposed to
the learner whose contribution they reviewed.
The Shared Task editor includes a compact learner preview so authors can check
the prompt, project orientation, contribution affordance and optional review
handoff before saving. When peer review is enabled, the preview can switch
between the contribution and peer-review states; it remains static and does not
simulate submissions or change learner state.
The contributor can later see a bounded set of anonymous responses to their own
contribution; other learners cannot see those responses. Reviewers may
optionally describe a response as an explanation, example, question or
counterexample and associate it with one authored project step; those labels
orient the exchange without grading it. The contributor may mark one received
response as helpful or clear that mark; this is a private resolution signal,
not a rating or popularity measure. The contributor may also keep an optional
private follow-up note about what to carry forward from a received response;
the note is visible only to that contributor, can be cleared, and does not
change completion, evidence, or peer-review visibility.

NPC dialogue speech bubbles can optionally play letter-keyed typing sounds.
Authors enable this per speech bubble and may choose an authored sound set or
the configured default. Spaces remain quiet and unsupported symbols reuse a
random available letter sound; learners can still mute or lower effects sound
through their existing sound preferences.

Activity authors can optionally add feedback guidance for any activity: its
purpose, what to notice in a learner response or action, and one possible next
action. Playback presents this as a compact orientation aid, and the scoped AI
activity review inspects the guidance and attached source references within the
same scoped authoring context. It is not a score or a learner assessment. When
a purpose is configured, it is captured with the
resulting evidence event and shown alongside that learning moment in the
learner's competence ledger; older moments without a purpose remain valid.
Explanation and transfer evidence also require an authored observable “what to
notice” criterion; without one, completion remains represented as
participation rather than making a stronger claim than the activity supports.
Authors may also add a short response-feedback note. For explanation, transfer,
and review responses, it appears in the post-response comparison pause so the
learner can relate their response to the authored guidance. It is explanatory
author guidance, not automated critique, a grade, or a rubric result.
The authoring form includes a compact learner preview of this pause, updating
as guidance is written so authors can check the learner-facing sequence before
saving.
When an explanation or transfer activity includes an independent check, the
pause also places the first and fresh private responses side by side. This
supports learner inspection of what changed or stayed consistent without
automatically judging either response. The optional confidence reflection is
shown after that comparison and any author guidance, so it describes the
learner's current understanding at the point the question is asked.
After the fresh response is saved, keyboard and assistive-technology focus
moves to the comparison heading so the newly available content is announced in
the same order it appears visually.
Reflection activities configured for explanation use a clearly labelled
explanation response. Transfer reflections additionally ask the learner to
name the changed context where they tried the idea. These responses are saved
with the learner's private journal entry; they are structured evidence context,
not an automatic rubric pass. Explanation and transfer activities can also
capture an optional starting-confidence signal before their guidance pause;
after the pause they may also record how settled the idea feels now. These
before-and-after values remain descriptive learner signals rather than an
assessment or score, and either may be left blank.
For reflection and review activities, the matching private response must be
saved in the same activity play-run before an explanation or transfer evidence
entry is recorded; an older response from another run does not authorize a new
claim. Completing without that response remains participation evidence.
The resulting evidence keeps an internal reference to the private response for
auditability, while learner ledgers and support signals continue to exclude its
text. Shared-task contributions use their own submission path.

Authors can open a bounded, paginated history for an activity's details and
type-specific configuration, inspect a selected revision on demand, and restore
an earlier version. The inspection view includes the stored activity fields,
type-specific settings, companion override state and graph position. Restoring
first preserves the current configuration and returns the activity to authoring
review. Route connections and separate NPC dialogue graph records are not
changed by this first activity-history slice.

Review activities optionally collect the learner's own confidence after the
review response. The value is stored as a descriptive signal on the completion
and any due revisit attempt; choosing nothing remains valid and does not block
completion. They can also optionally describe the result as clearer now, more
connected, or still open. These are private learner observations, not scores,
correctness judgments, or automatic rubric decisions.
The three signals have short plain-language explanations during review and in
the competence and topic histories, so their meaning stays visible without
turning them into an assessment scale.

When a learner chooses to return after a review pause, the due activity is
opened as a review attempt. The Learning Desk and Journal explain when it
became ready and whether the learner originally paused or postponed the return.
Completing it records that attempt separately from route completion and does
not by itself claim independent competence.
When the reviewed activity saves a private response during that run, the attempt
retains its response kind and an internal link to it; the response text remains
private.

Question activities can be authored as single-choice or multi-select prompts.
For multi-select prompts, an answer is correct only when it contains exactly
the authored correct options; the interaction does not introduce partial-credit
points. Feedback is shown before route completion is recorded, giving learners
an optional pause to reflect on how settled their understanding feels after
comparing with the explanation. That post-feedback signal remains part of the
activity evidence and does not grade the learner. They also let learners
optionally clear the visible answer and make a fresh independent attempt before
finishing; an author-written comparison note can appear in that result pause
without becoming automated critique or a grade. Earlier attempts remain
available as bounded private context rather
than being replaced. Learners can also explicitly keep an answered question in a
private recall queue. The queue is shown as its own paginated Learning Desk
area, links back to the originating activity and can be cleared by the learner;
it has no deadline and does not alter route progress. This is a reusable
question-level recall affordance, not an adaptive schedule or a score. The desk
shows whether a question is ready or when it is expected next. Answering from
that queue records the learner's correctness, confidence and review count and
shows the latest result and confidence plus the next interval using a
transparent baseline schedule. Learners can defer a queued question by one day
without changing its outcome or review count; only an explicit recall answer
changes that schedule. It remains private and learner-controlled, not an
adaptive or AI-generated recommendation.

Every activity type can reference optional reusable ambience. More specialized
types can add their own interaction sounds and visuals.

### Learning Companion

Administrators can enable and configure a small Learning Companion with a
display name, optional avatar image, avatar color, avatar framing and orientation
message. Administrators can preview the avatar and adjust its focus point and
size inside the visible circle. The avatar color controls the launcher and
fallback avatar treatment. The avatar image uses the reusable media workflow for
upload, download, selection and clearing.
Companion settings may inherit from the platform, world, map, place or
activity, with the most specific valid setting taking precedence. Administrators
can create and rename reusable dialogue graphs in the Learning Companion's
Dialogues section, shape bounded message, choice, AI and end nodes in a React
Flow graph editor, and assign each graph to one or more worlds, maps, places or
activities. Both graph records and
assignment targets use paginated, searchable views; assignments are saved as a
multi-selection rather than as hidden scope configuration. Authored dialogue
graphs are bounded and validate their node links and terminal actions against a
small server-owned navigation allowlist. The graph editor opens on demand in a
bounded overlay so the graph list and selected-graph details remain visible by
default. When a graph is assigned, the learner launcher can traverse its
authored message, choice and end nodes locally, with local Back and Restart
controls for recovering from a branch; navigation choices resolve only to
server-provided context actions. An administrator may enable authored AI nodes
with a guarded `learner_companion` template and a maximum of three allowlisted
context capabilities. Before a turn, the learner chooses no AI support, one
reflective question or one small hint. After completing an activity, the
learner may also request one bounded comparison or next question grounded in
the activity's authored feedback guidance. The post-attempt request does not
send the learner's answer, confidence, journal or other private response to the
companion. Only the selected question, hint or post-attempt request makes one
server-resolved, plain-text provider turn. Generated responses are marked as
based on authored guidance and the displayed context, may be incomplete, do
not receive the learner's private response and cannot navigate or mutate
learning content. The response is transient in the open companion panel and
cannot read private journal, group or unrelated learner history. AI assistance
is not independent learning evidence. When a learner receives a successful
question or hint response before completing the current activity, that
completion records the selected support level in its evidence instead of
silently presenting it as independent performance. Post-attempt support does
not rewrite the completed activity's earlier evidence.
Learners can open the companion from the lower-left corner on authenticated
learner-facing pages, including the Learning Desk, paths, topics, competence
map, bookmarks, organizations and activities, or immediately to the right of
map search on a world map. Settings remains an administrator surface and does
not show the learner companion. Without a configured provider or enabled
template, the companion keeps its deterministic fallback. The companion does
not replace map exploration or activity playback and does not make
independent-competence claims from AI assistance.

### Learner Messages

A message-prompt Activity collects at most one short contribution from a learner
for a MapAsset-scoped topic. A message-wall Activity displays the latest visible
contributions as dismissible cards during activity playback. Learners do not see
other messages until they reach the authored wall.

Authorized staff can review messages grouped by MapAsset and topic, see author
attribution, hide inappropriate entries and permanently delete them when their
permission level allows it.

A message prompt may instead be configured as an optional support request. The
learner chooses whether to send a short request to authorized Learning Support;
support requests stay out of peer walls and remain available in this same
moderation surface. Support staff can send private informational responses from
that surface, and only the requesting learner can see them on the Learning Desk
or when they revisit the activity. These responses do not enter peer walls or change completion,
competence, ranking or helpfulness signals.

Peer message walls may also invite one optional response per learner and
message. Responses are anonymous to learners, subject to the same moderation
filtering, and managed by Learning Support alongside the original messages.
Walls expose their visible contributions through bounded pages, so a growing
topic does not hide older contributions behind a clipped or unbounded panel.
Authors can optionally add short response guidance to help peers explain a clue,
question, example or counterexample; this guidance is an invitation, not a grade
or required rubric. Responding learners can optionally describe their
contribution as an explanation, an example, a question or a counterexample. The
label gives the exchange a little orientation without measuring response
quality, and older responses without a label remain valid. Learning Support sees
the same response label while moderating the exchange. The learner who
started a message can mark one visible response as helpful, or clear that mark;
the marker is shown as a resolution signal without exposing identities or
turning responses into a popularity measure. Authorized Learning Support staff
can see that resolution signal while moderating the exchange and can filter the
selected topic's threads with or without learner-confirmed help.
Learning Support keeps the topic directory lightweight and retrieves one
selected topic's moderation messages in bounded pages; changing the topic,
resolution view or page loads only that slice while preserving the existing
moderation actions. Response histories are also paged per message, so a busy
thread does not expand the moderation payload without limit; response hide,
show and delete actions remain available on each loaded response page.

The moderation directory also summarizes helpful and unresolved message counts
per topic. A bounded needs-attention digest links staff directly to up to three
topics with unresolved exchanges, while the existing topic navigation remains
available for deliberate review.

### Journal, Competence And Collaboration

The learner journal is a private Markdown workspace with custom pages,
reflection-created pages, search, writing/rendered modes, autosaved drafts and
export. The shared Journal action opens it as a focused workspace. Learners can
explicitly request feedback for one page from an eligible journal, group or
organization domain. The request is shown in the permission-controlled
feedback queue; this explicit request is the supported sharing path, and
journals are not a general staff-reading surface.
The Learning Support feedback queue shows a bounded page of requests at a time,
with stable pagination for older requests while keeping the existing review and
response actions available.
Reflections created while playing an activity remain private and do not create
feedback requests; learners can share the resulting journal page explicitly
from the Journal when they choose a permitted feedback domain.

Recent journal check-ins retain their related learning areas. Each area can
open its focused competence-map reading, while the activity itself remains a
separate route back to the learning place.

After completing an activity, a learner may optionally choose a private next
direction: return to that place, look for something related, or let it settle.
The direction is saved with the check-in and shown later in the Journal and
competence pulse as orientation, without deadlines or a progress score.
The check-in opens as a bounded overlay above the activity rather than pushing
the activity below the viewport. Learners can hide it and reopen it with the
Show conclusion control; keyboard focus moves into the conclusion when it opens
and returns to that control when the overlay is hidden.
When a graph route or activity transition changes the active activity, focus
moves to the new activity heading so keyboard and screen-reader users are
oriented at the beginning of the new activity without changing route or
progress behavior.
Authors can optionally add a short context sentence explaining why one of these
directions may be useful after a particular activity. The choice set remains
bounded and optional.

When the learner chose `Return to this place`, the Learning Desk and Journal
can surface the activity again after a transparent three-day spacing window.
Both surfaces show when the invitation became ready and explain the spacing
choice that produced it. The learner can open it, defer it or hide the
invitation. This is a quiet, finite return queue rather than a notification or
required task queue; a new check-in replaces an older direction, and completing
the reopened activity consumes the invitation. Opening it without completing
it leaves the choice available.

Topic pages can also show a short private trail of recent learning-pulse
reflections connected to that topic. Each entry links back to the activity and
its map place. When two or more private reflections are connected to the
topic's published map, the trail can offer a bounded chronological look back and
link to the full Journal.

Activities can contribute weighted competence topics. Learners see a
qualitative competence map, topic trails and bounded linked learning moments.
The evidence ledger keeps a bounded set of recent events reachable through the
topic trail and selected-star reading. Authorized support staff receive scoped
signals for orientation and support conversations rather than ranking; they do
not receive private journal text through this view.
Question activities also retain the learner's pre-answer confidence, the
correctness outcome, attempt order and independent-assistance context. The
learner can see the confidence, attempt and recorded assistance context in the
competence reading;
after an answer, the activity also offers a neutral confidence reflection that
describes whether the result aligned with, exceeded or challenged the starting
confidence. This supports calibration and noticing change without presenting a
grade or changing competence by itself.
The competence view also offers a bounded review history showing the revisited
activity, outcome and confidence context. When guided review is used, it can
show the learner's optional confidence before and after the guidance; it does
not expose private journal writing or turn review attempts into a score.
It also labels the response kind the learner chose, such as reflection,
explanation or transfer, so the history stays understandable without
pretending that these different evidence types are interchangeable.
When a learner completes a due revisit, the review history and the linked
competence evidence retain the same attempt sequence. For question activities,
the review record also preserves the answer's correctness and starting
confidence; the generic completion path does not add a second evidence event.
The review history also retains whether the learner returned after choosing to
pause or after postponing the invitation. This is descriptive context about
the learner's timing choice, not a measure of diligence or attention.
When the existing route context provides an entry timestamp, the bounded review
record also keeps the optional elapsed-time observation used by completion
evidence. It is not shown as a score or interpreted as attention; reviews
without that route context leave the value absent.
The evidence reading also distinguishes a successful independent recall from a
generic attempt or encounter, while keeping application, explanation,
reflection, review and transfer as the kinds of activity they were rather than
turning them into a shared score.
When a learner records an optional descriptive review outcome, the competence
map and topic evidence ledgers show that signal alongside the learning moment;
it remains a learner reflection, not a grade or score.
When assistance context is recorded, the learner's own competence and topic
ledgers label it as independent or supported context. Legacy events without a
recorded assistance level stay unlabeled; this context is not exposed through
the staff support-signals view or used as a score.
For explanation, review and transfer moments, the evidence ledger also retains the
author's observable “what to notice” criterion that was active when the moment
was recorded. Authors can add up to three optional observable rubric cues, one
per line; these are learner-facing prompts for noticing, not pass/fail grades.
Learners may optionally mark the cues they noticed in their own explanation,
review response or transfer response. The selection is saved as private
self-observation context and a snapshot in the learner's evidence ledger and,
for due revisits, in review history; it does not determine correctness or
create a rubric pass.
When authored observation guidance is present, saving an explanation, review or
transfer
response opens a short learner-controlled pause showing the “what to notice”,
possible next action and observable cues again before the activity continues.
The learner may optionally record a second confidence signal after that pause;
the evidence ledger shows both sides of the comparison. This is explanatory
orientation, not automated critique or grading.
Authors may optionally add an independent-check prompt for explanation or
transfer activities. After the feedback pause, learners can write a fresh
private response without looking back or continue without it. The fresh
response is stored separately from the first response and the evidence ledger
identifies it as an independent check; it is still an attempt, not an
automatic rubric result. Authors may also add a separate comparison note that
appears only after the fresh response is saved, so the learner can relate the
new example to the authored guidance without receiving an automated judgment.
Question results also repeat authored purpose, observation guidance, next action
and observable cues so learners can compare their answer with the intended
learning focus.
Review responses with authored guidance use the same pause and show its purpose
before the learner continues, keeping the review signal descriptive rather than
turning it into a grade.
Authors can also provide a concise evidence objective. The objective is copied
into later evidence records as context for the learner's reflection; it does
not create a grade or replace the activity's learning purpose.
The activity editor shows a compact learner-orientation preview beside the
objective and concept fields, so authors can see that context before saving.
When Explain or Transfer is selected without observable “What to notice”
guidance, the editor warns that the activity will remain participation evidence
until that guidance is added; existing content is not silently rewritten.
Authors can optionally attach up to eight concept labels, one per line. These
labels are copied into later evidence records and shown in the competence and
topic ledgers as context; they do not create a grade or alter the qualitative
competence interpretation.
Authors can maintain a separate Concept Library of reusable names and optional
descriptions. Active library entries can be added while configuring an
activity's evidence labels, while the activity still stores a snapshot so
later library edits do not rewrite existing evidence.

Activity authors can attach up to five source references with a title, URL,
optional publisher, publication date, rights or licence, stable anchor and a
short excerpt or location note. Learners can expand the Sources section during
playback to inspect those references. The competence evidence ledger snapshots
the bounded references that were active when the learning moment was recorded,
so later author edits do not rewrite its provenance. Source references explain
the basis of activity content; they are not learner evidence, grades or private
learner data.
Authors can save a validated reference to the bounded source catalog from the
activity editor and copy a saved record into another activity. This is an
authoring convenience, not a live link: changing a catalog record does not
rewrite an activity or an existing learner evidence snapshot. The picker
searches titles, URLs, publishers, anchors, excerpts and concept labels, and
paginates catalog records so a growing catalog does not have to be loaded into
every activity editor at once. Catalog records can carry reusable
Concept Library labels; authors can filter catalog reuse by those labels while
searching and paging. Copying a record includes those labels in the
activity's provenance snapshot, and learners can inspect them alongside the
source. Authors can also edit or delete catalog records from the same picker;
deleting a catalog entry does not remove copied activity references. Version
history is available for author inspection through the same picker: each
update keeps the prior metadata as an immutable, paginated revision. Richer
concept linkage and reusable excerpt workflows remain future work.
Authors can restore a listed revision; the current record is preserved as a
new revision first, and copied activity references still do not change.

Published topic pages also show the authored learning areas woven through their
accessible map activities, with links into the corresponding focused
competence-map reading. Those links retain the originating topic as a return
path even when the competence area is not itself a formal topic.
When connected competence areas have evidence, the topic page keeps their
description and evidence vocabulary in that same compact link rather than
repeating a second list of the same areas. Separate links remain available when
a competence area also relates to another published topic.

Organizations, learning groups, group chat and shared-task activities form an
early collaboration slice. Their purpose is contribution and coordination, not
public scoring. Group members can label a message as a help request and mark
that request resolved; this records that the request no longer needs attention,
not that a response was correct or that a learner earned a result. When a
learner belongs to multiple groups, the map group overlay presents one chat at
a time with pagination and loads later group pages only when requested; the
message transcript itself remains a bounded reading area.

### Tools, Items And Portals

Tools are reusable learner capabilities. They can be granted by activities or
NPC dialogue, equipped from learner controls, used in obstacles, reveal hidden
MapAssets and satisfy configured unlock rules.

Items are consumable inventory objects used by item-grant and item-obstacle
activities. Grants and inventory changes are persisted with the learner's
activity progress.

Portal activities connect MapAssets and maps. Entry portals own the destination;
exit portals receive the learner and can show or skip an arrival scene. Portal
visuals support reusable backgrounds, foregrounds, animated loops and optional
click-to-enter behavior.

## Administration

### Settings Workspace

Personal and administrative settings share a multi-level, full-height workspace.
Administrative areas are visible according to configurable resource permissions:

- Learning Support
- World Builder
- Assets & World Objects
- Access management
- AI
- Translations
- Color palettes
- Public pages
- API

Settings colors, inputs, navigation states, journal presentation and map visual
palettes are database-backed instead of being fixed to one deployment theme.

### Access Management

Admins can manage users, registration tokens, roles, groups and account access.
Roles carry permission levels per resource:

- `No`: no access
- `RO`: read-only
- `RU`: read and update/create
- `RUD`: read, update/create and delete

The platform supports multiple assigned roles, configurable role definitions,
login disabling, temporary bans and account deletion. Map editing is additionally
scoped by map access.

### World Builder

World editing stays in Settings rather than being mixed into the learner map.
The World Builder provides:

- a world/map graph with portal relationships
- map creation and map configuration for details, visuals, access and deletion
- a full-size MapAsset surface with a floating Add MapAsset action
- the demo world seeds image-backed MapAssets on both connected maps so each
  surface is immediately discoverable; empty maps show how to add the first
  visual area
- center placement for new MapAssets and explicit X/Y/Z/size/opacity fields
- a map-level lock for MapAsset placement
- one MapAsset editor for surface, text, learner panel, activities, rules,
  visuals, sounds and deletion
- shared upload, download, select-existing and clear controls for images
- a live MapAsset preview using the learner renderer
- light/dark map palettes and previewable controls
- activity, NPC dialogue and Markdown graph editors

Question activities can now be authored in the activity editor, including the
prompt, answer choices, correctness, feedback, explanations and optional
outcome keys for branching. Authors can connect an outcome branch to a matching
answer key in the activity graph; answers without a matching key continue to
use the generic correctness branch. Their separate question records are
preserved when authors save and reuse private activity templates.

Map detail edits keep a private author history of the title, description, topic
and MapAsset-surface lock settings. Authors can inspect the bounded history and
restore an earlier version without losing the current details.

Authors can also inspect a bounded private history for an individual MapAsset's
learner-facing configuration and restore an earlier version without losing the
current configuration. Structural node placement and broader map history remain
separate authoring concerns.

Authorized authors can download a single-map JSON export manifest containing
authored map, node, MapAsset, activity-route and explicit media/portal reference
data. The manifest uses portable slugs and excludes learner progress, revision
history, local editing-group assignments and AI review internals. Importing and
multi-map bundles remain future authoring work. Within the current world,
authors can duplicate a map as a new authored copy, including its activities,
routes, assets, questions, dialogue graphs and companion assignments. The copy
gets fresh content IDs, starts activities in authoring review, and does not
carry learner history, map history, review runs or editor groups. Authors can
upload a manifest to
run a bounded structural readiness check; it reports malformed links, missing
workspace references and map-slug conflicts without creating or changing content.

The activity graph also provides a template action for eligible activities. It
opens an editable copy with a destination MapAsset chooser, reusing the
author's existing editable world graph. Copies preserve reusable content and
media, while message topics and portal destinations are cleared when the
destination changes so source-context references cannot be carried across by
accident. Authors can also save an eligible activity as a private, named
template and browse their templates through a bounded paginated picker when
creating an activity. Template metadata is listed separately from its full
authored configuration, which is loaded only after selection. Authors preview
the template's activity type, title and context-sensitive references before
explicitly applying it as a new editable draft. Learner responses, evidence
and the separate NPC dialogue graph are not included.
Authors can rename or delete their own saved templates from that picker; these
operations do not affect activities that were previously created from them.
Shared, versioned templates and richer asset-resolution controls remain future
authoring work.

The World Builder graph surfaces the same review state on each map card. Maps
with waiting activity reviews link directly to the first affected node, so an
author can discover and enter the scoped review queue without opening maps one
by one.
World Builder also has a world-level Review queue section that gathers waiting
MapAssets across the current world and paginates them as the collection grows.
Review execution remains scoped to one activity at a time; the list is an entry
point rather than batch approval.
Review results can open the affected Activity editor directly, so content
suggestions and optional metadata suggestions can be considered in the same
scoped authoring flow.
If no activity-review helper is configured, permitted authors receive a setup
path for the activity-review purpose.

### Reusable Assets And Presentation

Admins can manage reusable images, animations, sounds, tools, items and cursor
images. Image inputs reuse existing media paths instead of forcing duplicate
uploads. Sound records include category, icon, volume, looping and optional
duration metadata, and the browser player supports concurrent sound layers.
Admins with sound-library access can also create complete WAV sound sets for
dialogue typing, replace a set or an individual letter, add tags, and choose
the default set. Set creation requires one file for each letter from `a.wav`
through `z.wav`.

The reusable visual library shows where each image is currently referenced
before an author replaces or deletes it. Replacing an image updates those
references together; deleting it clears them explicitly after confirmation.
Authors can also add a searchable category and tags, plus explicit
transparency and animation metadata; unknown values are allowed when the file
does not provide a reliable signal. Shared image pickers retain free-text
search and also offer preset tag filters for tool, item, background and
character assets; the selected tag is combined with the text search.

Public pages, auth backgrounds, information pages, source links, platform
languages and translation catalogs are configurable. Cursor roles currently
cover normal, action, grab, text and denied states.

### AI And Content Authoring

Admins can store encrypted provider credentials and reusable agent templates,
including a content-authoring purpose. Provider failures are surfaced through
sanitized, reviewable authoring states.

From a map's MapAsset surface, an admin can ask an enabled content-authoring
template for a draft. The brief contains a learning goal, optional audience and
prior knowledge, route length and allowed Activity types. The AI returns a
versioned structured ContentPlan. Nothing is created until the admin reviews the
MapAsset, linear route, warnings and token usage and explicitly applies it.

The authoring slice proposes a focusable MapAsset, activities and route
connections. Applying the draft revalidates the plan before creating content.
The draft can be edited before approval, including explicit per-Activity
attribution of selected source records. Edited plans receive the same
validation before application, and only attributed source snapshots are copied
into the created Activities.
See [AI-assisted authoring](ai-authoring.md).

### Content API

The permission-controlled Content API exposes a versioned machine contract and
operations for maps, MapAssets and Activities. Settings contains an interactive
console and readable contract view. It is an administration API rather than a
public token API. See [Content API](content-api.md).

## Intentional Non-goals

The prototype deliberately avoids global point totals, streak pressure,
leaderboards and reward loops that make the reward more important than learning.
It can still be playful and game-like, but interaction should support autonomy,
curiosity, competence and relatedness.

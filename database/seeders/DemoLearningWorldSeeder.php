<?php

namespace Database\Seeders;

use App\Models\ActivityTransition;
use App\Models\DialogueStage;
use App\Models\LearningActivity;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningQuestion;
use App\Models\LearningQuestionOption;
use App\Models\LearningWorld;
use Illuminate\Database\Seeder;

class DemoLearningWorldSeeder extends Seeder
{
    /**
     * Seed a small vertical slice that can be explored immediately.
     */
    public function run(): void
    {
        LearningWorld::query()->where('slug', 'demo-cybersecurity')->delete();

        $world = LearningWorld::query()->create([
            'slug' => 'demo-cybersecurity',
            'title' => 'Signal Garden',
            'description' => 'A small explorable world for practicing investigation habits without points, streaks or rankings.',
            'theme_config' => [
                'accent' => '#36d399',
                'surface' => '#101820',
                'highlight' => '#7dd3fc',
                'storyTone' => 'calm cyber exploration',
            ],
        ]);

        $map = LearningMap::query()->create([
            'learning_world_id' => $world->id,
            'slug' => 'first-sector',
            'title' => 'First Sector',
            'description' => 'A tiny network landscape where each node is a place for active learning.',
            'background_config' => [
                'imageUrl' => '/images/themes/cyber-map-background.svg',
                'overlay' => 'rgba(7, 13, 18, 0.58)',
                'pageBackground' => '#0b1117',
                'cursor' => "url('/images/cursors/cyber-cursor.svg') 4 4, default",
                'draggingCursor' => "url('/images/cursors/cyber-hand.svg') 12 10, default",
                'tileCursor' => "url('/images/cursors/cyber-hand.svg') 12 10, pointer",
                'panelBackground' => 'rgba(5, 15, 22, 0.72)',
                'panelTextColor' => '#f8fafc',
                'panelMutedTextColor' => 'rgba(226, 232, 240, 0.82)',
                'sidePanelBackground' => '#111820',
                'sidePanelBorderColor' => 'rgba(255, 255, 255, 0.1)',
                'sidePanelTextColor' => '#f8fafc',
                'accentColor' => '#99f6e4',
                'light' => [
                    'overlay' => 'rgba(238, 251, 252, 0.72)',
                    'pageBackground' => '#e8f6f8',
                    'panelBackground' => 'rgba(255, 255, 255, 0.78)',
                    'panelTextColor' => '#0f172a',
                    'panelMutedTextColor' => 'rgba(51, 65, 85, 0.78)',
                    'sidePanelBackground' => '#ffffff',
                    'sidePanelBorderColor' => 'rgba(15, 23, 42, 0.12)',
                    'sidePanelTextColor' => '#0f172a',
                    'accentColor' => '#0e7490',
                    'cardBorderColor' => 'rgba(14, 116, 144, 0.18)',
                ],
            ],
            'grid_config' => [
                'tileWidth' => 132,
                'tileHeight' => 116,
                'gap' => 12,
            ],
        ]);

        $signalGate = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => 'signal-gate',
            'title' => 'Signal Gate',
            'description' => 'Meet the guide and practice reading an event pattern.',
            'position_q' => 0,
            'position_r' => 0,
            'state' => 'active',
            'visual_config' => [
                'icon' => 'radioTower',
                'label' => 'Signal Gate',
                'tileColor' => '#12343b',
                'foregroundColor' => '#99f6e4',
                'labelColor' => '#ffffff',
                'highlightColor' => '#36d399',
                'tooltip' => 'Start here: short dialogue, then a question.',
                'light' => [
                    'tileColor' => '#d5f5f0',
                    'foregroundColor' => '#0f766e',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#0d9488',
                ],
            ],
        ]);

        $mentorDialogue = LearningActivity::query()->create([
            'learning_node_id' => $signalGate->id,
            'slug' => 'meet-mira',
            'type' => 'dialogue',
            'title' => 'Meet Mira',
            'introduction' => 'A short orientation with a configurable NPC.',
            'sort_order' => 10,
            'config' => [
                'allowBackward' => true,
            ],
        ]);

        DialogueStage::query()->create([
            'learning_activity_id' => $mentorDialogue->id,
            'stage_key' => 'arrival',
            'speaker_name' => 'Mira',
            'speaker_role' => 'Signal Keeper',
            'body' => 'Welcome to the Signal Garden. Nothing here asks you to chase points. We look for patterns, test ideas, and keep what becomes useful.',
            'portrait_url' => '/images/themes/mentor-calm.svg',
            'image_alt' => 'Mira, a calm guide with a glowing terminal frame.',
            'mood' => 'calm',
            'sort_order' => 10,
        ]);

        DialogueStage::query()->create([
            'learning_activity_id' => $mentorDialogue->id,
            'stage_key' => 'autonomy',
            'speaker_name' => 'Mira',
            'speaker_role' => 'Signal Keeper',
            'body' => 'You can move through places in more than one way. If an answer is off, that is not a failure state. It is just information for the next attempt.',
            'portrait_url' => '/images/themes/mentor-hint.svg',
            'image_alt' => 'Mira pointing toward branching signal paths.',
            'mood' => 'encouraging',
            'sort_order' => 20,
        ]);

        DialogueStage::query()->create([
            'learning_activity_id' => $mentorDialogue->id,
            'stage_key' => 'question-setup',
            'speaker_name' => 'Mira',
            'speaker_role' => 'Signal Keeper',
            'body' => 'A login alert just arrived. Read it like an investigator: what detail changes the story?',
            'portrait_url' => '/images/themes/mentor-alert.svg',
            'image_alt' => 'Mira reviewing a highlighted event stream.',
            'mood' => 'focused',
            'sort_order' => 30,
        ]);

        $signalQuestion = LearningActivity::query()->create([
            'learning_node_id' => $signalGate->id,
            'slug' => 'read-the-first-signal',
            'type' => 'question',
            'title' => 'Read the first signal',
            'introduction' => 'Choose the clue that best explains the alert.',
            'sort_order' => 20,
        ]);

        $question = LearningQuestion::query()->create([
            'learning_activity_id' => $signalQuestion->id,
            'prompt' => 'A login alert shows 84 failed attempts against one account in 4 minutes. The attempts came from 51 source IP addresses. Which clue matters most for the next investigation step?',
            'feedback_correct' => 'Correct. The many source IPs suggest a distributed pattern, so the next step should inspect source distribution and account exposure rather than treating this like one mistyped password.',
            'feedback_incorrect' => 'Not quite. Look again at the source IP distribution. The pattern is broader than a single user or one failing device.',
            'explanation' => 'The source distribution changes the hypothesis. One source may suggest a local system or user behavior; many sources can indicate credential stuffing, bot traffic or a distributed campaign.',
        ]);

        LearningQuestionOption::query()->create([
            'learning_question_id' => $question->id,
            'label' => 'A',
            'body' => 'The failed attempts came from many different source IP addresses.',
            'is_correct' => true,
            'outcome_key' => 'distributed-pattern',
            'feedback' => 'Good read. You noticed the clue that changes the investigation path.',
            'weights' => ['pattern_recognition' => 0.9, 'investigation_focus' => 0.8],
            'sort_order' => 10,
        ]);

        LearningQuestionOption::query()->create([
            'learning_question_id' => $question->id,
            'label' => 'B',
            'body' => 'The attempts target one account, so it is probably just that user mistyping.',
            'is_correct' => false,
            'outcome_key' => 'review-source-distribution',
            'feedback' => 'That would be plausible with one or a few sources. Here, 51 source IPs make the pattern more distributed.',
            'weights' => ['pattern_recognition' => 0.2, 'account_focus' => 0.6],
            'sort_order' => 20,
        ]);

        LearningQuestionOption::query()->create([
            'learning_question_id' => $question->id,
            'label' => 'C',
            'body' => 'The server is probably offline because many login attempts failed.',
            'is_correct' => false,
            'outcome_key' => 'review-source-distribution',
            'feedback' => 'A service outage could cause failures, but the source spread is the stronger clue in this alert.',
            'weights' => ['service_health' => 0.4, 'pattern_recognition' => 0.2],
            'sort_order' => 30,
        ]);

        $sourceReview = LearningActivity::query()->create([
            'learning_node_id' => $signalGate->id,
            'slug' => 'review-source-distribution',
            'type' => 'dialogue',
            'title' => 'Review the source pattern',
            'introduction' => 'A short loop that points back to the question.',
            'sort_order' => 30,
        ]);

        DialogueStage::query()->create([
            'learning_activity_id' => $sourceReview->id,
            'stage_key' => 'review',
            'speaker_name' => 'Mira',
            'speaker_role' => 'Signal Keeper',
            'body' => 'Try comparing the account clue with the source clue. One account tells us who was targeted; many sources tell us how the attempt behaved.',
            'portrait_url' => '/images/themes/mentor-hint.svg',
            'image_alt' => 'Mira showing two highlighted evidence columns.',
            'mood' => 'supportive',
            'sort_order' => 10,
        ]);

        $reflection = LearningActivity::query()->create([
            'learning_node_id' => $signalGate->id,
            'slug' => 'pattern-reflection',
            'type' => 'reflection',
            'title' => 'Keep the useful clue',
            'introduction' => 'A small competence reflection rather than a reward screen.',
            'sort_order' => 40,
            'config' => [
                'prompt' => 'In your own words, what did the source IP distribution help you understand?',
                'note' => 'Reflection storage will come later; for now this keeps the loop active and learner-owned.',
            ],
        ]);

        ActivityTransition::query()->create([
            'from_activity_id' => $mentorDialogue->id,
            'to_activity_id' => $signalQuestion->id,
            'trigger' => 'completed',
            'label' => 'Inspect the alert',
        ]);

        ActivityTransition::query()->create([
            'from_activity_id' => $signalQuestion->id,
            'to_activity_id' => $reflection->id,
            'trigger' => 'correct',
            'label' => 'Reflect on the clue',
        ]);

        ActivityTransition::query()->create([
            'from_activity_id' => $signalQuestion->id,
            'to_activity_id' => $sourceReview->id,
            'trigger' => 'incorrect',
            'label' => 'Review the clue',
        ]);

        ActivityTransition::query()->create([
            'from_activity_id' => $sourceReview->id,
            'to_activity_id' => $signalQuestion->id,
            'trigger' => 'completed',
            'label' => 'Try the alert again',
        ]);

        $signalGate->update(['start_activity_id' => $mentorDialogue->id]);

        $this->seedSecondaryNodes($map);
    }

    private function seedSecondaryNodes(LearningMap $map): void
    {
        $fieldNotes = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => 'field-notes',
            'title' => 'Field Notes',
            'description' => 'A future place for learner-owned notes and recall prompts.',
            'position_q' => 1,
            'position_r' => 0,
            'state' => 'available',
            'visual_config' => [
                'icon' => 'bookOpen',
                'label' => 'Field Notes',
                'tileColor' => '#253047',
                'foregroundColor' => '#bfdbfe',
                'labelColor' => '#ffffff',
                'highlightColor' => '#7dd3fc',
                'tooltip' => 'Coming next: personal notes without public scoring.',
                'light' => [
                    'tileColor' => '#dbeafe',
                    'foregroundColor' => '#1d4ed8',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#2563eb',
                ],
            ],
        ]);

        $fieldNotesActivity = LearningActivity::query()->create([
            'learning_node_id' => $fieldNotes->id,
            'slug' => 'field-notes-preview',
            'type' => 'placeholder',
            'title' => 'Prepare personal notes',
            'introduction' => 'A future learner-owned note space for recall prompts and self-explanations.',
            'sort_order' => 10,
            'config' => [
                'nextStep' => 'Next implementation step: add a small note editor and connect notes to the current node without public scoring.',
            ],
        ]);

        $fieldNotes->update(['start_activity_id' => $fieldNotesActivity->id]);

        LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => 'quiet-archive',
            'title' => 'Quiet Archive',
            'description' => 'A locked node that represents future competence-based discovery.',
            'position_q' => 0,
            'position_r' => 1,
            'state' => 'locked',
            'visual_config' => [
                'icon' => 'lockKeyhole',
                'label' => 'Quiet Archive',
                'tileColor' => '#2d2338',
                'foregroundColor' => '#e9d5ff',
                'labelColor' => '#ffffff',
                'highlightColor' => '#c084fc',
                'tooltip' => 'Locked for now. Later this should open because of understanding, not points.',
                'light' => [
                    'tileColor' => '#ede9fe',
                    'foregroundColor' => '#6d28d9',
                    'labelColor' => '#334155',
                    'highlightColor' => '#8b5cf6',
                ],
            ],
        ]);

        $portal = LearningNode::query()->create([
            'learning_map_id' => $map->id,
            'slug' => 'portal-foundation',
            'title' => 'Portal Foundation',
            'description' => 'A placeholder for map-to-map travel.',
            'position_q' => -1,
            'position_r' => 1,
            'state' => 'hinted',
            'visual_config' => [
                'icon' => 'orbit',
                'label' => 'Portal',
                'tileColor' => '#19312b',
                'foregroundColor' => '#bbf7d0',
                'labelColor' => '#ffffff',
                'highlightColor' => '#4ade80',
                'tooltip' => 'Future maps can connect here.',
                'light' => [
                    'tileColor' => '#dcfce7',
                    'foregroundColor' => '#15803d',
                    'labelColor' => '#0f172a',
                    'highlightColor' => '#16a34a',
                ],
            ],
        ]);

        $portalActivity = LearningActivity::query()->create([
            'learning_node_id' => $portal->id,
            'slug' => 'portal-preview',
            'type' => 'placeholder',
            'title' => 'Prepare map travel',
            'introduction' => 'A future portal action for moving between maps while preserving the learner context.',
            'sort_order' => 10,
            'config' => [
                'nextStep' => 'Next implementation step: connect this node to another map and show a clear travel action here.',
            ],
        ]);

        $portal->update(['start_activity_id' => $portalActivity->id]);
    }
}

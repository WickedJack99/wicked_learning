<?php

namespace App\Http\Controllers;

use App\Learning\Actions\CreateLearnerJournalPage;
use App\Learning\Actions\DeleteLearnerJournalPage;
use App\Learning\Actions\RecordLearnerReflection;
use App\Learning\Actions\RequestLearnerJournalFeedback;
use App\Learning\Actions\UpdateLearnerJournalPage;
use App\Learning\Queries\LoadFeedbackRequestDomains;
use App\Learning\Queries\LoadLearnerJournal;
use App\Learning\Serializers\LearnerJournalSerializer;
use App\Learning\Serializers\PlatformJournalSettingsSerializer;
use App\Models\LearnerJournalPage;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;
use App\Models\PlatformJournalSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** HTTP orchestration for the learner's own journal and reflection entries. */
class LearnerJournalController extends Controller
{
    public function __construct(
        private readonly LoadLearnerJournal $journal,
        private readonly LearnerJournalSerializer $serializer,
        private readonly PlatformJournalSettingsSerializer $settingsSerializer,
        private readonly LoadFeedbackRequestDomains $feedbackDomains,
        private readonly RecordLearnerReflection $recordReflection,
        private readonly RequestLearnerJournalFeedback $requestJournalFeedback,
        private readonly UpdateLearnerJournalPage $updatePage,
        private readonly CreateLearnerJournalPage $createPage,
        private readonly DeleteLearnerJournalPage $deletePage,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $pages = $this->journal->handle($request->user(), $request->string('search')->toString());
        $settings = $this->settingsSerializer->serialize(PlatformJournalSetting::current());

        return response()->json([
            'allowExpertAccessRequests' => $settings['allowExpertAccessRequests'],
            'feedbackDomains' => $this->feedbackDomains->handle($request->user()),
            'pages' => $pages->map(fn (LearnerJournalPage $page): array => $this->serializer->page($page))->values(),
            'theme' => $settings['theme'],
        ]);
    }

    public function requestFeedback(Request $request, LearnerJournalPage $page): JsonResponse
    {
        $data = $request->validate([
            'domain_key' => ['required', 'string', 'max:160'],
        ]);
        $domain = $this->feedbackDomains->find($request->user(), $data['domain_key']);

        abort_if($domain === null, 422, 'Choose a feedback domain you can access.');

        $this->requestJournalFeedback->handle($request->user(), $page, $domain);

        return response()->json([
            'page' => $this->serializer->page($page->refresh()->load('feedbackRequest')),
        ]);
    }

    public function storeActivityReflection(Request $request, LearningActivity $activity): JsonResponse
    {
        $reflection = $this->recordReflection->forActivity(
            $request->user(),
            $activity->loadMissing('node'),
            $request->string('play_run_id')->toString(),
            $this->reflectionData($request),
        );

        return response()->json(['reflection' => $this->serializer->reflection($reflection)]);
    }

    public function storePage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:240'],
            'topic' => ['required', 'string', 'max:160'],
            'subtopic' => ['nullable', 'string', 'max:160'],
            'markdown' => ['nullable', 'string', 'max:100000'],
            'preferred_mode' => ['nullable', 'in:view,edit'],
            'request_expert_access' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'page' => $this->serializer->page($this->createPage->handle($request->user(), $data)),
        ]);
    }

    public function storeDialogueReflection(Request $request, NpcDialogueNode $node): JsonResponse
    {
        $reflection = $this->recordReflection->forDialogueNode(
            $request->user(),
            $node,
            $request->string('play_run_id')->toString(),
            $this->reflectionData($request),
        );

        return response()->json(['reflection' => $this->serializer->reflection($reflection)]);
    }

    public function update(Request $request, LearnerJournalPage $page): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:240'],
            'topic' => ['required', 'string', 'max:160'],
            'subtopic' => ['nullable', 'string', 'max:160'],
            'markdown' => ['required', 'string', 'max:100000'],
            'preferred_mode' => ['required', 'in:view,edit'],
            'request_expert_access' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'page' => $this->serializer->page($this->updatePage->handle($request->user(), $page, $data)),
        ]);
    }

    public function destroy(Request $request, LearnerJournalPage $page): JsonResponse
    {
        $deletedPageId = $page->id;

        $this->deletePage->handle($request->user(), $page);

        return response()->json(['deletedPageId' => $deletedPageId]);
    }

    public function export(Request $request): StreamedResponse
    {
        $pages = $this->journal->handle($request->user());
        $content = $pages->map(function (LearnerJournalPage $page): string {
            $category = $page->topic.($page->subtopic !== '' ? ' / '.$page->subtopic : '');
            $heading = '# '.$page->title."\n\n_Category: {$category}_";

            return $heading."\n\n".trim($page->markdown);
        })->join("\n\n---\n\n");

        return response()->streamDownload(
            static fn () => print $content."\n",
            'learning-journal.md',
            ['Content-Type' => 'text/markdown; charset=UTF-8'],
        );
    }

    /** @return array{reflection: string, topic?: string|null, subtopic?: string|null, request_expert_access?: bool} */
    private function reflectionData(Request $request): array
    {
        return $request->validate([
            'play_run_id' => ['required', 'uuid'],
            'reflection' => ['required', 'string', 'max:20000'],
            'topic' => ['nullable', 'string', 'max:160'],
            'subtopic' => ['nullable', 'string', 'max:160'],
            'request_expert_access' => ['nullable', 'boolean'],
        ]);
    }
}

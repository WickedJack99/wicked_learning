<?php

namespace App\Http\Controllers;

use App\Learning\Actions\CreateLearnerJournalPage;
use App\Learning\Actions\DeleteLearnerJournalPage;
use App\Learning\Actions\RecordLearnerReflection;
use App\Learning\Actions\RequestLearnerJournalFeedback;
use App\Learning\Actions\UpdateLearnerJournalPage;
use App\Learning\Queries\LoadFeedbackRequestDomains;
use App\Learning\Queries\LoadLearnerActivityCheckIns;
use App\Learning\Queries\LoadLearnerJournal;
use App\Learning\Queries\LoadLearnerRevisitInvitations;
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
        private readonly LoadLearnerActivityCheckIns $checkIns,
        private readonly LoadLearnerRevisitInvitations $revisitInvitations,
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
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
            'search' => ['nullable', 'string', 'max:160'],
        ]);
        $pages = $this->journal->paginate(
            $request->user(),
            $data['search'] ?? null,
            $data['page'] ?? 1,
            $data['per_page'] ?? LoadLearnerJournal::DEFAULT_PAGE_SIZE,
        );
        $settings = $this->settingsSerializer->serialize(PlatformJournalSetting::current());

        return response()->json([
            'allowExpertAccessRequests' => $settings['allowExpertAccessRequests'],
            'checkIns' => $this->checkIns->handle($request->user()),
            'feedbackDomains' => $this->feedbackDomains->handle($request->user()),
            'pages' => collect($pages->items())
                ->map(fn (LearnerJournalPage $page): array => $this->serializer->page($page))
                ->values()
                ->all(),
            'pagination' => [
                'currentPage' => $pages->currentPage(),
                'lastPage' => $pages->lastPage(),
                'perPage' => $pages->perPage(),
                'total' => $pages->total(),
            ],
            'revisitInvitations' => $this->revisitInvitations->handle($request->user()),
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
            $this->reflectionData($request, true),
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
            'markdown' => ['nullable', 'string', 'max:100000'],
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

    /** @return array{reflection: string, response_context?: string|null, observed_cues?: list<string>, independent_check?: bool, topic?: string|null, subtopic?: string|null} */
    private function reflectionData(Request $request, bool $supportsResponseContext = false): array
    {
        $rules = [
            'play_run_id' => ['required', 'uuid'],
            'reflection' => ['required', 'string', 'max:20000'],
            'independent_check' => ['sometimes', 'boolean'],
            'observed_cues' => ['sometimes', 'array', 'max:3'],
            'observed_cues.*' => ['string', 'max:300'],
            'topic' => ['nullable', 'string', 'max:160'],
            'subtopic' => ['nullable', 'string', 'max:160'],
        ];

        if ($supportsResponseContext) {
            $rules['response_context'] = ['nullable', 'string', 'max:20000'];
        }

        return $request->validate($rules);
    }
}

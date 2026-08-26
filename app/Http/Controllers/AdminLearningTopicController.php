<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReorderLearningTopicAreasRequest;
use App\Http\Requests\SaveLearningTopicRequest;
use App\Http\Requests\StoreLearningTopicAreaRequest;
use App\Http\Requests\UpdateLearningTopicAreaRequest;
use App\Learning\Actions\CreateLearningTopicArea;
use App\Learning\Actions\ReorderLearningTopicAreas;
use App\Learning\Actions\SaveLearningTopic;
use App\Learning\Actions\UpdateLearningTopicArea;
use App\Learning\Queries\LoadLearningTopics;
use App\Learning\Serializers\LearningTopicSerializer;
use App\Models\LearningTopic;
use App\Models\LearningTopicArea;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AdminLearningTopicController extends Controller
{
    public function __construct(
        private readonly CreateLearningTopicArea $createArea,
        private readonly UpdateLearningTopicArea $updateArea,
        private readonly ReorderLearningTopicAreas $reorderAreas,
        private readonly SaveLearningTopic $saveTopic,
        private readonly LoadLearningTopics $topics,
        private readonly LearningTopicSerializer $serializer,
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/topics', [
            'areas' => $this->serializer->administration(
                $this->topics->administration(),
            ),
        ]);
    }

    public function storeArea(StoreLearningTopicAreaRequest $request): RedirectResponse
    {
        $this->createArea->handle($request->validated());

        return back();
    }

    public function updateArea(
        UpdateLearningTopicAreaRequest $request,
        LearningTopicArea $area,
    ): RedirectResponse {
        $this->updateArea->handle($area, $request->validated());

        return back();
    }

    public function reorderAreas(ReorderLearningTopicAreasRequest $request): RedirectResponse
    {
        $this->reorderAreas->handle($request->validated('area_ids'));

        return back();
    }

    public function storeTopic(
        SaveLearningTopicRequest $request,
        LearningTopicArea $area,
    ): RedirectResponse {
        $this->saveTopic->handle($area, $request->validated());

        return back();
    }

    public function updateTopic(
        SaveLearningTopicRequest $request,
        LearningTopicArea $area,
        LearningTopic $topic,
    ): RedirectResponse {
        abort_unless($topic->learning_topic_area_id === $area->id, 404);
        $this->saveTopic->handle($area, $request->validated(), $topic);

        return back();
    }
}

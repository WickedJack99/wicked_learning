<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearningDesk;
use App\Learning\Serializers\LearningDeskSerializer;
use App\Learning\Services\LearningCompanionContext;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningHomeController extends Controller
{
    public function __construct(
        private readonly LoadLearningDesk $loadLearningDesk,
        private readonly LearningDeskSerializer $serializer,
        private readonly LearningCompanionContext $companionContext,
    ) {}

    public function __invoke(Request $request): Response
    {
        return Inertia::render('home', [
            'companion' => $this->companionContext->forDesk(),
            'desk' => $this->serializer->serialize(
                $this->loadLearningDesk->handle($request->user()),
            ),
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearningPaths;
use App\Learning\Serializers\LearningPathSerializer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningPathController extends Controller
{
    public function __construct(
        private readonly LoadLearningPaths $loadLearningPaths,
        private readonly LearningPathSerializer $serializer,
    ) {}

    public function __invoke(Request $request): Response
    {
        return Inertia::render('paths', [
            'paths' => $this->serializer->serialize(
                $this->loadLearningPaths->handle($request->user()),
            ),
        ]);
    }
}

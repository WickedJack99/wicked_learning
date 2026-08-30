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
        $paths = $this->loadLearningPaths->handle(
            $request->user(),
            page: max(1, (int) $request->query('page', 1)),
        );

        return Inertia::render('paths', [
            'paths' => $this->serializer->serialize($paths),
            'pagination' => $paths['pagination'],
        ]);
    }
}

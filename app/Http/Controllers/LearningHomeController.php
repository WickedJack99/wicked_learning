<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearningDesk;
use App\Learning\Serializers\LearningDeskSerializer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningHomeController extends Controller
{
    public function __construct(
        private readonly LoadLearningDesk $loadLearningDesk,
        private readonly LearningDeskSerializer $serializer,
    ) {}

    public function __invoke(Request $request): Response
    {
        return Inertia::render('home', [
            'desk' => $this->serializer->serialize(
                $this->loadLearningDesk->handle($request->user()),
            ),
        ]);
    }
}

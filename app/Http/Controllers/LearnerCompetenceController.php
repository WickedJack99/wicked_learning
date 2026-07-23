<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearnerCompetenceMap;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearnerCompetenceController extends Controller
{
    public function __construct(private readonly LoadLearnerCompetenceMap $competenceMap) {}

    public function index(Request $request): Response
    {
        return Inertia::render('competence/index', [
            'competenceMap' => $this->competenceMap->handle($request->user()),
        ]);
    }
}

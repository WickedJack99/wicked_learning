<?php

namespace App\Http\Controllers;

use App\Learning\Services\LearningMapAccessService;
use App\Learning\Services\ProtectedMapMedia;
use App\Models\LearningMap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProtectedMapMediaController extends Controller
{
    public function __construct(
        private readonly LearningMapAccessService $mapAccess,
        private readonly ProtectedMapMedia $protectedMedia,
    ) {}

    public function show(Request $request, LearningMap $map, string $path): StreamedResponse
    {
        abort_unless($this->mapAccess->canViewMap($map, $request->user()), 403);
        abort_unless($this->protectedMedia->exists($map, $path), 404);

        $storagePath = $this->protectedMedia->pathFor($map, $path);
        $disk = Storage::disk('local');

        return $disk->response($storagePath, null, [
            'Cache-Control' => 'private, max-age=300',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Settings\Queries\LoadSettingsIndex;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function __construct(
        private readonly LoadSettingsIndex $loadSettingsIndex,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render(
            'settings/index',
            $this->loadSettingsIndex->handle(
                $request->user(),
                $request->session()->get('created_registration_token'),
            ),
        );
    }
}

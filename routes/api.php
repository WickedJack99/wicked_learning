<?php

use App\Http\Controllers\Api\ContentApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('content/v1')
    ->middleware(['web', 'auth', 'verified', 'can:content_api.ro'])
    ->group(function (): void {
        Route::get('contract', [ContentApiController::class, 'contract'])
            ->name('api.content.contract');
        Route::get('maps', [ContentApiController::class, 'maps'])
            ->name('api.content.maps.index');
        Route::get('maps/{map}/map-assets', [ContentApiController::class, 'mapAssets'])
            ->name('api.content.map-assets.index');
        Route::get('map-assets/{mapAsset}/activities', [ContentApiController::class, 'activities'])
            ->name('api.content.activities.index');

        Route::middleware('can:content_api.ru')->group(function (): void {
            Route::post('maps', [ContentApiController::class, 'storeMap'])
                ->name('api.content.maps.store');
            Route::post('maps/{map}/map-assets', [ContentApiController::class, 'storeMapAsset'])
                ->name('api.content.map-assets.store');
            Route::post('map-assets/{mapAsset}/activities', [ContentApiController::class, 'storeActivity'])
                ->name('api.content.activities.store');
        });
    });

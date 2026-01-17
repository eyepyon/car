<?php

use App\Http\Controllers\GateController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::prefix('gate')->group(function () {
    Route::post('/unlock', [GateController::class, 'unlock']);
    Route::get('/status/{deviceId}', [GateController::class, 'status']);
    Route::get('/logs', [GateController::class, 'logs']);
});

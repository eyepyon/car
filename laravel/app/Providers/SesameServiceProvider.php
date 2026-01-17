<?php

namespace App\Providers;

use App\Services\SesameApiClient;
use Illuminate\Support\ServiceProvider;

class SesameServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(SesameApiClient::class, function ($app) {
            return new SesameApiClient(
                apiKey: config('services.sesame.api_key') ?? '',
                timeout: config('services.sesame.timeout', 10),
                maxRetries: config('services.sesame.max_retries', 3)
            );
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}

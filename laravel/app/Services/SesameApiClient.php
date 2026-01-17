<?php

namespace App\Services;

use App\Exceptions\SesameApiException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\ConnectionException;
use Exception;

/**
 * Sesame Web API Client
 *
 * CANDY HOUSE Sesame スマートロックとの通信を行うクライアント
 * API Documentation: https://docs.candyhouse.co/
 *
 * Requirements: 9.1, 9.4
 */
class SesameApiClient
{
    private const BASE_URL = 'https://api.candyhouse.co/public';
    private const DEFAULT_TIMEOUT = 10;
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY_MS = 100;
    private const BACKOFF_MULTIPLIER = 2;

    private string $apiKey;
    private int $timeout;
    private int $maxRetries;

    public function __construct(
        ?string $apiKey = null,
        int $timeout = self::DEFAULT_TIMEOUT,
        int $maxRetries = self::MAX_RETRIES
    ) {
        $this->apiKey = $apiKey ?? config('services.sesame.api_key', '');
        $this->timeout = $timeout;
        $this->maxRetries = $maxRetries;
    }

    /**
     * Sesameデバイス一覧を取得
     *
     * @return array
     * @throws SesameApiException
     */
    public function getSesameList(): array
    {
        return $this->makeRequest('GET', '/sesames');
    }

    /**
     * Sesameデバイスのステータスを取得
     *
     * @param string $deviceId
     * @return array
     * @throws SesameApiException
     */
    public function getStatus(string $deviceId): array
    {
        $result = $this->makeRequest('GET', "/sesame/{$deviceId}");

        // デバイスがオフラインの場合
        if (isset($result['responsive']) && $result['responsive'] === false) {
            throw SesameApiException::deviceOffline($deviceId, $result);
        }

        return $result;
    }

    /**
     * Sesameを解錠する
     *
     * @param string $deviceId
     * @return array
     * @throws SesameApiException
     */
    public function unlock(string $deviceId): array
    {
        return $this->controlSesame($deviceId, 'unlock');
    }

    /**
     * Sesameを施錠する
     *
     * @param string $deviceId
     * @return array
     * @throws SesameApiException
     */
    public function lock(string $deviceId): array
    {
        return $this->controlSesame($deviceId, 'lock');
    }

    /**
     * Sesameのステータスを同期する
     *
     * @param string $deviceId
     * @return array
     * @throws SesameApiException
     */
    public function sync(string $deviceId): array
    {
        return $this->controlSesame($deviceId, 'sync');
    }

    /**
     * Sesameを制御する
     *
     * @param string $deviceId
     * @param string $command lock, unlock, or sync
     * @return array
     * @throws SesameApiException
     */
    private function controlSesame(string $deviceId, string $command): array
    {
        return $this->makeRequest('POST', "/sesame/{$deviceId}", [
            'command' => $command,
        ]);
    }

    /**
     * タスクの実行結果を取得
     *
     * @param string $taskId
     * @return array
     * @throws SesameApiException
     */
    public function getActionResult(string $taskId): array
    {
        return $this->makeRequest('GET', '/action-result', [
            'task_id' => $taskId,
        ]);
    }

    /**
     * タスクの完了を待機する
     *
     * @param string $taskId
     * @param int $maxWaitSeconds
     * @param int $pollIntervalMs
     * @return array
     * @throws SesameApiException
     */
    public function waitForTaskCompletion(
        string $taskId,
        int $maxWaitSeconds = 30,
        int $pollIntervalMs = 500
    ): array {
        $startTime = time();

        while (time() - $startTime < $maxWaitSeconds) {
            $result = $this->getActionResult($taskId);

            if (isset($result['status']) && $result['status'] === 'terminated') {
                return $result;
            }

            usleep($pollIntervalMs * 1000);
        }

        throw SesameApiException::timeout(
            'タスクの完了待機がタイムアウトしました',
            ['task_id' => $taskId, 'max_wait_seconds' => $maxWaitSeconds]
        );
    }

    /**
     * APIリクエストを実行（リトライ機構付き）
     *
     * Requirements: 9.4 - Sesame API接続失敗時のリトライ処理
     *
     * @param string $method
     * @param string $endpoint
     * @param array $data
     * @return array
     * @throws SesameApiException
     */
    private function makeRequest(string $method, string $endpoint, array $data = []): array
    {
        $lastException = null;
        $delay = self::RETRY_DELAY_MS;

        for ($attempt = 0; $attempt <= $this->maxRetries; $attempt++) {
            try {
                return $this->executeRequest($method, $endpoint, $data);
            } catch (SesameApiException $e) {
                // 認証エラーやデバイス未検出はリトライしない
                if (in_array($e->getErrorCode(), [
                    SesameApiException::CODE_UNAUTHORIZED,
                    SesameApiException::CODE_DEVICE_NOT_FOUND,
                    SesameApiException::CODE_RATE_LIMITED,
                ])) {
                    throw $e;
                }

                $lastException = $e;
            } catch (Exception $e) {
                $lastException = SesameApiException::connectionFailed(
                    $e->getMessage(),
                    ['endpoint' => $endpoint]
                );
            }

            Log::warning('Sesame API request failed', [
                'attempt' => $attempt + 1,
                'max_retries' => $this->maxRetries,
                'endpoint' => $endpoint,
                'error' => $lastException?->getMessage(),
            ]);

            if ($attempt < $this->maxRetries) {
                usleep($delay * 1000);
                $delay = min($delay * self::BACKOFF_MULTIPLIER, 1000);
            }
        }

        throw $lastException ?? SesameApiException::connectionFailed(
            'Unknown error occurred',
            ['endpoint' => $endpoint]
        );
    }

    /**
     * 実際のHTTPリクエストを実行
     *
     * @param string $method
     * @param string $endpoint
     * @param array $data
     * @return array
     * @throws SesameApiException
     */
    private function executeRequest(string $method, string $endpoint, array $data = []): array
    {
        $url = self::BASE_URL . $endpoint;

        try {
            $request = Http::timeout($this->timeout)
                ->withHeaders([
                    'Authorization' => $this->apiKey,
                    'Content-Type' => 'application/json',
                ]);

            $response = match (strtoupper($method)) {
                'GET' => $request->get($url, $data),
                'POST' => $request->post($url, $data),
                default => throw new Exception("Unsupported HTTP method: {$method}"),
            };
        } catch (ConnectionException $e) {
            throw SesameApiException::connectionFailed(
                'Sesame APIへの接続に失敗しました: ' . $e->getMessage(),
                ['url' => $url]
            );
        }

        if ($response->failed()) {
            $this->handleErrorResponse($response, $endpoint);
        }

        return $response->json() ?? [];
    }

    /**
     * エラーレスポンスを処理
     *
     * @param \Illuminate\Http\Client\Response $response
     * @param string $endpoint
     * @throws SesameApiException
     */
    private function handleErrorResponse($response, string $endpoint): void
    {
        $statusCode = $response->status();
        $errorMessage = $response->json('error') ?? $response->body();
        $context = [
            'endpoint' => $endpoint,
            'status_code' => $statusCode,
            'response' => $errorMessage,
        ];

        match ($statusCode) {
            401 => throw SesameApiException::unauthorized(
                'APIキーが無効です',
                $context
            ),
            404 => throw SesameApiException::deviceNotFound(
                $this->extractDeviceIdFromEndpoint($endpoint),
                $context
            ),
            429 => throw SesameApiException::rateLimited($context),
            504, 408 => throw SesameApiException::timeout(
                'Sesame APIがタイムアウトしました',
                $context
            ),
            default => throw SesameApiException::connectionFailed(
                "Sesame API error: {$errorMessage}",
                $context
            ),
        };
    }

    /**
     * エンドポイントからデバイスIDを抽出
     *
     * @param string $endpoint
     * @return string
     */
    private function extractDeviceIdFromEndpoint(string $endpoint): string
    {
        if (preg_match('/\/sesame\/([^\/]+)/', $endpoint, $matches)) {
            return $matches[1];
        }
        return 'unknown';
    }
}

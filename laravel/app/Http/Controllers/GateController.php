<?php

namespace App\Http\Controllers;

use App\Exceptions\SesameApiException;
use App\Models\GateLog;
use App\Services\SesameApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Exception;

/**
 * Gate Control API Controller
 *
 * ナンバープレート認識後のゲート開閉を制御するAPIエンドポイント
 * Sesame Web APIと連携してスマートロックを操作
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
class GateController extends Controller
{
    private SesameApiClient $sesameClient;

    public function __construct(SesameApiClient $sesameClient)
    {
        $this->sesameClient = $sesameClient;
    }

    /**
     * ゲートを解錠する
     *
     * POST /api/gate/unlock
     *
     * @param Request $request
     * @return JsonResponse
     *
     * Requirements: 9.1, 9.2, 9.3, 9.4
     */
    public function unlock(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'device_id' => 'required|string|uuid',
            'license_plate' => 'nullable|string|max:20',
            'recognition_confidence' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'VALIDATION_ERROR',
                '入力データが無効です',
                '正しいデバイスIDを指定してください',
                $validator->errors()->toArray(),
                422
            );
        }

        $deviceId = $request->input('device_id');
        $licensePlate = $request->input('license_plate');
        $confidence = $request->input('recognition_confidence');

        try {
            // Sesame APIを呼び出してゲートを解錠
            $result = $this->sesameClient->unlock($deviceId);

            $taskId = $result['task_id'] ?? null;

            if (!$taskId) {
                throw new Exception('Task ID not returned from Sesame API');
            }

            // タスクの完了を待機
            $taskResult = $this->sesameClient->waitForTaskCompletion($taskId, 30, 500);

            $successful = $taskResult['successful'] ?? false;

            // 操作ログを記録
            $this->logGateOperation(
                $deviceId,
                'unlock',
                $successful,
                $licensePlate,
                $confidence,
                $taskId,
                $taskResult['error'] ?? null
            );

            if (!$successful) {
                $errorMessage = $taskResult['error'] ?? 'Unknown error';
                return $this->errorResponse(
                    'UNLOCK_FAILED',
                    'ゲートの解錠に失敗しました',
                    'しばらく待ってから再試行してください',
                    ['sesame_error' => $errorMessage],
                    500
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'ゲートを解錠しました',
                'data' => [
                    'device_id' => $deviceId,
                    'task_id' => $taskId,
                    'license_plate' => $licensePlate,
                    'unlocked_at' => now()->toIso8601String(),
                ],
            ]);

        } catch (SesameApiException $e) {
            Log::error('Gate unlock failed (Sesame API)', [
                'device_id' => $deviceId,
                'license_plate' => $licensePlate,
                'error_code' => $e->getErrorCode(),
                'error' => $e->getMessage(),
                'context' => $e->getContext(),
            ]);

            // 失敗ログを記録
            $this->logGateOperation(
                $deviceId,
                'unlock',
                false,
                $licensePlate,
                $confidence,
                null,
                $e->getMessage()
            );

            return $this->errorResponse(
                $e->getErrorCode(),
                $e->getMessage(),
                $e->getSuggestion(),
                $e->getContext(),
                $e->getCode()
            );

        } catch (Exception $e) {
            Log::error('Gate unlock failed', [
                'device_id' => $deviceId,
                'license_plate' => $licensePlate,
                'error' => $e->getMessage(),
            ]);

            // 失敗ログを記録
            $this->logGateOperation(
                $deviceId,
                'unlock',
                false,
                $licensePlate,
                $confidence,
                null,
                $e->getMessage()
            );

            return $this->errorResponse(
                'API_CONNECTION_FAILED',
                'Sesame APIへの接続に失敗しました',
                'ネットワーク接続を確認し、しばらく待ってから再試行してください',
                ['error' => $e->getMessage()],
                503
            );
        }
    }

    /**
     * ゲートのステータスを取得
     *
     * GET /api/gate/status/{deviceId}
     *
     * @param string $deviceId
     * @return JsonResponse
     */
    public function status(string $deviceId): JsonResponse
    {
        // UUIDバリデーション
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $deviceId)) {
            return $this->errorResponse(
                'VALIDATION_ERROR',
                'デバイスIDが無効です',
                '正しいデバイスIDを指定してください',
                [],
                422
            );
        }

        try {
            $status = $this->sesameClient->getStatus($deviceId);

            return response()->json([
                'success' => true,
                'data' => [
                    'device_id' => $deviceId,
                    'locked' => $status['locked'] ?? null,
                    'battery' => $status['battery'] ?? null,
                    'responsive' => $status['responsive'] ?? null,
                    'checked_at' => now()->toIso8601String(),
                ],
            ]);

        } catch (SesameApiException $e) {
            Log::error('Gate status check failed (Sesame API)', [
                'device_id' => $deviceId,
                'error_code' => $e->getErrorCode(),
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse(
                $e->getErrorCode(),
                $e->getMessage(),
                $e->getSuggestion(),
                $e->getContext(),
                $e->getCode()
            );

        } catch (Exception $e) {
            Log::error('Gate status check failed', [
                'device_id' => $deviceId,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse(
                'API_CONNECTION_FAILED',
                'ステータスの取得に失敗しました',
                'しばらく待ってから再試行してください',
                ['error' => $e->getMessage()],
                503
            );
        }
    }

    /**
     * ゲート操作ログを取得
     *
     * GET /api/gate/logs
     *
     * @param Request $request
     * @return JsonResponse
     *
     * Requirements: 9.5
     */
    public function logs(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'device_id' => 'nullable|string|uuid',
            'license_plate' => 'nullable|string|max:20',
            'operation' => 'nullable|string|in:unlock,lock,sync',
            'success' => 'nullable|boolean',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'limit' => 'nullable|integer|min:1|max:100',
            'offset' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'VALIDATION_ERROR',
                '入力データが無効です',
                '正しいパラメータを指定してください',
                $validator->errors()->toArray(),
                422
            );
        }

        try {
            $query = GateLog::query();

            if ($request->has('device_id')) {
                $query->where('device_id', $request->input('device_id'));
            }

            if ($request->has('license_plate')) {
                $query->where('license_plate', $request->input('license_plate'));
            }

            if ($request->has('operation')) {
                $query->where('operation', $request->input('operation'));
            }

            if ($request->has('success')) {
                $query->where('success', $request->boolean('success'));
            }

            if ($request->has('from')) {
                $query->where('created_at', '>=', $request->input('from'));
            }

            if ($request->has('to')) {
                $query->where('created_at', '<=', $request->input('to'));
            }

            $limit = $request->input('limit', 20);
            $offset = $request->input('offset', 0);

            $total = $query->count();
            $logs = $query->orderBy('created_at', 'desc')
                ->skip($offset)
                ->take($limit)
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'logs' => $logs,
                    'pagination' => [
                        'total' => $total,
                        'limit' => $limit,
                        'offset' => $offset,
                    ],
                ],
            ]);

        } catch (Exception $e) {
            Log::error('Gate logs retrieval failed', [
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse(
                'DATABASE_ERROR',
                'ログの取得に失敗しました',
                'しばらく待ってから再試行してください',
                ['error' => $e->getMessage()],
                500
            );
        }
    }

    /**
     * ゲート操作ログを記録
     *
     * @param string $deviceId
     * @param string $operation
     * @param bool $success
     * @param string|null $licensePlate
     * @param float|null $confidence
     * @param string|null $taskId
     * @param string|null $errorMessage
     */
    private function logGateOperation(
        string $deviceId,
        string $operation,
        bool $success,
        ?string $licensePlate,
        ?float $confidence,
        ?string $taskId,
        ?string $errorMessage
    ): void {
        try {
            GateLog::create([
                'device_id' => $deviceId,
                'operation' => $operation,
                'success' => $success,
                'license_plate' => $licensePlate,
                'recognition_confidence' => $confidence,
                'task_id' => $taskId,
                'error_message' => $errorMessage,
            ]);
        } catch (Exception $e) {
            Log::error('Failed to save gate operation log', [
                'device_id' => $deviceId,
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * エラーレスポンスを生成
     *
     * @param string $code
     * @param string $message
     * @param string $suggestion
     * @param array $details
     * @param int $statusCode
     * @return JsonResponse
     */
    private function errorResponse(
        string $code,
        string $message,
        string $suggestion,
        array $details = [],
        int $statusCode = 500
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
                'suggestion' => $suggestion,
                'details' => $details,
            ],
        ], $statusCode);
    }
}

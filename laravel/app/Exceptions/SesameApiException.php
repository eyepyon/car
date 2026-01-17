<?php

namespace App\Exceptions;

use Exception;

/**
 * Sesame API Exception
 *
 * Sesame APIとの通信で発生するエラーを表す例外クラス
 */
class SesameApiException extends Exception
{
    public const CODE_CONNECTION_FAILED = 'CONNECTION_FAILED';
    public const CODE_TIMEOUT = 'TIMEOUT';
    public const CODE_UNAUTHORIZED = 'UNAUTHORIZED';
    public const CODE_DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND';
    public const CODE_DEVICE_OFFLINE = 'DEVICE_OFFLINE';
    public const CODE_RATE_LIMITED = 'RATE_LIMITED';
    public const CODE_UNKNOWN = 'UNKNOWN';

    private string $errorCode;
    private string $suggestion;
    private array $context;

    public function __construct(
        string $errorCode,
        string $message,
        string $suggestion,
        array $context = [],
        int $httpCode = 500,
        ?Exception $previous = null
    ) {
        parent::__construct($message, $httpCode, $previous);
        $this->errorCode = $errorCode;
        $this->suggestion = $suggestion;
        $this->context = $context;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getSuggestion(): string
    {
        return $this->suggestion;
    }

    public function getContext(): array
    {
        return $this->context;
    }

    /**
     * 接続失敗例外を作成
     */
    public static function connectionFailed(string $message, array $context = []): self
    {
        return new self(
            self::CODE_CONNECTION_FAILED,
            $message,
            'ネットワーク接続を確認し、しばらく待ってから再試行してください',
            $context,
            503
        );
    }

    /**
     * タイムアウト例外を作成
     */
    public static function timeout(string $message, array $context = []): self
    {
        return new self(
            self::CODE_TIMEOUT,
            $message,
            'しばらく待ってから再試行してください',
            $context,
            504
        );
    }

    /**
     * 認証エラー例外を作成
     */
    public static function unauthorized(string $message, array $context = []): self
    {
        return new self(
            self::CODE_UNAUTHORIZED,
            $message,
            'APIキーを確認してください',
            $context,
            401
        );
    }

    /**
     * デバイス未検出例外を作成
     */
    public static function deviceNotFound(string $deviceId, array $context = []): self
    {
        return new self(
            self::CODE_DEVICE_NOT_FOUND,
            "デバイス {$deviceId} が見つかりません",
            'デバイスIDを確認してください',
            array_merge($context, ['device_id' => $deviceId]),
            404
        );
    }

    /**
     * デバイスオフライン例外を作成
     */
    public static function deviceOffline(string $deviceId, array $context = []): self
    {
        return new self(
            self::CODE_DEVICE_OFFLINE,
            "デバイス {$deviceId} がオフラインです",
            'デバイスの電源とネットワーク接続を確認してください',
            array_merge($context, ['device_id' => $deviceId]),
            503
        );
    }

    /**
     * レート制限例外を作成
     */
    public static function rateLimited(array $context = []): self
    {
        return new self(
            self::CODE_RATE_LIMITED,
            'APIリクエストの制限に達しました',
            'しばらく待ってから再試行してください',
            $context,
            429
        );
    }
}

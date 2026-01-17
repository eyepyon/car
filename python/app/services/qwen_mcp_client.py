"""
Qwen MCP Client

Qwen MCPサーバーとの通信を行うクライアント
Requirements: 10.1, 10.5
"""

import httpx
import logging
from dataclasses import dataclass
from typing import List, Dict, Optional
import time

logger = logging.getLogger(__name__)


class QwenMCPError(Exception):
    """Qwen MCP API エラー"""

    def __init__(self, code: str, message: str, details: Optional[Dict] = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)

    @classmethod
    def connection_failed(cls, message: str, details: Optional[Dict] = None):
        return cls('CONNECTION_FAILED', message, details)

    @classmethod
    def timeout(cls, message: str, details: Optional[Dict] = None):
        return cls('TIMEOUT', message, details)

    @classmethod
    def unauthorized(cls, details: Optional[Dict] = None):
        return cls('UNAUTHORIZED', 'APIキーが無効です', details)

    @classmethod
    def rate_limited(cls, details: Optional[Dict] = None):
        return cls('RATE_LIMITED', 'リクエスト制限を超えました。しばらく待ってから再試行してください', details)


@dataclass
class ChatMessage:
    """チャットメッセージ"""
    role: str
    content: str


@dataclass
class ChatCompletionResponse:
    """チャット完了レスポンス"""
    content: str
    finish_reason: str
    usage: Optional[Dict] = None


class QwenMCPClient:
    """
    Qwen MCPサーバークライアント

    Requirements: 10.1 - Qwen MCPサーバーを呼び出す
    """

    DEFAULT_TIMEOUT = 30  # seconds
    MAX_RETRIES = 3
    RETRY_DELAY = 0.5  # seconds
    BACKOFF_MULTIPLIER = 2

    def __init__(
        self,
        base_url: str,
        api_key: str = '',
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = MAX_RETRIES
    ):
        """
        クライアントを初期化する

        Args:
            base_url: MCPサーバーのベースURL
            api_key: APIキー
            timeout: タイムアウト秒数
            max_retries: 最大リトライ回数
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries

    def chat(self, messages: List[Dict]) -> ChatCompletionResponse:
        """
        チャット完了リクエストを送信する

        Requirements: 10.1, 10.4 - 日本語で応答を返す

        Args:
            messages: メッセージリスト

        Returns:
            ChatCompletionResponse

        Raises:
            QwenMCPError: API呼び出しに失敗した場合
        """
        endpoint = f"{self.base_url}/v1/chat/completions"

        payload = {
            'model': 'qwen-plus',
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 2048,
        }

        headers = {
            'Content-Type': 'application/json',
        }

        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'

        return self._make_request_with_retry(endpoint, payload, headers)

    def _make_request_with_retry(
        self,
        endpoint: str,
        payload: Dict,
        headers: Dict
    ) -> ChatCompletionResponse:
        """
        リトライ機構付きでリクエストを送信する

        Requirements: 10.5 - 接続失敗時のエラーハンドリング

        Args:
            endpoint: エンドポイントURL
            payload: リクエストペイロード
            headers: リクエストヘッダー

        Returns:
            ChatCompletionResponse

        Raises:
            QwenMCPError: 全てのリトライが失敗した場合
        """
        last_error = None
        delay = self.RETRY_DELAY

        for attempt in range(self.max_retries + 1):
            try:
                return self._make_request(endpoint, payload, headers)
            except QwenMCPError as e:
                # 認証エラーやレート制限はリトライしない
                if e.code in ['UNAUTHORIZED', 'RATE_LIMITED']:
                    raise

                last_error = e

                logger.warning(
                    f"Qwen MCP request failed (attempt {attempt + 1}/{self.max_retries + 1}): {e.message}"
                )

                if attempt < self.max_retries:
                    time.sleep(delay)
                    delay = min(delay * self.BACKOFF_MULTIPLIER, 5.0)

        raise last_error or QwenMCPError.connection_failed('Unknown error occurred')

    def _make_request(
        self,
        endpoint: str,
        payload: Dict,
        headers: Dict
    ) -> ChatCompletionResponse:
        """
        HTTPリクエストを送信する

        Args:
            endpoint: エンドポイントURL
            payload: リクエストペイロード
            headers: リクエストヘッダー

        Returns:
            ChatCompletionResponse

        Raises:
            QwenMCPError: リクエストに失敗した場合
        """
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(endpoint, json=payload, headers=headers)

                if response.status_code == 401:
                    raise QwenMCPError.unauthorized({'endpoint': endpoint})

                if response.status_code == 429:
                    raise QwenMCPError.rate_limited({'endpoint': endpoint})

                if response.status_code >= 500:
                    raise QwenMCPError.connection_failed(
                        f'サーバーエラー: {response.status_code}',
                        {'endpoint': endpoint, 'status_code': response.status_code}
                    )

                if response.status_code >= 400:
                    raise QwenMCPError(
                        'API_ERROR',
                        f'APIエラー: {response.status_code}',
                        {'endpoint': endpoint, 'status_code': response.status_code}
                    )

                data = response.json()

                # レスポンスのパース
                choices = data.get('choices', [])
                if not choices:
                    raise QwenMCPError(
                        'INVALID_RESPONSE',
                        '応答が空です',
                        {'response': data}
                    )

                choice = choices[0]
                message = choice.get('message', {})

                return ChatCompletionResponse(
                    content=message.get('content', ''),
                    finish_reason=choice.get('finish_reason', 'stop'),
                    usage=data.get('usage')
                )

        except httpx.ConnectError as e:
            raise QwenMCPError.connection_failed(
                f'MCPサーバーに接続できません: {str(e)}',
                {'endpoint': endpoint}
            )
        except httpx.TimeoutException as e:
            raise QwenMCPError.timeout(
                f'リクエストがタイムアウトしました: {str(e)}',
                {'endpoint': endpoint, 'timeout': self.timeout}
            )
        except httpx.HTTPError as e:
            raise QwenMCPError.connection_failed(
                f'HTTPエラー: {str(e)}',
                {'endpoint': endpoint}
            )

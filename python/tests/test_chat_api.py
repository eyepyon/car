"""
Chat API Tests

Requirements: 10.1-10.5
"""

import pytest
from unittest.mock import patch, MagicMock
from app.services.qwen_mcp_client import QwenMCPClient, QwenMCPError, ChatCompletionResponse


class TestChatEndpoint:
    """Chat API エンドポイントのテスト"""

    def test_health_endpoint(self, client):
        """ヘルスチェックエンドポイントのテスト"""
        response = client.get('/papi/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'ok'
        assert data['service'] == 'chat-api'

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_success(self, mock_chat, client):
        """
        正常なチャットリクエストのテスト

        Requirements: 10.1, 10.4
        """
        mock_chat.return_value = ChatCompletionResponse(
            content='こんにちは！何かお手伝いできることはありますか？',
            finish_reason='stop'
        )

        response = client.post('/papi/chat', json={
            'message': 'こんにちは'
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'response' in data['data']
        assert data['data']['context_used'] is False

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_with_license_plate_context(self, mock_chat, client):
        """
        ナンバープレートコンテキスト付きチャットのテスト

        Requirements: 10.3
        """
        mock_chat.return_value = ChatCompletionResponse(
            content='品川330あ1234のナンバープレートが認識されています。',
            finish_reason='stop'
        )

        response = client.post('/papi/chat', json={
            'message': '認識されたナンバープレートを教えて',
            'context': {
                'license_plate': {
                    'region': '品川',
                    'classification_number': '330',
                    'hiragana': 'あ',
                    'serial_number': '1234',
                    'full_text': '品川330あ1234',
                    'confidence': 95.5
                }
            }
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['context_used'] is True

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_with_conversation_history(self, mock_chat, client):
        """
        会話履歴付きチャットのテスト

        Requirements: 10.3
        """
        mock_chat.return_value = ChatCompletionResponse(
            content='はい、先ほどの質問についてですね。',
            finish_reason='stop'
        )

        response = client.post('/papi/chat', json={
            'message': '続きを教えて',
            'context': {
                'conversation_history': [
                    {'role': 'user', 'content': '最初の質問'},
                    {'role': 'assistant', 'content': '最初の回答'}
                ]
            }
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

    def test_chat_empty_request(self, client):
        """空のリクエストボディのテスト"""
        response = client.post('/papi/chat', json={})

        # 空のリクエストはバリデーションエラー（422）または不正リクエスト（400）
        assert response.status_code in [400, 422]
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] in ['VALIDATION_ERROR', 'INVALID_REQUEST']

    def test_chat_missing_message(self, client):
        """メッセージなしのリクエストのテスト"""
        response = client.post('/papi/chat', json={
            'context': {}
        })

        assert response.status_code == 422
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_chat_invalid_message_type(self, client):
        """無効なメッセージ型のテスト"""
        response = client.post('/papi/chat', json={
            'message': 12345  # 数値は無効
        })

        assert response.status_code == 422
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] == 'VALIDATION_ERROR'

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_connection_error(self, mock_chat, client):
        """
        MCP接続エラーのテスト

        Requirements: 10.5
        """
        mock_chat.side_effect = QwenMCPError.connection_failed(
            'MCPサーバーに接続できません'
        )

        response = client.post('/papi/chat', json={
            'message': 'テスト'
        })

        assert response.status_code == 503
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] == 'CONNECTION_FAILED'

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_timeout_error(self, mock_chat, client):
        """
        タイムアウトエラーのテスト

        Requirements: 10.5
        """
        mock_chat.side_effect = QwenMCPError.timeout(
            'リクエストがタイムアウトしました'
        )

        response = client.post('/papi/chat', json={
            'message': 'テスト'
        })

        assert response.status_code == 504
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] == 'TIMEOUT'

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_unauthorized_error(self, mock_chat, client):
        """認証エラーのテスト"""
        mock_chat.side_effect = QwenMCPError.unauthorized()

        response = client.post('/papi/chat', json={
            'message': 'テスト'
        })

        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] == 'UNAUTHORIZED'

    @patch.object(QwenMCPClient, 'chat')
    def test_chat_rate_limited_error(self, mock_chat, client):
        """レート制限エラーのテスト"""
        mock_chat.side_effect = QwenMCPError.rate_limited()

        response = client.post('/papi/chat', json={
            'message': 'テスト'
        })

        assert response.status_code == 429
        data = response.get_json()
        assert data['success'] is False
        assert data['error']['code'] == 'RATE_LIMITED'


class TestQwenMCPClient:
    """Qwen MCP クライアントのテスト"""

    def test_client_initialization(self):
        """クライアント初期化のテスト"""
        client = QwenMCPClient(
            base_url='http://localhost:8080',
            api_key='test_key'
        )

        assert client.base_url == 'http://localhost:8080'
        assert client.api_key == 'test_key'
        assert client.timeout == QwenMCPClient.DEFAULT_TIMEOUT
        assert client.max_retries == QwenMCPClient.MAX_RETRIES

    def test_client_url_trailing_slash(self):
        """URLの末尾スラッシュ処理のテスト"""
        client = QwenMCPClient(
            base_url='http://localhost:8080/',
            api_key='test_key'
        )

        assert client.base_url == 'http://localhost:8080'

    @patch('httpx.Client')
    def test_chat_success(self, mock_client_class):
        """正常なチャットリクエストのテスト"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {'content': 'テスト応答'},
                'finish_reason': 'stop'
            }],
            'usage': {'total_tokens': 100}
        }

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        client = QwenMCPClient(
            base_url='http://localhost:8080',
            api_key='test_key'
        )

        result = client.chat([{'role': 'user', 'content': 'テスト'}])

        assert result.content == 'テスト応答'
        assert result.finish_reason == 'stop'

    @patch('httpx.Client')
    def test_chat_unauthorized(self, mock_client_class):
        """認証エラーのテスト"""
        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        client = QwenMCPClient(
            base_url='http://localhost:8080',
            api_key='invalid_key'
        )

        with pytest.raises(QwenMCPError) as exc_info:
            client.chat([{'role': 'user', 'content': 'テスト'}])

        assert exc_info.value.code == 'UNAUTHORIZED'

    @patch('httpx.Client')
    def test_chat_rate_limited(self, mock_client_class):
        """レート制限エラーのテスト"""
        mock_response = MagicMock()
        mock_response.status_code = 429

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_class.return_value = mock_client

        client = QwenMCPClient(
            base_url='http://localhost:8080',
            api_key='test_key'
        )

        with pytest.raises(QwenMCPError) as exc_info:
            client.chat([{'role': 'user', 'content': 'テスト'}])

        assert exc_info.value.code == 'RATE_LIMITED'


class TestChatModels:
    """チャットモデルのテスト"""

    def test_chat_request_from_dict(self):
        """ChatRequest.from_dict のテスト"""
        from app.models.chat import ChatRequest

        data = {
            'message': 'テストメッセージ',
            'context': {
                'license_plate': {
                    'region': '品川',
                    'full_text': '品川330あ1234'
                }
            }
        }

        request = ChatRequest.from_dict(data)

        assert request.message == 'テストメッセージ'
        assert request.context is not None
        assert request.context.license_plate['region'] == '品川'

    def test_chat_request_validation_empty_message(self):
        """空メッセージのバリデーションテスト"""
        from app.models.chat import ChatRequest

        with pytest.raises(ValueError) as exc_info:
            ChatRequest.from_dict({'message': ''})

        assert 'メッセージは必須です' in str(exc_info.value)

    def test_chat_request_validation_long_message(self):
        """長すぎるメッセージのバリデーションテスト"""
        from app.models.chat import ChatRequest

        with pytest.raises(ValueError) as exc_info:
            ChatRequest.from_dict({'message': 'a' * 10001})

        assert '10000文字以内' in str(exc_info.value)

    def test_chat_response_to_dict(self):
        """ChatResponse.to_dict のテスト"""
        from app.models.chat import ChatResponse

        response = ChatResponse(
            response='テスト応答',
            context_used=True
        )

        data = response.to_dict()

        assert data['response'] == 'テスト応答'
        assert data['context_used'] is True


class TestContextManager:
    """コンテキストマネージャーのテスト"""

    def test_get_or_create(self):
        """get_or_create のテスト"""
        from app.services.context_manager import ContextManager

        manager = ContextManager()

        context1 = manager.get_or_create('session1')
        context2 = manager.get_or_create('session1')

        assert context1 is context2
        assert context1.session_id == 'session1'

    def test_add_message(self):
        """メッセージ追加のテスト"""
        from app.services.context_manager import ConversationContext

        context = ConversationContext(session_id='test')
        context.add_message('user', 'テストメッセージ')

        assert len(context.messages) == 1
        assert context.messages[0]['role'] == 'user'
        assert context.messages[0]['content'] == 'テストメッセージ'

    def test_set_license_plate(self):
        """ナンバープレート設定のテスト"""
        from app.services.context_manager import ConversationContext

        context = ConversationContext(session_id='test')
        context.set_license_plate({
            'region': '品川',
            'full_text': '品川330あ1234'
        })

        assert context.license_plate['region'] == '品川'

    def test_max_history_length(self):
        """最大履歴長のテスト"""
        from app.services.context_manager import ConversationContext

        context = ConversationContext(session_id='test')

        # 最大数を超えるメッセージを追加
        for i in range(25):
            context.add_message('user', f'メッセージ{i}')

        assert len(context.messages) <= ConversationContext.MAX_HISTORY_LENGTH

    def test_generate_session_id(self):
        """セッションID生成のテスト"""
        from app.services.context_manager import ContextManager

        session_id = ContextManager.generate_session_id('user1', 'device1')

        assert len(session_id) == 32
        assert session_id.isalnum()

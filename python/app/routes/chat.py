"""
Chat API Routes

会話AI連携API - Qwen MCPサーバーとの連携
Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.qwen_mcp_client import QwenMCPClient, QwenMCPError
from app.models.chat import ChatRequest, ChatResponse, ChatError
import logging

chat_bp = Blueprint('chat', __name__)
logger = logging.getLogger(__name__)


@chat_bp.route('/chat', methods=['POST'])
def chat():
    """
    会話プロンプトを処理してQwen MCPサーバーから応答を取得する

    Requirements: 10.1, 10.2, 10.3, 10.4

    Request Body:
        {
            "message": "ユーザーのメッセージ",
            "context": {
                "license_plate": {
                    "region": "品川",
                    "classification_number": "330",
                    "hiragana": "あ",
                    "serial_number": "1234",
                    "full_text": "品川330あ1234",
                    "confidence": 95.5
                },
                "conversation_history": [
                    {"role": "user", "content": "..."},
                    {"role": "assistant", "content": "..."}
                ]
            }
        }

    Response:
        {
            "success": true,
            "data": {
                "response": "AIの応答メッセージ",
                "context_used": true
            }
        }
    """
    try:
        # リクエストのバリデーション
        data = request.get_json()
        if not data:
            return _error_response(
                code='INVALID_REQUEST',
                message='リクエストボディが空です',
                status_code=400
            )

        # ChatRequestの作成
        try:
            chat_request = ChatRequest.from_dict(data)
        except ValueError as e:
            return _error_response(
                code='VALIDATION_ERROR',
                message=str(e),
                status_code=422
            )

        # Qwen MCPクライアントの初期化
        client = QwenMCPClient(
            base_url=current_app.config['QWEN_MCP_URL'],
            api_key=current_app.config['QWEN_API_KEY']
        )

        # 会話履歴の構築
        messages = _build_messages(chat_request)

        # Qwen MCPサーバーへのリクエスト
        response = client.chat(messages)

        # レスポンスの構築
        chat_response = ChatResponse(
            response=response.content,
            context_used=chat_request.context is not None
        )

        logger.info(f"Chat request processed successfully: {len(chat_request.message)} chars")

        return jsonify({
            'success': True,
            'data': chat_response.to_dict()
        })

    except QwenMCPError as e:
        logger.error(f"Qwen MCP error: {e.code} - {e.message}")
        return _error_response(
            code=e.code,
            message=e.message,
            status_code=_get_status_code(e.code)
        )
    except Exception as e:
        logger.exception(f"Unexpected error in chat endpoint: {str(e)}")
        return _error_response(
            code='INTERNAL_ERROR',
            message='内部エラーが発生しました',
            status_code=500
        )


def _build_messages(chat_request: ChatRequest) -> list:
    """
    会話メッセージリストを構築する

    Requirements: 10.3 - ナンバープレート認識結果をコンテキストとして含める

    Args:
        chat_request: チャットリクエスト

    Returns:
        メッセージリスト
    """
    messages = []

    # システムプロンプトの構築
    system_prompt = _build_system_prompt(chat_request.context)
    messages.append({
        'role': 'system',
        'content': system_prompt
    })

    # 会話履歴の追加
    if chat_request.context and chat_request.context.conversation_history:
        for msg in chat_request.context.conversation_history:
            messages.append({
                'role': msg.get('role', 'user'),
                'content': msg.get('content', '')
            })

    # 現在のメッセージを追加
    messages.append({
        'role': 'user',
        'content': chat_request.message
    })

    return messages


def _build_system_prompt(context) -> str:
    """
    システムプロンプトを構築する

    Requirements: 10.3, 10.4 - コンテキストを含め、日本語で応答

    Args:
        context: コンテキスト情報

    Returns:
        システムプロンプト文字列
    """
    base_prompt = """あなたは車両情報に関する質問に答えるAIアシスタントです。
日本語で丁寧に応答してください。
ユーザーの質問に対して、簡潔で分かりやすい回答を心がけてください。"""

    if context and context.license_plate:
        plate = context.license_plate
        plate_info = f"""
現在認識されているナンバープレート情報:
- 地名: {plate.get('region', '不明')}
- 分類番号: {plate.get('classification_number', '不明')}
- ひらがな: {plate.get('hiragana', '不明')}
- 一連番号: {plate.get('serial_number', '不明')}
- 完全なナンバー: {plate.get('full_text', '不明')}
- 認識信頼度: {plate.get('confidence', 0)}%

この情報を参考にして、ユーザーの質問に答えてください。"""
        return base_prompt + plate_info

    return base_prompt


def _error_response(code: str, message: str, status_code: int):
    """
    エラーレスポンスを生成する

    Requirements: 10.5 - 適切なエラーメッセージを返す

    Args:
        code: エラーコード
        message: エラーメッセージ
        status_code: HTTPステータスコード

    Returns:
        JSONレスポンス
    """
    return jsonify({
        'success': False,
        'error': {
            'code': code,
            'message': message
        }
    }), status_code


def _get_status_code(error_code: str) -> int:
    """
    エラーコードからHTTPステータスコードを取得する

    Args:
        error_code: エラーコード

    Returns:
        HTTPステータスコード
    """
    status_map = {
        'CONNECTION_FAILED': 503,
        'TIMEOUT': 504,
        'UNAUTHORIZED': 401,
        'RATE_LIMITED': 429,
        'INVALID_REQUEST': 400,
        'VALIDATION_ERROR': 422,
        'INTERNAL_ERROR': 500,
    }
    return status_map.get(error_code, 500)

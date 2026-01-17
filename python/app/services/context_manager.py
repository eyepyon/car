"""
Context Manager

会話コンテキストの管理
Requirements: 10.3 - ナンバープレート認識結果をコンテキストに含める
"""

from typing import Dict, List, Optional
from dataclasses import dataclass, field
import time
import hashlib


@dataclass
class ConversationContext:
    """
    会話コンテキスト

    Requirements: 10.3 - 会話履歴の管理
    """
    session_id: str
    license_plate: Optional[Dict] = None
    messages: List[Dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    MAX_HISTORY_LENGTH = 20  # 最大会話履歴数

    def add_message(self, role: str, content: str) -> None:
        """
        メッセージを追加する

        Args:
            role: メッセージの役割 (user/assistant/system)
            content: メッセージ内容
        """
        self.messages.append({
            'role': role,
            'content': content,
            'timestamp': time.time()
        })
        self.updated_at = time.time()

        # 履歴が長すぎる場合は古いメッセージを削除
        if len(self.messages) > self.MAX_HISTORY_LENGTH:
            # システムメッセージは保持
            system_messages = [m for m in self.messages if m['role'] == 'system']
            other_messages = [m for m in self.messages if m['role'] != 'system']

            # 最新のメッセージを保持
            keep_count = self.MAX_HISTORY_LENGTH - len(system_messages)
            self.messages = system_messages + other_messages[-keep_count:]

    def set_license_plate(self, plate_data: Dict) -> None:
        """
        ナンバープレート情報を設定する

        Requirements: 10.3 - ナンバープレート認識結果をコンテキストに含める

        Args:
            plate_data: ナンバープレートデータ
        """
        self.license_plate = plate_data
        self.updated_at = time.time()

    def get_messages_for_api(self) -> List[Dict]:
        """
        API呼び出し用のメッセージリストを取得する

        Returns:
            メッセージリスト（role, contentのみ）
        """
        return [
            {'role': m['role'], 'content': m['content']}
            for m in self.messages
        ]

    def clear_history(self) -> None:
        """会話履歴をクリアする"""
        self.messages = []
        self.updated_at = time.time()

    def to_dict(self) -> Dict:
        """辞書に変換"""
        return {
            'session_id': self.session_id,
            'license_plate': self.license_plate,
            'messages': self.messages,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }


class ContextManager:
    """
    コンテキストマネージャー

    セッションごとの会話コンテキストを管理する
    """

    SESSION_TIMEOUT = 3600  # 1時間

    def __init__(self):
        self._contexts: Dict[str, ConversationContext] = {}

    def get_or_create(self, session_id: str) -> ConversationContext:
        """
        セッションIDに対応するコンテキストを取得または作成する

        Args:
            session_id: セッションID

        Returns:
            ConversationContext
        """
        self._cleanup_expired()

        if session_id not in self._contexts:
            self._contexts[session_id] = ConversationContext(session_id=session_id)

        return self._contexts[session_id]

    def get(self, session_id: str) -> Optional[ConversationContext]:
        """
        セッションIDに対応するコンテキストを取得する

        Args:
            session_id: セッションID

        Returns:
            ConversationContext または None
        """
        self._cleanup_expired()
        return self._contexts.get(session_id)

    def delete(self, session_id: str) -> bool:
        """
        セッションIDに対応するコンテキストを削除する

        Args:
            session_id: セッションID

        Returns:
            削除成功したかどうか
        """
        if session_id in self._contexts:
            del self._contexts[session_id]
            return True
        return False

    def _cleanup_expired(self) -> None:
        """期限切れのコンテキストを削除する"""
        current_time = time.time()
        expired_sessions = [
            session_id
            for session_id, context in self._contexts.items()
            if current_time - context.updated_at > self.SESSION_TIMEOUT
        ]

        for session_id in expired_sessions:
            del self._contexts[session_id]

    @staticmethod
    def generate_session_id(user_id: str = '', device_id: str = '') -> str:
        """
        セッションIDを生成する

        Args:
            user_id: ユーザーID
            device_id: デバイスID

        Returns:
            セッションID
        """
        data = f"{user_id}:{device_id}:{time.time()}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]


# グローバルインスタンス
context_manager = ContextManager()

"""
Chat Models

チャットAPIのリクエスト/レスポンスモデル
Requirements: 10.2, 10.3
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class LicensePlateContext:
    """ナンバープレートコンテキスト"""
    region: Optional[str] = None
    classification_number: Optional[str] = None
    hiragana: Optional[str] = None
    serial_number: Optional[str] = None
    full_text: Optional[str] = None
    confidence: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'LicensePlateContext':
        """辞書からインスタンスを作成"""
        return cls(
            region=data.get('region'),
            classification_number=data.get('classification_number'),
            hiragana=data.get('hiragana'),
            serial_number=data.get('serial_number'),
            full_text=data.get('full_text'),
            confidence=data.get('confidence'),
        )

    def to_dict(self) -> Dict:
        """辞書に変換"""
        return {
            'region': self.region,
            'classification_number': self.classification_number,
            'hiragana': self.hiragana,
            'serial_number': self.serial_number,
            'full_text': self.full_text,
            'confidence': self.confidence,
        }


@dataclass
class ChatContext:
    """
    チャットコンテキスト

    Requirements: 10.3 - ナンバープレート認識結果をコンテキストとして含める
    """
    license_plate: Optional[Dict] = None
    conversation_history: List[Dict] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict) -> 'ChatContext':
        """辞書からインスタンスを作成"""
        return cls(
            license_plate=data.get('license_plate'),
            conversation_history=data.get('conversation_history', []),
        )

    def to_dict(self) -> Dict:
        """辞書に変換"""
        return {
            'license_plate': self.license_plate,
            'conversation_history': self.conversation_history,
        }


@dataclass
class ChatRequest:
    """
    チャットリクエスト

    Requirements: 10.1, 10.2
    """
    message: str
    context: Optional[ChatContext] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'ChatRequest':
        """
        辞書からインスタンスを作成

        Args:
            data: リクエストデータ

        Returns:
            ChatRequest インスタンス

        Raises:
            ValueError: バリデーションエラー
        """
        message = data.get('message')
        if not message:
            raise ValueError('メッセージは必須です')

        if not isinstance(message, str):
            raise ValueError('メッセージは文字列である必要があります')

        if len(message) > 10000:
            raise ValueError('メッセージは10000文字以内である必要があります')

        context = None
        if 'context' in data and data['context']:
            context = ChatContext.from_dict(data['context'])

        return cls(
            message=message,
            context=context,
        )

    def to_dict(self) -> Dict:
        """辞書に変換"""
        result = {'message': self.message}
        if self.context:
            result['context'] = self.context.to_dict()
        return result


@dataclass
class ChatResponse:
    """
    チャットレスポンス

    Requirements: 10.4 - 日本語で応答を返す
    """
    response: str
    context_used: bool = False

    def to_dict(self) -> Dict:
        """辞書に変換"""
        return {
            'response': self.response,
            'context_used': self.context_used,
        }


@dataclass
class ChatError:
    """チャットエラー"""
    code: str
    message: str

    def to_dict(self) -> Dict:
        """辞書に変換"""
        return {
            'code': self.code,
            'message': self.message,
        }

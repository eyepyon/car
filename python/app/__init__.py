"""
Flask Application Factory

会話AI連携API (Qwen MCP Server)
Requirements: 10.1-10.5
"""

from flask import Flask
from flask_cors import CORS
import os
import logging


def create_app(config=None):
    """
    Create and configure the Flask application.

    Args:
        config: Optional configuration dictionary

    Returns:
        Flask application instance
    """
    app = Flask(__name__)

    # Load configuration
    app.config.from_mapping(
        QWEN_MCP_URL=os.getenv('QWEN_MCP_URL', 'http://localhost:8080'),
        QWEN_API_KEY=os.getenv('QWEN_API_KEY', ''),
        LOG_LEVEL=os.getenv('LOG_LEVEL', 'INFO'),
    )

    if config:
        app.config.update(config)

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, app.config['LOG_LEVEL']),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Enable CORS
    CORS(app)

    # Register blueprints
    from app.routes.chat import chat_bp
    app.register_blueprint(chat_bp, url_prefix='/papi')

    # Health check endpoint
    @app.route('/papi/health')
    def health():
        return {'status': 'ok', 'service': 'chat-api'}

    return app

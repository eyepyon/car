"""
Pytest Configuration and Fixtures
"""

import pytest
from app import create_app


@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app({
        'TESTING': True,
        'QWEN_MCP_URL': 'http://localhost:8080',
        'QWEN_API_KEY': 'test_api_key',
    })
    yield app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create test CLI runner."""
    return app.test_cli_runner()

import pytest
import os
from backend.app.config import settings

@pytest.fixture(autouse=True, scope="session")
def setup_test_environment():
    """
    Ensures unit and regression tests run deterministically without burning
    live LLM API credits or waiting for socket timeouts in sandboxed runners.
    """
    original_mock = settings.MOCK_LLM_MODE
    settings.MOCK_LLM_MODE = True
    yield
    settings.MOCK_LLM_MODE = original_mock


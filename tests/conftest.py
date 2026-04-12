import os

os.environ.setdefault("USE_MOCK_DB", "true")
os.environ.setdefault("JWT_SECRET", "local-test-secret-with-32-plus-characters")

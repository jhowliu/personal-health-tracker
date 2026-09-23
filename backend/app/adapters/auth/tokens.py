import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

ALGORITHM = "HS256"


class JwtTokenIssuer:
    def __init__(self, secret: str, access_ttl_min: int, refresh_ttl_days: int) -> None:
        self._secret = secret
        self._access_ttl = timedelta(minutes=access_ttl_min)
        self._refresh_ttl = timedelta(days=refresh_ttl_days)

    def issue_access(self, user_id: str) -> str:
        now = datetime.now(UTC)
        return jwt.encode(
            {"sub": user_id, "iat": now, "exp": now + self._access_ttl},
            self._secret,
            algorithm=ALGORITHM,
        )

    def decode_access(self, token: str) -> dict[str, Any]:
        return jwt.decode(token, self._secret, algorithms=[ALGORITHM])

    def issue_refresh(self) -> tuple[str, str, datetime]:
        raw = secrets.token_urlsafe(48)
        return raw, self.hash_refresh(raw), datetime.now(UTC) + self._refresh_ttl

    def hash_refresh(self, raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

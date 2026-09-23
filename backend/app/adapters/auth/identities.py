"""Verify Google/Apple ID tokens.

Both are standard OIDC; they differ only in issuer, JWKS URL and audience.
"""

import asyncio

import jwt
from jwt import PyJWKClient

from app.domain.errors import InvalidCredentials

GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
APPLE_JWKS = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"


class OidcIdentityVerifier:
    def __init__(self, google_audiences: tuple[str, ...], apple_audience: str) -> None:
        self._google_audiences = tuple(a for a in google_audiences if a)
        self._apple_audience = apple_audience
        self._jwks: dict[str, PyJWKClient] = {}

    def _client(self, url: str) -> PyJWKClient:
        if url not in self._jwks:
            self._jwks[url] = PyJWKClient(url, cache_keys=True)
        return self._jwks[url]

    async def verify(self, provider: str, id_token: str) -> tuple[str, str | None]:
        if provider == "google":
            claims = await self._decode(id_token, GOOGLE_JWKS, self._google_audiences, None)
            if claims.get("iss") not in GOOGLE_ISSUERS:
                raise InvalidCredentials("Google token issuer 不對")
        elif provider == "apple":
            claims = await self._decode(
                id_token, APPLE_JWKS, (self._apple_audience,), APPLE_ISSUER
            )
        else:
            raise InvalidCredentials(f"不支援的登入方式:{provider}")

        subject = claims.get("sub")
        if not subject:
            raise InvalidCredentials("token 裡沒有 sub")
        return subject, claims.get("email")

    async def _decode(
        self, id_token: str, jwks_url: str, audiences: tuple[str, ...], issuer: str | None
    ) -> dict:
        if not audiences:
            raise InvalidCredentials("伺服器沒有設定這個登入方式的 client id")

        def work() -> dict:
            key = self._client(jwks_url).get_signing_key_from_jwt(id_token).key
            return jwt.decode(
                id_token,
                key,
                algorithms=["RS256", "ES256"],
                audience=list(audiences),
                issuer=issuer,
            )

        try:
            return await asyncio.to_thread(work)
        except jwt.PyJWTError as e:
            raise InvalidCredentials("第三方 token 驗證失敗") from e

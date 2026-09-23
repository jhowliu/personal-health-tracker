"""Account use cases: register, sign in (password and third-party), refresh, sign out, delete."""

from dataclasses import dataclass

from app.application.ports import (
    AccountStore,
    Clock,
    IdentityVerifier,
    PasswordHasher,
    TokenIssuer,
)
from app.domain.errors import AlreadyExists, InvalidCredentials
from app.domain.ids import new_id
from app.domain.models import Account

MIN_PASSWORD_LENGTH = 8


@dataclass(frozen=True, slots=True)
class TokenPair:
    access_token: str
    refresh_token: str


class AccountService:
    def __init__(
        self,
        store: AccountStore,
        hasher: PasswordHasher,
        tokens: TokenIssuer,
        identities: IdentityVerifier,
        clock: Clock,
    ) -> None:
        self._store = store
        self._hasher = hasher
        self._tokens = tokens
        self._identities = identities
        self._clock = clock

    async def register(self, email: str, password: str, locale: str = "zh-TW") -> TokenPair:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise InvalidCredentials("密碼至少 8 個字")
        if await self._store.find_credentials(email) is not None:
            raise AlreadyExists("這個 Email 已經註冊過了")

        account = Account(
            id=new_id(), email=email, locale=locale, created_at=self._clock.now()
        )
        await self._store.create_account(account, self._hasher.hash(password))
        return await self._issue(account.id)

    async def login(self, email: str, password: str) -> TokenPair:
        found = await self._store.find_credentials(email)
        if found is None or found.password_hash is None:
            raise InvalidCredentials("Email 或密碼不對")
        if not self._hasher.verify(password, found.password_hash):
            raise InvalidCredentials("Email 或密碼不對")
        return await self._issue(found.user_id)

    async def login_with_provider(self, provider: str, id_token: str) -> TokenPair:
        """Google/Apple sign-in. Creates an account when there is none; links to the
        existing account when the email already matches one.
        """
        subject, email = await self._identities.verify(provider, id_token)

        user_id = await self._store.find_by_identity(provider, subject)
        if user_id is None:
            existing = await self._store.find_credentials(email) if email else None
            if existing is not None:
                user_id = existing.user_id
            else:
                account = Account(
                    id=new_id(),
                    email=email or f"{provider}-{subject}@placeholder.local",
                    locale="zh-TW",
                    created_at=self._clock.now(),
                )
                await self._store.create_account(account, None)
                user_id = account.id
            await self._store.link_identity(provider, subject, user_id, email)

        return await self._issue(user_id)

    async def refresh(self, refresh_token: str) -> TokenPair:
        token_hash = self._tokens.hash_refresh(refresh_token)
        user_id = await self._store.consume_refresh(token_hash, self._clock.now())
        if user_id is None:
            raise InvalidCredentials("refresh token 無效或已過期")
        return await self._issue(user_id)

    async def logout(self, user_id: str) -> None:
        await self._store.revoke_all_refresh(user_id)

    async def delete_account(self, user_id: str) -> None:
        await self._store.delete_account(user_id)

    async def _issue(self, user_id: str) -> TokenPair:
        raw, token_hash, expires_at = self._tokens.issue_refresh()
        await self._store.save_refresh(user_id, token_hash, expires_at)
        return TokenPair(access_token=self._tokens.issue_access(user_id), refresh_token=raw)

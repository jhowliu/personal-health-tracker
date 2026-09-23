from fastapi import APIRouter, status

from app.api.deps import Accounts, CurrentUserId
from app.api.schemas import LoginIn, ProviderLoginIn, RefreshIn, RegisterIn, TokenPairOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPairOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, service: Accounts) -> TokenPairOut:
    return TokenPairOut.of(
        await service.register(payload.email, payload.password, payload.locale)
    )


@router.post("/login", response_model=TokenPairOut)
async def login(payload: LoginIn, service: Accounts) -> TokenPairOut:
    return TokenPairOut.of(await service.login(payload.email, payload.password))


@router.post("/refresh", response_model=TokenPairOut)
async def refresh(payload: RefreshIn, service: Accounts) -> TokenPairOut:
    return TokenPairOut.of(await service.refresh(payload.refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user_id: CurrentUserId, service: Accounts) -> None:
    await service.logout(user_id)


@router.post("/google", response_model=TokenPairOut)
async def google(payload: ProviderLoginIn, service: Accounts) -> TokenPairOut:
    return TokenPairOut.of(await service.login_with_provider("google", payload.id_token))


@router.post("/apple", response_model=TokenPairOut)
async def apple(payload: ProviderLoginIn, service: Accounts) -> TokenPairOut:
    return TokenPairOut.of(await service.login_with_provider("apple", payload.id_token))

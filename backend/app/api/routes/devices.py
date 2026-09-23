from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, Reminders
from app.api.schemas import DeviceIn

router = APIRouter(prefix="/devices", tags=["push"])


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(
    payload: DeviceIn, user_id: CurrentUserId, service: Reminders
) -> None:
    await service.register_device(user_id, payload.push_token, payload.platform)

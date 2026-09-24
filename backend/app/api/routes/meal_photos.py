from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, MealPhotos
from app.api.schemas import (
    MealPhotoAnalysisOut,
    MealPhotoCreateIn,
    MealPhotoCreateOut,
    RecognizedItemOut,
)

router = APIRouter(tags=["meal photos"])


@router.post("/meal-photos", response_model=MealPhotoCreateOut, status_code=status.HTTP_201_CREATED)
async def create_photo(
    payload: MealPhotoCreateIn, user_id: CurrentUserId, service: MealPhotos
) -> MealPhotoCreateOut:
    photo, upload_url = await service.create(user_id, payload.content_type)
    return MealPhotoCreateOut.of(photo, upload_url)


@router.post("/meal-photos/{photo_id}/analyze", response_model=MealPhotoAnalysisOut)
async def analyze_photo(
    photo_id: str, user_id: CurrentUserId, service: MealPhotos
) -> MealPhotoAnalysisOut:
    photo, items = await service.analyze(user_id, photo_id)
    return MealPhotoAnalysisOut(
        id=photo.id, status=photo.status.value, items=[RecognizedItemOut.of(item) for item in items]
    )

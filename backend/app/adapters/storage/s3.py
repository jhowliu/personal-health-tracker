"""S3-compatible object storage adapter; boto3 stays entirely in this module."""

import boto3

from app.domain.errors import ServiceUnavailable, ValidationFailed

_CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png"}


class S3MealPhotoStorage:
    def __init__(
        self,
        endpoint: str,
        region: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        public_endpoint: str | None = None,
    ) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        self._signer = boto3.client(
            "s3",
            endpoint_url=public_endpoint or endpoint,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        self._bucket = bucket
        self._ready = False

    async def create_upload_url(
        self, user_id: str, photo_id: str, content_type: str
    ) -> tuple[str, str]:
        extension = _CONTENT_TYPES.get(content_type)
        if extension is None:
            raise ValidationFailed("照片只接受 JPEG 或 PNG")
        key = f"users/{user_id}/meal-photos/{photo_id}.{extension}"
        await self._ensure_bucket()
        try:
            url = self._signer.generate_presigned_url(
                "put_object",
                Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=900,
                HttpMethod="PUT",
            )
        except Exception as exc:
            raise ServiceUnavailable("照片儲存服務暫時不可用") from exc
        return key, url

    async def create_download_url(self, object_key: str) -> str:
        await self._ensure_bucket()
        try:
            url = self._signer.generate_presigned_url(
                "get_object", Params={"Bucket": self._bucket, "Key": object_key}, ExpiresIn=900
            )
        except Exception as exc:
            raise ServiceUnavailable("照片儲存服務暫時不可用") from exc
        return url

    async def _ensure_bucket(self) -> None:
        if self._ready:
            return
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except Exception:
            try:
                self._client.create_bucket(Bucket=self._bucket)
            except Exception as exc:
                raise ServiceUnavailable("照片儲存服務暫時不可用") from exc
        self._ready = True

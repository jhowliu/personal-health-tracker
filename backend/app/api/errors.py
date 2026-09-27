from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.domain.errors import (
    AlreadyExists,
    DomainError,
    InvalidCredentials,
    NotFound,
    PermissionDenied,
    QuotaExceeded,
    ServiceUnavailable,
    ValidationFailed,
)

STATUS_BY_ERROR: dict[type[DomainError], int] = {
    NotFound: status.HTTP_404_NOT_FOUND,
    AlreadyExists: status.HTTP_409_CONFLICT,
    InvalidCredentials: status.HTTP_401_UNAUTHORIZED,
    PermissionDenied: status.HTTP_403_FORBIDDEN,
    ValidationFailed: status.HTTP_422_UNPROCESSABLE_CONTENT,
    QuotaExceeded: status.HTTP_429_TOO_MANY_REQUESTS,
    ServiceUnavailable: status.HTTP_503_SERVICE_UNAVAILABLE,
}


async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    code = STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST)
    return JSONResponse(status_code=code, content={"detail": str(exc)})

class DomainError(Exception):
    """所有領域錯誤的基底。API 層據此對應 HTTP 狀態碼。"""


class NotFound(DomainError):
    pass


class AlreadyExists(DomainError):
    pass


class InvalidCredentials(DomainError):
    pass


class PermissionDenied(DomainError):
    pass


class ValidationFailed(DomainError):
    pass

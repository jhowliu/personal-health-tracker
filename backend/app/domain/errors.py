class DomainError(Exception):
    """Base for every domain error. The API layer maps these to HTTP status codes."""


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

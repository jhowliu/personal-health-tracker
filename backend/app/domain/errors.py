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


class ConsentRequired(DomainError):
    """An AI feature was asked for before the user agreed to send their data to the provider."""


class ServiceUnavailable(DomainError):
    """A required external capability is not configured or currently unavailable."""


class QuotaExceeded(DomainError):
    pass

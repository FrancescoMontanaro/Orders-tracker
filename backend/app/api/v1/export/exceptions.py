class JobAlreadyExistsException(Exception):
    """
    Raised when a user tries to create a new export job while they already have one pending or running.
    """

    pass
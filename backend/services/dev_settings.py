"""Process-local development controls, reset when the backend starts."""
import os
from threading import Lock


class DevSettings:
    def __init__(self, *, dev: bool = False):
        self.dev = dev
        self._stub_mode = dev
        self._stub_fail = False
        self._lock = Lock()

    @classmethod
    def from_environment(cls):
        return cls(dev=os.getenv("DEV", "").strip().casefold() in {"1", "true", "yes", "on"})

    def snapshot(self):
        with self._lock:
            return {"dev": self.dev, "stub_mode": self._stub_mode, "stub_fail": self._stub_fail}

    def update(self, *, stub_mode: bool, stub_fail: bool):
        if not self.dev:
            raise PermissionError("Development controls are disabled")
        with self._lock:
            self._stub_mode = stub_mode
            self._stub_fail = stub_fail
            return {"dev": True, "stub_mode": stub_mode, "stub_fail": stub_fail}

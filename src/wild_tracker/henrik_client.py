from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.henrikdev.xyz"

# Confirmed live 2026-08-16 against WILD GAMING#WILD: raw key, no "Bearer" prefix.
AUTH_HEADER = "Authorization"

MAX_RETRIES = 5
INITIAL_BACKOFF_SECONDS = 2.0


class HenrikDevError(RuntimeError):
    def __init__(self, status_code: int, url: str, body: str):
        super().__init__(f"HenrikDev API error {status_code} for {url}: {body[:500]}")
        self.status_code = status_code
        self.url = url
        self.body = body


class HenrikDevClient:
    def __init__(self, api_key: str, timeout: float = 30.0):
        self._client = httpx.Client(
            base_url=BASE_URL,
            headers={AUTH_HEADER: api_key},
            timeout=timeout,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "HenrikDevClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        backoff = INITIAL_BACKOFF_SECONDS
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            response = self._client.get(path, params=params)

            if response.status_code == 200:
                return response.json()

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else backoff
                logger.warning(
                    "Rate limited on %s (attempt %d/%d) — waiting %.1fs",
                    path,
                    attempt,
                    MAX_RETRIES,
                    wait,
                )
                time.sleep(wait)
                backoff *= 2
                last_error = HenrikDevError(response.status_code, str(response.url), response.text)
                continue

            if response.status_code >= 500:
                logger.warning(
                    "Server error %d on %s (attempt %d/%d) — backing off %.1fs",
                    response.status_code,
                    path,
                    attempt,
                    MAX_RETRIES,
                    backoff,
                )
                time.sleep(backoff)
                backoff *= 2
                last_error = HenrikDevError(response.status_code, str(response.url), response.text)
                continue

            # 4xx other than 429 (400/401/403/404/409): not retryable.
            raise HenrikDevError(response.status_code, str(response.url), response.text)

        assert last_error is not None
        raise last_error

    def get_premier_team_by_name(
        self, name: str, tag: str, affinity: str | None = None
    ) -> dict[str, Any]:
        params = {"affinity": affinity} if affinity else None
        return self._get(f"/valorant/v1/premier/{name}/{tag}", params=params)

    def get_premier_team_history_by_name(
        self, name: str, tag: str, season: str | None = None
    ) -> dict[str, Any]:
        params = {"season": season} if season else None
        return self._get(f"/valorant/v1/premier/{name}/{tag}/history", params=params)

    def get_match_details_v4(self, affinity: str, match_id: str) -> dict[str, Any]:
        return self._get(f"/valorant/v4/match/{affinity}/{match_id}")

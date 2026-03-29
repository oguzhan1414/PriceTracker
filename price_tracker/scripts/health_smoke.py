#!/usr/bin/env python3
"""Simple health smoke check for Price Tracker API.

Usage:
  python scripts/health_smoke.py
  python scripts/health_smoke.py http://localhost:8000
"""

from __future__ import annotations

import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def fetch_json(url: str) -> tuple[int, dict]:
    req = Request(url, method="GET")
    with urlopen(req, timeout=8) as response:
        status = response.getcode()
        payload = response.read().decode("utf-8")
        data = json.loads(payload) if payload else {}
        return status, data


def check(endpoint: str, expected_status: int) -> bool:
    try:
        status, data = fetch_json(endpoint)
        ok = status == expected_status
        state = "OK" if ok else "FAIL"
        print(f"[{state}] {endpoint} -> {status} | {data}")
        return ok
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"[FAIL] {endpoint} -> HTTP {exc.code} | {body}")
        return False
    except URLError as exc:
        print(f"[FAIL] {endpoint} -> URL error: {exc.reason}")
        return False
    except Exception as exc:
        print(f"[FAIL] {endpoint} -> Unexpected error: {exc}")
        return False


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    base = base.rstrip("/")

    live_ok = check(f"{base}/health/live", 200)
    ready_ok = check(f"{base}/health/ready", 200)

    if live_ok and ready_ok:
        print("Health smoke check passed.")
        return 0

    print("Health smoke check failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

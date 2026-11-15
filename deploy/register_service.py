#!/usr/bin/env python3
"""HD2Lab Dynamic Service Registration Script for BabyCare (AGPilot0004).

Supports registering, toggling, deregistering, and checking the BabyCare service
in Server-HQ's dynamic service registry via:
1) Remote/Local HTTP API (POST /auth/services, /auth/services/toggle, /auth/services/delete)
2) Direct SQLite DB manipulation (if running on Server-HQ with auth.sqlite3 access)
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from urllib.request import Request, build_opener, HTTPCookieProcessor
from http.cookiejar import CookieJar

DEFAULT_ORIGIN = os.environ.get("HD2LAB_ORIGIN", "https://hd2lab.duckdns.org")

BABYCARE_MANIFEST = {
    "slug": "babycare",
    "title": "HD²LAB BabyCare (0004)",
    "description": "성장 추적 · 수유/수면 기록 · 육아 통계 ZIP 분석 · 향단이 AI",
    "href": "/babycare/",
    "category_slug": "service",
    "hub_publish": True,
    "protect_prefix": True,
    "enabled": True,
    "sort_order": 95,
}


class DynamicRegistryClient:
    """Client for Server-HQ dynamic admin-auth API."""

    def __init__(self, origin: str):
        self.origin = origin.rstrip("/")
        self.jar = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.jar))
        self.csrf_token = ""

    def _request(self, path: str, method: str = "GET", payload: dict | None = None) -> dict:
        url = f"{self.origin}{path}"
        headers = {
            "Origin": self.origin,
            "User-Agent": "HD2Lab-BabyCare-Registrar/1.0",
        }
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token

        req = Request(url, data=data, headers=headers, method=method)
        with self.opener.open(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}

    def login(self, username: str, password: str) -> bool:
        session = self._request("/auth/session")
        self.csrf_token = session.get("csrf", "")
        login_res = self._request(
            "/auth/login",
            method="POST",
            payload={"username": username, "password": password, "next": "/admin/"},
        )
        session_after = self._request("/auth/session")
        if session_after.get("authenticated") and session_after.get("role") == "admin":
            self.csrf_token = session_after.get("csrf", self.csrf_token)
            return True
        return False

    def list_services(self) -> dict:
        return self._request("/auth/services")

    def public_hub(self) -> dict:
        return self._request("/auth/public-hub")

    def register(self, manifest: dict | None = None) -> dict:
        payload = manifest or BABYCARE_MANIFEST
        return self._request("/auth/services", method="POST", payload=payload)

    def toggle(self, slug: str, enabled: bool) -> dict:
        return self._request(
            "/auth/services/toggle",
            method="POST",
            payload={"slug": slug, "enabled": enabled},
        )

    def delete(self, slug: str) -> dict:
        return self._request(
            "/auth/services/delete",
            method="POST",
            payload={"slug": slug},
        )


def handle_db_register(db_path: str, manifest: dict = BABYCARE_MANIFEST):
    conn = sqlite3.connect(db_path)
    now = int(time.time())
    with conn:
        conn.execute(
            """INSERT INTO admin_services(slug, title, description, href, category_slug, hub_publish, protect_prefix, enabled, sort_order, created_at, updated_at)
               VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(slug) DO UPDATE SET
                 title=excluded.title,
                 description=excluded.description,
                 href=excluded.href,
                 category_slug=excluded.category_slug,
                 hub_publish=excluded.hub_publish,
                 protect_prefix=excluded.protect_prefix,
                 enabled=excluded.enabled,
                 sort_order=excluded.sort_order,
                 updated_at=excluded.updated_at""",
            (
                manifest["slug"],
                manifest["title"],
                manifest["description"],
                manifest["href"],
                manifest["category_slug"],
                int(bool(manifest["hub_publish"])),
                int(bool(manifest["protect_prefix"])),
                int(bool(manifest["enabled"])),
                manifest["sort_order"],
                now,
                now,
            ),
        )
    print(f"✅ [Direct DB] Registered '{manifest['slug']}' in {db_path}")


def handle_db_delete(db_path: str, slug: str):
    conn = sqlite3.connect(db_path)
    with conn:
        cur = conn.execute("DELETE FROM admin_services WHERE slug=?", (slug,))
        count = cur.rowcount
    if count > 0:
        print(f"✅ [Direct DB] Deleted '{slug}' from {db_path}")
    else:
        print(f"ℹ️ [Direct DB] Service '{slug}' not found in {db_path}")


def handle_db_toggle(db_path: str, slug: str, enabled: bool):
    conn = sqlite3.connect(db_path)
    now = int(time.time())
    with conn:
        cur = conn.execute(
            "UPDATE admin_services SET enabled=?, updated_at=? WHERE slug=?",
            (int(bool(enabled)), now, slug),
        )
        count = cur.rowcount
    if count > 0:
        status_str = "enabled" if enabled else "disabled"
        print(f"✅ [Direct DB] Service '{slug}' {status_str} in {db_path}")
    else:
        print(f"ℹ️ [Direct DB] Service '{slug}' not found in {db_path}")


def main():
    parser = argparse.ArgumentParser(description="HD2Lab Dynamic Service Registrar for BabyCare")
    subparsers = parser.add_subparsers(dest="action", required=True)

    # register
    reg_parser = subparsers.add_parser("register", help="Register or update BabyCare in Server-HQ")
    reg_parser.add_argument("--origin", default=DEFAULT_ORIGIN, help="Server-HQ Origin URL")
    reg_parser.add_argument("--username", help="Admin username for API authentication")
    reg_parser.add_argument("--password", help="Admin password for API authentication")
    reg_parser.add_argument("--db", help="Path to auth.sqlite3 for direct DB registration")

    # unregister / delete
    del_parser = subparsers.add_parser("unregister", help="Deregister/delete BabyCare from Server-HQ")
    del_parser.add_argument("--origin", default=DEFAULT_ORIGIN, help="Server-HQ Origin URL")
    del_parser.add_argument("--username", help="Admin username")
    del_parser.add_argument("--password", help="Admin password")
    del_parser.add_argument("--db", help="Path to auth.sqlite3 for direct DB deletion")
    del_parser.add_argument("--slug", default=BABYCARE_MANIFEST["slug"], help="Service slug")

    # toggle
    tog_parser = subparsers.add_parser("toggle", help="Enable/disable BabyCare")
    tog_parser.add_argument("--origin", default=DEFAULT_ORIGIN, help="Server-HQ Origin URL")
    tog_parser.add_argument("--username", help="Admin username")
    tog_parser.add_argument("--password", help="Admin password")
    tog_parser.add_argument("--db", help="Path to auth.sqlite3")
    tog_parser.add_argument("--slug", default=BABYCARE_MANIFEST["slug"], help="Service slug")
    tog_parser.add_argument("--enable", action="store_true", help="Enable service")
    tog_parser.add_argument("--disable", action="store_true", help="Disable service")

    # status
    stat_parser = subparsers.add_parser("status", help="Check registration status in public hub")
    stat_parser.add_argument("--origin", default=DEFAULT_ORIGIN, help="Server-HQ Origin URL")
    stat_parser.add_argument("--slug", default=BABYCARE_MANIFEST["slug"], help="Service slug to check")

    args = parser.parse_args()

    if getattr(args, "db", None):
        if args.action == "register":
            handle_db_register(args.db)
        elif args.action == "unregister":
            handle_db_delete(args.db, args.slug)
        elif args.action == "toggle":
            enabled = True if args.enable else (False if args.disable else True)
            handle_db_toggle(args.db, args.slug, enabled)
        return

    # API Mode
    client = DynamicRegistryClient(args.origin)

    if args.action == "status":
        try:
            hub = client.public_hub()
            services = hub.get("services", [])
            match = next((s for s in services if s["slug"] == args.slug), None)
            if match:
                print(f"✅ '{args.slug}' is registered and active in public hub:")
                print(json.dumps(match, ensure_ascii=False, indent=2))
            else:
                print(f"ℹ️ '{args.slug}' is not found in public hub manifest.")
        except Exception as e:
            print(f"❌ Failed to query public hub: {e}")
            sys.exit(1)
        return

    # Actions requiring admin login
    if not args.username or not args.password:
        print("❌ Username and password are required for API mode (or use --db <path>).")
        sys.exit(1)

    print(f"🔑 Authenticating with {args.origin}...")
    if not client.login(args.username, args.password):
        print("❌ Authentication failed. Check credentials or permissions.")
        sys.exit(1)
    print("✅ Authenticated as admin.")

    if args.action == "register":
        res = client.register()
        print(f"✅ Successfully registered/updated '{BABYCARE_MANIFEST['slug']}':")
        print(json.dumps(res.get("service", {}), ensure_ascii=False, indent=2))
    elif args.action == "unregister":
        res = client.delete(args.slug)
        print(f"✅ Successfully deleted '{args.slug}'.")
    elif args.action == "toggle":
        enabled = True if args.enable else (False if args.disable else True)
        res = client.toggle(args.slug, enabled)
        print(f"✅ Service '{args.slug}' enabled={enabled}.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Dynamic route registration script for Server-HQ AI Gateway (/run/hd2lab-ai-gateway/api.sock).

Usage:
  1. Request route creation (submits dynamic registry request to AI Gateway):
     ./deploy/register_ai_gateway.py request --registry-token <REGISTRY_TOKEN>
  2. Approve in /admin/ai-gateway/ UI
  3. Claim issued Caller Bearer Token:
     ./deploy/register_ai_gateway.py claim --request-id <REQ_ID> --registry-token <REGISTRY_TOKEN>
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import httpx

DEFAULT_SOCKET = os.environ.get("AI_GATEWAY_SOCKET", "/run/hd2lab-ai-gateway/api.sock")

BABYCARE_ROUTE_SPEC = {
    "action": "add",
    "route": "babycare",
    "display_name": "HD2Lab BabyCare (향단이 육아 AI)",
    "engine": "ollama",
    "model": "qwen3:4b-instruct",
    "context_tokens": 4096,
    "max_output_tokens": 768,
    "temperature": 0.2,
    "history_overflow": "trim",
    "system_prompt_mode": "merge",
    "no_think_suffix": "생각을 최소화하고 바로 최종 한국어 답변만 출력해.",
    "persona": (
        "당신은 HD2Lab BabyCare의 소아청소년과 지침 기반 육아 도우미 '향단이'입니다. "
        "질병관리청 국가건강정보포털 및 대한소아청소년과학회 기준에 근거해 간결하고 따뜻하게 답변하며, "
        "응급 증상 시 즉시 의료기관 방문을 안내하고 의학적 진단을 대신하지 않습니다."
    ),
}


def main():
    parser = argparse.ArgumentParser(description="Register BabyCare route in Server-HQ AI Gateway")
    sub = parser.add_subparsers(dest="cmd", required=True)

    req_p = sub.add_parser("request", help="Submit dynamic route registration request")
    req_p.add_argument("--socket", default=DEFAULT_SOCKET)
    req_p.add_argument("--registry-token", required=True, help="AI Gateway X-Registry-Token")

    claim_p = sub.add_parser("claim", help="Poll and claim issued route bearer token")
    claim_p.add_argument("--socket", default=DEFAULT_SOCKET)
    claim_p.add_argument("--request-id", required=True)
    claim_p.add_argument("--registry-token", required=True)

    args = parser.parse_args()
    transport = httpx.HTTPTransport(uds=args.socket)
    headers = {"X-Registry-Token": args.registry_token, "Content-Type": "application/json"}

    with httpx.Client(transport=transport, timeout=10.0) as client:
        if args.cmd == "request":
            resp = client.post(
                "http://localhost/internal/registry/requests",
                json=BABYCARE_ROUTE_SPEC,
                headers=headers,
            )
            print(f"Status: {resp.status_code}")
            print(json.dumps(resp.json(), ensure_ascii=False, indent=2))
            if resp.status_code not in (200, 202):
                sys.exit(1)
        elif args.cmd == "claim":
            resp = client.get(
                f"http://localhost/internal/registry/requests/{args.request_id}",
                headers=headers,
            )
            print(f"Status: {resp.status_code}")
            print(json.dumps(resp.json(), ensure_ascii=False, indent=2))
            if resp.status_code != 200:
                sys.exit(1)


if __name__ == "__main__":
    main()

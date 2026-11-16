import hashlib
import os
import secrets
import time
import httpx


class HD2MailClient:
    """Client for Server-HQ hd2lab-mail Unix domain socket (/run/hd2lab-mail/http.sock)."""

    def __init__(self, socket_path: str | None = None):
        self.socket_path = socket_path or os.getenv("HD2_MAIL_SOCKET", "/run/hd2lab-mail/http.sock")

    def status(self) -> dict:
        if not os.path.exists(self.socket_path):
            return {"ready": False, "state": "MISSING_SOCKET"}
        try:
            transport = httpx.HTTPTransport(uds=self.socket_path)
            with httpx.Client(transport=transport, timeout=3.0) as client:
                r = client.get("http://mail/v1/status", headers={"X-Mail-Actor": "babycare"})
                r.raise_for_status()
                return r.json()
        except Exception as exc:
            return {"ready": False, "state": f"ERROR: {exc}"}

    def send_message(self, to_email: str, subject: str, body_text: str, body_html: str) -> tuple[bool, str]:
        if not os.path.exists(self.socket_path):
            return False, "메일 서비스 소켓(/run/hd2lab-mail/http.sock)을 찾을 수 없습니다."

        job_id = secrets.token_hex(16)
        expires = int(time.time()) + 600
        payload = {
            "id": job_id,
            "payload": {
                "to": to_email,
                "expires": expires,
                "template": {
                    "name": "HD²LAB BabyCare",
                    "kind": "message",
                    "scope": "common",
                    "subject": subject,
                    "greeting": "안녕하세요.",
                    "body": body_text,
                    "format": "html",
                    "body_html": body_html,
                    "signature": "HD²LAB BabyCare",
                },
            },
        }
        try:
            transport = httpx.HTTPTransport(uds=self.socket_path)
            with httpx.Client(transport=transport, timeout=15.0) as client:
                r = client.post(
                    "http://mail/v1/deliver",
                    json=payload,
                    headers={"X-Mail-Actor": "babycare", "Content-Type": "application/json"},
                )
                if r.status_code >= 400:
                    return False, f"메일 발송 거부 ({r.status_code}): {r.text[:160]}"
                data = r.json()
                state = data.get("state", "UNKNOWN")
                if state in ("ACCEPTED", "SENT", "DELIVERED"):
                    return True, state
                return False, f"메일 발송 상태: {state}"
        except Exception as exc:
            return False, f"메일 서비스 통신 오류: {exc}"


def hash_otp(email: str, code: str) -> str:
    return hashlib.sha256(f"{email.strip().lower()}:{code.strip()}".encode("utf-8")).hexdigest()

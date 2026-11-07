from abc import ABC, abstractmethod
from typing import Optional
import httpx
from app.core.config import settings

class BaseLLMGateway(ABC):
    @abstractmethod
    async def generate_response(self, system_prompt: str, user_prompt: str) -> str:
        pass

class GeminiGateway(BaseLLMGateway):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    async def generate_response(self, system_prompt: str, user_prompt: str) -> str:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        url = f"{self.endpoint}?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"시스템 지침:\n{system_prompt}\n\n사용자 질문:\n{user_prompt}"}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1000
            }
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

class LocalLlamaGateway(BaseLLMGateway):
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def generate_response(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 800
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

class DeterministicMockGateway(BaseLLMGateway):
    """
    Deterministic rule-grounded response generator for local testing and zero-cost offline runs.
    Synthesizes answers directly from the retrieved knowledge articles and child context.
    """
    async def generate_response(self, system_prompt: str, user_prompt: str) -> str:
        return (
            "제공된 공인 육아 지침에 기초하여 안내해 드립니다.\n\n"
            f"{system_prompt}\n\n"
            "※ 본 답변은 참고용 육아 정보이며 전문의의 의학적 진단을 대신할 수 없습니다."
        )

def get_llm_gateway() -> BaseLLMGateway:
    if settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        return GeminiGateway(settings.GEMINI_API_KEY)
    elif settings.AI_PROVIDER == "llama":
        return LocalLlamaGateway(settings.LOCAL_LLAMA_URL)
    return DeterministicMockGateway()

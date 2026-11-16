# HD²LAB BabyCare — 운영·실행·라이브 업데이트 매뉴얼 (Runbook)

본 문서는 `AGPilot0004` 저장소 기반 **HD²LAB BabyCare** 플랫폼의 로컬 실행, Server-HQ 동적 등록, AI Gateway 연동, 라이브 업데이트 방법을 정리한 운영 리포트입니다.

---

## 1. 아키텍처 및 주요 기능 요약

1. **HD²LAB 테마 통일 (`shared/hub.css` 기준)**
   - 배경 `#FAFAFD`, 패널 `#FFFFFF`/`#F4F1FC`, 포인트 라벤더 퍼플 `#8B6CE8`, 텍스트 `#1D192B`, 공식 `.hd2-skew-mark` 적용.
   - 상단 헤더 `Service Hub ↗` 링크를 통해 `/service/` 허브와 자연스럽게 연결.
2. **Local-First 아기 프로필 & 누적 통계 (`localStore.ts`)**
   - 일반 방문자는 계정 발급이나 로그인 없이 **브라우저 `localStorage` 기준**으로 아기 프로필과 누적 기록을 보관·조회.
   - 다중 월 ZIP(`stat_*.zip`) 및 전체 기간 CSV 업로드 시 날짜 기준 중복 제거 후 누적 병합(분유, 모유, 유축, 이유식, 밤잠, 낮잠, 소변/대변, 놀이, 터미타임 등 전 항목).
3. **Server-HQ AI Gateway 동적 연결 (`HD2AIGateway`)**
   - Unix Domain Socket(`/run/hd2lab-ai-gateway/api.sock`)을 통해 `babycare` 라우트 호출.
   - 토큰 버짓: `context_tokens=4096`, `max_output_tokens=768`, `temperature=0.2`, `history_overflow=trim`.
   - Gateway 미연결/토큰 미발급 시 규칙 기반 소아과 RAG 응답으로 자동 Fallback.
4. **실제 접종·검진 라이브 규칙 (`GET /api/babycare/v1/health-rules/live`)**
   - 질병관리청 국가예방접종(NIP) 및 국민건강보험공단 영유아 건강검진(1~8차) 규칙을 실시간 제공.
   - 서버 디스크(`HEALTH_RULES_LIVE_JSON` 또는 `./data/health_rules_live.json`)를 교체하면 코드 재배포 없이 즉시 최신 접종표 반영 가능.

---

## 2. 로컬 개발 환경 실행 방법

### 백엔드 (FastAPI)
```bash
cd services/babycare/backend
PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload --port 8004
```

### 프론트엔드 (Vite + React)
```bash
cd services/babycare/frontend
npm install
npm run dev
```

### 테스트 실행
```bash
PYTHONPATH=services/babycare/backend services/babycare/backend/.venv/bin/pytest tests/backend/ -v
```

---

## 3. 실서버(`hyogidevrsp` / Server-HQ) 업데이트 방법

### 원클릭 업데이트
서버에 SSH 접속 후 아래 스크립트를 실행하면 `git pull` → `npm run build` → `pip install` → `systemctl restart hd2lab-babycare`가 일괄 진행됩니다:
```bash
bash /var/www/services/babycare/deploy/update_live.sh
```

---

## 4. 동적 서비스 & AI Gateway 연결 방법

### 4.1 Server-HQ 서비스 허브 등록/제거
- **웹 관리자 UI**: `https://hd2lab.duckdns.org/admin/services/` 에서 `slug: babycare`, `href: /babycare/`, `category_slug: service`, `공개 허브 노출(✅)`, `SSO 보호(해제: Public)` 저장.
- **CLI 스크립트**:
  ```bash
  ./deploy/register_service.py register --origin https://hd2lab.duckdns.org --username <ID> --password <PW>
  ```

### 4.2 HD2AI (AI Gateway) 동적 라우트 등록 & 토큰 발급
1. 등록 요청 제출:
   ```bash
   ./deploy/register_ai_gateway.py request --registry-token <REGISTRY_TOKEN>
   ```
2. 관리자 웹 UI(`https://hd2lab.duckdns.org/admin/ai-gateway/`)에서 `babycare` 요청 승인.
3. 발급된 Bearer Token 수령:
   ```bash
   ./deploy/register_ai_gateway.py claim --request-id <REQ_ID> --registry-token <REGISTRY_TOKEN>
   ```
4. 수령한 토큰을 `/etc/systemd/system/hd2lab-babycare.service`의 `Environment="AI_GATEWAY_TOKEN=<발급토큰>"` 로 추가 후 `sudo systemctl daemon-reload && sudo systemctl restart hd2lab-babycare`.

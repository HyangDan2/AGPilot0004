# HD²LAB BabyCare

> **Integrated Parenting Web Platform**  
> *Baby Profile • Growth Tracker • Daily Care (Feeding & Sleep) • Health & Vaccination Calendar • Parenting Knowledge • HyangDani Baby AI*

---

## 1. Overview

**HD²LAB BabyCare**는 아이별 프로필과 성장 데이터를 기반으로 개인화된 육아 경험을 제공하는 웹 플랫폼(Responsive Web App + PWA)입니다.

### Core Modules
1. **Baby Profile & Family Sharing**: 다자녀 프로필 관리, 이른둥이(미숙아) 교정연령 계산, 가족 구성원(소유자/양육자/조회자) 공동 관리.
2. **Growth Tracker**: 2017 질병관리청(KDCA) 소아청소년 성장도표 공식 LMS 백분위수 산출 및 인터랙티브 성장 곡선 차트.
3. **Daily Care Tracker**: 수유(분유/직접 모유/유축 모유) 기록 및 실시간 수면 타이머, 자정 넘어가는 수면 자동 집계.
4. **Health Calendar**: 질병관리청 국가예방접종(NIP) 및 영유아 건강검진(1~8차) 출생일 기반 자동 일정 생성 및 관리.
5. **Parenting Knowledge**: 공공누리 제1유형 공식 보건당국 가이드라인 8대 카테고리 검색 라이브러리.
6. **HyangDani Baby AI**: RAG 기반 공인 가이드 연동 육아 인공지능, 응급 징후 자동 감지 및 의료 안전 가드레일.

---

## 2. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, TanStack Query, PWA
- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, SQLite/PostgreSQL
- **AI**: Gateway Abstraction (Gemini / Local Llama / Deterministic Mock), 8-step Knowledge RAG Pipeline
- **Deploy**: Nginx Reverse Proxy (`/babycare/`, `/api/babycare/v1/`), systemd service unit

---

## 3. Quick Start (Local Development)

### Backend
```bash
cd services/babycare/backend
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8004 --reload
```
API docs: `http://localhost:8004/api/babycare/v1/docs`

### Frontend
```bash
cd services/babycare/frontend
npm install
npm run dev
```
Web App: `http://localhost:5173/`

### Automated Tests
```bash
# Backend pytest suite (13 test suites)
PYTHONPATH=services/babycare/backend services/babycare/backend/.venv/bin/pytest tests/backend/ -v

# Frontend build verification
cd services/babycare/frontend && npm run build
```

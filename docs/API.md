# HD²LAB BabyCare API

기준: `main` (2026-11-17, `d37780a`)의 `services/babycare/backend/app` 소스에서 직접 확인한 내용.
문서에 없는 경로는 존재하지 않는 것으로 본다. 시크릿·토큰 값은 이 문서에 기재하지 않는다.

## 1. 개요

아이 프로필·가족 공유·성장도표·수유/수면 기록·예방접종 캘린더·육아 지식·향단이 AI를 제공하는 FastAPI 백엔드다.
모든 업무 API는 `/api/babycare/v1` 아래에 있고, 응답은 JSON(`application/json`)이다.
업로드 이미지와 OpenAPI 문서만 예외다.

- 프런트엔드는 `services/babycare/frontend`(React + Vite)이며 Nginx 뒤 `/babycare/`에서 정적 서빙된다.
- 인증은 **하이브리드**다. Nginx/SSO가 붙여 주는 헤더를 우선 사용하고, 없으면 자체 JWT(Authorization 또는 쿠키)로 떨어진다.
- 런타임 Swagger: `/api/babycare/v1/docs`, OpenAPI JSON: `/api/babycare/v1/openapi.json`, ReDoc: `/api/babycare/v1/redoc`.

## 2. 접속

| 구분 | 값 |
| --- | --- |
| 로컬 직접 실행 | `http://127.0.0.1:8004` (README의 uvicorn 실행 예) |
| API 베이스 | `/api/babycare/v1` (`app/core/config.py`의 `API_V1_STR`) |
| 운영(추정) | `https://hd2lab.duckdns.org/api/babycare/v1` — Nginx 리버스 프록시 경유. `CORS_ORIGINS`에 `https://hd2lab.duckdns.org`가 기본 포함되어 있다 |
| 프런트 | `/babycare/` (`FRONTEND_BASE_URL` 기본값) |
| 업로드 정적 경로 | `GET /api/babycare/v1/uploads/{filename}` (`UPLOAD_DIR` 마운트) |
| DB | 기본 SQLite `sqlite:///./babycare.db`, `DATABASE_URL`로 교체 |

CORS는 `CORS_ORIGINS` 목록만 허용하며 `allow_credentials=True`, 메서드/헤더는 전체 허용이다.

## 3. 인증·권한

### 3-1. 두 가지 인증 경로 (`app/services/auth_adapter.py`)

1. **프록시 헤더(우선)** — `X-User-Email`이 있으면 그 이메일로 사용자를 조회하고, 없으면 자동 생성한다.
   - `X-User-Id`(선택), `X-User-Email`(필수), `X-User-Name`(선택)
   - 이 경로는 **헤더를 신뢰**하므로 반드시 Nginx가 외부 요청의 해당 헤더를 덮어쓰는 구성에서만 쓴다.
2. **JWT(폴백)** — `Authorization: Bearer <jwt>` 또는 쿠키 `babycare_access_token`. HS256, `SECRET_KEY`로 서명하며 `sub`=사용자 ID. 만료 기본 7일(`ACCESS_TOKEN_EXPIRE_MINUTES`).

`config.py`에 `AUTH_MODE`(`hybrid`/`hd2lab_proxy`/`local`)가 정의돼 있지만 **현재 코드는 이 값을 읽어 분기하지 않고 항상 하이브리드 어댑터를 쓴다**.

### 3-2. 아이 단위 역할

`ROLE_HIERARCHY = {owner: 3, caregiver: 2, viewer: 1}`. `permission_service.verify_child_access()`가 검사한다.

| 역할 | 가능한 일 |
| --- | --- |
| `viewer` | 조회(아이·수유·수면·성장·캘린더·분석) |
| `caregiver` | viewer + 기록 생성/수정/삭제, 아이 정보 수정, 아바타 업로드 |
| `owner` | caregiver + 아이 삭제, 가족 초대/삭제, 초대 코드 발급, 가입 요청 승인/거절 |

- 아이 생성자(`created_by`)는 항상 `owner`다.
- `ChildMember.status`가 `pending`이면 데이터 접근이 403으로 막힌다(승인 전 열람 불가).

### 3-3. 인증 실패 응답

| 상황 | 상태 | 본문 |
| --- | --- | --- |
| 자격 증명 없음/만료 | 401 | `{"detail":"로그인이 필요합니다."}` + `WWW-Authenticate: Bearer` |
| 아이 접근 권한 없음 | 403 | `{"detail":"해당 아이 프로필에 대한 접근 권한이 없습니다."}` |
| 승인 대기 중 | 403 | `{"detail":"주 양육자(Owner)의 최종 승인을 기다리는 중입니다."}` |
| 역할 부족 | 403 | `{"detail":"해당 작업을 수행하려면 owner 이상의 권한이 필요합니다."}` |

## 4. 엔드포인트

표기: 경로는 모두 `/api/babycare/v1` 뒤에 붙는다. `인증` 열의 `viewer`/`caregiver`/`owner`는 로그인 + 해당 역할 이상을 뜻한다.

### 4-1. 인증 `/auth` (9)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/auth/dev-login` | 공개 | 이메일만으로 사용자를 만들거나 찾아 JWT를 발급하고 쿠키를 심는다. **개발·테스트용** |
| GET | `/auth/me` | 로그인 | 내 계정 정보 |
| POST | `/auth/logout` | 공개 | `babycare_access_token` 쿠키 삭제 |
| GET | `/auth/google/status` | 공개 | Google OAuth 설정 여부(`configured`) |
| GET | `/auth/google/login` | 공개 | Google 동의 화면으로 302. 미설정 시 503 |
| GET | `/auth/google/callback` | 공개 | `code`, `state`를 받아 토큰 교환 후 쿠키 발급, `FRONTEND_BASE_URL?auth=google`로 302 |
| GET | `/auth/otp/status` | 공개 | hd2lab-mail UDS 연결 상태 |
| POST | `/auth/otp/request` | 공개 | 6자리 메일 OTP 발급·발송(10분 유효) |
| POST | `/auth/otp/verify` | 공개 | OTP 검증 후 JWT + 쿠키 발급. 새 이메일이면 사용자 생성 |

### 4-2. 아이 프로필·가족 `/children` (14)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/children` | 로그인 | 내가 소유했거나 `active`로 공유받은 아이 목록 |
| POST | `/children` | 로그인 | 아이 등록 + owner 멤버십 + 예방접종 일정 자동 생성. 201 |
| GET | `/children/{id}` | viewer | 아이 상세(역할·가족·개월수 포함) |
| PATCH | `/children/{id}` | caregiver | 부분 수정. `birth_date`가 바뀌면 일정 재생성 |
| DELETE | `/children/{id}` | owner | 삭제. 204 |
| POST | `/children/{id}/upload-avatar` | caregiver | multipart `file`(JPG/PNG/WEBP, 5MB 이하) |
| POST | `/children/{id}/members` | owner | 이메일로 가족 초대(즉시 active). 이미 있으면 역할만 변경 |
| DELETE | `/children/{id}/members/{member_id}` | owner | 멤버 제거. owner는 제거 불가(400). 204 |
| POST | `/children/{id}/invite-code` | owner | 6자리 초대 코드 발급(24시간). 기존 활성 코드는 무효화 |
| POST | `/children/join-request` | 로그인 | 6자리 코드로 참여 요청 → `pending` 생성, owner에게 메일 통지(실패 무시) |
| GET | `/children/join-requests/mine` | 로그인 | 내가 낸 대기 중 요청 목록 |
| GET | `/children/{id}/members/pending` | owner | 승인 대기 요청 목록 |
| POST | `/children/{id}/members/{member_id}/approve` | owner | 승인(선택적으로 역할 변경) |
| POST | `/children/{id}/members/{member_id}/reject` | owner | 거절·삭제. 204 |

### 4-3. 수유 `/children/{child_id}/feeding` (5)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `` (기본 경로) | viewer | 목록. 쿼리 `target_date=YYYY-MM-DD`(선택, `start_time` 기준) |
| POST | `` | caregiver | 기록 생성. 201. 분유/유축모유는 `amount_ml` 필수 |
| PATCH | `/{record_id}` | caregiver | 부분 수정 |
| DELETE | `/{record_id}` | caregiver | 204 |
| GET | `/daily-summary` | viewer | 쿼리 `date_str=YYYY-MM-DD`(없으면 오늘) |

### 4-4. 수면 `/children/{child_id}/sleep` (5)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `` | viewer | 목록. 쿼리 `target_date`(선택) |
| POST | `` | caregiver | 생성. 201. `is_ongoing=true`면 진행 중 기록이 하나만 허용(중복 시 400) |
| PATCH | `/{record_id}` | caregiver | 수정. `end_time`이 있으면 `duration_min` 재계산. 진행 중 종료에 사용 |
| DELETE | `/{record_id}` | caregiver | 204 |
| GET | `/daily-summary` | viewer | 쿼리 `date_str`. 진행 중 기록은 `ongoing_sleep`으로 따로 반환 |

### 4-5. 성장 `/children/{child_id}/growth` (6)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `` | viewer | 측정 기록 오름차순 |
| POST | `` | caregiver | 생성. 201. 2017 KDCA LMS로 백분위 자동 계산 |
| PATCH | `/{record_id}` | caregiver | 수정 후 백분위 재계산 |
| DELETE | `/{record_id}` | caregiver | 204 |
| GET | `/curves` | viewer | 쿼리 `metric`(`weight_kg`\|`height_cm`\|`head_circumference_cm`, 기본 `weight_kg`), 아이 성별 기준 P3/P50/P97 |
| GET | `/summary` | viewer | 최근 2건 비교·증감·전체 건수 |

### 4-6. 건강 캘린더 `/children/{child_id}/calendar`, `/health-rules` (6)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/children/{child_id}/calendar` | viewer | 쿼리 `event_type`(`vaccine`\|`checkup`\|`hospital`). 조회 시 지난 일정 `overdue` 갱신 |
| POST | `/children/{child_id}/calendar` | caregiver | 사용자 추가 일정. 201. 항상 `is_self_reported=true` |
| PATCH | `/children/{child_id}/calendar/{event_id}` | caregiver | 수정. `completed_date`가 있으면 `status=completed` 자동 |
| DELETE | `/children/{child_id}/calendar/{event_id}` | caregiver | 204 |
| GET | `/children/{child_id}/calendar/summary` | viewer | 예정 5건·지연·완료·전체 |
| GET | `/health-rules/live` | 공개 | 쿼리 `birth_date=YYYY-MM-DD`(선택). NIP 예방접종 + 영유아 건강검진 규칙, `birth_date`가 있으면 `scheduled_date`·`d_day` 계산 |

### 4-7. 육아 지식 `/articles` (2)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/articles` | 공개 | 쿼리 `category`, `age_months`, `keyword`. 승인된 글만 |
| GET | `/articles/{id}` | 공개 | 단건. 없거나 미승인은 404 |

### 4-8. 분석 `/analytics` (3)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/analytics/analyze-stateless` | 공개 | multipart `file`(.zip/.csv, 10MB 이하)을 메모리에서만 해석. DB 저장 없음 |
| POST | `/analytics/upload-zip` | 로그인 | multipart `file`, `child_id`(선택), `auto_create_child`(기본 `true`). 기록을 DB에 적재 |
| GET | `/analytics/children/{child_id}` | viewer | 아이 나이 요약 |

### 4-9. 향단이 AI `/ai` (2)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/ai/chat` | 선택 | RAG 답변. 비로그인도 사용 가능(대화 미저장). `use_child_context=true`면 아이 접근 권한 확인 + 동의 이력 기록 |
| GET | `/ai/conversations` | 선택 | 내 대화 목록. 비로그인이면 빈 배열 |

### 4-10. 시스템 (2)

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/health` | 공개 | DB `SELECT 1` 확인 포함 상태 |
| GET | `/uploads/{filename}` | 공개 | 업로드된 아바타 정적 파일 |

루트 `GET /`(프리픽스 없음)는 서비스 소개 JSON을 돌려준다.

합계: **54행** = API 53개 + 업로드 정적 경로 1개
(인증 9 · 프로필 14 · 수유 5 · 수면 5 · 성장 6 · 캘린더 6 · 지식 2 · 분석 3 · AI 2 · 시스템 2).
`/uploads/{filename}`은 FastAPI `StaticFiles` 마운트라 엔드포인트 집계에서는 빼면 53개다.

## 5. 요청·응답 예시

### 5-1. 로그인 (OTP)

```bash
curl -s -X POST https://hd2lab.duckdns.org/api/babycare/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com"}'
```

```json
{"status":"sent","email":"parent@example.com","message":"6자리 인증 코드를 이메일로 발송했습니다. (10분 유효)"}
```

```bash
curl -s -X POST https://hd2lab.duckdns.org/api/babycare/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com","code":"123456","name":"김보호"}'
```

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user": {"id":"u_...","email":"parent@example.com","name":"김보호","avatar_url":null,
           "role":"user","is_active":true,"created_at":"2026-11-19T00:00:00","updated_at":"2026-11-19T00:00:00"}
}
```

성공 시 `Set-Cookie: babycare_access_token=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`도 함께 온다.

### 5-2. 아이 등록

```bash
curl -s -X POST https://hd2lab.duckdns.org/api/babycare/v1/children \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"태휘","birth_date":"2026-06-09","sex":"male","is_premature":true,
       "due_date":"2026-07-20","gestational_weeks":33}'
```

```json
{
  "id": "c_...", "name": "태휘", "birth_date": "2026-06-09", "sex": "male",
  "is_premature": true, "due_date": "2026-07-20", "gestational_weeks": 33,
  "profile_image_url": null, "created_by": "u_...",
  "created_at": "2026-11-19T06:00:00", "updated_at": "2026-11-19T06:00:00",
  "role": "owner",
  "members": [{"id":"m_...","user_id":"u_...","role":"owner","user_name":"김보호",
               "user_email":"parent@example.com","invited_at":"2026-11-19T06:00:00"}],
  "days_since_birth": 163, "months_since_birth": 5.4, "corrected_age_months": 3.9
}
```

`@router.post("")`은 `/children`(끝 슬래시 없음)에 매핑된다. `/children/`로 호출하면 307로 리다이렉트된다.

### 5-3. 수유 기록과 일일 합계

```bash
curl -s -X POST ".../children/c_.../feeding" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"feeding_type":"formula","start_time":"2026-11-19T08:10:00","end_time":"2026-11-19T08:30:00",
       "amount_ml":180,"notes":"잘 먹음"}'
```

```json
{"id":"f_...","child_id":"c_...","feeding_type":"formula","start_time":"2026-11-19T08:10:00",
 "end_time":"2026-11-19T08:30:00","amount_ml":180.0,"left_duration_min":null,
 "right_duration_min":null,"notes":"잘 먹음","created_at":"2026-11-19T08:31:00"}
```

`GET .../children/c_.../feeding/daily-summary?date_str=2026-11-19`

```json
{"date":"2026-11-19","total_amount_ml":760.0,"total_breastfeeding_min":40,
 "formula_count":4,"breastfeeding_count":1,"expressed_milk_count":0,"total_count":5}
```

### 5-4. 수면 진행 중 기록 → 종료

```bash
curl -s -X POST ".../children/c_.../sleep" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"start_time":"2026-11-19T13:00:00","is_nap":true,"is_ongoing":true}'

curl -s -X PATCH ".../children/c_.../sleep/s_..." -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"end_time":"2026-11-19T14:05:00","is_ongoing":false}'
```

종료 응답의 `duration_min`은 `end_time - start_time`의 분 단위 정수다.

### 5-5. 성장 기록

```json
{"measurement_date":"2026-11-15","weight_kg":7.9,"height_cm":67.5,
 "head_circumference_cm":43.2,"notes":"6개월 검진","measurement_method":"clinic"}
```

응답에는 `weight_percentile`, `height_percentile`, `head_circumference_percentile`(0~100, 소수)가 붙는다.
`is_premature=true`이고 `due_date`가 있으면 교정 연령으로 계산한다.

### 5-6. 향단이 AI

```bash
curl -s -X POST ".../ai/chat" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"6개월 아기 밤중 수유 끊는 방법 알려줘","use_child_context":false}'
```

```json
{
  "conversation_id": "conv_...", "message_id": "msg_...",
  "reply": "…", "sources": [{"title":"…","organization":"질병관리청","url":"…","category":"수면","excerpt":"…"}],
  "is_emergency": false, "safety_disclaimer": "…",
  "suggested_follow_ups": ["…"], "used_child_context": false
}
```

요청 필드: `message`(1~2000자), `conversation_id`(선택), `child_id`(선택), `use_child_context`(기본 `false`).

### 5-7. 검증 규칙 요약

| 대상 | 규칙 |
| --- | --- |
| `ChildCreate.sex` | `male` \| `female` |
| `gestational_weeks` | 20~44 |
| `FeedingRecord.feeding_type` | `breastfeeding` \| `formula` \| `expressed_milk` |
| `amount_ml` | 0~1000, 분유/유축모유는 필수 |
| 수유 지속 | `left_duration_min`, `right_duration_min` 각 0~120 |
| `GrowthRecord` | `weight_kg` 0.5~50, `height_cm` 20~160, `head_circumference_cm` 15~70 |
| `HealthEvent.event_type` | `vaccine` \| `checkup` \| `hospital` |
| `HealthEvent.status` | `scheduled` \| `completed` \| `overdue` |
| 가족 역할 | `caregiver` \| `viewer` (초대), 승인 시 같은 값으로 변경 가능 |
| 초대 코드 | 6자리 숫자 |
| 아바타 | `image/jpeg` \| `image/png` \| `image/webp`, 5MB 이하 |

## 6. 오류 코드

| HTTP | 발생 지점 | 의미 | 조치 |
| --- | --- | --- | --- |
| 400 | 여러 곳 | 검증 실패(예: 분유인데 `amount_ml` 없음, 이미 진행 중인 수면, owner 제거 시도, `birth_date` 형식 오류) | 본문 `detail` 확인 후 요청 수정 |
| 401 | 인증 의존성 | 자격 증명 없음/만료 | 재로그인 |
| 403 | `verify_child_access` | 역할 부족·미승인 멤버·권한 없는 아이 | owner 승인 또는 역할 상향 |
| 404 | 리소스 조회 | 아이/기록/일정/글/승인 대기 요청 없음 | ID 확인 |
| 413 | `/analytics/*` | 10MB 초과 | 파일 축소 |
| 422 | FastAPI | 스키마 검증 실패(필드 누락·정규식·범위) | `errors[]` 확인 |
| 429 | `/auth/otp/verify` | OTP 시도 5회 초과 → 코드 폐기 | 새 코드 요청 |
| 500 | 예외 | 처리되지 않은 서버 오류 | 서버 로그 |
| 503 | `/auth/google/*`, `/auth/otp/request` | Google OAuth 미설정, hd2lab-mail 소켓/발신 불가 | `HD2_MAIL_SOCKET` 및 메일 서버 상태 확인 |

## 7. 환경변수·배포

`app/core/config.py`(pydantic-settings, `case_sensitive=True`)와 `os.getenv`에서 읽는다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SECRET_KEY` | 개발용 하드코딩 기본값 | JWT 서명 키. **운영에서는 반드시 교체** |
| `DATABASE_URL` | `sqlite:///./babycare.db` | SQLAlchemy 접속 문자열 |
| `UPLOAD_DIR` | `./uploads` | 아바타 저장 경로. `/api/babycare/v1/uploads`로 정적 서빙 |
| `AUTH_MODE` | `hybrid` | 정의만 되어 있고 현재 분기에 쓰이지 않음 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 빈 값 | 비어 있으면 Google 로그인 503 |
| `GOOGLE_REDIRECT_URI` | `https://hd2lab.duckdns.org/api/babycare/v1/auth/google/callback` | OAuth 콜백 |
| `FRONTEND_BASE_URL` | `/babycare/` | Google 콜백 후 이동지 |
| `HD2_MAIL_SOCKET` | `/run/hd2lab-mail/http.sock` | hd2lab-mail Unix 소켓(OTP·초대 알림) |
| `HEALTH_RULES_LIVE_JSON` | `./data/health_rules_live.json` | 있으면 `/health-rules/live`가 이 파일로 규칙을 덮어쓴다 |
| `AI_PROVIDER` | `hd2lab_gateway` | `hd2lab_gateway` \| `gemini` \| `llama` \| `mock` |
| `AI_GATEWAY_SOCKET` | `/run/hd2lab-ai-gateway/api.sock` | AI Gateway UDS |
| `AI_GATEWAY_ROUTE` | `babycare` | Gateway 라우트 이름(`/internal/babycare/...`) |
| `AI_GATEWAY_TOKEN` (`GATEWAY_BABYCARE_TOKEN` 대체) | 빈 값 | Gateway 인증 토큰. 값은 저장소·문서에 남기지 않는다 |
| `AI_GATEWAY_MAX_CONTEXT_TOKENS` / `AI_GATEWAY_MAX_OUTPUT_TOKENS` | `4096` / `768` | 요청 예산 |
| `GEMINI_API_KEY` | 빈 값 | `AI_PROVIDER=gemini`일 때만 |
| `LOCAL_LLAMA_URL` | `http://127.0.0.1:8080/v1` | `AI_PROVIDER=llama`일 때만 |

그 밖의 고정값: `API_V1_STR=/api/babycare/v1`, 업로드 최대 5MB(`MAX_UPLOAD_SIZE_BYTES`), 분석 파일 최대 10MB(`analytics.MAX_STAT_FILE_BYTES`).

배포: `cd services/babycare/backend && PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8004`.
기동 시 `Base.metadata.create_all`, `child_members.status` 컬럼 보정, 지식·건강 규칙 시드가 자동 실행된다.
Nginx는 `/babycare/`(정적)와 `/api/babycare/v1/`(백엔드)를 프록시한다. 상세 절차는 `docs/DEPLOYMENT_AND_RUNBOOK.md`.

### 보안 주의

- `/auth/dev-login`은 비밀번호 없이 이메일만으로 JWT를 발급한다. 운영 인스턴스에서 이 경로를 외부에 열어 두면 누구나 계정을 만들 수 있으므로 Nginx에서 차단하는 것을 권한다. 현재 코드에는 차단 장치가 없다.
- 프록시 헤더 인증은 `X-User-Email`을 그대로 신뢰한다. Nginx가 클라이언트가 보낸 같은 이름의 헤더를 제거하고 SSO 결과로 덮어써야 안전하다.
- `SECRET_KEY` 기본값은 공개된 개발용 문자열이다.

## 8. 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-11-19 | `main`(`d37780a`) 소스 기준 최초 작성. 53개 엔드포인트, 인증·역할·오류·환경변수 정리 |

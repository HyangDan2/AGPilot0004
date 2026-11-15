"""
Official Korea National Immunization Program (NIP, 질병관리청 국가예방접종지원사업)
and National Infant & Child Health Checkup Program (국민건강보험공단 영유아 건강검진 1~8차).
Separated as data rules to allow updates without codebase restructuring.
"""

VACCINATION_RULES = [
    {
        "code": "VAC_BCG",
        "name": "BCG (피내용/경피용 결핵)",
        "target_age_months_min": 0,
        "target_age_months_max": 1,
        "description": "생후 4주 이내 접종 권장. 피내용(무료) 또는 경피용.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 1
    },
    {
        "code": "VAC_HEPB_1",
        "name": "B형간염 1차",
        "target_age_months_min": 0,
        "target_age_months_max": 0,
        "description": "출생 직후 12시간 이내 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 2
    },
    {
        "code": "VAC_HEPB_2",
        "name": "B형간염 2차",
        "target_age_months_min": 1,
        "target_age_months_max": 1,
        "description": "생후 1개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 3
    },
    {
        "code": "VAC_DTAP_1",
        "name": "DTaP 1차 (디프테리아·파상풍·백일해)",
        "target_age_months_min": 2,
        "target_age_months_max": 2,
        "description": "생후 2개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 4
    },
    {
        "code": "VAC_IPV_1",
        "name": "폴리오 (IPV) 1차 (소아마비)",
        "target_age_months_min": 2,
        "target_age_months_max": 2,
        "description": "생후 2개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 5
    },
    {
        "code": "VAC_HIB_1",
        "name": "b형 헤모필루스 인플루엔자 (Hib) 1차",
        "target_age_months_min": 2,
        "target_age_months_max": 2,
        "description": "생후 2개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 6
    },
    {
        "code": "VAC_PCV_1",
        "name": "폐렴구균 (PCV) 1차",
        "target_age_months_min": 2,
        "target_age_months_max": 2,
        "description": "생후 2개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 7
    },
    {
        "code": "VAC_DTAP_2",
        "name": "DTaP 2차",
        "target_age_months_min": 4,
        "target_age_months_max": 4,
        "description": "생후 4개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 8
    },
    {
        "code": "VAC_IPV_2",
        "name": "폴리오 (IPV) 2차",
        "target_age_months_min": 4,
        "target_age_months_max": 4,
        "description": "생후 4개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 9
    },
    {
        "code": "VAC_HIB_2",
        "name": "Hib 2차",
        "target_age_months_min": 4,
        "target_age_months_max": 4,
        "description": "생후 4개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 10
    },
    {
        "code": "VAC_PCV_2",
        "name": "폐렴구균 2차",
        "target_age_months_min": 4,
        "target_age_months_max": 4,
        "description": "생후 4개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 11
    },
    {
        "code": "VAC_DTAP_3",
        "name": "DTaP 3차",
        "target_age_months_min": 6,
        "target_age_months_max": 6,
        "description": "생후 6개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 12
    },
    {
        "code": "VAC_HEPB_3",
        "name": "B형간염 3차",
        "target_age_months_min": 6,
        "target_age_months_max": 6,
        "description": "생후 6개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 13
    },
    {
        "code": "VAC_MMR_1",
        "name": "MMR 1차 (홍역·유행성이하선염·풍진)",
        "target_age_months_min": 12,
        "target_age_months_max": 15,
        "description": "생후 12~15개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 14
    },
    {
        "code": "VAC_VAR_1",
        "name": "수두 (VAR) 1차",
        "target_age_months_min": 12,
        "target_age_months_max": 15,
        "description": "생후 12~15개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 15
    },
    {
        "code": "VAC_HEPA_1",
        "name": "A형간염 1차",
        "target_age_months_min": 12,
        "target_age_months_max": 23,
        "description": "생후 12~23개월 접종 (6개월 후 2차 접종).",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 16
    },
    {
        "code": "VAC_JE_1",
        "name": "일본뇌염 (불활성화 1차 또는 사백신)",
        "target_age_months_min": 12,
        "target_age_months_max": 23,
        "description": "생후 12~23개월 접종.",
        "official_source": "질병관리청 예방접종도우미 (NIP)",
        "is_mandatory": True,
        "order_num": 17
    }
]

CHECKUP_RULES = [
    {
        "code": "CHK_1",
        "name": "영유아 건강검진 1차 (생후 14~35일)",
        "target_age_months_min": 0,
        "target_age_months_max": 1,
        "description": "신체계측, 시각/청각 문진, 영양 및 안전사고 예방 교육",
        "official_source": "국민건강보험공단 건강iN",
        "is_mandatory": True,
        "order_num": 101
    },
    {
        "code": "CHK_2",
        "name": "영유아 건강검진 2차 (생후 4~6개월)",
        "target_age_months_min": 4,
        "target_age_months_max": 6,
        "description": "신체계측, 발달선별검사 및 수유/이유식 상담",
        "official_source": "국민건강보험공단 건강iN",
        "is_mandatory": True,
        "order_num": 102
    },
    {
        "code": "CHK_3",
        "name": "영유아 건강검진 3차 (생후 9~12개월)",
        "target_age_months_min": 9,
        "target_age_months_max": 12,
        "description": "신체계측, 발달선별검사 및 구강검진 안내",
        "official_source": "국민건강보험공단 건강iN",
        "is_mandatory": True,
        "order_num": 103
    },
    {
        "code": "CHK_4",
        "name": "영유아 건강검진 4차 (생후 18~24개월)",
        "target_age_months_min": 18,
        "target_age_months_max": 24,
        "description": "신체계측, 대소변가리기 및 발달평가 (구강검진 1차 포함)",
        "official_source": "국민건강보험공단 건강iN",
        "is_mandatory": True,
        "order_num": 104
    },
    {
        "code": "CHK_5",
        "name": "영유아 건강검진 5차 (생후 30~36개월)",
        "target_age_months_min": 30,
        "target_age_months_max": 36,
        "description": "신체계측, 시각검사 및 정서발달 상담 (구강검진 2차 포함)",
        "official_source": "국민건강보험공단 건강iN",
        "is_mandatory": True,
        "order_num": 105
    }
]

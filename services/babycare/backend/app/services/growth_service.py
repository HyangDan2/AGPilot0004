import math
from datetime import date
from typing import Optional
from app.knowledge.korean_cdc_growth_table import KOREAN_CDC_2017_LMS

def calculate_age_in_months(birth_date: date, measurement_date: date) -> float:
    days = (measurement_date - birth_date).days
    if days < 0:
        return 0.0
    return days / 30.4375  # Standard average days per month

def calculate_corrected_age_in_months(
    birth_date: date,
    measurement_date: date,
    is_premature: bool,
    due_date: Optional[date] = None,
    gestational_weeks: Optional[int] = None
) -> float:
    """
    For premature infants born < 37 weeks:
    Corrected Age = Chronological Age - (40 - Gestational Weeks) * 7 days
    If due_date is supplied, days between due_date and measurement_date is used.
    """
    if not is_premature:
        return calculate_age_in_months(birth_date, measurement_date)

    if due_date and measurement_date >= due_date:
        days = (measurement_date - due_date).days
        return max(0.0, days / 30.4375)
    elif gestational_weeks and gestational_weeks < 37:
        premature_days = (40 - gestational_weeks) * 7
        actual_days = (measurement_date - birth_date).days - premature_days
        return max(0.0, actual_days / 30.4375)

    return calculate_age_in_months(birth_date, measurement_date)

def get_lms_params(metric: str, sex: str, age_months: float) -> tuple[float, float, float]:
    """
    Interpolates (L, M, S) parameters from official Korean CDC tables for a given age in months.
    """
    metric_table = KOREAN_CDC_2017_LMS.get(metric, {})
    sex_table = metric_table.get(sex.lower(), [])
    if not sex_table:
        # Fallback to male if unknown
        sex_table = metric_table.get("male", [])

    if not sex_table:
        return (1.0, 1.0, 0.1)

    # Clamp age
    if age_months <= sex_table[0][0]:
        return sex_table[0][1], sex_table[0][2], sex_table[0][3]
    if age_months >= sex_table[-1][0]:
        return sex_table[-1][1], sex_table[-1][2], sex_table[-1][3]

    # Linear interpolation between adjacent monthly points
    for i in range(len(sex_table) - 1):
        m0, l0, med0, s0 = sex_table[i]
        m1, l1, med1, s1 = sex_table[i + 1]
        if m0 <= age_months <= m1:
            ratio = (age_months - m0) / (m1 - m0)
            l = l0 + ratio * (l1 - l0)
            m = med0 + ratio * (med1 - med0)
            s = s0 + ratio * (s1 - s0)
            return (l, m, s)

    return sex_table[-1][1], sex_table[-1][2], sex_table[-1][3]

def normal_cdf(z: float) -> float:
    """Standard normal cumulative distribution function."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))

def calculate_percentile(value: Optional[float], metric: str, sex: str, age_months: float) -> Optional[float]:
    """
    Calculates exact growth percentile using the LMS formula:
      Z = ((X/M)^L - 1) / (L * S)  if L != 0
      Z = ln(X/M) / S              if L == 0
    Percentile = normal_cdf(Z) * 100
    """
    if value is None or value <= 0:
        return None

    L, M, S = get_lms_params(metric, sex, age_months)
    if M <= 0 or S <= 0:
        return None

    ratio = value / M
    if abs(L) < 1e-5:
        z = math.log(ratio) / S
    else:
        z = (math.pow(ratio, L) - 1.0) / (L * S)

    percentile = normal_cdf(z) * 100.0
    return round(percentile, 1)

def get_growth_curve(metric: str, sex: str, max_months: int = 36) -> list[dict]:
    """
    Generates reference growth curve points (p3, p50, p97) for charting.
    Using Z-scores:
      p3: Z = -1.8808
      p50: Z = 0.0 (M)
      p97: Z = +1.8808
    Formula inverse:
      X = M * (1 + L * S * Z)^(1 / L) if L != 0
      X = M * exp(S * Z)             if L == 0
    """
    z_3 = -1.8808
    z_50 = 0.0
    z_97 = 1.8808

    points = []
    # Every 1 month from 0 to 12, then every 3 months to max_months
    months_to_sample = list(range(0, 13)) + list(range(15, max_months + 1, 3))
    
    for m in months_to_sample:
        L, M, S = get_lms_params(metric, sex, float(m))
        
        def z_to_val(z):
            if abs(L) < 1e-5:
                return round(M * math.exp(S * z), 2)
            base = 1.0 + L * S * z
            if base <= 0:
                return 0.0
            return round(M * math.pow(base, 1.0 / L), 2)

        points.append({
            "age_months": m,
            "p3": z_to_val(z_3),
            "p50": z_to_val(z_50),
            "p97": z_to_val(z_97)
        })

    return points

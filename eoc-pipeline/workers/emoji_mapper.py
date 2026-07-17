"""Maps incident categories and offense descriptions to (category, emoji, severity) tuples."""

from typing import Tuple

# ---------------------------------------------------------------------------
# Citizen app category mappings
# ---------------------------------------------------------------------------

CITIZEN_CATEGORY_MAP: dict[str, Tuple[str, str, str]] = {
    # Violent crime
    "shooting": ("shooting", "\U0001F4A5", "critical"),
    "stabbing": ("stabbing", "\U0001F52A", "critical"),
    "assault": ("assault", "\U0001F44A", "high"),
    "robbery": ("robbery", "\U0001F3AD", "high"),
    "homicide": ("homicide", "\U0001F480", "critical"),
    "murder": ("homicide", "\U0001F480", "critical"),
    "kidnapping": ("kidnapping", "\U0001F6A8", "critical"),
    "carjacking": ("carjacking", "\U0001F697", "critical"),

    # Fire / hazmat
    "fire": ("fire", "\U0001F525", "high"),
    "structure fire": ("fire", "\U0001F525", "high"),
    "brush fire": ("fire", "\U0001F525", "medium"),
    "gas leak": ("hazmat", "\u2623\ufe0f", "high"),
    "hazmat": ("hazmat", "\u2623\ufe0f", "high"),
    "explosion": ("explosion", "\U0001F4A5", "critical"),

    # Vehicle / traffic
    "accident": ("traffic", "\U0001F698", "medium"),
    "vehicle accident": ("traffic", "\U0001F698", "medium"),
    "hit and run": ("traffic", "\U0001F698", "medium"),
    "pedestrian struck": ("traffic", "\U0001F6B6", "high"),
    "pursuit": ("pursuit", "\U0001F6A8", "high"),
    "reckless driver": ("traffic", "\U0001F6A8", "medium"),

    # Medical
    "ems": ("medical", "\U0001F691", "medium"),
    "medical emergency": ("medical", "\U0001F691", "medium"),
    "overdose": ("medical", "\U0001F48A", "high"),
    "cardiac arrest": ("medical", "\u2764\ufe0f", "high"),

    # Police activity
    "police activity": ("police", "\U0001F46E", "medium"),
    "shots fired": ("shooting", "\U0001F4A5", "critical"),
    "armed person": ("armed_person", "\U0001F52B", "critical"),
    "barricade": ("standoff", "\U0001F6E1\ufe0f", "critical"),
    "standoff": ("standoff", "\U0001F6E1\ufe0f", "critical"),
    "suspicious activity": ("suspicious", "\U0001F440", "low"),
    "suspicious package": ("suspicious", "\U0001F4E6", "high"),
    "burglary": ("burglary", "\U0001F3E0", "medium"),
    "theft": ("theft", "\U0001F3E0", "low"),

    # Weather / natural
    "tornado": ("weather", "\U0001F32A\ufe0f", "critical"),
    "severe weather": ("weather", "\u26C8\ufe0f", "high"),
    "flooding": ("weather", "\U0001F30A", "high"),

    # Other
    "missing person": ("missing_person", "\U0001F50D", "high"),
    "wanted person": ("wanted", "\U0001F46E", "medium"),
    "bomb threat": ("bomb_threat", "\U0001F4A3", "critical"),
    "protest": ("protest", "\u270A", "low"),
    "disturbance": ("disturbance", "\U0001F4E2", "low"),
}

# ---------------------------------------------------------------------------
# KCPD offense description mappings
# ---------------------------------------------------------------------------

KCPD_OFFENSE_MAP: dict[str, Tuple[str, str, str]] = {
    # Violent
    "aggravated assault": ("assault", "\U0001F44A", "high"),
    "simple assault": ("assault", "\U0001F44A", "medium"),
    "murder": ("homicide", "\U0001F480", "critical"),
    "homicide": ("homicide", "\U0001F480", "critical"),
    "manslaughter": ("homicide", "\U0001F480", "critical"),
    "robbery": ("robbery", "\U0001F3AD", "high"),
    "armed robbery": ("robbery", "\U0001F52B", "critical"),
    "rape": ("sexual_assault", "\U0001F6A8", "critical"),
    "sexual assault": ("sexual_assault", "\U0001F6A8", "critical"),
    "kidnapping": ("kidnapping", "\U0001F6A8", "critical"),

    # Property
    "burglary": ("burglary", "\U0001F3E0", "medium"),
    "breaking and entering": ("burglary", "\U0001F3E0", "medium"),
    "larceny": ("theft", "\U0001F4B0", "low"),
    "theft": ("theft", "\U0001F4B0", "low"),
    "motor vehicle theft": ("auto_theft", "\U0001F697", "medium"),
    "auto theft": ("auto_theft", "\U0001F697", "medium"),
    "arson": ("arson", "\U0001F525", "high"),
    "vandalism": ("vandalism", "\U0001F3A8", "low"),
    "trespassing": ("trespassing", "\U0001F6B7", "low"),

    # Drugs
    "drug violation": ("drugs", "\U0001F48A", "medium"),
    "drug offense": ("drugs", "\U0001F48A", "medium"),
    "narcotics": ("drugs", "\U0001F48A", "medium"),

    # Weapons
    "weapons violation": ("weapons", "\U0001F52B", "high"),
    "weapons offense": ("weapons", "\U0001F52B", "high"),
    "unlawful use of weapon": ("weapons", "\U0001F52B", "high"),

    # Traffic
    "dwi": ("traffic", "\U0001F698", "medium"),
    "dui": ("traffic", "\U0001F698", "medium"),
    "hit and run": ("traffic", "\U0001F698", "medium"),
    "leaving the scene": ("traffic", "\U0001F698", "medium"),

    # Disorder
    "disorderly conduct": ("disturbance", "\U0001F4E2", "low"),
    "disturbance": ("disturbance", "\U0001F4E2", "low"),
    "domestic disturbance": ("domestic", "\U0001F3E0", "medium"),
    "domestic violence": ("domestic", "\U0001F3E0", "high"),

    # Other
    "fraud": ("fraud", "\U0001F4B3", "low"),
    "forgery": ("fraud", "\U0001F4B3", "low"),
    "prostitution": ("vice", "\U0001F6A8", "low"),
    "missing person": ("missing_person", "\U0001F50D", "high"),
}

# Severity ordering for comparisons
SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def map_citizen_category(raw_category: str) -> Tuple[str, str, str]:
    """Map a Citizen app incident category to (category, emoji, severity).

    Falls back to a generic mapping if the category is not recognized.
    """
    key = raw_category.strip().lower()

    # Exact match
    if key in CITIZEN_CATEGORY_MAP:
        return CITIZEN_CATEGORY_MAP[key]

    # Substring match: check if any known key is contained in the raw category
    for known_key, mapping in CITIZEN_CATEGORY_MAP.items():
        if known_key in key:
            return mapping

    # Default fallback
    return ("other", "\u26a0\ufe0f", "info")


def map_kcpd_offense(offense_desc: str) -> Tuple[str, str, str]:
    """Map a KCPD offense description to (category, emoji, severity).

    Falls back to a generic mapping if the offense is not recognized.
    """
    key = offense_desc.strip().lower()

    # Exact match
    if key in KCPD_OFFENSE_MAP:
        return KCPD_OFFENSE_MAP[key]

    # Substring match
    for known_key, mapping in KCPD_OFFENSE_MAP.items():
        if known_key in key:
            return mapping

    # Default fallback
    return ("other", "\U0001F46E", "info")


def map_scanner_category(category: str) -> Tuple[str, str, str]:
    """Map a scanner-derived category string to (category, emoji, severity).

    Tries Citizen mappings first (broader coverage), then KCPD.
    """
    key = category.strip().lower()

    if key in CITIZEN_CATEGORY_MAP:
        return CITIZEN_CATEGORY_MAP[key]
    if key in KCPD_OFFENSE_MAP:
        return KCPD_OFFENSE_MAP[key]

    # Substring search across both maps
    for known_key, mapping in CITIZEN_CATEGORY_MAP.items():
        if known_key in key:
            return mapping
    for known_key, mapping in KCPD_OFFENSE_MAP.items():
        if known_key in key:
            return mapping

    return ("other", "\U0001F4FB", "info")

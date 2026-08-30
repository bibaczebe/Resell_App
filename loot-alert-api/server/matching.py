"""Shared relevance logic used by BOTH the scheduler (push path) and the
current-matches endpoint (in-app preview), so the two never diverge.

Live production data showed the flagship "iphone 13" query was ~80% noise:
music-marketplace results (Reverb/Discogs), phone cases/screens/parts. This
module gates that out: all-keyword-tokens, a bilingual accessory denylist,
user exclude-keywords, and a music-source relevance gate.
"""
import re

# Whole-word accessory / spare-parts noise, PL + EN. A listing whose title
# contains one of these (as a whole word) is rejected UNLESS the user's own
# keywords include that term (so a genuine "case"/"etui" hunter still works).
ACCESSORY_DENYLIST = {
    # Polish
    "etui", "obudowa", "pokrowiec", "szkło", "szklo", "folia", "ładowarka",
    "ladowarka", "kabel", "części", "czesci", "zamienny", "zamienna",
    "wyświetlacz", "wyswietlacz", "zasilacz", "nakładka", "nakladka",
    # English
    "case", "cover", "screen", "lcd", "digitizer", "flex", "wallet",
    "protector", "parts", "replacement", "charger", "bumper",
    # Other EU languages (Vinted is pan-European — cases show up as skal/obal/…)
    "skal", "fodral",                      # SE
    "obal", "kryt", "pouzdro",             # CZ/SK
    "hoesje", "oplader",                   # NL
    "coque", "housse", "chargeur",         # FR
    "funda", "carcasa", "cargador",        # ES
    "custodia", "pellicola", "caricatore",  # IT
    "hülle", "huelle", "schutzhülle", "panzerglas", "ladegerät",  # DE
    "capa", "capinha",                     # PT
    "dėklas",                              # LT
    # Low-value / non-flippable junk (margin < shipping) — PL + EN
    "skarpetki", "skarpety", "skarpetka", "socks",
    "opakowanie", "pudełko", "pudelko", "packaging",
    "naklejka", "naklejki", "sticker", "stickers",
    "brelok", "keychain", "smycz", "lanyard",
    "magnes", "magnet", "przypinka", "badge", "pin",
    "próbka", "probka", "sample", "gratis", "gadżet", "gadzet",
    # Buy-back / dealer ads (they want to BUY, not sell) — never a flip
    "skup", "skupujemy", "skupuje", "odkupię", "odkupie", "kupię", "kupie",
    # Spare parts / mounts / consumables (esp. vacuums/electronics)
    "uchwyt", "filtr", "filtry", "ssawka", "końcówka", "koncowka",
    "nasadka", "wąż", "waz", "rura", "zamiennik",
    # Screen protectors in more EU languages (AI catches the rest)
    "näytönsuoja", "naytonsuoja", "skärmskydd", "skarmskydd", "panssarilasi",
    "beschermfolie", "displayschutz",
}

# Keyword tokens that indicate a music/vinyl/instrument hunt. Reverb & Discogs
# only fire when at least one of these is present.
MUSIC_SIGNAL = {
    "vinyl", "winyl", "lp", "ep", "cd", "record", "records", "płyta", "plyta",
    "guitar", "gitara", "bass", "synth", "synthesizer", "pedal", "amp",
    "amplifier", "drum", "drums", "perkusja", "microphone", "mikrofon",
    "turntable", "gramofon", "cassette", "kaseta", "piano", "keyboard",
    "ukulele", "violin", "skrzypce", "reverb", "discogs",
}

MUSIC_ONLY_SOURCES = {"reverb", "discogs"}


def _word_in(word: str, text: str) -> bool:
    """Whole-word (or numeric-token) match, case-insensitive."""
    return re.search(rf"(?<!\w){re.escape(word)}(?!\w)", text) is not None


def has_music_signal(keywords: str) -> bool:
    return bool({w for w in keywords.lower().split()} & MUSIC_SIGNAL)


def source_allowed(source: str, keywords: str, sources: list[str] | None = None) -> bool:
    """Music-only sources fire only for music-signal keywords — UNLESS the user
    deliberately chose only music sources (then respect their choice)."""
    if source in MUSIC_ONLY_SOURCES:
        if sources and all(s in MUSIC_ONLY_SOURCES for s in sources):
            return True
        return has_music_signal(keywords)
    return True


def matches(title: str, keywords: str, color: str | None = None,
            size: str | None = None, listing_size: str | None = None,
            exclude_keywords: str | None = None) -> bool:
    """The single relevance gate. `title` is the listing title."""
    t = (title or "").lower()
    words = [w for w in keywords.lower().split() if w]

    # 1) all keyword tokens must appear (whole-word)
    if words and not all(_word_in(w, t) for w in words):
        return False

    # 2) user's explicit exclude keywords
    if exclude_keywords:
        for x in exclude_keywords.lower().split():
            if x and _word_in(x, t):
                return False

    # 3) accessory/parts denylist (skip terms the user actually searched for)
    kwset = set(words)
    for junk in ACCESSORY_DENYLIST:
        if junk in kwset:
            continue
        if _word_in(junk, t):
            return False

    # 4) colour
    if color and not _word_in(color.lower(), t):
        return False

    # 5) size — prefer the structured field, fall back to the title
    if size:
        s = size.lower()
        if listing_size:
            if s not in listing_size.lower():
                return False
        elif not _word_in(s, t):
            return False

    return True

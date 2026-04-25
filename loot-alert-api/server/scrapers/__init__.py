import random
from dataclasses import dataclass
from server.config import USER_AGENTS


@dataclass
class Listing:
    id: str
    title: str
    price: float | None
    url: str
    image_url: str | None
    source: str
    currency: str = "PLN"
    condition: str = "unknown"
    size: str | None = None


def random_headers() -> dict:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    }

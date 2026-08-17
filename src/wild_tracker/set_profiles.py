from __future__ import annotations

from .config import load_config
from .db import connect, init_schema

# (player_id, nickname, headshot_filename or None). Real names + headshot
# files provided directly by the user (2026-08-16) — not derivable from any
# API. Headshot filenames match static/headshots/; Josh's photo file is
# named "josh.png" but sourced from his "Gosling" asset per the user.
# Nicknames updated 2026-08-16 to the user's preferred display names
# (in-game/community handles rather than real first names).
PROFILES: list[tuple[str, str, str | None]] = [
    ("c0225528-834e-5705-8918-ad1b6b5c9c97", "YOUR MOTHER", "calum.png"),
    ("cfc1950e-db2e-5bb5-a304-ae4af8dfefa5", "LEGZM", "zohaib.png"),
    ("4e04bddb-2904-5c1c-8dca-5aad6c685412", "mochi", "johan.png"),
    ("00160431-62ab-5d08-be2b-db7724137417", "metro", "daniel.png"),
    ("4689d9a2-577b-50b7-8116-59ce5c64b490", "smeege", "eli.png"),
    ("308584f8-0993-5d8c-aac6-3ab1285805a5", "boney", "an.png"),
    ("2f452013-77d1-56e4-a40e-f4d719f0849b", "fungus", "erik.png"),
    ("61fc9ee9-d20a-5d64-9148-3e636121e34e", "choopapi", "josh.png"),
    ("xlsx-player-sultan-1479", "sultan", None),
    ("4a807314-981b-589d-95b5-5f88910a10ea", "burro", "sameer.png"),
    ("f9ed4d2c-83ba-5a25-8422-16e3e85e7c13", "waqasu", "waqas.png"),
    ("cd195545-f653-5fc0-b8f8-f3f0e1b391d0", "fisko", None),  # Fisko#Bear
]


def run() -> None:
    cfg = load_config()
    conn = connect(cfg.database_url)
    init_schema(conn)
    for player_id, nickname, headshot_filename in PROFILES:
        conn.execute(
            "UPDATE players SET nickname = ?, headshot_filename = COALESCE(?, headshot_filename) WHERE player_id = ?",
            (nickname, headshot_filename, player_id),
        )
    conn.commit()
    conn.close()


if __name__ == "__main__":
    run()

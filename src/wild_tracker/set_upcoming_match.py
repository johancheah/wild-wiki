from __future__ import annotations

import argparse
from datetime import datetime, timezone

from .config import get_db_path, load_config
from .db_sqlite import connect as connect_sqlite
from .db_sqlite import init_schema as init_schema_sqlite

# Manually curated homepage "Upcoming Match" header — HenrikDev's
# premier/seasons endpoint returns a season's weekly map list but no
# team-specific scheduling (every event's date field is an unset
# placeholder, and the array order doesn't match WILD's actual play order,
# confirmed 2026-08-28), so there's nothing reliable to pull live. Edit
# these two values and rerun this script whenever the next map is known.
# Left as an honest placeholder — MAP=None until you set it, since guessing
# would just be fabricated data (queries.py treats a None map as "TBD").
MAP: str | None = None
NOTE = ""


def run(target_postgres: bool) -> None:
    now = datetime.now(timezone.utc).isoformat()

    conn = connect_sqlite(get_db_path())
    init_schema_sqlite(conn)
    conn.execute(
        "INSERT INTO upcoming_match (id, map, note, updated_at) VALUES (1, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET map=excluded.map, note=excluded.note, updated_at=excluded.updated_at",
        (MAP, NOTE, now),
    )
    conn.commit()
    conn.close()
    print(f"SQLite updated: map={MAP!r} note={NOTE!r}")

    if target_postgres:
        from .db import connect as connect_pg
        from .db import init_schema as init_schema_pg

        cfg = load_config()
        pg_conn = connect_pg(cfg.database_url)
        init_schema_pg(pg_conn)
        pg_conn.execute(
            "INSERT INTO upcoming_match (id, map, note, updated_at) VALUES (1, %(map)s, %(note)s, %(updated_at)s) "
            "ON CONFLICT(id) DO UPDATE SET map=excluded.map, note=excluded.note, updated_at=excluded.updated_at",
            {"map": MAP, "note": NOTE, "updated_at": now},
        )
        pg_conn.commit()
        pg_conn.close()
        print(f"Postgres (Supabase) updated: map={MAP!r} note={NOTE!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Update the homepage's manually-curated upcoming match header.")
    parser.add_argument("--postgres", action="store_true", help="Also write to Supabase Postgres (live site), not just local SQLite.")
    args = parser.parse_args()
    run(args.postgres)


if __name__ == "__main__":
    main()

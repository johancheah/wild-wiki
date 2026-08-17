from __future__ import annotations

import json
from typing import Any


def _get(d: dict | None, *path: str, default: Any = None) -> Any:
    cur: Any = d
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
    return cur if cur is not None else default


def normalize_match(raw: dict, wild_premier_team_id: str, match_type: str | None) -> dict:
    """Turn one match-details-v4 response into rows for every raw table.

    `wild_premier_team_id` is the `id` from the premier-team-by-name lookup —
    used to figure out which side of `data.teams`/`data.players` is WILD
    (matched via team.premier_roster.id, since data.teams[].team_id is just
    an in-match label like "Red"/"Blue", not a stable team identity).
    """
    data = raw.get("data", raw)  # tolerate either the wrapped or unwrapped response
    metadata = data.get("metadata", {})
    match_id = metadata.get("match_id")

    teams_raw = data.get("teams", [])

    # data.teams[].team_id / data.players[].team_id are per-match slot labels
    # ("Red"/"Blue"), reused across unrelated matches — NOT a stable team
    # identity. Map each label to a stable id (premier_roster.id when the API
    # provides it; otherwise a deterministic per-match fallback, since an
    # opponent without roster info still needs *a* consistent identity across
    # this one match's rows even if we can't identify them cross-match).
    label_to_stable_id: dict[str, str] = {}
    for t in teams_raw:
        label = t.get("team_id")
        premier_id = _get(t, "premier_roster", "id")
        label_to_stable_id[label] = premier_id or f"unknown_{match_id}_{label}"

    wild_in_match_label = None
    enemy_in_match_label = None
    for t in teams_raw:
        label = t.get("team_id")
        if label_to_stable_id.get(label) == wild_premier_team_id:
            wild_in_match_label = label
        else:
            enemy_in_match_label = label

    wild_team_id = label_to_stable_id.get(wild_in_match_label)
    enemy_team_id = label_to_stable_id.get(enemy_in_match_label)

    teams_rows = []
    wild_rounds_won = None
    enemy_rounds_won = None
    for t in teams_raw:
        label = t.get("team_id")
        stable_id = label_to_stable_id[label]
        premier = t.get("premier_roster") or {}
        teams_rows.append(
            {
                "team_id": stable_id,
                "name": premier.get("name") or label,
                "tag": premier.get("tag") or "",
            }
        )
        if label == wild_in_match_label:
            wild_rounds_won = _get(t, "rounds", "won")
        elif label == enemy_in_match_label:
            enemy_rounds_won = _get(t, "rounds", "won")

    result = None
    margin = None
    if wild_rounds_won is not None and enemy_rounds_won is not None:
        margin = wild_rounds_won - enemy_rounds_won
        result = "WIN" if margin > 0 else "LOSS" if margin < 0 else "DRAW"

    # metadata.season is {"id": <uuid>, "short": "e10a3"} in the real API
    # (confirmed against a live match) — "short" is the human-readable code,
    # analogous to the spreadsheet's Phase column ("E9A2" etc.), so use that
    # rather than the opaque UUID.
    season_short = _get(metadata, "season", "short")
    match_row = {
        "match_id": match_id,
        "season_id": season_short.upper() if season_short else None,
        "date": metadata.get("started_at"),
        "map": _get(metadata, "map", "name"),
        "match_type": match_type,
        "team_id": wild_team_id,
        "enemy_team_id": enemy_team_id,
        "result": result,
        "margin": margin,
        "raw_payload": json.dumps(raw),
    }

    players_raw = data.get("players", [])
    player_rows = []
    match_player_rows = []
    weapon_kill_rows = []
    rounds_played_count = len(data.get("rounds", [])) or None

    for p in players_raw:
        puuid = p.get("puuid")
        player_rows.append(
            {
                "player_id": puuid,
                "riot_name": p.get("name"),
                "riot_tag": p.get("tag"),
            }
        )
        match_player_rows.append(
            {
                "match_id": match_id,
                "player_id": puuid,
                "team_id": label_to_stable_id.get(p.get("team_id")),
                "agent": _get(p, "agent", "name"),
                "score": _get(p, "stats", "score"),
                "kills": _get(p, "stats", "kills"),
                "deaths": _get(p, "stats", "deaths"),
                "assists": _get(p, "stats", "assists"),
                "headshots": _get(p, "stats", "headshots"),
                "bodyshots": _get(p, "stats", "bodyshots"),
                "legshots": _get(p, "stats", "legshots"),
                "damage_dealt": _get(p, "stats", "damage", "dealt"),
                "damage_received": _get(p, "stats", "damage", "received"),
                "economy_spent_overall": _get(p, "economy", "spent", "overall"),
                "economy_loadout_value_overall": _get(p, "economy", "loadout_value", "overall"),
                "rounds_played": rounds_played_count,
            }
        )

    for k in data.get("kills", []):
        weapon = _get(k, "weapon", "name")
        killer_id = _get(k, "killer", "puuid")
        if weapon and killer_id:
            weapon_kill_rows.append((match_id, killer_id, weapon))

    weapon_kill_counts: dict[tuple, int] = {}
    for key in weapon_kill_rows:
        weapon_kill_counts[key] = weapon_kill_counts.get(key, 0) + 1
    weapon_kill_table_rows = [
        {"match_id": mid, "player_id": pid, "weapon": w, "kill_count": count}
        for (mid, pid, w), count in weapon_kill_counts.items()
    ]

    round_rows = []
    round_player_stats_rows = []
    for r in data.get("rounds", []):
        round_number = r.get("id")
        # data.rounds[].winning_team is a team_id label ("Red"/"Blue"), same
        # space as data.teams[].team_id — store it as-is.
        round_rows.append(
            {
                "match_id": match_id,
                "round_number": round_number,
                "winning_team_id": label_to_stable_id.get(r.get("winning_team")),
                "side": None,
                "ceremony": r.get("ceremony"),
                "plant_player_id": _get(r, "plant", "player", "puuid"),
                "plant_site": _get(r, "plant", "site"),
                "defuse_player_id": _get(r, "defuse", "player", "puuid"),
            }
        )

        for stat in r.get("stats", []) or []:
            player_id = _get(stat, "player", "puuid")
            round_player_stats_rows.append(
                {
                    "match_id": match_id,
                    "round_number": round_number,
                    "player_id": player_id,
                    "kills": _get(stat, "stats", "kills"),
                    "headshots": _get(stat, "stats", "headshots"),
                    "bodyshots": _get(stat, "stats", "bodyshots"),
                    "legshots": _get(stat, "stats", "legshots"),
                    "damage": sum(
                        d.get("damage", 0) for d in stat.get("damage_events", []) or []
                    ),
                    "loadout_value": _get(stat, "economy", "loadout_value"),
                    "remaining_credits": _get(stat, "economy", "remaining"),
                    "weapon": _get(stat, "economy", "weapon", "name"),
                    "armor": _get(stat, "economy", "armor", "name"),
                    "was_afk": 1 if stat.get("was_afk") else 0,
                }
            )

    kill_event_rows = []
    round_event_counters: dict[int, int] = {}
    for k in data.get("kills", []):
        round_number = k.get("round")
        event_index = round_event_counters.get(round_number, 0)
        round_event_counters[round_number] = event_index + 1
        kill_event_rows.append(
            {
                "match_id": match_id,
                "round_number": round_number,
                "event_index": event_index,
                "time_in_round_ms": k.get("time_in_round_in_ms"),
                "time_in_match_ms": k.get("time_in_match_in_ms"),
                "killer_id": _get(k, "killer", "puuid"),
                "victim_id": _get(k, "victim", "puuid"),
                "assistant_ids": json.dumps(
                    [a.get("puuid") for a in k.get("assistants", []) or []]
                ),
                "weapon": _get(k, "weapon", "name"),
                "location_x": _get(k, "location", "x"),
                "location_y": _get(k, "location", "y"),
            }
        )

    return {
        "teams": teams_rows,
        "match": match_row,
        "players": player_rows,
        "match_players": match_player_rows,
        "match_player_weapon_kills": weapon_kill_table_rows,
        "rounds": round_rows,
        "round_player_stats": round_player_stats_rows,
        "kill_events": kill_event_rows,
    }

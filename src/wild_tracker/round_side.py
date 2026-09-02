from __future__ import annotations

import sqlite3

# match-details-v4 doesn't expose ATK/DEF side per round directly (confirmed
# in PLAN.md §5). This infers it instead:
#   1. Group rounds into "blocks" using the standard format: rounds 1-12 and
#      13-24 (0-indexed: 0-11, 12-23) are the two regulation halves; OT plays
#      in 2-round pairs after that. Side is constant within a block and
#      strictly alternates block-to-block — that part of the ruleset is
#      certain, so only ONE block per match actually needs to be determined
#      from evidence; every other block follows by alternation.
#   2. Within a block, whichever team's plant_player appears is that block's
#      attacker (defenders can never plant) — aggregated across the whole
#      block, not just one round, in case a given round's plant is missing.
#   3. Blocks with no plant evidence at all (rare — e.g. no round in that
#      block reached a plant) are filled in afterward from any resolved
#      neighboring block via alternation.
# Best-effort, not authoritative — flagged as such in the UI.


def _block_index(round_number: int) -> int:
    if round_number < 24:
        return round_number // 12
    return 2 + (round_number - 24) // 2


def compute_wild_side_by_round(
    conn: sqlite3.Connection, match_id: str, wild_team_id: str, enemy_team_id: str
) -> dict[int, str | None]:
    """Per-round WILD side ("ATK"/"DEF"/None), via the block-inference scheme
    documented above. Shared by compute_match_timeline (below) and any other
    query that needs to split rounds by side — e.g. the match-summary ATK/DEF
    round-win counts — so the inference logic lives in exactly one place.
    """
    rounds = conn.execute(
        "SELECT round_number, plant_player_id FROM rounds WHERE match_id = ? ORDER BY round_number",
        (match_id,),
    ).fetchall()
    if not rounds:
        return {}

    planter_team = dict(
        conn.execute(
            "SELECT player_id, team_id FROM match_players WHERE match_id = ?", (match_id,)
        ).fetchall()
    )

    # Pass 1: determine each block's WILD side from plant evidence.
    block_side: dict[int, str | None] = {}
    for r in rounds:
        block = _block_index(r["round_number"])
        block_side.setdefault(block, None)
        if block_side[block] is not None:
            continue
        planter = r["plant_player_id"]
        if not planter:
            continue
        planter_team_id = planter_team.get(planter)
        if planter_team_id == wild_team_id:
            block_side[block] = "ATK"
        elif planter_team_id == enemy_team_id:
            block_side[block] = "DEF"

    # Pass 2: fill blocks with no plant evidence via alternation from any
    # resolved neighbor (side strictly alternates block-to-block, always).
    blocks_sorted = sorted(block_side)
    for _ in range(len(blocks_sorted)):  # bounded passes — settles quickly
        changed = False
        for i, b in enumerate(blocks_sorted):
            if block_side[b] is not None:
                continue
            if i > 0 and block_side[blocks_sorted[i - 1]] is not None:
                block_side[b] = "DEF" if block_side[blocks_sorted[i - 1]] == "ATK" else "ATK"
                changed = True
            elif i < len(blocks_sorted) - 1 and block_side[blocks_sorted[i + 1]] is not None:
                block_side[b] = "DEF" if block_side[blocks_sorted[i + 1]] == "ATK" else "ATK"
                changed = True
        if not changed:
            break

    return {r["round_number"]: block_side.get(_block_index(r["round_number"])) for r in rounds}


def compute_match_timeline(
    conn: sqlite3.Connection, match_id: str, wild_team_id: str, enemy_team_id: str
) -> list[dict]:
    rounds = conn.execute(
        "SELECT round_number, winning_team_id, result, plant_player_id "
        "FROM rounds WHERE match_id = ? ORDER BY round_number",
        (match_id,),
    ).fetchall()
    if not rounds:
        return []

    wild_side_by_round = compute_wild_side_by_round(conn, match_id, wild_team_id, enemy_team_id)

    timeline = []
    for r in rounds:
        wild_side = wild_side_by_round.get(r["round_number"])
        winner = (
            "wild" if r["winning_team_id"] == wild_team_id
            else "enemy" if r["winning_team_id"] == enemy_team_id
            else None
        )
        if wild_side is None or winner is None:
            win_side = None
        else:
            win_side = wild_side if winner == "wild" else ("DEF" if wild_side == "ATK" else "ATK")
        timeline.append({
            "round_number": r["round_number"],
            "label": r["round_number"] + 1,
            "winner": winner,
            "win_side": win_side,
            "result": r["result"] or "Time",
        })

    # Pad to 24 rounds minimum (a full regulation match) with empty
    # placeholder cells, even if this match ended early — keeps every match's
    # timeline the same width. Matches that went to OT already have more
    # than 24 real rounds and are left as-is (never truncated).
    last_round_number = timeline[-1]["round_number"]
    for rn in range(last_round_number + 1, 24):
        timeline.append({
            "round_number": rn, "label": rn + 1, "winner": None, "win_side": None, "result": None,
        })

    return timeline

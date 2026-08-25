# WILD Gaming — Valorant Premier Tracker: Planning Doc

Status: **planning phase, no code written yet**. This document replaces the manual Excel workflow with a plan for a personal web app that pulls Valorant Premier stats automatically via the HenrikDev API. Review and mark up sections below — nothing here is final until you sign off.

---

## 0. What was clarified before writing this

The source spreadsheet has a few columns/values whose logic isn't derivable from the schema alone. Rather than guess, these were confirmed directly:

| Item | Spreadsheet reality | Decision for the app |
|---|---|---|
| **ECON** | Entered manually/subjectively — there is no formula to port | The app will **auto-compute** ECON from API loadout-value data. This is a **new formula being introduced**, not a replica of existing logic — see §5 for the proposed formula and please confirm it before it's built. |
| **Clutches (1v1–1v5)** | Standard definition | Player is the sole surviving teammate at some point in the round while 1+ enemies are still alive, and their team wins the round. Fully derivable from round survivor state + kill events. |
| **PL / DE columns** | `PL` = Plant, `DE` = Defuse | Per-player **counts**, not booleans (confirmed against the real file — see §0.5) — number of times that player personally planted/defused across the match. |

---

## 0.5. Findings from the actual workbook

I read `Wild Gaming Valorant (1).xlsx` directly (14 sheets, `Data` = 68 columns × 650 player-match rows across 130 matches) rather than working only from the schema described in the original prompt. Three findings materially change or correct the plan:

1. **ECON, PL, DE, 2K–5K, 1v1–1v5, HS%, and KAST% are all raw typed-in values in `Data` — zero formulas behind any of them**, confirmed by scanning every cell in those columns. You've been hand-counting these per match today, not deriving them via spreadsheet logic. This means:
   - The API-driven derivation in §1/§2 is a genuine capability upgrade, not just "automating an existing formula" — there's no formula to port.
   - It also means there's **no formula to validate the new derivation logic against**. Validation in Phase 2 (§6) will mean spot-checking a few matches against what you'd count by eye, not diffing against a spreadsheet formula.
2. **`PL`/`DE` are per-player counts, not flags** — observed values range 0–11 for `PL` and 0–4 for `DE` per player-match. My original draft's `pistol_won` (bool) in `derived_player_match_stats` doesn't correspond to anything in your actual schema and has been dropped; `plants`/`defuses` (counts) take its place.
3. **`Data` has 30 more columns than the original prompt described**, all worth carrying into the schema:
   - `Phase` — season/episode tag (`Beta`, `Launch`, `Ignition`, `E7A3`, `E8A1`–`E9A3`, `V25:A3`–`A5`) — this is what `season_id` should actually encode.
   - `Type` — `Regular` or `Playoffs`, a first-class field, not folded into `queue`.
   - `TCS`, `RDS`, `TD`, and a second `KAST` column — these are **round-weighted totals** (`TCS = ACS × rounds_played`, `TD = ADR × rounds_played`, `KAST(count) = KAST% × rounds_played`, `RDS = rounds_played`) that exist specifically so higher-level views can compute `SUM(TCS)/SUM(RDS)` instead of naively averaging per-match rate stats. **This weighting pattern must be replicated in the SQL views layer** (§1) — a plain `AVG(acs)` across matches with different round counts would silently misweight short and long matches.
   - A full **per-weapon kill breakdown** (Classic, Shorty, Frenzy, Ghost, Sheriff, Stinger, Spectre, Bucky, Judge, Bulldog, Guardian, Phantom, Vandal, Marshal, Outlaw, Operator, Ares, Odin, Melee, Ability) per player per match — trivially derivable from `kill_events.weapon`, added as its own table in §1.
4. Confirms scale: **130 matches / 650 player-match rows** for the full tracked history — reinforces the SQLite recommendation in §3.
5. The workbook was originally built in Google Sheets and exported to `.xlsx` (the `Scoreboard` sheet's `QUERY()` formulas survive only as dead `__xludf.DUMMYFUNCTION` placeholders). Not relevant to the rebuild itself, just explains some formula artifacts if you open the file in Excel.

---

## 1. Data model

Replace the flat "Data" sheet with a normalized schema. Every other spreadsheet view becomes a **query/view** over these tables, not a formula.

### Raw / ingested tables (populated directly from the API)

**`teams`**
- `team_id` (PK, from API), `name`, `tag`

**`players`**
- `player_id` (PK, puuid), `riot_name`, `riot_tag`, `current_team_id` (FK) — see §5 roster-change risk

**`season_schedule`**
- `season_id` (matches `Data.Phase` values like `E8A2`, `V25:A5`, `Beta`, `Launch`, `Ignition`), `week_label` (Week 1–7, Playoffs), `start_date`, `end_date`

**`matches`**
- `match_id` (PK, from API), `season_id` (FK), `date`, `map`, `match_type` (`Regular`/`Playoffs` — direct port of `Data.Type`), `team_id` (FK), `enemy_team_id` (FK), `result` (W/L/tie), `margin`, `raw_payload` (JSON, full API response kept for re-derivation if formulas change)

**`match_players`** (one row per player per match — direct API fields, no derivation)
- `match_id` (FK), `player_id` (FK), `agent`, `role`, `acs`, `kills`, `deaths`, `assists`, `plus_minus`, `kd`, `kad`, `adr`, `hs_pct`, `kast`, `fk`, `fd`, `rounds_played` (replaces the spreadsheet's `RDS`; `TCS`/`TD`/round-weighted-`KAST` are **not stored** — they're computed on demand in the views layer, see below)

**`match_player_weapon_kills`** (new — not in the original prompt's schema, found in the real file)
- `match_id` (FK), `player_id` (FK), `weapon`, `kill_count` — one row per weapon used, derived from `kill_events.weapon` grouped by killer. Replaces the 20 flat weapon columns (Classic…Ability) in `Data`.

**`rounds`**
- `match_id` (FK), `round_number`, `winning_team_id` (FK), `side` (ATK/DEF), `ceremony`, `team_loadout_value`, `team_spent`

**`kill_events`**
- `match_id` (FK), `round_number`, `time_in_round_ms`, `killer_id`, `victim_id`, `assistant_ids[]`, `weapon`, `killer_location`, `victim_location`, `is_plant` / `is_defuse` flags on the responsible player's row where applicable (source for the `plants`/`defuses` counts below)

This table is the **source of truth for every derived stat** — multi-kills, clutches, plants/defuses, FK/FD, KPR/APR/FKPR/FDPR all compute from it, so nothing derived needs to be re-entered or hand-maintained the way `Data`'s manually-typed columns are today (see §0.5).

### Derived table (computed, not ingested)

**`derived_player_match_stats`**
- `match_id` (FK), `player_id` (FK), `kpr`, `apr`, `fkpr`, `fdpr`, `two_k`, `three_k`, `four_k`, `five_k`, `clutch_1v1`…`clutch_1v5` (attempted/won), `plants` (count), `defuses` (count), `econ`

Kept as a **separate computed table** (not columns bolted onto `match_players`) so the derivation logic can be re-run and corrected without re-ingesting from the API. No `pistol_won` field — the real spreadsheet doesn't track pistol-round outcomes at the player-match grain (that was a misreading of `PL`/`DE` before I read the actual file; see §0.5).

### Views (replace the other 12 sheets)
- **Team Stats**, **Player Stats**, **Scoreboard**, **Team Comps**, **Phase Comparison**, **Rounds**, **Matches**, **Teammates (synergy)** → each becomes a SQL view or query joining `matches` + `match_players` + `derived_player_match_stats` (+ `rounds`/`kill_events`/`match_player_weapon_kills` for round- or weapon-level views). None of these store data independently — exactly the "one raw table, everything else derives" pattern from your fantasy-basketball app, just normalized instead of flat.
- **Weighting rule for rate stats** (carried over from the real `Data` sheet's `TCS`/`RDS`/`TD` pattern, §0.5): any view aggregating ACS, ADR, HS%, or KAST% across multiple matches must weight by rounds played — `SUM(acs × rounds_played) / SUM(rounds_played)`, not `AVG(acs)` — or a 13-round match and a 24-round match get equal weight, which is wrong.

---

## 2. Ingestion pipeline

### Finding match IDs (the one non-obvious part)
Live testing against `docs.henrikdev.xyz` surfaced a real inconsistency worth designing around up front:

- `GET /valorant/v1/premier/{id}/history` returns only **aggregate team stats** (wins/losses/rounds/placement) — **no match list**, despite the name.
- `GET /valorant/v1/premier/{name}/{tag}/history` is the endpoint that actually returns match IDs, split into `league_matches[]` (id, started_at, points before/after) and `tournament_matches[]` (tournament_id, matches[], placement).

**Design decision: always resolve and query by team name+tag, never by team ID**, when pulling Premier history.

### Backfill (one-time, past season(s))
1. Resolve team via `GET /valorant/v1/premier/{name}/{tag}` (handle the documented 409 "multiple teams match" by supplying `affinity`).
2. Pull match ID list via `GET /valorant/v1/premier/{name}/{tag}/history` (paginate/loop over `league_matches` + `tournament_matches`).
3. For each match ID, call `GET /valorant/v2-or-v4/match/{match_id}` (**v4** — richer schema, see below) and store the full payload in `matches.raw_payload` plus normalized rows in `match_players`/`rounds`/`kill_events`.
4. Run the derived-stats computation pass over the newly ingested matches.
5. Cross-check option: `GET /valorant/v1/by-puuid/matches/{affinity}/{platform}/{puuid}` (v4, supports `mode`/`map`/`size`/`start` filters) per roster player as a redundancy check if the Premier history path misses matches.

Do **not** rely on the stored-matches endpoints (`/stored-matches/...`) for backfill — HenrikDev's own docs describe these as "an accumulating materialized subset... not a pre-populated mirror," with possible holes. They're fine for cheap ongoing polling, not for a trustworthy backfill.

### Ongoing sync
- **Manual "Sync Now" button**, not a scheduled job. At hobby-team cadence (a handful of matches/week), a scheduled poller adds infra complexity for no real benefit — you play a match, you click sync. Promoting this to a cron/webhook job later is a small, isolated change if it turns out to matter.
- Sync flow: same as backfill steps 2–4, scoped to matches newer than the latest one already stored.

### Match details endpoint: v4
`get-match-details-v4` is the one call that returns everything needed per match:
- `metadata`: match_id, map, game_version, game_length_ms, started_at, queue, season, platform
- `players[]`: agent, per-player stats (kills/deaths/assists/headshots/bodyshots/legshots/damage/score), economy (spent + loadout_value, aggregate and per-round), ability casts, behavior flags (afk_rounds, friendly_fire), tier
- `rounds[]`: id, result, winning_team, ceremony, per-player per-round damage + economy snapshots
- `kills[]`: round, time_in_round_ms, time_in_match_ms, killer, victim, assistants, weapon, locations, player_locations
- `teams[]`: team_id, won, rounds won/lost, premier roster info

No separate endpoint is needed to get round/kill-level data — it's all in this one response, which is what makes deriving multi-kills/clutches/pistols/plant-defuse feasible without extra API calls.

### Rate limits / backoff
Confirmed from HenrikDev docs:

| Tier | Price | Rate limit | Cache reduction |
|---|---|---|---|
| Free (default) | — | not numerically published | 300s cache |
| Tier 1 | $10.99/mo | 130 req/min | 60% reduced caching |
| Tier 2 | $15.99/mo | 200 req/min | 80% reduced caching |
| Tier 3 | $25.99/mo | 300 req/min | 90–100% reduced caching |

Design implication: implement simple exponential backoff + respect rate-limit response headers regardless of tier (the docs confirm both API-call count and background Riot-request count factor into limiting). Start on the free tier; **measure the actual free-tier req/min ceiling empirically** during backfill testing before assuming a sync cadence works — this number isn't published.

---

## 3. Tech stack recommendation

Sized for: single team, a handful of users, small dataset (one season is maybe 20–40 matches × 5 players = a few hundred rows across the raw tables). Two reasonable options:

**Option A — SQLite + a lightweight full-stack framework (e.g., Next.js or SvelteKit with an embedded SQLite via better-sqlite3/Drizzle, or Python + FastAPI + SQLite)**
- Pros: zero infra to run — single file DB, deployable as one process (or even fully local), trivial backup (copy the file), matches "personal hobby app" scale exactly.
- Cons: less convenient if you ever want multi-device concurrent writes or to host it somewhere with ephemeral filesystems (e.g. some serverless platforms wipe local disk).

**Option B — Postgres (hosted free/cheap tier, e.g. Supabase/Neon) + Next.js**
- Pros: real hosted DB, survives serverless deploys cleanly, gives you a SQL views layer for free (the "Data sheet → derived views" pattern maps directly onto Postgres views), easy to add auth later if teammates want logins.
- Cons: one more external dependency/account to manage for a single-team hobby project.

**Leaning recommendation**: Option A to start (SQLite) given the scale and the explicit "personal app" framing — it mirrors the simplicity of the existing fantasy-basketball app you're modeling this on. Migrating a normalized SQLite schema to Postgres later is low-cost if the app grows (more users, hosted deploy needs). Flagging as a recommendation, not a decision — happy to build the plan around Option B if you already know you want to host it somewhere with an ephemeral filesystem.

---

## 4. Frontend

Pages mapped to the current sheets, using the same replica-vs-upgrade lens for each:

| Spreadsheet sheet | App page | Table or dashboard? |
|---|---|---|
| Data (raw) | *(not exposed directly — implementation detail)* | — |
| Team Stats | `/team` | Table, season aggregates |
| Player Stats | `/players/[player]` | Table + **upgrade**: per-player trend line across the season (ACS/ADR/KAST over time) — a spreadsheet can't easily show this |
| Scoreboard | `/matches/[match_id]` | Table, per-match box score |
| Matches | `/matches` | Table, sortable/filterable match list |
| Team Comps | `/comps` | **Upgrade**: win-rate-by-composition view (heatmap or ranked list) — much clearer than a spreadsheet pivot |
| Phase Comparison | `/players/[player]` (section) or `/phases` | Table, likely fine as-is |
| Rounds | `/matches/[match_id]` (section) | Table, round-by-round win/loss + econ strip (a simple horizontal timeline view is a nice cheap upgrade here) |
| Teammates (synergy) | `/synergy` | Table, pairwise win-rate matrix |
| Schedule | `/schedule` | Table, Week 1–7 + Playoffs, mostly a faithful port |

General principle applied throughout: **tables stay tables** where the spreadsheet already did the job well; dashboards/charts are reserved for views where seeing a *trend* or *distribution* (comps win-rate, player trend lines, synergy matrix) is the actual value-add over a flat grid.

---

## 5. Open questions / risks

- **`history-by-id` vs `history-by-name` inconsistency** (confirmed above) — build against `by-name` only; re-verify if HenrikDev ships a fix, since the "by-id" behavior may change without notice.
- **Free-tier rate limit is unpublished** — needs empirical measurement during initial backfill testing before committing to any specific sync cadence or assuming headroom.
- ~~**ECON formula (new, not ported)**~~ **Resolved.** User provided Riot's actual in-game formula: `ECON = (Total Damage Dealt / Total Credits Spent) × 1000`. Implemented exactly as given in `derive.py::compute_econ`, using `match_players.damage_dealt` / `economy_spent_overall` (both already stored from the raw API payload) — no invented formula needed.
- ~~**Premier visibility in the API**~~ **Resolved (2026-08-16 live test).** Ran the full Phase 1 backfill against WILD GAMING#WILD (na): resolved the team, pulled 50 match references from history, and successfully ingested **33 of 38 unique matches** (12 of the 50 were exact duplicates — the history endpoint repeats some tournament entries verbatim, a HenrikDev data-quality quirk, not ours) — full player/round/kill/weapon data, spanning March 2024 through November 2025. **5 unique match IDs 404 from match-details-v4 with "Match not found"** and the cause isn't simply age: the oldest successful match is from March 2024 while some 404s are from mid-2025, so it's not a clean retention cutoff. Ingestion logs and skips these individually without failing the run — acceptable for now, but worth periodically retrying in case it's a transient indexing delay rather than permanent loss.
- **Auth header confirmed**: `Authorization: <raw key>` (no `Bearer` prefix) — the code's original guess was correct, confirmed by live 200 responses.
- **Free-tier rate limit (empirical)**: a burst of roughly 10–11 rapid requests succeeds, then 429s start; the client's exponential backoff (2s → 4s → 8s → 16s → 32s) successfully recovers and completes the request every time it was tested. A full 38-match backfill took about 90 seconds wall-clock including backoff waits — fine for a manual "Sync Now" click.
- **`metadata.season` is an object** (`{id: <uuid>, short: "e10a3"}`), not a plain string as originally assumed — `season_id` in the schema now stores the uppercased `short` code (e.g. `E10A3`), which lines up with the spreadsheet's `Phase` column convention.
- **KAST is confirmed absent from match-details-v4** — no per-round survived/traded field anywhere in the real response. Raw counters (kills/deaths/assists/damage/economy) are stored instead; KAST computation remains an open Phase 2 problem, not solved by this endpoint.

## 5.5. Phase 1.5 — legacy spreadsheet import (2026-08-16)

The API alone cannot reach your full 130-match history — confirmed, not assumed:

- **Matches #1–46** (Beta, Ignition, Launch, E7A3 — 4/29/23 through ~Feb 2024) are **permanently unreachable**. Every `season` filter format I tried against the history endpoint (content-endpoint act UUIDs, the real season UUID from a live match, short codes like `e10a3`) was rejected as `"Invalid season"` with no documented valid format, and the earliest match `match-details-v4` can return at all is from March 2024. Riot's own retention appears to be the hard limit here, not a HenrikDev quirk.
- **The spreadsheet itself never recorded opponent identity** — traced the `Matches` sheet's formulas back to the `Data` sheet's `Team`/`Enemy` columns and confirmed they hold *rounds won by each side* (0–16), not a team ID. There is no opponent name anywhere in the workbook. So spreadsheet-imported matches have map/result/score/margin but `enemy_team_id = NULL`.
- Built `xlsx_import.py` to backfill matches the API can't reach, reconciled against what's already API-ingested so nothing double-counts. Player identity required a manual name→Riot ID mapping from the user (spreadsheet uses informal first names like "Calum", not Riot IDs) — one player (Rafid / Sultan#1479) has no resolvable puuid yet since Riot's account API needs a recent match to populate his account data; stored with a synthetic id in the meantime.
- **Reconciliation key had to be (Eastern-local date, map, margin)**, not just date+map: the spreadsheet's date is a naive local date while the API's is UTC (evening matches roll to the next UTC day — fixed by converting to `America/New_York` before comparing), and date+map alone isn't unique on nights WILD played the same map twice (confirmed real case: two separate Pearl matches both on 2025-06-01).
- **Final result: 136 unique matches** (33 API-sourced + 103 spreadsheet-sourced). Of those, 4 are genuinely new matches (Nov 2025) your spreadsheet hasn't recorded yet. One pair (2025-07-12, Bind) is almost certainly the same real match recorded in both sources with a one-round discrepancy in the final score (WIN+3 in the sheet vs WIN+4 from the API) — left as two separate rows rather than guessing which score is correct; worth a manual look.
- Schema grew to support this: `matches.source` ('api'/'spreadsheet'), nullable `match_players.adr/hs_pct/role/fk/fd` (populated only for spreadsheet rows, which have the pre-computed value but not its raw components), and a new `derived_player_match_stats` table (multi-kills/clutches/plants/defuses/ECON) tagged `source='spreadsheet_manual'` for the 515 player-match rows carried over from your hand-tallied Excel columns — this table is the same one Phase 2 will populate with `source='computed'` rows for the API-sourced matches.
- **Roster changes mid-season** — `players.current_team_id` as modeled assumes one active team per player at ingestion time; a player who leaves/joins mid-season needs either an effective-dated team membership table or accepting that `match_players` (not `players.current_team_id`) is the source of truth for "who was on the team for match X" — recommend the latter, since `match_players` already ties each player to a specific match's roster.
- **Ties / incomplete / forfeited matches** — need a defined `result` enum (W/L/tie/forfeit/incomplete) and a decision on whether incomplete matches get partially ingested or excluded until confirmed complete.
- **What if an assumed field doesn't exist** (e.g. `player_locations` in kills, or per-round loadout breakdown) — Phase 1 smoke test (below) should log the actual raw payload from one real match so field assumptions in §1/§2 get corrected against real data, not just docs, before the derived-stats logic is built.

## 6.5. Phase 2 — derived stats (2026-08-16)

Built `derive.py`, a re-runnable pass over `kill_events`/`rounds` for the 33 API-sourced matches, writing `derived_player_match_stats` rows tagged `source='computed'` (the 515 `spreadsheet_manual` rows from Phase 1.5 are untouched):

- **Multi-kills (2K–5K)**: group `kill_events` by (round, killer), bucket by exact count per round — standard scoreboard convention, not cumulative.
- **FK/FD**: first `kill_events` row per round (by `time_in_round_ms`) attributes a first-kill to the killer and a first-death to the victim. Now backfilled into `match_players.fk`/`fd` for API rows, which were null after Phase 1.
- **Plants/defuses**: trivial — `rounds.plant_player_id`/`defuse_player_id` were already stored raw in Phase 1, this just counts them per player.
- **Clutches (1v1–1v5)**: replays each round's kills in time order tracking both teams' alive sets; the moment WILD drops to its last living player with 1+ enemies still alive is the trigger, labeled by how many enemies were alive *at that moment* (later kills don't relabel it) — matches the standard definition confirmed in §0. Only recorded as a win if that round's `winning_team_id` is WILD's.
- **ECON**: `(damage_dealt / economy_spent_overall) × 1000` — Riot's actual in-game formula, given directly by the user, not the invented one originally proposed (see §5).

**Validated, not just run**: cross-checked all 33 matches — FK totals equal the count of rounds containing at least one kill for every match (0 mismatches); multi-kill totals never exceed a player's actual kill count for that match (0 impossible cases, out of 330 player-match rows); clutch-win frequency (59 across 33 matches) falls in a plausible range with no 1v4/1v5 outliers in this sample.

## 6.6. Phase 3 — core frontend (2026-08-16)

Stack: **FastAPI + Jinja2 server-rendered templates**, still SQLite-backed — one Python process, no Node/npm, matches §3's Option A recommendation and the existing all-Python codebase. Run it with:

```bash
.venv/bin/uvicorn wild_tracker.webapp:app --reload --port 8000 --app-dir src
```

Pages built, all backed by real queries (`queries.py`) over the `v_match_player_stats`/`v_wild_player_match_stats` SQL views added in `db/views.sql` — the "views over raw tables, not separately-stored sheets" architecture from §1, now actually load-bearing instead of just a plan:

- **Team Stats** (`/`) — overall record, win rate, by-map, by-season, by-match-type breakdowns.
- **Player Stats** (`/players`, `/players/{id}`) — career totals (blending API-computed and spreadsheet-provided ADR/HS%, rounds-weighted per §1's rule), multi-kills/clutches/plants/defuses/ECON, agent pool, full match log linking to each match.
- **Matches** (`/matches`, `/matches/{id}`) — full 136-match list with a Source pill (API/Sheet); detail page shows a full 10-player box score for API matches, WILD-only for spreadsheet matches (with an explicit note why opponent data is absent — see §5.5), plus weapon-kill breakdown.
- **Schedule** (`/schedule`) — placeholder grouped by season rather than Week 1–7 date ranges, since `season_schedule` is a manually-curated calendar nobody's populated yet (a real open item, not deferred silently).

Verified live in-browser (not just "should work"): navigated all five page types, cross-checked numbers against the data-preview artifact, confirmed the WILD-only vs. full-box-score distinction renders correctly for both match sources, and confirmed zero console errors.

## 6.7. UI polish — branding, real photos, nicknames (2026-08-16)

- **Team logo** in the nav bar, from the user's own asset file (`static/logo.png`).
- **Agent icons and map images**: cached locally from `valorant-api.com` (a free community Valorant asset API — `agents.json`/`maps.json` under `static/`) rather than hit at request time, so the app doesn't depend on that service staying up. All 12 of the team's maps and 29 agents covered.
- **Real player headshots**: the user provided actual photos for 10 of 12 roster members. Added `players.headshot_filename` (nullable) and `players.nickname` (nullable) columns via the same lightweight column-migration mechanism as Phase 1.5. `set_profiles.py` holds the name→player_id→(nickname, headshot file) mapping (reusing the identity work from §5.5) and is safe to rerun. Players without a photo (Ben, Rafid) fall back to an initials avatar — never a broken image.
- **Nicknames replace Riot IDs throughout the UI** (`COALESCE(nickname, riot_name)` in every query that returns a player row) — "Calum" instead of "YourMother#IsAHo". Opponent players (no nickname on file) fall back to their real Riot name automatically, same mechanism.
- **Box scores drop the `#tag` suffix** entirely (both WILD and Opponent tables on the match detail page); as of a follow-up request the tag is now hidden everywhere in the UI, not just box scores (Player Stats, player detail header included) — `riot_tag` is no longer rendered anywhere, only used internally for identity resolution.
- **Nicknames updated** to the user's preferred handles (in-game/community names, not real first names) — `set_profiles.py` is the single source of truth and was simply rerun with new values.
- **Accent color** changed from orange (`#ffb454`) to green (`#a9f14f`), with `--accent-dim` recomputed to a matching dark-olive tint for the one place it's used (the API-source pill border) rather than left mismatched.

## 6.8. Box score redesign — VLR.gg-style layout + real data-flow fixes (2026-08-16)

User asked for the box score to match vlr.gg's compact stat-chip layout and flagged that **ACS was missing entirely**. Investigating that surfaced two real bugs already present in the data, not just a display gap:

- **ACS was being read from the spreadsheet but silently discarded** — `xlsx_import.py` parsed `r["acs"]` and then hardcoded `"score": None` in the `match_players` upsert, never storing it anywhere. Fixed by adding a dedicated `match_players.acs` column (spreadsheet rows store it directly; API rows compute `score / rounds_played` in the view, since match-details-v4 gives `score` but not ACS directly).
- **KAST was never imported from the spreadsheet at all**, despite being a real column in the source `Data` sheet (confirmed present in §0.5) — the `COL` mapping in `xlsx_import.py` simply never included it. Added `match_players.kast_pct` and the missing column mapping; re-ran the (idempotent) import to backfill all 515 existing spreadsheet player-match rows. KAST remains correctly absent (`—`, not faked) for the 33 API-sourced matches, since match-details-v4 genuinely doesn't expose it (§5).
- **Found and fixed a views bug while wiring this up**: `db/views.sql` used `CREATE VIEW IF NOT EXISTS`, which silently keeps a *stale* view definition after any schema/logic change — my ACS addition didn't take effect until I added `DROP VIEW IF EXISTS` before each `CREATE VIEW`. Views are cheap to rebuild and hold no data, so they're now dropped and recreated on every app startup rather than risking silent staleness again.
- **Bonus discovery**: derived stats (multi-kills, clutches, FK/FD, ECON) were already being computed for opponent players too (Phase 2's `derive.py` iterates all 10 `match_players` rows per match, not just WILD's 5) — just never displayed. The Opponent Box Score table went from 5 columns to the full set as a result, at no extra computation cost.

New layout (`macros.html::box_score_table`, shared by both WILD and Opponent tables): Player, Agent, ACS, K/D/A (combined), +/− (K−D), KAST, ADR, HS%, FK, FD, +/− (FK−FD) — each stat in its own chip (`.stat-chip`), matching vlr.gg's visual convention, colored green/red for the two +/− columns. Multi-kills/clutches/plants/defuses/ECON moved to a separate "Advanced Stats" section below rather than dropped, since vlr.gg's compact view doesn't show those either but the data is still valuable. Sort order changed from kills to ACS (both tables), matching vlr.gg convention of showing the best performer first.

## 6.9. Round-by-round timeline + box score polish (2026-08-16)

Paused the Supabase/Vercel deploy (blocked on the user's Supabase org-wide egress quota — see chat) and continued local work: player avatars → rounded rectangle (matching agent icons, not circular), box score agent column → icon-only (name dropped, kept in Agent Pool/Match Log where it's still wanted), both box score tables given fixed `<colgroup>` widths so WILD and Opponent align vertically as two separate `<table>` elements, and `.num-col` changed from right- to center-aligned site-wide.

**Round-by-round timeline**, added above the box score:
- **`rounds.result` was silently missing** — the real field (`"Elimination"`/`"Defuse"`/`"Detonate"`/`"Surrendered"`/`""` for time-expiry, confirmed against live data) exists in `data.rounds[].result` and was already sitting unused in every stored `raw_payload`, but `normalize.py` never extracted it into its own column. Fixed going forward; backfilled all 666 already-stored rounds from the preserved `raw_payload` with a new `backfill_round_result.py` script — no API re-fetch needed.
- **Side (ATK/DEF) still isn't provided by the API directly** (confirmed again) — `round_side.py` infers it instead: rounds group into the standard 12-round halves (+ 2-round OT blocks), attacker/defender is determined per block from plant evidence (only attackers can plant), and blocks with no plant evidence in them inherit their side from any resolved neighbor via strict alternation, since that part of the ruleset is certain. **Sanity-checked against the game's own rules, not just eyeballed**: every `Defuse`-result round the algorithm labels shows a `DEF` win and every `Detonate`-result round shows `ATK` — both are logically forced outcomes (only defenders can defuse, only attackers can detonate), so agreement across the full dataset is a real correctness check, not a coincidence.
- Timeline renders two rows (WILD / opponent), one rounded-rect cell per round, colored by **side** of the winner (red = attacker win, green = defender win — matching the standard convention, not the classic "team A vs team B" coloring), with a gap after round 12 (halftime) and after round 24 (before OT). Hand-drawn inline SVG icons per result type (skull/Elimination, cut-spike/Defuse, burst-spike/Detonate, clock/Time, flag/Surrendered) — no licensed Valorant assets used. Only rendered for API-sourced matches (spreadsheet matches have no round data at all — degrades to no section, not an error).
- **Debugging note worth keeping**: hit a confusing bug where new CSS rules appeared correctly in the raw file (confirmed via `curl` and even `fetch()` from the browser) but silently failed to apply — `document.styleSheets[0].cssRules.length` was stuck at a stale count across page reloads, hard-reloads, and even brand-new tabs. Root cause was the browser's parsed-stylesheet cache surviving despite fresh bytes on the wire; fixed for good with a cache-busting `?v=<mtime>` query param on the stylesheet `<link>` (`webapp.py::asset_version`), not by chasing cache headers further.

## 6.10. Match weeks — Schedule redesign + combined box score (2026-08-17)

**Match weeks**: Premier plays one assigned map per week, twice against two different opponents — confirmed against the real data by grouping API-sourced Regular-season matches by (season, calendar night, map) and checking consistency: every week group came out to exactly 2 matches on the same map (the 2 exceptions are known 404'd matches from Phase 1, not a format break). Older seasons (Beta, Ignition, E7A3, early E8) turn out to have run **single-map weeks instead** — grouping those the same way showed 11 single-match groups, not pairs, meaning Premier's format changed at some point in its history. `queries.py::match_weeks` doesn't assume a fixed size — it groups by (season_id, Eastern-local calendar date, match_type) and reports however many maps actually land in the group, reusing the exact Eastern-timezone conversion built for Phase 1.5's spreadsheet reconciliation (needed again here: matches starting near midnight UTC land on different UTC calendar dates but the same real evening).

- **Schedule page** rebuilt around match weeks instead of season aggregates: one row per week, showing every map's result as a pill, and the week record (2-0/1-1/0-2).
- **New Match Week detail page** (`/schedule/{season_id}/{local_date}`): lists the week's individual map results, plus a **combined box score** — one row per WILD player with stats summed (kills/deaths/assists/FK/FD/multi-kills/clutches/plants/defuses) or rounds-weighted-averaged (ACS/ADR/HS%/KAST) across every map that week, reusing the same `box_score_table` macro from the per-match box score (agent column shows a blank fallback here, since a player can play different agents across the week's maps).
- **Surfaced a known pre-existing data issue more visibly**: the 2025-07-12 Bind match flagged back in §5.5 as likely double-recorded (once via API under E10A4, once via spreadsheet under V25:A4, with a one-round score discrepancy) now shows up as two separate Week-1 entries in two different season groupings. Not a new bug — just more visible now. Worth a manual resolution pass if it bothers the user; not fixed yet.

## 6.11. Real round icons + role breakdown (2026-08-17)

User supplied real game-client icon files (`src/assets/icons/`, white-on-transparent `.webp`/`.png`) — the round-result timeline now uses these (`elim`/`defuse`/`boom`/`time`/`earlysurrender-flag`) instead of the hand-drawn SVG placeholders from §6.9, copied into `static/icons/` and swapped in via `macros.html::round_icon`.

Also asked for the supplied role/class symbols (Duelist/Initiator/Controller/Sentinel) to drive a **per-player role breakdown** — % of maps played per role plus performance per role — on the player page, not the box score. This needed a real gap filled first: `match_players.role` was only ever populated for spreadsheet-sourced rows (from the sheet's own Role column); API-sourced rows had no role at all. Fixed properly, not just patched over the gap:
- Pulled the real agent→role mapping from `valorant-api.com` (same source as the agent icons) into `static/agents.json` alongside the icon URLs, and added `agent_roles.py` as the single lookup point.
- `normalize.py` now sets `role` from the agent at ingest time for future API matches; `backfill_agent_role.py` filled in all 330 existing API-sourced player-match rows from already-stored data (no re-fetch). Confirmed clean afterward — every `match_players` row across both sources now has one of exactly 4 role values, no stragglers.
- New "Role Breakdown" section on the player page (`queries.py::player_detail`'s `roles` list): role icon, maps played, % of maps, win rate, ACS/ADR/K-D per role. A player who's never touched a given role (e.g. mochi has zero Duelist maps) correctly shows no row for it rather than a padded zero row.

## 6.12. Real KAST + match-detail redesign (Overview/Performance/Economy tabs) (2026-08-17)

**Real KAST for API-sourced matches, resolving the open question from §5.** KAST was previously only available for spreadsheet-sourced matches (a manual column in the source sheet) — match-details-v4 doesn't expose a KAST field directly, but its `kill_events`/`rounds` data turned out to be rich enough to compute it properly rather than leave it permanently blank. New `compute_kast.py`: per round, a player gets credit if they got a Kill, an Assist, Survived, or were Traded (a teammate killed their killer within a 5-second window) — standard KAST definition. Ran once, backfilling `match_players.kast_pct` for all 330 API-sourced player-match rows. **Validated independently, not just "ran without error"**: the API-match average KAST (71.8%) landed almost exactly on the separately-sourced spreadsheet-match average (71.8%) — strong cross-check that the derivation matches the real definition. The stale "KAST unavailable from the API" note is removed from the match detail page.

**New `queries.py::match_economy()`**: round-by-round loadout spend per team (from `round_player_stats`), bucketed into pistol (rounds 1 & 13) / eco (<5k) / semi-eco (5–10k) / semi-buy (10–20k) / full-buy (20k+), plus a per-team summary of rounds played and won in each bucket. Validated against a real match before use (pistol win correctly followed by a full-buy round, pistol loss by an eco round — matches expected Valorant economic behavior).

**Match detail page redesigned** around a VLR.gg-style Overview / Performance / Economy tab layout (plain vanilla-JS tab switcher, no framework, consistent with the rest of the site):
- **Overview** — the box score tables (WILD + Opponent), unchanged content, just relocated into a tab panel.
- **Performance** — multi-kills/clutches/plants/defuses/ECON (previously "Advanced Stats") plus Weapon Kills, both moved here since they're performance detail, not top-level overview.
- **Economy** — new: per-team buy-type summary table, legend, and the round-by-round grid (bank/remaining-credits rows sandwiching each team's buy-type row per round, pistol rounds marked distinctly). Hidden entirely for spreadsheet-sourced matches (no round-level economy data exists for those — degrades cleanly, no error).
- Round-by-round timeline: dropped the "Round-by-Round" header/explainer (self-explanatory), replaced team-name text labels with a `team_badge()` (WILD's real logo; opponent falls back to 2-letter initials, no logo asset available for opponents), padded to a minimum of 24 rounds so every match's timeline is the same width (`round_side.py::compute_match_timeline`, matches that went to OT keep their real length), and the K/D/A stat chip is now fixed-width (`.stat-chip.kda { width: 88px }`) regardless of digit count.
- **Real bug found and fixed during browser verification**: the timeline was centered via `display:flex; justify-content:center` on the scrolling container, which — because the content overflows — clipped rounds 1–6 permanently unreachable (`scrollLeft` can't go negative, so the browser's own centering ate into the unreachable region rather than the visible one). Fixed by switching to `text-align:center` on the scroll container with the inner grid as `inline-flex`, which centers only when content fits and scrolls correctly from the true start otherwise.

---

## 6. Suggested build phases

1. ~~**Phase 1 — Raw ingestion + storage.**~~ **Done.** See §0.5.
2. ~~**Phase 1.5 — Legacy spreadsheet import.**~~ **Done.** See §5.5.
3. ~~**Phase 2 — Derived-stats computation layer.**~~ **Done.** See §6.5.
4. ~~**Phase 3 — Core frontend views.**~~ **Done.** See §6.6.
5. **Phase 4 — Upgrade views + sync UX.** Comps win-rate, synergy matrix, player trend lines, Sync Now button/flow, populate `season_schedule` for the real Schedule page, polish.

Each phase is meant to be approved before starting the next, per your original ask.

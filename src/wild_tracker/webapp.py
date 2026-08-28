from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import queries
from .config import get_db_path
from .db_sqlite import connect, init_schema

APP_DIR = Path(__file__).parent
HEADSHOTS_DIR = APP_DIR / "static" / "headshots"

app = FastAPI(title="WILD Gaming Tracker")
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
templates = Jinja2Templates(directory=APP_DIR / "templates")

# Cached locally (fetched once from valorant-api.com, a free community game-
# asset API) rather than hit at request time — keeps the app fast and
# resilient to that external service being down.
AGENT_ASSETS: dict = json.loads((APP_DIR / "static" / "agents.json").read_text())
MAP_ASSETS: dict = json.loads((APP_DIR / "static" / "maps.json").read_text())


def agent_icon(agent_name: str | None) -> str | None:
    return AGENT_ASSETS.get(agent_name, {}).get("icon") if agent_name else None


def map_icon(map_name: str | None) -> str | None:
    return MAP_ASSETS.get(map_name, {}).get("icon") if map_name else None


def map_splash(map_name: str | None) -> str | None:
    return MAP_ASSETS.get(map_name, {}).get("splash") if map_name else None


def headshot_url(headshot_filename: str | None) -> str | None:
    if headshot_filename and (HEADSHOTS_DIR / headshot_filename).exists():
        return f"/static/headshots/{headshot_filename}"
    return None


templates.env.globals["agent_icon"] = agent_icon
templates.env.globals["map_icon"] = map_icon
templates.env.globals["map_splash"] = map_splash
templates.env.globals["headshot_url"] = headshot_url


def asset_version() -> int:
    # Cache-busting query param for style.css — browsers (and this preview
    # tool) can be stubborn about revalidating a <link>-loaded stylesheet
    # even when the bytes on disk have changed; a version query string
    # sidesteps that entirely rather than depending on cache headers.
    return int(os.path.getmtime(APP_DIR / "static" / "style.css"))


templates.env.globals["asset_version"] = asset_version


def get_conn():
    conn = connect(get_db_path())
    init_schema(conn)  # idempotent (CREATE ... IF NOT EXISTS) — cheap enough per-request at this scale
    return conn


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    conn = get_conn()
    data = queries.home_page_data(conn)
    conn.close()
    return templates.TemplateResponse("home.html", {"request": request, "active": "home", **data})


@app.get("/team", response_class=HTMLResponse)
def team_stats(request: Request):
    conn = get_conn()
    data = queries.team_record(conn)
    conn.close()
    return templates.TemplateResponse("team_stats.html", {"request": request, "active": "team", **data})


@app.get("/players", response_class=HTMLResponse)
def player_list(request: Request):
    conn = get_conn()
    players = queries.player_career_list(conn)
    conn.close()
    return templates.TemplateResponse("players.html", {"request": request, "active": "players", "players": players})


@app.get("/players/{player_id}", response_class=HTMLResponse)
def player_detail(request: Request, player_id: str):
    conn = get_conn()
    data = queries.player_detail(conn, player_id)
    conn.close()
    if data is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return templates.TemplateResponse("player_detail.html", {"request": request, "active": "players", **data})


@app.get("/matches", response_class=HTMLResponse)
def match_list(request: Request):
    conn = get_conn()
    matches = queries.match_list(conn)
    conn.close()
    return templates.TemplateResponse("matches.html", {"request": request, "active": "matches", "matches": matches})


@app.get("/matches/{match_id}", response_class=HTMLResponse)
def match_detail(request: Request, match_id: str):
    conn = get_conn()
    data = queries.match_detail(conn, match_id)
    conn.close()
    if data is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return templates.TemplateResponse("match_detail.html", {"request": request, "active": "matches", **data})


@app.get("/comps", response_class=HTMLResponse)
def team_comps(request: Request, map: Optional[str] = None):
    conn = get_conn()
    all_comps = queries.team_comps(conn)
    conn.close()

    maps = sorted({c["map"] for c in all_comps})
    requested_map = map
    selected_map = requested_map if requested_map in maps else (maps[0] if maps else None)
    comps = [c for c in all_comps if c["map"] == selected_map]
    summary = queries.map_comp_summary(comps)

    return templates.TemplateResponse("team_comps.html", {
        "request": request, "active": "comps",
        "comps": comps, "maps": maps, "selected_map": selected_map, "summary": summary,
        "splash": map_splash(selected_map),
    })


@app.get("/schedule", response_class=HTMLResponse)
def schedule(request: Request):
    conn = get_conn()
    seasons = queries.schedule_by_season(conn)
    conn.close()
    return templates.TemplateResponse("schedule.html", {"request": request, "active": "schedule", "seasons": seasons})


@app.get("/schedule/{season_id}/{local_date}", response_class=HTMLResponse)
def match_week_detail(request: Request, season_id: str, local_date: str):
    conn = get_conn()
    data = queries.match_week_detail(conn, season_id, local_date)
    conn.close()
    if data is None:
        raise HTTPException(status_code=404, detail="Match week not found")
    return templates.TemplateResponse("match_week_detail.html", {"request": request, "active": "schedule", **data})

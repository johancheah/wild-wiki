from __future__ import annotations

import json
from pathlib import Path

_AGENTS_PATH = Path(__file__).parent / "static" / "agents.json"
_AGENTS: dict = json.loads(_AGENTS_PATH.read_text())


def agent_role(agent_name: str | None) -> str | None:
    """Duelist/Initiator/Controller/Sentinel for a given agent, from the
    cached valorant-api.com data (same source as the agent icons)."""
    if not agent_name:
        return None
    return _AGENTS.get(agent_name, {}).get("role")

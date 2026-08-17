import agentsData from "../public/agents.json";
import mapsData from "../public/maps.json";

type AgentAsset = { icon: string; bust: string; killfeed: string };
type MapAsset = { icon: string; splash: string };

const agents = agentsData as Record<string, AgentAsset>;
const maps = mapsData as Record<string, MapAsset>;

export function agentIcon(agent: string | null | undefined): string | null {
  return agent ? agents[agent]?.icon ?? null : null;
}

export function mapIcon(map: string | null | undefined): string | null {
  return map ? maps[map]?.icon ?? null : null;
}

export function mapSplash(map: string | null | undefined): string | null {
  return map ? maps[map]?.splash ?? null : null;
}

export function headshotUrl(filename: string | null | undefined): string | null {
  return filename ? `/headshots/${filename}` : null;
}

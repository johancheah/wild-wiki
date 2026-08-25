import { agentIcon } from "@/lib/assets";

// Box score variant: icon only, no agent name (AgentCell keeps the name —
// still used in Agent Pool / Match Log where the text is wanted).
export function AgentCellIconOnly({ agent }: { agent: string | null }) {
  const icon = agentIcon(agent);
  return (
    <span className="agent-cell-icon-only">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="agent-icon-only" src={icon} alt={agent ?? ""} />
      ) : (
        <span className="avatar-fallback">—</span>
      )}
    </span>
  );
}

// Combined (match-week) box score variant: a player can play a different
// agent on each map, so show one small icon per map instead of one agent.
export function MultiAgentCell({ agents }: { agents: (string | null)[] }) {
  return (
    <span className="agent-cell-icon-only agent-cell-multi">
      {agents.map((a, i) => {
        const icon = agentIcon(a);
        return icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="agent-icon-only" src={icon} alt={a ?? ""} />
        ) : (
          <span key={i} className="avatar-fallback">—</span>
        );
      })}
    </span>
  );
}

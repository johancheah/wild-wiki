import { agentIcon } from "@/lib/assets";

export function AgentCell({ agent }: { agent: string | null }) {
  const icon = agentIcon(agent);
  return (
    <span className="agent-cell">
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="agent-icon" src={icon} alt={agent ?? ""} />
      )}
      {agent ?? "—"}
    </span>
  );
}

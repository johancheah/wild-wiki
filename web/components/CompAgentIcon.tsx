import { agentIcon, headshotUrl } from "@/lib/assets";
import type { CompAgent } from "@/lib/comps";

// Mirrors src/wild_tracker/templates/macros.html::comp_agent — agent icon
// grouped by role (gap_before adds a small gap between role groups), with
// a hover preview of the player who played that agent that map.
export function CompAgentIcon({ a }: { a: CompAgent }) {
  const icon = agentIcon(a.agent);
  const hs = headshotUrl(a.headshot_filename);
  return (
    <span className={`comp-agent ${a.gap_before ? "comp-agent-gap" : ""}`}>
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="agent-icon-only" src={icon} alt={a.agent ?? ""} />
      )}
      {hs && (
        <span className="comp-agent-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hs} alt={a.display_name} />
          <span className="comp-agent-preview-name">{a.display_name}</span>
        </span>
      )}
    </span>
  );
}

import { agentIcon, headshotUrl } from "@/lib/assets";
import type { CompAgent } from "@/lib/comps";

// Mirrors src/wild_tracker/templates/macros.html::comp_agent — one agent
// icon. The headshot/name are exposed as data attributes for the singleton
// CompTooltip to read on hover (position:fixed, not clipped by the
// scrolling table container). Role-grouping/alignment is handled by the
// parent CompRow, not here.
export function CompAgentIcon({ a }: { a: CompAgent }) {
  const icon = agentIcon(a.agent);
  const hs = headshotUrl(a.headshot_filename);
  return (
    <span className="comp-agent" data-headshot={hs ?? undefined} data-name={hs ? a.display_name : undefined}>
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="agent-icon-only" src={icon} alt={a.agent ?? ""} />
      )}
    </span>
  );
}

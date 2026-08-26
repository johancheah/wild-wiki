import { CompAgentIcon } from "./CompAgentIcon";
import type { CompAgent } from "@/lib/comps";

// Mirrors src/wild_tracker/templates/macros.html::comp_row — a fixed-width
// box (see .comp-row in globals.css) so every row occupies the same total
// width regardless of a given comp's actual role mix. Icons are
// left-aligned inside it with consistent gaps (small within a role, larger
// between roles via CompAgentIcon's gap_before), so any slack from a less
// role-diverse comp just becomes trailing whitespace.
export function CompRow({ agents }: { agents: CompAgent[] }) {
  return (
    <span className="comp-row">
      {agents.map((a) => (
        <CompAgentIcon key={a.player_id} a={a} />
      ))}
    </span>
  );
}

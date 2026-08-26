import { CompAgentIcon } from "./CompAgentIcon";
import type { CompAgent } from "@/lib/comps";

const ROLE_SLOTS = ["Controller", "Initiator", "Sentinel", "Duelist"] as const;

// Mirrors src/wild_tracker/templates/macros.html::comp_row — one fixed-
// width slot per role, each holding however many of that role appear
// (usually 0 or 1, occasionally 2). Fixed slot widths (see .comp-row in
// globals.css) — not per-icon margins — are what makes every row's
// leftmost and rightmost icon line up in the same columns regardless of
// which roles a given comp actually used.
export function CompRow({ agents }: { agents: CompAgent[] }) {
  return (
    <span className="comp-row">
      {ROLE_SLOTS.map((role) => (
        <span className="comp-role-slot" key={role}>
          {agents.filter((a) => a.role === role).map((a) => (
            <CompAgentIcon key={a.player_id} a={a} />
          ))}
        </span>
      ))}
    </span>
  );
}

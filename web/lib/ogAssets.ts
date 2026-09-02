import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MIME_BY_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

// Reads a public/ asset straight off disk into a data: URI — satori (which
// next/og's ImageResponse renders through) sniffs the declared mime to pick
// a decoder, so this must match the file's real format or image decoding
// throws deep inside satori rather than just mis-rendering. Shared by every
// opengraph-image.tsx route (player, match, match-week) so the headshot/
// logo-reading logic and its mime-matching only lives in one place.
export async function fileDataUri(relPath: string): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public", relPath));
    const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Reconstructs the real final round score (e.g. 14-12, not just "+2") from
// two values every match already stores — matches.margin (signed round
// differential, WILD's perspective) and rounds_played (total rounds in the
// match, same for every player). Works uniformly for both a normal 13-round
// finish and an overtime finish (win by 2 past 12-12), and needs no
// assumption about which case it was: the match stops the instant a team's
// round count satisfies "first to 13, win by 2", so for a given total round
// count and margin there is exactly one possible split —
//   winner = (total + |margin|) / 2, loser = (total - |margin|) / 2
// (verified against real per-round data for an actual OT match: 26 rounds,
// margin 2 → 14-12, not the 13-11 a naive "13 minus margin" guess would
// have produced).
export function matchRoundScore(
  margin: number | null,
  result: string | null,
  roundsPlayed: number | null
): { wildScore: number; oppScore: number } | null {
  if (margin == null || roundsPlayed == null || roundsPlayed <= 0) return null;
  const absMargin = Math.abs(margin);
  const winner = Math.round((roundsPlayed + absMargin) / 2);
  const loser = Math.round((roundsPlayed - absMargin) / 2);
  if (result === "WIN") return { wildScore: winner, oppScore: loser };
  if (result === "LOSS") return { wildScore: loser, oppScore: winner };
  return { wildScore: Math.round(roundsPlayed / 2), oppScore: Math.round(roundsPlayed / 2) };
}

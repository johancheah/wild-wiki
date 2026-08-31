import { supabase } from "@/lib/supabase";
import { fetchStages, fetchPlayerCareer } from "@/lib/players";
import { StageSelect } from "@/components/StageSelect";
import { PlayersTable } from "@/components/PlayersTable";

export const revalidate = 0;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const stages = await fetchStages(supabase);
  const selectedStage = stage && stages.includes(stage) ? stage : null;
  const players = await fetchPlayerCareer(supabase, selectedStage);

  return (
    <>
      <h1>Player Stats</h1>

      <StageSelect stages={stages} selected={selectedStage} />

      <div className="subtitle">
        {selectedStage ? (
          <>
            Career totals for {selectedStage} across {players.length} roster members who played that stage.
          </>
        ) : (
          <>Career totals across all {players.length} tracked roster members.</>
        )}{" "}
        Click a player for match log + agent pool. Click a column header to sort.
      </div>

      <PlayersTable players={players} />
    </>
  );
}

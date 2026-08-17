export type MatchPlayerStats = {
  match_id: string;
  player_id: string;
  team_id: string | null;
  wild_team_id: string | null;
  is_wild_player: boolean;
  agent: string | null;
  role: string | null;
  score: number | null;
  kills: number;
  deaths: number;
  assists: number;
  rounds_played: number | null;
  adr: number | null;
  hs_pct: number | null;
  acs: number | null;
  kast_pct: number | null;
  fk: number | null;
  fd: number | null;
  kpr: number | null;
  apr: number | null;
  fkpr: number | null;
  fdpr: number | null;
  two_k: number | null;
  three_k: number | null;
  four_k: number | null;
  five_k: number | null;
  clutch_1v1: number | null;
  clutch_1v2: number | null;
  clutch_1v3: number | null;
  clutch_1v4: number | null;
  clutch_1v5: number | null;
  plants: number | null;
  defuses: number | null;
  econ: number | null;
  date: string;
  map: string;
  season_id: string | null;
  match_type: string | null;
  match_result: string | null;
  margin: number | null;
  match_source: string;
  enemy_team_id: string | null;
};

export type BoxScoreRow = MatchPlayerStats & {
  riot_name: string;
  riot_tag: string;
  headshot_filename: string | null;
  display_name: string;
};

export type PlayerCareer = {
  player_id: string;
  riot_name: string;
  riot_tag: string;
  headshot_filename: string | null;
  display_name: string;
  matches_played: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number | null;
  adr: number | null;
  hs_pct: number | null;
  two_k: number | null;
  three_k: number | null;
  four_k: number | null;
  five_k: number | null;
  clutches: number | null;
  plants: number | null;
  defuses: number | null;
  econ: number | null;
};

export type MatchListItem = {
  match_id: string;
  date: string;
  season_id: string | null;
  match_type: string | null;
  map: string;
  result: string | null;
  margin: number | null;
  source: string;
  opponent: string | null;
};

export type MatchRow = {
  match_id: string;
  source: string;
  season_id: string | null;
  date: string;
  map: string;
  match_type: string | null;
  team_id: string | null;
  enemy_team_id: string | null;
  result: string | null;
  margin: number | null;
  opponent_name: string | null;
  opponent_tag: string | null;
};

export type WeaponKillRow = {
  player_id: string;
  riot_name: string;
  display_name: string;
  weapon: string;
  kill_count: number;
};

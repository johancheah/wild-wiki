"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Lets the player detail page (a server component) publish "here's the
// current player + the WILD roster" up to <Nav>, which lives higher in the
// tree (rendered once in the root layout) — so Nav can show the compact
// avatar+name switcher without re-fetching data the page already has.
// See components/PlayerHeaderSync.tsx for the publishing side.

export type NavPlayer = {
  player_id: string;
  display_name: string;
  headshot_filename: string | null;
};

type PlayerHeaderState = {
  player: NavPlayer | null;
  roster: NavPlayer[];
};

type PlayerHeaderContextValue = PlayerHeaderState & {
  setPlayerHeader: (player: NavPlayer | null, roster: NavPlayer[]) => void;
};

const PlayerHeaderContext = createContext<PlayerHeaderContextValue | null>(null);

export function PlayerHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerHeaderState>({ player: null, roster: [] });
  const setPlayerHeader = useCallback((player: NavPlayer | null, roster: NavPlayer[]) => {
    setState({ player, roster });
  }, []);

  return (
    <PlayerHeaderContext.Provider value={{ ...state, setPlayerHeader }}>{children}</PlayerHeaderContext.Provider>
  );
}

export function usePlayerHeader() {
  const ctx = useContext(PlayerHeaderContext);
  if (!ctx) throw new Error("usePlayerHeader must be used within a PlayerHeaderProvider");
  return ctx;
}

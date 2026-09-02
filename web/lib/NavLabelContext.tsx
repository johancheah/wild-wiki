"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Lets the match-week detail page (a server component) publish a plain
// breadcrumb-style label ("Season · Week N") up to <Nav>, which lives
// higher in the tree (rendered once in the root layout) — same pattern as
// PlayerHeaderContext, kept separate since a week page has nothing to
// switch between (no dropdown, just a label) and only one of the two is
// ever shown at a time.

type NavLabelContextValue = {
  label: string | null;
  setNavLabel: (label: string | null) => void;
};

const NavLabelContext = createContext<NavLabelContextValue | null>(null);

export function NavLabelProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const setNavLabel = useCallback((l: string | null) => setLabel(l), []);

  return <NavLabelContext.Provider value={{ label, setNavLabel }}>{children}</NavLabelContext.Provider>;
}

export function useNavLabel() {
  const ctx = useContext(NavLabelContext);
  if (!ctx) throw new Error("useNavLabel must be used within a NavLabelProvider");
  return ctx;
}

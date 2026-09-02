"use client";

import { useEffect } from "react";
import { useNavLabel } from "@/lib/NavLabelContext";

// Renders nothing — just publishes this page's nav-bar label to context on
// mount, and clears it on unmount (navigating away from this page) so the
// label doesn't linger elsewhere. Mirrors PlayerHeaderSync's pattern.
export function NavLabelSync({ label }: { label: string }) {
  const { setNavLabel } = useNavLabel();

  useEffect(() => {
    setNavLabel(label);
    return () => setNavLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  return null;
}

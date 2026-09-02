"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayerSwitcher } from "./PlayerSwitcher";
import { usePlayerHeader } from "@/lib/PlayerHeaderContext";
import { useNavLabel } from "@/lib/NavLabelContext";

const LINKS = [
  { href: "/team", label: "Team Stats" },
  { href: "/players", label: "Player Stats" },
  { href: "/matches", label: "Matches" },
  { href: "/comps", label: "Team Comps" },
  { href: "/schedule", label: "Schedule" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { player, roster } = usePlayerHeader();
  const { label: navLabel } = useNavLabel();

  // Reveal the compact avatar+name once the page's own big player header
  // (well above the fold) has scrolled out of view.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 220);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = (onClick?: () => void) =>
    LINKS.map((l) => {
      const active = pathname.startsWith(l.href);
      return (
        <Link key={l.href} href={l.href} className={active ? "active" : ""} onClick={onClick}>
          {l.label}
        </Link>
      );
    });

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.png" alt="WILD Gaming" />
        </Link>

        {player ? (
          <div className={`nav-player ${scrolled ? "visible" : ""}`}>
            <PlayerSwitcher currentPlayer={player} roster={roster} variant="nav" />
          </div>
        ) : (
          navLabel && (
            <div className={`nav-player nav-week-label ${scrolled ? "visible" : ""}`}>
              <span className="nav-week-text">{navLabel}</span>
            </div>
          )
        )}

        <nav className="desktop-nav">{navLinks()}</nav>
        <button
          className="nav-toggle"
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      <nav id="mobile-menu" className={`mobile-menu ${open ? "open" : ""}`}>
        {navLinks(() => setOpen(false))}
      </nav>
    </header>
  );
}

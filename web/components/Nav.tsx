"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { usePlayerHeader } from "@/lib/PlayerHeaderContext";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { player, roster } = usePlayerHeader();
  const navPlayerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (navPlayerRef.current && !navPlayerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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

        {player && (
          <div className={`nav-player ${scrolled ? "visible" : ""}`} ref={navPlayerRef}>
            <button
              className="nav-player-btn"
              type="button"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((o) => !o);
              }}
            >
              <Avatar displayName={player.display_name} headshotFilename={player.headshot_filename} />
              <span className="nav-player-name">{player.display_name}</span>
              <span className="nav-player-caret">▾</span>
            </button>
            <div className={`nav-player-dropdown ${dropdownOpen ? "open" : ""}`}>
              {roster.map((p) => (
                <Link
                  key={p.player_id}
                  href={`/players/${p.player_id}`}
                  className={p.player_id === player.player_id ? "active" : ""}
                  onClick={() => setDropdownOpen(false)}
                >
                  <Avatar displayName={p.display_name} headshotFilename={p.headshot_filename} />
                  {p.display_name}
                </Link>
              ))}
            </div>
          </div>
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

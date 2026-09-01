"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

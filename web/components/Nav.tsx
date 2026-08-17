"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Team Stats" },
  { href: "/players", label: "Player Stats" },
  { href: "/matches", label: "Matches" },
  { href: "/schedule", label: "Schedule" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.png" alt="WILD Gaming" />
          WILD <span>GAMING</span>
        </Link>
        <nav>
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={active ? "active" : ""}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

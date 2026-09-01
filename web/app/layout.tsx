import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import Waves from "@/components/Waves";

export const metadata: Metadata = {
  title: "WILD Gaming",
  description: "WILD Gaming Valorant Premier tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-background" aria-hidden="true">
          <Waves
            lineColor="#a9f14f"
            backgroundColor="transparent"
            waveSpeedX={0.02}
            waveSpeedY={0.025}
            waveAmpX={45}
            waveAmpY={20}
            friction={0.9}
            tension={0.01}
            maxCursorMove={120}
            xGap={12}
            yGap={36}
          />
        </div>
        <Nav />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}

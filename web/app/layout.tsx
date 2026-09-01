import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import Grainient from "@/components/Grainient";

export const metadata: Metadata = {
  title: "WILD Gaming",
  description: "WILD Gaming Valorant Premier tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Subtle animated background — near-black with just a hint of the
            WILD green accent (#ABF14F) worked into the mid tone; contrast/
            grain/warp all turned down from the component's defaults so it
            reads as ambient texture, not a foreground gradient. */}
        <div className="page-background" aria-hidden="true">
          <Grainient
            color1="#16220f"
            color2="#1f2e14"
            color3="#0c0f13"
            timeSpeed={0.1}
            colorBalance={0.0}
            warpStrength={1.0}
            warpFrequency={4.0}
            warpSpeed={1.0}
            warpAmplitude={40.0}
            blendAngle={0.0}
            blendSoftness={0.3}
            rotationAmount={120.0}
            noiseScale={1.5}
            grainAmount={0.05}
            grainScale={2.0}
            grainAnimated={false}
            contrast={1.1}
            gamma={1.0}
            saturation={1.0}
            zoom={1.3}
          />
        </div>
        <Nav />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { storageMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Screenova — The AI design workspace for app stores",
  description:
    "Screenova — The AI design workspace for app stores. Turn raw app screenshots into beautiful App Store and Google Play campaigns.",
  openGraph: {
    title: "Screenova — The AI design workspace for app stores",
    description:
      "Screenova — The AI design workspace for app stores. Turn raw app screenshots into high-converting mobile campaigns.",
    type: "website",
  },
};

export default function Page() {
  return <LandingPage cloud={storageMode() === "supabase"} />;
}

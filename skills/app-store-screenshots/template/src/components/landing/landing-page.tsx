"use client";
import * as React from "react";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Navbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { SocialProof } from "./social-proof";
import { HowItWorks } from "./how-it-works";
import { BeforeAfterSection } from "./before-after-section";
import { LocalizationSection } from "./localization-section";
import { ComparisonTable } from "./comparison-table";
import { ExperimentSection } from "./experiment-section";
import { FAQ } from "./faq";
import { PricingSection } from "./pricing-section";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { TemplatesModal } from "./templates-modal";
import { LoginModal } from "./login-modal";
import { CheckoutModal } from "./checkout-modal";
import { useTheme } from "./use-theme";
import type { PricingPlan } from "./types";

/**
 * Screenova marketing landing — the public home page. Sections and copy match
 * the design-html preview; creation CTAs route into the real app at /studio
 * (describe → editor), with no simulated editor or checkout.
 */
export function LandingPage({ cloud = false }: { cloud?: boolean }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [checkoutPlan, setCheckoutPlan] = React.useState<PricingPlan | null>(null);

  const openStudio = (prompt?: string) => {
    if (prompt?.trim()) {
      try { sessionStorage.setItem("screenova:studio-prompt", prompt.trim()); } catch { /* storage is optional */ }
    }
    router.push("/studio");
  };
  const goStudio = () => router.push("/studio");
  const scrollToPricing = () =>
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });

  function handleSelectPlan(plan: PricingPlan) {
    if (plan.id === "free") {
      goStudio();
      return;
    }
    setCheckoutPlan(plan);
  }

  return (
    <MotionConfig reducedMotion="user"><div
      className={cn(
        "screenova-landing min-h-screen antialiased",
        theme === "dark" && "screenova-dark",
      )}
    >
      <Navbar
        onOpenStudio={goStudio}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenPricing={scrollToPricing}
        onOpenLogin={cloud ? goStudio : () => setLoginOpen(true)}
        onNavigateHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main><HeroSection onGenerate={openStudio} onStart={goStudio} />
      <SocialProof cloud={cloud} />
      <HowItWorks />
      <BeforeAfterSection onTryItNow={goStudio} />
      <LocalizationSection />
      {!cloud && <ComparisonTable />}
      <ExperimentSection />
      {/* Add testimonials only after real customer approval and verification. */}
      <FAQ cloud={cloud} />
      <PricingSection cloud={cloud} onSelectPlan={handleSelectPlan} />
      <CtaBanner onStart={goStudio} /></main>
      <Footer onOpenTemplates={() => setTemplatesOpen(true)} onOpenPricing={scrollToPricing} />

      {templatesOpen && (
        <TemplatesModal
          onClose={() => setTemplatesOpen(false)}
          onSelectTemplate={(prompt) => {
            setTemplatesOpen(false);
            openStudio(prompt);
          }}
        />
      )}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSuccess={goStudio} />}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={goStudio}
        />
      )}
    </div></MotionConfig>
  );
}

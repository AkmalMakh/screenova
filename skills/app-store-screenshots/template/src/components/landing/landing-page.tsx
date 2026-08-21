"use client";
import * as React from "react";
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
import { Testimonials } from "./testimonials";
import { FAQ } from "./faq";
import { PricingSection } from "./pricing-section";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StudioEditorModal } from "./studio-editor-modal";
import { TemplatesModal } from "./templates-modal";
import { LoginModal } from "./login-modal";
import { CheckoutModal } from "./checkout-modal";
import { useTheme } from "./use-theme";
import type { PricingPlan } from "./types";

/**
 * Screenova marketing landing — the public home page. Sections and copy match
 * the design-html preview; the interactive studio demo opens as a modal, and
 * the primary CTAs route into the real app at /studio (describe → editor).
 */
export function LandingPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [studioPrompt, setStudioPrompt] = React.useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [checkoutPlan, setCheckoutPlan] = React.useState<PricingPlan | null>(null);

  const openStudio = (prompt?: string) =>
    setStudioPrompt(prompt ?? "Make this feel like a calm premium wellness app.");
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
    <div
      className={cn(
        "screenova-landing min-h-screen antialiased",
        theme === "dark" && "screenova-dark",
      )}
    >
      <Navbar
        onOpenStudio={goStudio}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenPricing={scrollToPricing}
        onOpenLogin={() => setLoginOpen(true)}
        onNavigateHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <HeroSection onGenerate={openStudio} onStart={goStudio} />
      <SocialProof />
      <HowItWorks />
      <BeforeAfterSection onTryItNow={goStudio} />
      <LocalizationSection />
      <ComparisonTable />
      <ExperimentSection />
      <Testimonials />
      <FAQ />
      <PricingSection onSelectPlan={handleSelectPlan} />
      <CtaBanner onStart={goStudio} />
      <Footer onOpenTemplates={() => setTemplatesOpen(true)} onOpenPricing={scrollToPricing} />

      {studioPrompt !== null && (
        <StudioEditorModal initialPrompt={studioPrompt} onClose={() => setStudioPrompt(null)} />
      )}
      {templatesOpen && (
        <TemplatesModal
          onClose={() => setTemplatesOpen(false)}
          onSelectTemplate={(prompt) => {
            setTemplatesOpen(false);
            openStudio(prompt);
          }}
        />
      )}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSuccess={() => {}} />}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

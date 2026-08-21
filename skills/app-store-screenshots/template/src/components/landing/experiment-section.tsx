"use client";
import React from 'react';
import { UploadCloud, ArrowDown, Repeat, TrendingUp, Info } from 'lucide-react';
import { Reveal, RevealGroup, fadeUp } from './reveal';
import { Kicker } from './kicker';
import { motion } from 'motion/react';

interface Direction {
  id: string;
  label: string;
  style: string;
  images: string[];
}

// Three real design directions generated from the same app's raw screenshots —
// same product, three distinct visual treatments, exactly what you'd upload as
// separate Product Page Optimization treatments in App Store Connect.
const DIRECTIONS: Direction[] = [
  {
    id: 'A',
    label: 'Direction A',
    style: 'Editorial dark',
    images: ['/deck/01-hero.webp', '/deck/02-split-landscape.webp', '/deck/04-two-devices.webp'],
  },
  {
    id: 'B',
    label: 'Direction B',
    style: 'Soft editorial',
    images: ['/deck-b/01-hero.webp', '/deck-b/02-single.webp', '/deck-b/03-two-devices.webp'],
  },
  {
    id: 'C',
    label: 'Direction C',
    style: 'Bold & direct',
    images: ['/deck-c/01-hero.webp', '/deck-c/02-single.webp', '/deck-c/03-two-devices.webp'],
  },
];

const LOCALES = ['EN', 'KO', 'JA', 'DE', 'ES', 'FR'];

// Illustrative only — a mock of the report App Store Connect hands back once a
// Product Page Optimization test collects enough traffic. Screenova doesn't run
// experiments or measure conversion itself, so these numbers are a sample shape
// of the output, not a real or claimed result. See the disclaimer directly below it.
interface ResultRow {
  id: string;
  label: string;
  delta: number | null;
  isControl?: boolean;
  leading?: boolean;
}

const SAMPLE_RESULTS: ResultRow[] = [
  { id: 'control', label: 'Current page', delta: null, isControl: true },
  { id: 'A', label: 'Treatment A', delta: 30, leading: true },
  { id: 'B', label: 'Treatment B', delta: 20 },
  { id: 'C', label: 'Treatment C', delta: 6 },
];

const MAX_DELTA = Math.max(...SAMPLE_RESULTS.map((r) => r.delta ?? 0));

export const ExperimentSection: React.FC = () => {
  return (
    <section className="border-t border-black/[0.06] bg-[#FAF9F6] py-24 text-black dark:border-white/[0.06] dark:bg-[#07080a] dark:text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker index="06" label="Generate, export, test" tone="violet" />
          <h2 className="mx-auto mt-4 max-w-xl text-3xl font-semibold tracking-tight text-black sm:text-4xl dark:text-white">
            Draft a few directions. Let App Store Connect find the winner.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Same raw screenshots, three different design directions — each a full deck
            reflowed across every locale you pick. Export them as Product Page Optimization
            treatments, upload to App Store Connect, and let Apple&apos;s own experiment
            engine tell you which one converts.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {DIRECTIONS.map((d) => (
            <motion.div
              key={d.id}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="overflow-hidden rounded-[20px] border border-black/[0.08] bg-white dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
                <div>
                  <span className="block text-[11px] font-semibold text-black dark:text-white">{d.label}</span>
                  <span className="block text-[10px] text-neutral-500 dark:text-neutral-500">{d.style}</span>
                </div>
                <span className="rounded-full bg-[#5241C4]/10 px-2 py-0.5 text-[10px] font-semibold text-[#5241C4] dark:bg-[#a89bff]/15 dark:text-[#a89bff]">
                  Treatment {d.id}
                </span>
              </div>
              <div className="flex items-end justify-center gap-2 bg-[#F1F0EC] px-3 pb-0 pt-4 dark:bg-transparent">
                {d.images.map((src, i) => (
                  <img
                    key={src}
                    src={src}
                    alt={`${d.label} screen ${i + 1}`}
                    className={`w-1/3 rounded-t-lg object-cover object-top shadow-lg ${
                      i === 1 ? 'h-56 -translate-y-2' : 'h-48'
                    }`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-1 border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
                {LOCALES.map((loc) => (
                  <span
                    key={loc}
                    className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[9px] font-medium text-neutral-600 dark:bg-white/[0.06] dark:text-neutral-400"
                  >
                    {loc}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </RevealGroup>

        <Reveal className="mt-8 flex justify-center">
          <ArrowDown className="h-4 w-4 text-neutral-400 dark:text-neutral-600" />
        </Reveal>

        <Reveal className="mt-4">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-6 py-5 text-center dark:border-white/[0.08] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-black dark:text-white">
              <UploadCloud className="h-4 w-4 text-[#5241C4] dark:text-[#a89bff]" />
              <span>App Store Connect · Product Page Optimization</span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Running
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              Apple splits App Store traffic across your treatments and reports which one wins —
              run it once, or keep iterating with a fresh direction from Screenova each time.
            </p>
          </div>
        </Reveal>

        <p className="mx-auto mt-6 max-w-lg text-center text-[11px] text-neutral-400 dark:text-neutral-600">
          Screenova generates the treatments and locales. Uploading and running the experiment
          happens in your own App Store Connect account.
        </p>

        {/* Sample-shaped results, not real measured data — Screenova has no analytics
            engine of its own. Labeled "Example report" and disclaimed below so it reads
            as "here's the shape of what Apple hands back," not as a performance claim. */}
        <Reveal className="mt-8">
          <div className="mx-auto max-w-lg rounded-2xl border border-black/[0.08] bg-white px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-black dark:text-white">
                <TrendingUp className="h-4 w-4 text-[#5241C4] dark:text-[#a89bff]" />
                <span>Treatment conversion vs. current page</span>
              </div>
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400">
                Example report
              </span>
            </div>

            <div className="mt-5 space-y-3.5">
              {SAMPLE_RESULTS.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                    {r.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                    {r.delta !== null && (
                      <div
                        className={`h-full rounded-full ${
                          r.leading ? 'bg-[#5241C4] dark:bg-[#a89bff]' : 'bg-[#5241C4]/40 dark:bg-[#a89bff]/40'
                        }`}
                        style={{ width: `${Math.max(6, (r.delta / MAX_DELTA) * 100)}%` }}
                      />
                    )}
                  </div>
                  <span
                    className={`w-16 shrink-0 text-right text-[12px] font-semibold ${
                      r.isControl
                        ? 'text-neutral-400 dark:text-neutral-600'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {r.isControl ? 'Baseline' : `+${r.delta}%`}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-600" />
              <p className="text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-600">
                Illustrative example, not a Screenova measurement — Screenova has no analytics of
                its own. Real percentages like these come from Apple, in your App Store Connect
                dashboard, once your experiment collects enough traffic.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Roadmap: the continuous-optimization layer isn't built yet — marked
            explicitly as upcoming rather than folded into the copy above,
            which describes what Screenova does today. */}
        <Reveal className="mt-14">
          <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-black/[0.12] px-6 py-6 text-center dark:border-white/[0.15]">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[#5241C4]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#5241C4] dark:bg-[#a89bff]/15 dark:text-[#a89bff]">
              <Repeat className="h-3 w-3" />
              <span>Coming soon</span>
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-black dark:text-white">
              A continuous optimization loop, not a one-time export
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              Today, you run each experiment through App Store Connect yourself. Next: Screenova
              reads back which treatments Apple reports as winners, learns what&apos;s actually
              converting for your app, and keeps drafting fresh directions to test — so the page
              keeps improving instead of stopping after one round.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

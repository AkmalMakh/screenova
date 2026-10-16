import { badgeText, cleanAwardBadge } from "@/lib/award-badge";
import type { AwardBadge as AwardBadgeData } from "@/lib/types";

// Original vector artwork. No raster image, remote font, or external SVG asset.
export function AwardBadge({ badge: value, color, locale }: { badge?: AwardBadgeData; color: string; locale: string }) {
  const badge = cleanAwardBadge(value);
  const title = badgeText(badge.title, locale);
  const eyebrow = badgeText(badge.eyebrow, locale);
  const fit = (text: string, size: number) => Math.min(size, 174 / Math.max(1, [...text].reduce((n, c) => n + (/[^\u0000-\u024f]/.test(c) ? 1 : 0.6), 0)));
  return (
    <svg data-award-badge="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="100%" height="100%" role="img" aria-label={[eyebrow, title].filter(Boolean).join(" ")} style={{ display: "block", overflow: "hidden" }}>
      {badge.laurels && [false, true].map((mirror) => (
        <g key={String(mirror)} transform={mirror ? "translate(320 0) scale(-1 1)" : undefined} fill={color}>
          <path d="M71 137 C28 117 22 65 48 22" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {[{ x: 46, y: 29, a: 18 }, { x: 39, y: 43, a: 2 }, { x: 34, y: 58, a: -12 }, { x: 32, y: 74, a: -27 }, { x: 34, y: 90, a: -43 }, { x: 40, y: 105, a: -60 }, { x: 50, y: 119, a: -78 }, { x: 64, y: 131, a: -95 }].map(({ x, y, a }, i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
              <path d="M0 3 C-15 -1 -18 -14 -15 -20 C-3 -17 1 -7 0 3Z" />
              <path d="M1 3 C1 -11 8 -18 16 -19 C16 -7 10 0 1 3Z" />
            </g>
          ))}
        </g>
      ))}
      <g fill={badge.textColor} textAnchor="middle" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif">
        <text x="160" y={title ? 49 : 68} fontSize={fit(eyebrow, 20)} fontWeight="400">{eyebrow}</text>
        <text x="160" y={eyebrow ? 87 : 76} fontSize={fit(title, 28)} fontWeight="700">{title}</text>
      </g>
      <g fill={color}>
        {Array.from({ length: badge.stars }, (_, i) => (
          <path key={i} transform={`translate(${160 + (i - (badge.stars - 1) / 2) * 29} 119)`} d="M0 -10 L3 -3.3 L10 -3.1 L4.8 1.6 L6.2 8.6 L0 5 L-6.2 8.6 L-4.8 1.6 L-10 -3.1 L-3 -3.3 Z" />
        ))}
      </g>
    </svg>
  );
}

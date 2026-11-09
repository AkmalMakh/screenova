import type { Slide } from "./types";

/**
 * A screen added to a designed deck should look like it belongs there: it
 * takes the reference screen's background, frame, type, layout, placement and
 * background shapes. It leaves out what is specific to that screen: its words,
 * extra text blocks, screenshots and feature icons.
 */
export function styledLikeDeck(slide: Slide, reference: Slide | undefined): Slide {
  if (!reference || reference.layout === "feature-graphic" || slide.layout === "feature-graphic") return slide;
  // A new screen is there to show a screenshot, so a device-free reference
  // lends its look but not its layout.
  const layout = reference.layout === "no-device" ? slide.layout : reference.layout;
  const decorations = (reference.decorations ?? [])
    .filter((decoration) => decoration.kind !== "icon-tile")
    .map((decoration) => ({ ...decoration, id: `${decoration.id}-${slide.id}` }));
  return {
    ...slide,
    layout,
    ...(reference.backgroundFill ? { backgroundFill: reference.backgroundFill } : {}),
    ...(reference.backgroundStyle ? { backgroundStyle: reference.backgroundStyle } : {}),
    ...(reference.frameStyle ? { frameStyle: reference.frameStyle } : {}),
    ...(reference.headlineStyle ? { headlineStyle: reference.headlineStyle } : {}),
    ...(reference.headlineFontFamily ? { headlineFontFamily: reference.headlineFontFamily } : {}),
    ...(reference.inverted ? { inverted: reference.inverted } : {}),
    ...(reference.visualAsset ? { visualAsset: reference.visualAsset } : {}),
    ...(layout === reference.layout && reference.transforms ? { transforms: reference.transforms } : {}),
    ...(decorations.length ? { decorations } : {}),
  };
}

import type { Slide } from "./types";

// Static translations for the placeholder starter-deck copy in
// src/lib/defaults.ts (makeStarterSlides/ipadStarter/tabletStarter/fgStarter).
// Keyed by the English source string; applied when a project is created with
// additional content locales so switching the content locale shows native
// starter copy immediately. Only known strings are translated — anything the
// user has already written is left untouched.
export const STARTER_COPY: Record<string, Record<string, string>> = {
  "MEET YOUR APP": {
    de: "LERN DEINE APP KENNEN",
    es: "CONOCE TU APP",
    fr: "DÉCOUVREZ VOTRE APP",
    zh: "认识你的应用",
    ja: "アプリを知る",
    ko: "앱을 만나보세요",
    ru: "ПОЗНАКОМЬТЕСЬ С ПРИЛОЖЕНИЕМ",
  },
  "Sell one\nidea per slide.": {
    de: "Eine Idee\npro Bildschirm.",
    es: "Una idea\npor pantalla.",
    fr: "Une idée\npar écran.",
    zh: "每页只讲\n一个想法。",
    ja: "1画面に\n1つのアイデア。",
    ko: "한 화면에\n하나의 아이디어.",
    ru: "Одна идея\nна слайд.",
  },
  "FEATURE 01": {
    de: "FUNKTION 01",
    es: "FUNCIÓN 01",
    fr: "FONCTION 01",
    zh: "功能 01",
    ja: "機能 01",
    ko: "기능 01",
    ru: "ФУНКЦИЯ 01",
  },
  "FEATURE 02": {
    de: "FUNKTION 02",
    es: "FUNCIÓN 02",
    fr: "FONCTION 02",
    zh: "功能 02",
    ja: "機能 02",
    ko: "기능 02",
    ru: "ФУНКЦИЯ 02",
  },
  "FEATURE 03": {
    de: "FUNKTION 03",
    es: "FUNCIÓN 03",
    fr: "FONCTION 03",
    zh: "功能 03",
    ja: "機能 03",
    ko: "기능 03",
    ru: "ФУНКЦИЯ 03",
  },
  "Your headline\nlives here.": {
    de: "Deine Headline\nsteht hier.",
    es: "Tu titular\nvive aquí.",
    fr: "Votre titre\nvit ici.",
    zh: "你的标题\n写在这里。",
    ja: "見出しは\nここに。",
    ko: "헤드라인이\n여기 있어요.",
    ru: "Ваш заголовок\nживёт здесь.",
  },
  "Show two\nscreens at once.": {
    de: "Zeige zwei\nBildschirme gleichzeitig.",
    es: "Muestra dos\npantallas a la vez.",
    fr: "Montrez deux\nécrans à la fois.",
    zh: "同时展示\n两个画面。",
    ja: "2つの画面を\n同時に見せる。",
    ko: "두 화면을\n한 번에 보여주세요.",
    ru: "Покажите два\nэкрана сразу.",
  },
  "Flip the contrast\nfor visual rhythm.": {
    de: "Wechsle den Kontrast\nfür visuellen Rhythmus.",
    es: "Invierte el contraste\npara dar ritmo visual.",
    fr: "Inversez le contraste\npour le rythme visuel.",
    zh: "反转对比\n营造视觉节奏。",
    ja: "コントラストを反転して\n視覚的なリズムを。",
    ko: "대비를 뒤집어\n시각적 리듬을 만들어보세요.",
    ru: "Переверните контраст\nради визуального ритма.",
  },
  "MORE": {
    de: "MEHR",
    es: "MÁS",
    fr: "PLUS",
    zh: "更多",
    ja: "もっと",
    ko: "더보기",
    ru: "ЕЩЁ",
  },
  "And so\nmuch more.": {
    de: "Und noch\nviel mehr.",
    es: "Y mucho\nmás.",
    fr: "Et bien\nplus encore.",
    zh: "还有\n更多。",
    ja: "さらに\n多くの機能。",
    ko: "그리고\n훨씬 더.",
    ru: "И многое\nдругое.",
  },
  "Made for\nthe big screen.": {
    de: "Gemacht für\nden großen Bildschirm.",
    es: "Hecha para\nla pantalla grande.",
    fr: "Pensée pour\nle grand écran.",
    zh: "为\n大屏而生。",
    ja: "大画面の\nために。",
    ko: "큰 화면을\n위해 만들어졌어요.",
    ru: "Создано для\nбольшого экрана.",
  },
  "Built for\nfocus.": {
    de: "Gebaut für\nFokus.",
    es: "Hecha para\nconcentrarte.",
    fr: "Conçue pour\nla concentration.",
    zh: "为专注\n而生。",
    ja: "集中の\nために。",
    ko: "집중을 위해\n만들어졌어요.",
    ru: "Создано для\nфокуса.",
  },
  "Always within reach.": {
    de: "Immer in\nReichweite.",
    es: "Siempre al\nalcance.",
    fr: "Toujours à\nportée de main.",
    zh: "始终\n触手可及。",
    ja: "いつでも\n手の届くところに。",
    ko: "언제나\n손이 닿는 곳에.",
    ru: "Всегда\nпод рукой.",
  },
  "Pocket-sized\npower.": {
    de: "Kraft im\nTaschenformat.",
    es: "Potencia de\nbolsillo.",
    fr: "La puissance\nen poche.",
    zh: "口袋大小\n的强大能力。",
    ja: "ポケットサイズの\nパワー。",
    ko: "주머니 속\n강력함.",
    ru: "Мощь\nв кармане.",
  },
  "Wide canvas,\nbigger ideas.": {
    de: "Breite Leinwand,\ngrößere Ideen.",
    es: "Lienzo amplio,\nideas más grandes.",
    fr: "Toile large,\nidées plus grandes.",
    zh: "宽阔画布\n更大创意。",
    ja: "広いキャンバスに\n大きなアイデア。",
    ko: "넓은 캔버스,\n더 큰 아이디어.",
    ru: "Широкий холст,\nбольшие идеи.",
  },
  "Your tagline goes here.": {
    de: "Dein Slogan steht hier.",
    es: "Tu eslogan va aquí.",
    fr: "Votre slogan ici.",
    zh: "你的宣传语写在这里。",
    ja: "キャッチコピーはここに。",
    ko: "슬로건이 여기에 들어갑니다.",
    ru: "Здесь будет ваш слоган.",
  },
};

/**
 * Fill in starter-deck translations: for every slide whose English copy is a
 * known starter string, write the matching translation into the given locales.
 */
export function localizeStarterDeck(deck: Slide[], locales: string[]): Slide[] {
  return deck.map((slide) => {
    const enLabel = slide.label?.en;
    const enHeadline = slide.headline?.en;
    if (!enLabel && !enHeadline) return slide;
    const label = { ...(slide.label || {}) };
    const headline = { ...(slide.headline || {}) };
    for (const locale of locales) {
      if (locale === "en") continue;
      const labelCopy = enLabel ? STARTER_COPY[enLabel]?.[locale] : undefined;
      const headlineCopy = enHeadline ? STARTER_COPY[enHeadline]?.[locale] : undefined;
      if (labelCopy) label[locale] = labelCopy;
      if (headlineCopy) headline[locale] = headlineCopy;
    }
    return { ...slide, label, headline };
  });
}

export type DeviceType = 'iphone_65' | 'ipad_pro' | 'android_phone';
export type PlatformType = 'ios' | 'android';
export type ViewMode = 'isolated' | 'deck' | 'canvas';

export type LanguageCode = 'en' | 'ko' | 'ja' | 'de' | 'es' | 'fr';

export type SlideLayout = 
  | 'hero' 
  | 'split-landscape' 
  | 'device-bottom' 
  | 'two-devices' 
  | 'device-top'
  | 'dual-sync'
  | 'routines-dual';

export interface ScreenshotSlide {
  id: string;
  screenIndex: number;
  screenName: string;
  category: {
    [key in LanguageCode]: string;
  };
  headline: {
    [key in LanguageCode]: string;
  };
  subtitle: {
    [key in LanguageCode]: string;
  };
  badgeText?: string;
  badgePosition?: 'top-right' | 'bottom-left' | 'side-rotated';
  accentLineColor?: string;
  bgColor: string;
  gradient: string;
  layout: SlideLayout;
  deviceType: DeviceType;
  uiType: 
    | 'onboarding_hero' 
    | 'workouts_stats' 
    | 'voice_calendar' 
    | 'expense_budget_dual' 
    | 'daily_plan_grid' 
    | 'routines_shift_cycle' 
    | 'multilingual_month' 
    | 'light_dark_sync' 
    | 'diary_notes';
}

export interface CampaignPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  theme: {
    gradient: string;
    primaryColor: string;
    textColor: string;
    accentLine: string;
  };
  slides: ScreenshotSlide[];
}

export interface TestimonialItem {
  id: string;
  stars: number;
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarBg: string;
}

export interface ComparisonRow {
  feature: string;
  storeCanvas: string | boolean;
  traditionalTools: string | boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceAnnual: number;
  popular?: boolean;
  features: string[];
  ctaText: string;
  buttonVariant: 'outline' | 'solid-purple' | 'subtle';
}


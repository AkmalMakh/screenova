"use client";
import React, { useState } from 'react';
import {
  Sparkles,
  Smartphone,
  Tablet,
  Download,
  Globe2,
  Undo,
  Redo,
  Layers,
  Type,
  Palette,
  Check,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  X,
  Share2,
  RefreshCw,
  Upload,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Settings,
  Copy,
  Paperclip,
  ArrowUp,
  Sliders,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeviceType, LanguageCode, PlatformType, ViewMode, ScreenshotSlide } from './types';
import { SAMPLE_CAMPAIGNS, LOCALIZED_PREVIEWS } from './mock-data';
import { AppStoreSlideCard } from './app-store-slide-card';

interface StudioEditorModalProps {
  initialPrompt?: string;
  onClose: () => void;
}

export const StudioEditorModal: React.FC<StudioEditorModalProps> = ({
  initialPrompt = 'Make this feel like a calm premium wellness app.',
  onClose,
}) => {
  const defaultPreset = SAMPLE_CAMPAIGNS[0];
  const [slides, setSlides] = useState<ScreenshotSlide[]>(defaultPreset.slides);
  const [selectedSlideId, setSelectedSlideId] = useState<string>(slides[0].id);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
  const [currentPlatform, setCurrentPlatform] = useState<PlatformType>('ios');
  const [currentDevice, setCurrentDevice] = useState<DeviceType>('iphone_65');
  const [viewMode, setViewMode] = useState<ViewMode>('isolated');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [projectName, setProjectName] = useState<string>('MoteCalendar');

  // AI Prompting states
  const [promptText, setPromptText] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiScope, setAiScope] = useState<'current' | 'selected' | 'deck'>('current');
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [showScreensModal, setShowScreensModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const selectedIndex = slides.findIndex((s) => s.id === selectedSlideId);
  const selectedSlide = slides[selectedIndex] || slides[0];

  const handleUpdateSlide = (updated: Partial<ScreenshotSlide>) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === selectedSlideId ? { ...s, ...updated } : s))
    );
  };

  const handleApplyPrompt = (customPrompt?: string) => {
    const textToUse = customPrompt || promptText;
    if (!textToUse.trim()) return;

    setIsAiGenerating(true);
    setTimeout(() => {
      if (textToUse.toLowerCase().includes('dark') || textToUse.toLowerCase().includes('cinematic')) {
        setSlides((prev) =>
          prev.map((s) => ({
            ...s,
            gradient: 'linear-gradient(180deg, #090D1F 0%, #060914 50%, #03050B 100%)',
            accentLineColor: '#818CF8',
          }))
        );
      } else if (textToUse.toLowerCase().includes('bold') || textToUse.toLowerCase().includes('type')) {
        handleUpdateSlide({
          headline: {
            ...selectedSlide.headline,
            [currentLanguage]: 'Redefined Time. Pure Focus.',
          },
          subtitle: {
            ...selectedSlide.subtitle,
            [currentLanguage]: 'Experience the next standard in daily organization.',
          },
        });
      } else if (textToUse.toLowerCase().includes('violet') || textToUse.toLowerCase().includes('soft')) {
        setSlides((prev) =>
          prev.map((s) => ({
            ...s,
            gradient: 'linear-gradient(180deg, #191438 0%, #100D28 50%, #0A0819 100%)',
            accentLineColor: '#C084FC',
          }))
        );
      } else {
        // General calm wellness polish
        handleUpdateSlide({
          headline: {
            ...selectedSlide.headline,
            [currentLanguage]: 'Your whole day. One calm place.',
          },
          subtitle: {
            ...selectedSlide.subtitle,
            [currentLanguage]: 'Plans, tasks, and spending—harmoniously together.',
          },
        });
      }
      setIsAiGenerating(false);
      setPromptText('');
    }, 900);
  };

  const handleExport = () => {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#6366F1', '#A855F7', '#3B82F6', '#10B981', '#F59E0B'],
    });
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3500);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const nextSlide = () => {
    if (selectedIndex < slides.length - 1) {
      setSelectedSlideId(slides[selectedIndex + 1].id);
    }
  };

  const prevSlide = () => {
    if (selectedIndex > 0) {
      setSelectedSlideId(slides[selectedIndex - 1].id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070913] text-neutral-200 overflow-hidden font-sans select-none">
      {/* 1. TOP MAIN STUDIO TOOLBAR (Matches Screenshot 2026-08-16 at 12.07.22 AM) */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800/80 bg-[#0C0F1D] px-3.5 z-40">
        {/* Left Section: Project Dropdown & Editable Title */}
        <div className="flex items-center gap-2">
          {/* Project Pill Dropdown */}
          <div className="flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-700/60 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:border-neutral-500 cursor-pointer transition">
            <span className="text-sm">🦉</span>
            <span className="font-bold text-xs">{projectName}</span>
            <ChevronDown className="h-3 w-3 text-neutral-400" />
          </div>

          {/* Editable Project Name Input */}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="hidden sm:inline-block w-32 rounded-md bg-neutral-900/60 border border-dashed border-neutral-700 px-2 py-1 text-xs font-medium text-neutral-300 focus:border-indigo-500 focus:outline-none"
          />

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* View Mode Toggle: Isolated vs Deck */}
          <button
            onClick={() => setViewMode(viewMode === 'isolated' ? 'deck' : 'isolated')}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === 'isolated'
                ? 'bg-neutral-800 border-neutral-700 text-white'
                : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <span className="text-[11px]">↔</span>
            <span>{viewMode === 'isolated' ? 'Isolated' : 'Deck View'}</span>
          </button>
        </div>

        {/* Center Section: Platform, Device & Language Selectors */}
        <div className="flex items-center gap-2">
          {/* Platform Segmented Control */}
          <div className="flex items-center rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setCurrentPlatform('ios')}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                currentPlatform === 'ios'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              iOS
            </button>
            <button
              onClick={() => setCurrentPlatform('android')}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                currentPlatform === 'android'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Android
            </button>
          </div>

          {/* Device Selector */}
          <div className="relative">
            <select
              value={currentDevice}
              onChange={(e) => setCurrentDevice(e.target.value as DeviceType)}
              className="appearance-none rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1 pr-7 text-xs font-semibold text-neutral-300 hover:border-neutral-700 cursor-pointer focus:outline-none"
            >
              <option value="iphone_65">iPhone 6.5&quot;</option>
              <option value="ipad_pro">iPad Pro 12.9&quot;</option>
              <option value="android_phone">Pixel 8 Pro</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-neutral-500" />
          </div>

          {/* Locale Code Pill */}
          <div className="flex items-center rounded-lg bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs font-bold text-neutral-400">
            <span>{currentLanguage.toUpperCase()}</span>
          </div>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={currentLanguage}
              onChange={(e) => setCurrentLanguage(e.target.value as LanguageCode)}
              className="appearance-none rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1 pr-7 text-xs font-semibold text-neutral-300 hover:border-neutral-700 cursor-pointer focus:outline-none"
            >
              <option value="en">文A English</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="de">Deutsch (German)</option>
              <option value="es">Español (Spanish)</option>
              <option value="fr">Français (French)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-neutral-500" />
          </div>

          {/* Saved Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pl-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>saved 7m ago</span>
          </div>
        </div>

        {/* Right Section: Action Controls & Export Bundle */}
        <div className="flex items-center gap-1.5">
          {/* Screens Modal Trigger */}
          <button
            onClick={() => setShowScreensModal(!showScreensModal)}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
          >
            <Layers className="h-3.5 w-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Screens</span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => setShowSettingsModal(!showSettingsModal)}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5 text-neutral-400" />
          </button>

          {/* Copy Trigger */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
            title="Copy Deck Link"
          >
            {copiedSuccess ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-neutral-400" />}
          </button>

          {/* Undo Trigger */}
          <button
            onClick={() => {}}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition"
            title="Undo"
          >
            <Undo className="h-3.5 w-3.5" />
          </button>

          {/* Export Bundle Primary Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3.5 py-1 text-xs font-bold text-neutral-900 hover:bg-white shadow-sm transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export bundle</span>
          </button>

          <button
            onClick={onClose}
            className="ml-1 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE: LEFT AI PANEL + CENTER STAGE */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: "Design with AI" (Matches reference screenshot) */}
        <aside className="w-[340px] shrink-0 border-r border-neutral-800/80 bg-[#0C0F1E] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* AI Header */}
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                  <Sparkles className="h-4 w-4 fill-current" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Design with AI
                </h3>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Describe it, preview it, then apply.
              </p>
            </div>

            {/* Try a direction chips */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Try a direction
              </span>
              <div className="mt-2 space-y-1.5">
                {[
                  '“Make this feel like a calm premium wellness app.”',
                  '“Use bolder type and a dark cinematic palette.”',
                  '“Create a new campaign screen from the workout screenshot.”',
                  '“Generate a cinematic midnight visual backdrop with soft violet light.”',
                  '“Give every screen more visual rhythm and cleaner copy.”',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPrompt(prompt.replace(/[“”]/g, ''))}
                    className="w-full rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-2 text-left text-xs text-neutral-300 hover:border-indigo-500/50 hover:bg-neutral-900 transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom AI Prompt Input Area */}
          <div className="mt-4 pt-3 border-t border-neutral-800 space-y-3">
            {/* Scope tabs */}
            <div className="flex items-center rounded-lg bg-neutral-900 p-0.5 text-[11px] font-semibold">
              <button
                onClick={() => setAiScope('current')}
                className={`flex-1 rounded-md py-1 text-center transition ${
                  aiScope === 'current'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Current Screen
              </button>
              <button
                onClick={() => setAiScope('selected')}
                className={`flex-1 rounded-md py-1 text-center transition ${
                  aiScope === 'selected'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Selected
              </button>
              <button
                onClick={() => setAiScope('deck')}
                className={`flex-1 rounded-md py-1 text-center transition ${
                  aiScope === 'deck'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Entire Deck
              </button>
            </div>

            {/* Input Box */}
            <div className="relative rounded-2xl border border-neutral-700/80 bg-[#121626] p-2.5 focus-within:border-indigo-500 transition">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleApplyPrompt();
                  }
                }}
                placeholder="Redesign screens or create a new one from an attachment..."
                rows={3}
                className="w-full resize-none bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none leading-relaxed"
              />

              {/* Bottom toolbar inside input box */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                <button className="flex items-center gap-1 rounded-lg bg-neutral-800/80 px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-neutral-700">
                  <Paperclip className="h-3 w-3" />
                  <span>1 existing target</span>
                </button>

                <button
                  onClick={() => handleApplyPrompt()}
                  disabled={isAiGenerating}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-black hover:bg-white disabled:opacity-50 transition"
                >
                  {isAiGenerating ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Disclaimer Footnote */}
            <p className="text-[10px] text-neutral-500 leading-tight">
              Prompts, target previews, and references are sent to OpenAI. Requested visual updates reflect in real-time.
            </p>
          </div>
        </aside>

        {/* CENTER MAIN STAGE CANVAS */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#070913] relative">
          {/* Breadcrumb info & Screen navigation strip */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800/80 bg-[#0A0D1A] px-6 text-xs text-neutral-400">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 font-medium">
              <span>iPhone</span>
              <span>·</span>
              <span className="text-white font-bold">
                Screen {selectedSlide.screenIndex}
              </span>
              <span>·</span>
              <span>{selectedSlide.screenName}</span>
              <span>·</span>
              <span className="text-neutral-500">{viewMode}</span>
            </div>

            {/* Slide Index Navigator Thumbnails */}
            <div className="flex items-center gap-1.5">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSlideId(s.id)}
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold transition ${
                    s.id === selectedSlideId
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[11px] text-neutral-400 w-9 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Screen Display Area */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative">
            {/* View Mode: Isolated (Single Screen Focus) */}
            {viewMode === 'isolated' ? (
              <div className="relative flex items-center gap-6">
                {/* Previous Slide Floating Button */}
                <button
                  onClick={prevSlide}
                  disabled={selectedIndex === 0}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/90 border border-neutral-700 text-white shadow-xl hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Main Selected Slide Card with dynamic zoom */}
                <div
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out',
                  }}
                >
                  <AppStoreSlideCard
                    slide={selectedSlide}
                    language={currentLanguage}
                    isSelected={true}
                  />
                </div>

                {/* Next Slide Floating Button */}
                <button
                  onClick={nextSlide}
                  disabled={selectedIndex === slides.length - 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/90 border border-neutral-700 text-white shadow-xl hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : (
              /* View Mode: Deck (All 9 Screens in a horizontal panoramic ribbon) */
              <div className="flex items-center gap-6 py-6 px-4">
                {slides.map((slide) => (
                  <div
                    key={slide.id}
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <AppStoreSlideCard
                      slide={slide}
                      language={currentLanguage}
                      isSelected={slide.id === selectedSlideId}
                      onSelect={() => setSelectedSlideId(slide.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Inspector Bar (Bottom) */}
          <div className="h-14 border-t border-neutral-800/80 bg-[#0C0F1E] px-6 flex items-center justify-between text-xs z-30">
            <div className="flex items-center gap-3">
              <span className="text-neutral-400 font-semibold">Headline:</span>
              <input
                type="text"
                value={selectedSlide.headline[currentLanguage] || selectedSlide.headline.en}
                onChange={(e) =>
                  handleUpdateSlide({
                    headline: {
                      ...selectedSlide.headline,
                      [currentLanguage]: e.target.value,
                    },
                  })
                }
                className="w-80 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-neutral-400 font-semibold">Subtitle:</span>
              <input
                type="text"
                value={selectedSlide.subtitle[currentLanguage] || selectedSlide.subtitle.en}
                onChange={(e) =>
                  handleUpdateSlide({
                    subtitle: {
                      ...selectedSlide.subtitle,
                      [currentLanguage]: e.target.value,
                    },
                  })
                }
                className="w-80 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleUpdateSlide({
                    accentLineColor:
                      selectedSlide.accentLineColor === '#7B76E6'
                        ? '#F43F5E'
                        : '#7B76E6',
                  })
                }
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Toggle Accent
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Optional Screens Drawer / Modal */}
      {showScreensModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#0E1222] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h4 className="text-base font-bold text-white">Deck Screens Overview (9 Total)</h4>
              <button
                onClick={() => setShowScreensModal(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => {
                    setSelectedSlideId(slide.id);
                    setShowScreensModal(false);
                  }}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    slide.id === selectedSlideId
                      ? 'border-blue-500 bg-blue-950/40'
                      : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-400">
                    <span>Screen {idx + 1}</span>
                    <span className="text-[10px] text-blue-400 uppercase">{slide.category.en}</span>
                  </div>
                  <div className="mt-2 font-serif-headline text-sm font-bold text-white line-clamp-1">
                    {slide.headline.en}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-400 line-clamp-1">
                    {slide.subtitle.en}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

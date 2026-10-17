"use client";
import React from 'react';
import {
  Calendar,
  CreditCard,
  BookOpen,
  Heart,
  Clock,
  Dumbbell,
  Mic,
  Plus,
  Video,
  ChevronRight,
  ChevronLeft,
  Settings,
  Sparkles,
  Moon,
  LayoutGrid,
  RefreshCw,
  X,
  Check,
  TrendingUp,
  Apple,
} from 'lucide-react';
import { LanguageCode } from './types';

interface PhoneMockupProps {
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
  language?: LanguageCode;
  isSecondary?: boolean;
  themeMode?: 'dark' | 'light';
  className?: string;
  compact?: boolean;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  uiType,
  language = 'en',
  isSecondary = false,
  themeMode = 'dark',
  className = '',
  compact = false,
}) => {
  const isLight = themeMode === 'light';

  return (
    <div
      className={`relative select-none overflow-hidden rounded-[44px] p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_0_1px_rgba(230,195,140,0.4),0_0_20px_rgba(100,120,255,0.15)] transition-all duration-300 ${
        isLight
          ? 'bg-gradient-to-b from-[#E6D4B8] via-[#C5A880] to-[#E3D1B4]'
          : 'bg-gradient-to-b from-[#D8BA8E] via-[#8C6D45] to-[#D5B78B]'
      } ${className}`}
      style={{
        width: compact ? '240px' : '295px',
        height: compact ? '490px' : '600px',
      }}
    >
      {/* Outer Titanium Bezel Edge Reflections */}
      <div className="absolute inset-[1px] rounded-[42px] border border-white/20 pointer-events-none" />
      <div className="absolute inset-[3px] rounded-[40px] bg-black pointer-events-none" />

      {/* Screen Inner Glass */}
      <div
        className={`relative h-full w-full overflow-hidden rounded-[38px] ${
          isLight ? 'bg-[#F2F2F7] text-neutral-900' : 'bg-[#000000] text-white'
        } flex flex-col font-sans text-xs leading-normal`}
      >
        {/* Dynamic Island / Speaker Pill */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex h-[22px] w-[84px] items-center justify-between rounded-full bg-black px-2 py-0.5 shadow-md">
          <div className="h-2.5 w-2.5 rounded-full bg-[#111] border border-neutral-800" />
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-neutral-900 border border-neutral-700" />
          </div>
        </div>

        {/* iOS Top Status Bar */}
        <div className="relative z-20 flex h-10 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-semibold">
          <div className="flex items-center gap-1">
            <span>6:05</span>
            <span className="text-[10px]">🌙</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <svg className="w-3 h-2.5 fill-current" viewBox="0 0 17 11">
              <path d="M1 8.5h2v2H1zm4-2.5h2v4.5H5zm4-3h2v7.5H9zm4-3h2v10.5h-2z" />
            </svg>
            <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16">
              <path d="M8 12.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0-4.5c2.3 0 4.3.9 5.8 2.4l-1.4 1.4C11.3 10.7 9.7 10 8 10s-3.3.7-4.4 1.8L2.2 10.4C3.7 8.9 5.7 8 8 8zm0-4.5c3.5 0 6.7 1.4 9 3.7l-1.4 1.4C13.8 6.8 11 5.5 8 5.5S2.2 6.8.4 8.6L-1 7.2C1.3 4.9 4.5 3.5 8 3.5z" />
            </svg>
            <div className="flex items-center gap-0.5 border border-current rounded px-0.5 py-[1px] text-[8px] font-bold">
              <span>30</span>
            </div>
          </div>
        </div>

        {/* Screen Content Renderers */}
        <div className="relative flex-1 overflow-hidden flex flex-col">
          {uiType === 'onboarding_hero' && <HeroOnboardingContent />}
          {uiType === 'workouts_stats' && <WorkoutsStatsContent />}
          {uiType === 'voice_calendar' && <VoiceCalendarContent />}
          {uiType === 'expense_budget_dual' && (
            isSecondary ? <ExpensesDonutContent /> : <BudgetDashboardContent />
          )}
          {uiType === 'daily_plan_grid' && <DailyPlanGridContent />}
          {uiType === 'routines_shift_cycle' && (
            isSecondary ? <ShiftSelectorModalContent /> : <CycleTrackerContent />
          )}
          {uiType === 'multilingual_month' && <MultilingualMonthContent />}
          {uiType === 'light_dark_sync' && (
            <SyncSettingsContent isLight={isLight} />
          )}
          {uiType === 'diary_notes' && <DiaryNotesContent />}
        </div>

        {/* iOS Bottom Bar Indicator */}
        <div className="relative z-20 flex h-4 shrink-0 items-center justify-center pb-1">
          <div className="h-1 w-24 rounded-full bg-neutral-500/40" />
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   INDIVIDUAL SCREEN IMPLEMENTATIONS
   ========================================================================= */

// Screen 1: MoteCalendar Hero & Onboarding
const HeroOnboardingContent: React.FC = () => (
  <div className="flex flex-1 flex-col items-center justify-between px-4 pb-2 pt-2 text-center">
    {/* Cute Mote Monster Icon */}
    <div className="flex flex-col items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8050F5] to-[#5C2EE0] shadow-lg shadow-purple-900/40">
        <div className="relative flex items-center justify-center">
          {/* Owl/Creature Face */}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-[#3B1578]" />
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-white flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-[#3B1578]" />
            </div>
          </div>
          <div className="absolute -bottom-1 h-1 w-2 rounded-full bg-pink-300" />
        </div>
      </div>
      <span className="mt-1 text-[11px] font-bold tracking-tight text-blue-400">
        MoteCalendar
      </span>
    </div>

    {/* Floating Agenda Widget Card */}
    <div className="w-full max-w-[230px] rounded-2xl border border-neutral-800 bg-[#161618] p-3 shadow-xl text-left">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
        <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          <Calendar className="h-3 w-3 text-blue-400" />
          <span>Agenda</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">
          <Mic className="h-2.5 w-2.5" />
          <span>AI</span>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 font-mono">09:00</span>
          <div className="flex flex-1 items-center justify-between rounded-[14px] bg-blue-600/25 border border-blue-500/40 px-2.5 py-1.5 text-blue-200">
            <div>
              <div className="text-[10px] font-bold text-white">Team Sync</div>
              <div className="text-[8px] text-blue-300">Video Call</div>
            </div>
            <Video className="h-3.5 w-3.5 text-blue-400" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 font-mono">11:30</span>
          <div className="flex flex-1 items-center justify-between rounded-[14px] bg-neutral-800/90 border border-neutral-700/50 px-2.5 py-1.5 text-neutral-300">
            <span className="text-[10px] font-bold text-white">Go to Gym</span>
            <Dumbbell className="h-3.5 w-3.5 text-neutral-400" />
          </div>
        </div>
      </div>
    </div>

    {/* Pitch copy */}
    <div className="space-y-1">
      <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
        Every Task & Expense in<br />One Place
      </h4>
      <p className="text-[10px] text-neutral-400">
        Plan your day and track your budget effortlessly.
      </p>
      <div className="flex items-center justify-center gap-1 pt-0.5">
        <div className="flex text-amber-400 text-[10px]">★★★★★</div>
        <span className="text-[9px] text-neutral-400">50,000+ organized users</span>
      </div>
    </div>

    {/* Auth Buttons */}
    <div className="w-full space-y-1.5 px-2">
      <button className="flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-white py-2 text-[11px] font-bold text-black shadow-sm">
        <Apple className="h-3.5 w-3.5 fill-current" />
        <span>Continue with Apple</span>
      </button>
      <button className="flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#222] border border-neutral-700 py-1.5 text-[10px] font-semibold text-white">
        <span className="font-bold text-[#4285F4]">G</span>
        <span>Continue with Google</span>
      </button>
      <button className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-neutral-800 bg-[#141416] py-1.5 text-[10px] font-semibold text-neutral-300">
        <span>✉ Continue with Email</span>
      </button>
      <p className="text-[7.5px] text-neutral-500 pt-0.5">
        By continuing, you agree to our Terms & Privacy Policy
      </p>
    </div>
  </div>
);

// Screen 2: Workouts & Volume Stats
const WorkoutsStatsContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-3 pt-1 text-left">
    <div>
      <div className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">
        MOTE WORKOUTS
      </div>
      <div className="flex items-center justify-between pt-0.5">
        <h4 className="text-sm font-extrabold text-white">My workouts</h4>
        <button className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-2 flex rounded-[14px] bg-[#1C1C1E] p-0.5 text-[9px] font-semibold">
        <button className="flex-1 rounded-lg bg-[#2C2C2E] py-1 text-center text-white">
          Progress
        </button>
        <button className="flex-1 py-1 text-center text-neutral-400">
          My workouts
        </button>
        <button className="flex-1 py-1 text-center text-neutral-400">
          Schedule
        </button>
      </div>

      {/* Volume Card */}
      <div className="mt-3 rounded-2xl bg-[#141416] border border-neutral-800 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[8px] font-bold uppercase text-neutral-400">
              AVG VOLUME LOAD
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-white">878</span>
              <span className="text-[10px] text-neutral-400">kg</span>
            </div>
          </div>
          <div className="flex rounded-lg bg-[#222] p-0.5 text-[8px] font-bold">
            <span className="rounded bg-[#333] px-2 py-0.5 text-white">M</span>
            <span className="px-2 py-0.5 text-neutral-400">6M</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] text-neutral-400 border-t border-neutral-800/80 pt-1.5">
          <ChevronLeft className="h-3 w-3" />
          <span className="font-semibold text-neutral-300">
            July 2026 · 3,510 kg total · 4 training days
          </span>
          <ChevronRight className="h-3 w-3" />
        </div>

        {/* Chart Bars */}
        <div className="mt-3 flex h-20 items-end justify-between px-1 border-b border-neutral-800 pb-1">
          {[
            { day: '1', h: 4, active: false },
            { day: '7', h: 6, active: false },
            { day: '14', h: 32, active: true },
            { day: '18', h: 64, active: true },
            { day: '19', h: 58, active: true },
            { day: '20', h: 50, active: true },
            { day: '21', h: 8, active: false },
            { day: '28', h: 4, active: false },
            { day: '31', h: 4, active: false },
          ].map((bar, i) => (
            <div key={i} className="flex flex-col items-center gap-1 w-3">
              <div
                className={`w-1.5 rounded-t-sm transition-all ${
                  bar.active ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-neutral-800'
                }`}
                style={{ height: `${bar.h}%` }}
              />
              <span className="text-[7px] text-neutral-500">{bar.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5">
        <h5 className="text-[10px] font-bold text-neutral-300">Personal Records</h5>
        <div className="mt-1 h-6 rounded-[14px] bg-neutral-900 border border-neutral-800" />
      </div>
    </div>

    {/* Bottom Nav Bar */}
    <MoteBottomNav activeTab="workout" />
  </div>
);

// Screen 3: Voice Calendar & Audio Recording
const VoiceCalendarContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-2 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-xs font-bold text-white">
          <span>August 2026</span>
          <ChevronRight className="h-3 w-3 rotate-90" />
        </div>
        <div className="flex gap-1">
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-bold text-white">
            Record
          </span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[8px] font-semibold text-neutral-400">
            Budget
          </span>
        </div>
      </div>

      {/* Total Balance Card */}
      <div className="mt-2 rounded-2xl bg-[#141416] border border-neutral-800 p-2.5">
        <div className="flex items-center justify-between text-[8px] font-bold text-neutral-400">
          <span>TOTAL BALANCE</span>
          <ChevronRight className="h-3 w-3" />
        </div>
        <div className="text-base font-extrabold text-white mt-0.5">
          ₩ 3,728,674
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px]">
          <span className="text-blue-400 font-medium">● Income +₩ 4,000,000</span>
          <span className="text-neutral-400">● Expenses ₩ 271,326</span>
        </div>
      </div>

      {/* Mini Calendar Grid */}
      <div className="mt-2 rounded-[14px] bg-black border border-neutral-900 p-1.5 text-[8px]">
        <div className="grid grid-cols-7 text-center text-[7px] text-neutral-500 font-bold mb-1">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-blue-400">Sat</span><span className="text-red-400">Sun</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[7px]">
          <div className="p-0.5 text-neutral-600">27</div>
          <div className="p-0.5 text-neutral-600">28</div>
          <div className="p-0.5 text-neutral-300">29<br/><span className="text-[6px] text-neutral-500">-16k</span></div>
          <div className="p-0.5 text-neutral-300">30<br/><span className="text-[6px] text-neutral-500">-35k</span></div>
          <div className="p-0.5 text-neutral-300">31<br/><span className="text-[6px] text-neutral-500">-1.2k</span></div>
          <div className="p-0.5 text-blue-300 bg-blue-950/40 rounded">1<br/><span className="text-[6px] text-blue-400">+4M</span></div>
          <div className="p-0.5 text-red-300">2<br/><span className="text-[6px] text-neutral-500">-50k</span></div>
          
          <div className="p-0.5">3</div>
          <div className="p-0.5">4</div>
          <div className="p-0.5">5</div>
          <div className="p-0.5">6</div>
          <div className="p-0.5">7</div>
          <div className="p-0.5 text-blue-400">8</div>
          <div className="p-0.5 text-red-400">9</div>

          <div className="p-0.5">10</div>
          <div className="p-0.5">11</div>
          <div className="p-0.5">12</div>
          <div className="p-0.5">13</div>
          <div className="p-0.5 text-blue-400 font-bold border-b border-blue-400">15</div>
          <div className="p-0.5 text-red-400">16</div>
        </div>
      </div>

      {/* Floating Red Audio Waveform Widget */}
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 p-2.5 shadow-lg shadow-red-950/60">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
            <span>Recording voice...</span>
          </div>
          {/* Waveform */}
          <div className="flex items-end gap-1 h-3">
            {[4, 10, 6, 12, 8, 14, 7, 12, 5, 10, 8].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-white/90 rounded-full animate-pulse"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>
        <button className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-600 shadow-md">
          <div className="h-2.5 w-2.5 rounded bg-red-600" />
        </button>
      </div>
    </div>

    <MoteBottomNav activeTab="expenses" />
  </div>
);

// Screen 4A: Budget Dashboard
const BudgetDashboardContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-3 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between">
        <ChevronLeft className="h-4 w-4 text-neutral-400" />
        <span className="text-[11px] font-bold text-white">Budget Dashboard</span>
        <Mic className="h-3.5 w-3.5 text-neutral-400" />
      </div>

      <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-300 font-semibold">
        <span>August 2026</span>
        <ChevronRight className="h-3 w-3 rotate-90" />
      </div>

      {/* Progress Card */}
      <div className="mt-2 rounded-2xl bg-[#141416] border border-neutral-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-[10px] bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-3 w-3" />
            </div>
            <div>
              <div className="text-[9px] font-bold text-white">Spending Progress</div>
              <div className="text-[8px] text-emerald-400">On Track</div>
            </div>
          </div>
          <span className="text-sm font-black text-emerald-400">14%</span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full w-[14%] rounded-full bg-emerald-500" />
        </div>

        <div className="mt-2 grid grid-cols-3 text-[8px] pt-1 border-t border-neutral-800/80">
          <div>
            <span className="text-neutral-500">Actual</span>
            <div className="font-bold text-neutral-200">₩271,326</div>
          </div>
          <div>
            <span className="text-neutral-500">Limit</span>
            <div className="font-bold text-neutral-200">₩2,000,000</div>
          </div>
          <div>
            <span className="text-neutral-500">Remaining</span>
            <div className="font-bold text-emerald-400">₩1,728,674</div>
          </div>
        </div>
      </div>

      {/* Monthly Expense Budget Breakdown */}
      <div className="mt-2.5 rounded-2xl bg-[#141416] border border-neutral-800 p-2.5 space-y-1.5 text-[8.5px]">
        <div className="flex items-center justify-between text-neutral-300 font-bold border-b border-neutral-800/80 pb-1">
          <span>Monthly Expense Budget</span>
          <span className="text-neutral-400">₩3,400,000 &gt;</span>
        </div>

        <div className="flex items-center justify-between text-neutral-400">
          <span>📦 Fixed Cost</span>
          <span className="text-neutral-200 font-mono">₩600,000 &gt;</span>
        </div>
        <div className="flex items-center justify-between text-neutral-400">
          <span>🚗 Variable Cost</span>
          <span className="text-neutral-200 font-mono">₩600,000 &gt;</span>
        </div>
        <div className="flex items-center justify-between text-neutral-400">
          <span>🍽 Living Expenses</span>
          <span className="text-neutral-200 font-mono">₩800,000 &gt;</span>
        </div>
      </div>
    </div>

    <MoteBottomNav activeTab="expenses" />
  </div>
);

// Screen 4B: Donut Chart Expenses
const ExpensesDonutContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-3 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <ChevronLeft className="h-3 w-3 text-neutral-400" />
        <span className="font-bold text-white">Aug 2026</span>
        <ChevronRight className="h-3 w-3 text-neutral-400" />
      </div>

      <div className="mt-1 flex items-center justify-between border-b border-neutral-800 pb-1">
        <div className="flex gap-2 text-[9px] font-bold">
          <span className="text-red-400 border-b border-red-400 pb-0.5">Expenses</span>
          <span className="text-neutral-500">Income</span>
        </div>
        <span className="text-xs font-black text-white">₩271,326</span>
      </div>

      {/* Donut Chart Illustration */}
      <div className="mt-2 flex justify-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#222" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#EF4444"
              strokeWidth="5"
              strokeDasharray="48 100"
              strokeDashoffset="0"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#06B6D4"
              strokeWidth="5"
              strokeDasharray="32 100"
              strokeDashoffset="-48"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#10B981"
              strokeWidth="5"
              strokeDasharray="14 100"
              strokeDashoffset="-80"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="5"
              strokeDasharray="6 100"
              strokeDashoffset="-94"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-[8px] font-bold text-neutral-400">Total</span>
          </div>
        </div>
      </div>

      {/* Breakdown list */}
      <div className="mt-2 space-y-1 text-[8px]">
        <div className="flex items-center justify-between rounded-lg bg-neutral-900/80 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-red-500/20 px-1 text-red-400 font-bold">48%</span>
            <span className="text-neutral-300">None</span>
          </div>
          <span className="font-mono text-neutral-200">₩130,700</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-neutral-900/80 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-cyan-500/20 px-1 text-cyan-400 font-bold">32%</span>
            <span className="text-neutral-300">EatOut</span>
          </div>
          <span className="font-mono text-neutral-200">₩88,025</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-neutral-900/80 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-emerald-500/20 px-1 text-emerald-400 font-bold">14%</span>
            <span className="text-neutral-300">Food</span>
          </div>
          <span className="font-mono text-neutral-200">₩37,601</span>
        </div>
      </div>
    </div>

    <MoteBottomNav activeTab="expenses" />
  </div>
);

// Screen 5: Daily Plan Colorful Grid
const DailyPlanGridContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-2 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-xs font-bold text-white">
          <span>August 2026</span>
          <ChevronRight className="h-3 w-3 rotate-90" />
        </div>
        <div className="flex rounded-[14px] bg-neutral-800 p-0.5 text-[8px] font-bold">
          <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-white">Personal</span>
          <span className="px-2.5 py-0.5 text-neutral-400">Work</span>
        </div>
      </div>

      {/* Colorful Event Schedule Grid */}
      <div className="mt-2 rounded-[14px] bg-black border border-neutral-800 p-1.5 text-[7px]">
        <div className="grid grid-cols-7 text-center text-neutral-400 font-bold border-b border-neutral-800 pb-1 mb-1">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-blue-400">Sat</span><span className="text-red-400">Sun</span>
        </div>
        <div className="grid grid-cols-7 gap-0.5 font-mono">
          <div className="min-h-[38px] rounded bg-neutral-900/40 p-0.5">
            <span className="text-neutral-600">27</span>
          </div>
          <div className="min-h-[38px] rounded bg-neutral-900/40 p-0.5">
            <span className="text-neutral-600">28</span>
            <div className="text-[6px] text-cyan-300">● New Event</div>
          </div>
          <div className="min-h-[38px] rounded bg-cyan-600/90 text-white p-0.5 leading-tight font-sans font-semibold">
            29
            <div className="text-[6px]">Workshop AI</div>
          </div>
          <div className="min-h-[38px] rounded bg-rose-600/90 text-white p-0.5 leading-tight font-sans font-semibold">
            30
            <div className="text-[6px]">Open AI meet</div>
          </div>
          <div className="min-h-[38px] rounded bg-cyan-600/90 text-white p-0.5 leading-tight font-sans font-semibold">
            31
            <div className="text-[6px]">Pick Groceries</div>
          </div>
          <div className="min-h-[38px] rounded bg-blue-900/40 p-0.5 text-blue-400">1</div>
          <div className="min-h-[38px] rounded bg-red-900/40 p-0.5 text-red-400">2</div>

          {/* Week 2 */}
          <div className="min-h-[38px] rounded bg-neutral-900/40 p-0.5">3</div>
          <div className="min-h-[38px] rounded bg-neutral-900/40 p-0.5">
            4
            <div className="text-[6px] text-cyan-300">● Event</div>
          </div>
          <div className="min-h-[38px] rounded bg-teal-600/90 text-white p-0.5 font-sans font-semibold">
            5
            <div className="text-[6px]">Date mom</div>
          </div>
          <div className="min-h-[38px] rounded bg-blue-600/90 text-white p-0.5 font-sans font-semibold">
            6
            <div className="text-[6px]">Tickets day</div>
          </div>
          <div className="min-h-[38px] rounded bg-rose-600/90 text-white p-0.5 font-sans font-semibold">
            7
            <div className="text-[6px]">Date Jenny</div>
          </div>
          <div className="min-h-[38px] rounded bg-blue-900/40 p-0.5 text-blue-400">8</div>
          <div className="min-h-[38px] rounded bg-red-900/40 p-0.5 text-red-400">9</div>
        </div>
      </div>
    </div>

    <MoteBottomNav activeTab="tasks" />
  </div>
);

// Screen 6A: Shift Selector Modal
const ShiftSelectorModalContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-3 pt-2 text-left bg-[#101014]">
    <div>
      <div className="flex items-center justify-between text-[10px] text-neutral-400 border-b border-neutral-800 pb-1.5">
        <div>
          <span className="text-[9px] font-bold text-white">Select Shift</span>
          <div className="text-[8px] text-neutral-400">Friday, August 21</div>
        </div>
        <X className="h-3.5 w-3.5 text-neutral-400" />
      </div>

      {/* Shift 4 Grid Cards */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#E67E22] p-2.5 text-white shadow-md">
          <div className="text-amber-100 text-sm">☀️</div>
          <div className="mt-1 text-[10px] font-bold">Day</div>
          <div className="text-[8px] text-amber-100">8:00–16:00</div>
        </div>

        <div className="rounded-2xl bg-[#5C45D8] p-2.5 text-white shadow-md">
          <div className="text-indigo-200 text-sm">🌙</div>
          <div className="mt-1 text-[10px] font-bold">Night</div>
          <div className="text-[8px] text-indigo-200">22:00–06:00</div>
        </div>

        <div className="rounded-2xl bg-[#27AE60] p-2.5 text-white shadow-md">
          <div className="text-emerald-100 text-sm">✓</div>
          <div className="mt-1 text-[10px] font-bold">Off</div>
          <div className="text-[8px] text-emerald-100">Rest day</div>
        </div>

        <div className="rounded-2xl bg-[#1C1C22] border border-neutral-700 p-2.5 text-neutral-300 flex flex-col justify-between">
          <div className="text-neutral-400 text-sm">+</div>
          <div className="text-[10px] font-bold">Custom</div>
          <div className="text-[8px] text-neutral-500">Set hours</div>
        </div>
      </div>

      <button className="mt-4 flex w-full items-center justify-center rounded-[14px] bg-blue-600 py-2 text-[10px] font-bold text-white shadow-md shadow-blue-600/30">
        Done
      </button>
    </div>

    <MoteBottomNav activeTab="shift" />
  </div>
);

// Screen 6B: Cycle Tracker
const CycleTrackerContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-3 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-white">
        <span>August 2026</span>
        <Settings className="h-3.5 w-3.5 text-neutral-400" />
      </div>

      {/* Period Pills */}
      <div className="mt-2 flex gap-2">
        <div className="flex-1 rounded-2xl bg-[#1F1618] border border-rose-900/50 p-2 text-[8px]">
          <div className="flex items-center gap-1 text-rose-400 font-bold">
            <span>🩸 Aug 13, 2026</span>
          </div>
          <div className="text-[7px] text-neutral-400">Period Start</div>
        </div>
        <div className="flex-1 rounded-2xl bg-[#1F1618] border border-rose-900/50 p-2 text-[8px]">
          <div className="flex items-center gap-1 text-rose-400 font-bold">
            <span>🩸 Aug 17, 2026</span>
          </div>
          <div className="text-[7px] text-neutral-400">Period End</div>
        </div>
      </div>

      <div className="mt-2 rounded-[14px] bg-black border border-neutral-800 p-2 text-[7px]">
        <div className="grid grid-cols-7 text-center text-neutral-500 font-bold mb-1">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-blue-400">Sat</span><span className="text-red-400">Sun</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-mono">
          <span className="text-neutral-600">27</span>
          <span className="text-neutral-600">28</span>
          <span>29</span>
          <span>30</span>
          <span>31</span>
          <span className="text-blue-400">1</span>
          <span className="text-red-400">2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
          <span>6</span>
          <span>7</span>
          <span className="text-blue-400">8</span>
          <span className="text-red-400">9</span>
          <span>10</span>
          <span>11</span>
          <span>12</span>
          <span className="text-rose-400 font-bold bg-rose-950/60 rounded">13●</span>
          <span className="text-rose-400">14●</span>
          <span className="text-blue-400">15</span>
          <span className="text-red-400">16</span>
        </div>
      </div>
    </div>

    <MoteBottomNav activeTab="cycle" />
  </div>
);

// Screen 7: Multilingual Month View
const MultilingualMonthContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-2 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-xs font-bold text-white">
          <span>June 2026</span>
          <ChevronRight className="h-3 w-3 rotate-90" />
        </div>
        <div className="flex rounded-[14px] bg-neutral-800 p-0.5 text-[8px] font-bold">
          <span className="px-2 py-0.5 text-neutral-400">Personal</span>
          <span className="px-2 py-0.5 text-neutral-400">Work</span>
          <span className="rounded-lg bg-blue-600 px-2 py-0.5 text-white">Both</span>
        </div>
      </div>

      <div className="mt-2 rounded-[14px] bg-black border border-neutral-800 p-1.5 text-[7px]">
        <div className="grid grid-cols-7 text-center text-neutral-500 font-bold border-b border-neutral-800 pb-1 mb-1">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-blue-400">Sat</span><span className="text-red-400">Sun</span>
        </div>
        <div className="grid grid-cols-7 gap-0.5 font-sans">
          <div className="p-0.5 rounded bg-neutral-900/60 text-white">
            1
            <div className="text-[6px] text-neutral-400">Work</div>
          </div>
          <div className="p-0.5 rounded bg-neutral-900/60 text-white">
            2
            <div className="text-[6px] text-blue-300">Meeting</div>
          </div>
          <div className="p-0.5 rounded bg-amber-950/60 text-amber-200">
            3
            <div className="text-[6px]">Day off / 지방</div>
          </div>
          <div className="p-0.5 rounded bg-emerald-950/60 text-emerald-200">
            4
            <div className="text-[6px]">✓ Res...</div>
          </div>
          <div className="p-0.5 rounded bg-neutral-900/60 text-white">
            5
            <div className="text-[6px] text-cyan-300">Fix bug</div>
          </div>
          <div className="p-0.5 rounded bg-blue-950/60 text-blue-300">
            6
            <div className="text-[6px]">현충일</div>
          </div>
          <div className="p-0.5 rounded bg-red-950/60 text-red-300">
            7
            <div className="text-[6px]">Smile</div>
          </div>

          {/* Row 2 */}
          <div className="p-0.5 rounded bg-blue-950/60 text-blue-200">
            15
            <div className="text-[6px]">Создать...</div>
          </div>
          <div className="p-0.5">16</div>
          <div className="p-0.5 text-cyan-300">17</div>
          <div className="p-0.5">18</div>
          <div className="p-0.5">19</div>
          <div className="p-0.5 text-blue-400">20</div>
          <div className="p-0.5 text-red-400">21</div>
        </div>
      </div>
    </div>

    {/* Floating Mic Button */}
    <div className="relative">
      <div className="absolute right-2 -top-10 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40">
        <Mic className="h-4 w-4" />
      </div>
      <MoteBottomNav activeTab="tasks" />
    </div>
  </div>
);

// Screen 8: Sync Settings (Light & Dark)
const SyncSettingsContent: React.FC<{ isLight: boolean }> = ({ isLight }) => (
  <div
    className={`flex flex-1 flex-col justify-between px-3 pt-2 text-left ${
      isLight ? 'bg-white text-neutral-900' : 'bg-[#0E0E12] text-white'
    }`}
  >
    <div>
      <div className="flex items-center justify-between text-xs font-bold">
        <span>June 2026</span>
        <Settings className="h-3.5 w-3.5 opacity-60" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div
          className={`rounded-2xl p-3 flex flex-col justify-between h-20 ${
            isLight ? 'bg-[#F2F2F7]' : 'bg-[#1C1C22]'
          }`}
        >
          <div className="h-4 w-4 opacity-70">👤</div>
          <div className="text-[9px] font-bold">Account Setting</div>
        </div>

        <div
          className={`rounded-2xl p-3 flex flex-col justify-between h-20 ${
            isLight ? 'bg-[#F2F2F7]' : 'bg-[#1C1C22]'
          }`}
        >
          <Settings className="h-4 w-4 opacity-70" />
          <div className="text-[9px] font-bold">Calendar Setting</div>
        </div>

        <div
          className={`rounded-2xl p-3 flex flex-col justify-between h-20 relative ${
            isLight ? 'bg-[#F2F2F7]' : 'bg-[#1C1C22]'
          }`}
        >
          {!isLight && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
          )}
          <Moon className="h-4 w-4 opacity-70" />
          <div className="text-[9px] font-bold">Dark Mode</div>
        </div>

        <div
          className={`rounded-2xl p-3 flex flex-col justify-between h-20 ${
            isLight ? 'bg-[#F2F2F7]' : 'bg-[#1C1C22]'
          }`}
        >
          <LayoutGrid className="h-4 w-4 opacity-70" />
          <div className="text-[9px] font-bold">Widget Setting</div>
        </div>
      </div>

      {/* Cloud Sync Status */}
      <div
        className={`mt-3 flex items-center justify-between rounded-2xl p-3 ${
          isLight ? 'bg-[#F2F2F7]' : 'bg-[#1C1C22]'
        }`}
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          <div>
            <div className="text-[9px] font-bold">Cloud Sync</div>
            <div className="text-[7.5px] opacity-60">12m ago</div>
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
      </div>
    </div>

    <div className="flex justify-center pb-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
        <X className="h-4 w-4" />
      </div>
    </div>
  </div>
);

// Screen 9: Diary & Notes View
const DiaryNotesContent: React.FC = () => (
  <div className="flex flex-1 flex-col justify-between px-2 pt-1 text-left">
    <div>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 text-xs font-bold text-white">
          <span>August 2026</span>
          <ChevronRight className="h-3 w-3 rotate-90" />
        </div>
        <Settings className="h-3.5 w-3.5 text-neutral-400" />
      </div>

      <div className="mt-2 flex rounded-[14px] bg-neutral-900 border border-neutral-800 p-0.5 text-[8.5px] font-bold">
        <span className="flex-1 rounded-lg bg-blue-600 py-1 text-center text-white flex items-center justify-center gap-1">
          <BookOpen className="h-3 w-3" />
          <span>Diary</span>
        </span>
        <span className="flex-1 py-1 text-center text-neutral-400 flex items-center justify-center gap-1">
          <span>Notes</span>
        </span>
      </div>

      {/* Diary Calendar Grid */}
      <div className="mt-2 rounded-[14px] bg-black border border-neutral-800 p-1.5 text-[7.5px]">
        <div className="grid grid-cols-7 text-center text-neutral-500 font-bold border-b border-neutral-800 pb-1 mb-1">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-blue-400">Sat</span><span className="text-red-400">Sun</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-mono">
          <span className="text-neutral-600">27</span>
          <span className="text-neutral-600">28</span>
          <span>29</span>
          <span>30</span>
          <span>31</span>
          <span className="text-blue-400">1</span>
          <span className="text-red-400">2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
          <span>6</span>
          <span>7</span>
          <span className="text-blue-400">8</span>
          <span className="text-red-400">9</span>
          <span>10</span>
          <span>11</span>
          <span>12</span>
          <span>13</span>
          <span>14</span>
          <span className="text-blue-400 font-bold border-b-2 border-blue-500">15</span>
          <span className="text-red-400">16</span>
          <span>17</span>
          <span>18</span>
          <span>19</span>
          <span>20</span>
          <span>21</span>
          <span className="text-blue-400">22</span>
          <span className="text-red-400">23</span>
        </div>
      </div>
    </div>

    <div className="relative">
      <div className="absolute right-2 -top-10 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40">
        <Mic className="h-4 w-4" />
      </div>
      <MoteBottomNav activeTab="diary" />
    </div>
  </div>
);

// Global Bottom Navigation Bar for Mote App
const MoteBottomNav: React.FC<{ activeTab: 'tasks' | 'expenses' | 'diary' | 'cycle' | 'shift' | 'workout' }> = ({
  activeTab,
}) => (
  <div className="flex h-11 items-center justify-between border-t border-neutral-800/80 bg-black/90 px-2 text-[8px] font-semibold text-neutral-500">
    <div className={`flex flex-col items-center gap-0.5 ${activeTab === 'tasks' ? 'text-white' : ''}`}>
      <Calendar className="h-3.5 w-3.5" />
      <span>Tasks</span>
    </div>
    <div className={`flex flex-col items-center gap-0.5 ${activeTab === 'expenses' ? 'text-white' : ''}`}>
      <CreditCard className="h-3.5 w-3.5" />
      <span>Expenses</span>
    </div>
    <div className={`flex flex-col items-center gap-0.5 ${activeTab === 'diary' ? 'text-white' : ''}`}>
      <BookOpen className="h-3.5 w-3.5" />
      <span>Diary</span>
    </div>
    <div className={`flex flex-col items-center gap-0.5 ${activeTab === 'cycle' ? 'text-white' : ''}`}>
      <Heart className="h-3.5 w-3.5" />
      <span>Cycle</span>
    </div>
    <div className={`flex flex-col items-center gap-0.5 ${activeTab === 'shift' ? 'text-white' : ''}`}>
      <Clock className="h-3.5 w-3.5" />
      <span>Shift</span>
    </div>
    <div className={`flex flex-col items-center gap-0.5 ${activeTab === 'workout' ? 'text-white' : ''}`}>
      <Dumbbell className="h-3.5 w-3.5" />
      <span>Workout</span>
    </div>
  </div>
);

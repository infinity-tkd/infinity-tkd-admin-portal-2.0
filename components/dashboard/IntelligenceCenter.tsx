'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Student } from '@/lib/store';
import type { PromotionReadinessReport } from '@/lib/utils';
import type { TranslatorFn } from '@/hooks/useTranslation';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { cn } from '@/lib/utils';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { Crown } from '@phosphor-icons/react/dist/csr/Crown';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { Flame } from '@phosphor-icons/react/dist/csr/Flame';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { SafeImage } from '@/components/SafeImage';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';

export interface IntelligenceCenterProps {
  activeCount: number;
  attendanceDensityStats: { optimalDay: string; optimalRate: number; lowDay: string; lowRate: number; };
  beltDistribution: { count: number; pct: number; key: string; name: string; color: string; barColor: string; }[];
  canViewFinancials: boolean;
  churnFilter: "all" | "high" | "medium";
  churnHazardRoster: { student: Student; daysSinceLastClass: number; lastDate: string; riskLevel: "High" | "Medium" | "Stable"; cpi: number; estimatedMissedClasses: number; recommendedAction: string; expectedWeeklyFrequency: number; }[];
  churnSearch: string;
  expectedMonthlyRevenue: number;
  filteredChurnHazards: { student: Student; daysSinceLastClass: number; lastDate: string; riskLevel: "High" | "Medium" | "Stable"; cpi: number; estimatedMissedClasses: number; recommendedAction: string; expectedWeeklyFrequency: number; }[];
  filteredPriCandidates: { student: Student; attendanceRate: number; syllabusProgress: number; completedCount: number; pri: number; rank: "Gold" | "Silver" | "Bronze"; report: PromotionReadinessReport; }[];
  financialForecast: { expected: number; actual: number; predicted: number; historicalEfficiencyRate: number; churnRatioPct: number; };
  forecastChartData: { svgCoords: string; lastCircleY: number; shadowPath: string; };
  forecastChurnRate: number;
  getWhatsAppOutreachUrl: (student: Student, daysSince: number) => string | null;
  healthScoreMetrics: { overall: number; statusText: string; statusColor: string; badgeBg: string; turnoutScore: number; financialScore: number; testingPipelineScore: number; retentionScore: number; goldCount: number; silverCount: number; bronzeCount: number; highRiskCount: number; mediumRiskCount: number; };
  predictedRevenueDynamic: number;
  priRankFilter: "Gold" | "Silver" | "Bronze" | "all";
  priSearch: string;
  promotionReadinessRoster: { student: Student; attendanceRate: number; syllabusProgress: number; completedCount: number; pri: number; rank: "Gold" | "Silver" | "Bronze"; report: PromotionReadinessReport; }[];
  setActiveHelpSection: Dispatch<SetStateAction<"revenue" | "turnout" | "promotion" | "retention" | null>>;
  setChurnFilter: Dispatch<SetStateAction<"all" | "high" | "medium">>;
  setChurnSearch: Dispatch<SetStateAction<string>>;
  setForecastChurnRate: Dispatch<SetStateAction<number>>;
  setPriRankFilter: Dispatch<SetStateAction<"Gold" | "Silver" | "Bronze" | "all">>;
  setPriSearch: Dispatch<SetStateAction<string>>;
  t: TranslatorFn;
  translateBeltFormatted: (beltName: string, dob?: string | undefined) => string;
  weeklyDensityBarData: { dayName: string; rate: number; count: any; }[];
}

export function IntelligenceCenter({ activeCount, attendanceDensityStats, beltDistribution, canViewFinancials, churnFilter, churnHazardRoster, churnSearch, expectedMonthlyRevenue, filteredChurnHazards, filteredPriCandidates, financialForecast, forecastChartData, forecastChurnRate, getWhatsAppOutreachUrl, healthScoreMetrics, predictedRevenueDynamic, priRankFilter, priSearch, promotionReadinessRoster, setActiveHelpSection, setChurnFilter, setChurnSearch, setForecastChurnRate, setPriRankFilter, setPriSearch, t, translateBeltFormatted, weeklyDensityBarData }: IntelligenceCenterProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Executive Header: Academy AI Health Score & 4 Core Pillars */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 lg:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-neutral-200 dark:border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <Sparkle className="w-5 h-5 text-brand-ink" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono font-bold text-brand-ink">{t('dash_tab_intelligence')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight">
                {t('dash_academy_health_score')}
              </h2>
            </div>
          </div>

          {/* Health Score Metric & Badge */}
          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2D2D2D] px-3.5 py-2 rounded-[8px]">
            <div className="flex items-baseline gap-1">
              <span className={cn("text-2xl font-black font-mono tracking-tight", healthScoreMetrics.statusColor)}>
                {healthScoreMetrics.overall}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-neutral-400">/100</span>
            </div>
            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
            <span className={cn("px-2 py-0.5 rounded text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider font-mono border", healthScoreMetrics.badgeBg)}>
              {healthScoreMetrics.statusText}
            </span>
          </div>
        </div>

        {/* 4 Pillars Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          {/* Pillar 1: Turnout */}
          <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                {t('dash_health_turnout')}
              </span>
              <span className="text-xs sm:text-[13px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {healthScoreMetrics.turnoutScore}%
              </span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${healthScoreMetrics.turnoutScore}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
              Optimal: <strong className="text-neutral-700 dark:text-neutral-300">{attendanceDensityStats.optimalDay}</strong> ({attendanceDensityStats.optimalRate}%)
            </span>
          </div>

          {/* Pillar 2: Financial Compliance */}
          <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-500" />
                {t('dash_health_finance')}
              </span>
              <span className="text-xs sm:text-[13px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {healthScoreMetrics.financialScore}%
              </span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${healthScoreMetrics.financialScore}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
              Collected: <strong className="text-neutral-700 dark:text-neutral-300">${financialForecast.actual.toFixed(0)}</strong> / ${expectedMonthlyRevenue.toFixed(0)}
            </span>
          </div>

          {/* Pillar 3: Testing Pipeline */}
          <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                {t('dash_health_pipeline')}
              </span>
              <span className="text-xs sm:text-[13px] font-mono font-bold text-amber-600 dark:text-amber-400">
                {healthScoreMetrics.testingPipelineScore}%
              </span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${healthScoreMetrics.testingPipelineScore}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
              Ready: <strong className="text-amber-600 dark:text-amber-400">{healthScoreMetrics.goldCount} Gold</strong>, {healthScoreMetrics.silverCount} Silver
            </span>
          </div>

          {/* Pillar 4: Retention Guard */}
          <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[9.5px] uppercase tracking-wider font-mono font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-ink" />
                {t('dash_health_retention')}
              </span>
              <span className={cn("text-xs sm:text-[13px] font-mono font-bold", healthScoreMetrics.highRiskCount > 0 ? "text-brand-ink" : "text-green-600 dark:text-green-400")}>
                {healthScoreMetrics.retentionScore}%
              </span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden mt-2.5">
              <div
                className={cn("h-full rounded-full transition-all duration-500", healthScoreMetrics.highRiskCount > 0 ? "bg-brand" : "bg-green-500")}
                style={{ width: `${healthScoreMetrics.retentionScore}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5 truncate">
              Hazards: <strong className={healthScoreMetrics.highRiskCount > 0 ? "text-brand-ink" : "text-neutral-700 dark:text-neutral-300"}>{healthScoreMetrics.highRiskCount} High</strong>, {healthScoreMetrics.mediumRiskCount} Med
            </span>
          </div>
        </div>
      </div>

      {/* Row 1 - Top Analytics & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Module 1: Revenue Forecast Slider & Chart */}
        {canViewFinancials && (
          <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-2">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-brand-ink font-mono font-bold">{t('dash_predictive_analytics')}</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] flex items-center gap-1.5 leading-none">
                  {t('dash_tuition_cashflow_forecast')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveHelpSection('revenue')}
                className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Guide"
              >
                <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] shadow-sm">
                  <span className="text-[9px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-mono block mb-0.5">{t('dash_expected_revenue')}</span>
                  <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-neutral-900 dark:text-white">${expectedMonthlyRevenue.toFixed(0)}</span>
                </div>
                <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] shadow-sm">
                  <span className="text-[9px] uppercase tracking-widest text-brand-ink font-mono block mb-0.5">{t('dash_simulated_forecast')}</span>
                  <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-brand-ink">${predictedRevenueDynamic.toFixed(0)}</span>
                </div>
              </div>

              {/* Scenario Presets */}
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 font-mono block">Scenario Presets</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { label: t('dash_scenario_baseline'), rate: 5 },
                    { label: t('dash_scenario_exam'), rate: 15 },
                    { label: t('dash_scenario_holiday'), rate: 25 },
                    { label: t('dash_scenario_stress'), rate: 40 },
                  ].map(sc => (
                    <button
                      key={sc.rate}
                      type="button"
                      onClick={() => setForecastChurnRate(sc.rate)}
                      className={cn(
                        "px-1.5 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider border transition-all text-center cursor-pointer",
                        forecastChurnRate === sc.rate
                          ? "bg-brand text-white border-brand shadow-sm"
                          : "bg-white dark:bg-[#0F0F0F] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-[#262626] hover:border-neutral-400 dark:hover:border-neutral-600"
                      )}
                    >
                      {sc.label} ({sc.rate}%)
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Churn simulation slider */}
              <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] shadow-sm space-y-1.5">
                <div className="flex justify-between text-[9px] uppercase font-bold text-neutral-500 font-mono">
                  <span>Simulated Churn Stress</span>
                  <span className="text-brand-ink font-bold">{forecastChurnRate}% Loss Multiplier</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={forecastChurnRate}
                  onChange={(e) => setForecastChurnRate(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 sm:h-2 bg-neutral-100 dark:bg-[#1A1A1A] rounded-[8px] appearance-none cursor-pointer accent-brand outline-none"
                />
              </div>

              {/* Render simulated line chart */}
              <div className="h-[95px] sm:h-[110px] flex items-center justify-center relative overflow-hidden select-none">
                <svg className="w-full h-full" viewBox="0 0 220 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="confidenceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF2F38" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#EF2F38" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="220" y2="20" stroke="rgba(128,128,128,0.08)" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="0" y1="45" x2="220" y2="45" stroke="rgba(128,128,128,0.08)" strokeWidth="0.5" />
                  <line x1="0" y1="70" x2="220" y2="70" stroke="rgba(128,128,128,0.08)" strokeWidth="0.5" strokeDasharray="3,3" />

                  {/* Confidence area bounds */}
                  <path
                    d={forecastChartData.shadowPath}
                    fill="url(#confidenceAreaGrad)"
                    className="transition-all duration-300"
                  />

                  {/* Revenue Line */}
                  <polyline
                    fill="none"
                    stroke="#EF2F38"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={forecastChartData.svgCoords}
                    className="drop-shadow-[0_2px_4px_rgba(239,47,56,0.15)]"
                  />
                  <circle cx="218" cy={forecastChartData.lastCircleY} r="3.5" fill="#EF2F38" className="animate-ping" />
                  <circle cx="218" cy={forecastChartData.lastCircleY} r="2.5" fill="#EF2F38" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Module 2: Turnout Weekly Density heatmaps */}
        <div className={cn("bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between", canViewFinancials ? "lg:col-span-2" : "lg:col-span-3")}>
          <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-2">
            <div className="space-y-0.5">
              <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-indigo-500 font-mono font-bold">{t('dash_attendance_heatmap_model')}</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] leading-none">{t('dash_cohort_turnout_density')}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveHelpSection('turnout')}
              className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Guide"
            >
              <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Day stats highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/20 p-2.5 rounded-[8px]">
              <div>
                <span className="block text-[9px] text-green-700 dark:text-green-400 font-mono uppercase tracking-wider font-bold leading-none">{t('dash_optimal_training_day')}</span>
                <span className="text-xs font-bold text-neutral-800 dark:text-white leading-none mt-1 block">{attendanceDensityStats.optimalDay}</span>
              </div>
              <span className="text-sm sm:text-base font-bold text-green-600 dark:text-green-400 font-mono leading-none">{attendanceDensityStats.optimalRate}%</span>
            </div>

            <div className="flex justify-between items-center bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 p-2.5 rounded-[8px]">
              <div>
                <span className="block text-[9px] text-red-700 dark:text-red-400 font-mono uppercase tracking-wider font-bold leading-none">{t('dash_at_risk_density_day')}</span>
                <span className="text-xs font-bold text-neutral-800 dark:text-white leading-none mt-1 block">{attendanceDensityStats.lowDay}</span>
              </div>
              <span className="text-sm sm:text-base font-bold text-red-600 dark:text-red-400 font-mono leading-none">{attendanceDensityStats.lowRate}%</span>
            </div>
          </div>

          {/* Mat Congestion Alert (if any day rate >= 80%) */}
          {attendanceDensityStats.optimalRate >= 80 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/25 px-3 py-2 rounded-[8px] flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-[9px] sm:text-[10px] text-amber-800 dark:text-amber-300 font-mono">
                <strong>{t('dash_mat_congestion_alert')}:</strong> {attendanceDensityStats.optimalDay} reaches {attendanceDensityStats.optimalRate}% mat capacity. Consider splitting sessions or adding coach support.
              </span>
            </div>
          )}

          {/* Weekly density bars */}
          <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 sm:p-4 rounded-[8px] shadow-sm">
            <div className="flex items-end justify-between h-24 sm:h-28 pt-3 pb-0.5">
              {weeklyDensityBarData.map((d, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 group space-y-1.5">
                  <div className="w-6 sm:w-8 md:w-10 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-[#262626] rounded-t-[8px] h-18 sm:h-22 flex items-end overflow-hidden relative">
                    <div
                      className={cn(
                        "w-full rounded-t-[8px] transition-all duration-500",
                        d.rate >= 80 ? "bg-green-500/85 group-hover:bg-green-500" :
                        d.rate >= 65 ? "bg-amber-500/85 group-hover:bg-amber-500" :
                        "bg-red-500/85 group-hover:bg-red-500"
                      )}
                      style={{ height: `${d.rate || 6}%` }}
                    />
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-bold font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-1 rounded shadow pointer-events-none">
                      {d.rate}%
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-600 dark:text-neutral-400 font-mono">{d.dayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 - Advanced analysis lists (Readiness candidates + Churn hazard list) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Module 3: Promotion Readiness candidates list */}
        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex flex-col gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-amber-500 font-mono font-bold">{t('dash_promotion_readiness_engine')}</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] leading-none">{t('dash_testing_eligibility_candidates')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveHelpSection('promotion')}
                className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Guide"
              >
                <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Filter Pills with Counts & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {[
                  { key: 'all', label: t('dash_all_tiers'), count: promotionReadinessRoster.length },
                  { key: 'Gold', label: t('dash_gold_only'), count: healthScoreMetrics.goldCount },
                  { key: 'Silver', label: t('dash_silver_only'), count: healthScoreMetrics.silverCount },
                  { key: 'Bronze', label: t('dash_bronze_only'), count: healthScoreMetrics.bronzeCount },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPriRankFilter(tab.key as any)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] sm:text-[9.5px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap",
                      priRankFilter === tab.key
                        ? "bg-amber-500 text-amber-950 font-black border-amber-500 shadow-sm"
                        : "bg-white dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Candidate Search Box */}
              <div className="relative min-w-[150px] sm:min-w-[180px]">
                <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={priSearch}
                  onChange={(e) => setPriSearch(e.target.value)}
                  placeholder={t('dash_search_candidates')}
                  className="w-full bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded px-2.5 pl-7 py-1 text-[10px] sm:text-xs font-mono text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-brand"
                />
                {priSearch && (
                  <button
                    type="button"
                    onClick={() => setPriSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Candidates Roster */}
          <div className="space-y-2 max-h-[300px] sm:max-h-[360px] overflow-y-auto pr-1">
            {filteredPriCandidates.map(candidate => {
              const report = (candidate as any).report;
              return (
                <div key={candidate.student.id} className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
                  {/* Student Identity */}
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <SafeImage
                      src={candidate.student.profilePicturePath}
                      alt={candidate.student.englishName}
                      containerClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                      fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px] sm:text-xs">{candidate.student.englishName.charAt(0)}</span>}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-none">{candidate.student.englishName}</h4>
                        {candidate.student.khmerName && (
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans leading-none">{candidate.student.khmerName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-brand-ink dark:text-red-400 font-mono uppercase tracking-wider font-bold leading-none">
                          {translateBeltFormatted(candidate.student.currentBelt, candidate.student.dob)}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-mono leading-none">• {candidate.student.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantitative Progress Pills & Status */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 w-full lg:w-auto border-t lg:border-t-0 border-neutral-100 dark:border-[#1A1A1A] pt-1.5 lg:pt-0">
                    {/* 4 Pillars Explicit Badges */}
                    <div className="flex flex-wrap gap-1 sm:gap-1.5">
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[9px] font-mono", report?.daysEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Time in Grade">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>{report?.daysElapsed}/{report?.daysRequired}d</span>
                      </span>
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[9px] font-mono", report?.attendanceEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Attendance Count">
                        <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>{report?.attendanceSince}/{report?.attendanceRequired}</span>
                      </span>
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[9px] font-mono", report?.syllabusEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Syllabus Progress">
                        <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>{report?.syllabusCompletedPct}%</span>
                      </span>
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#252525] flex items-center gap-1 text-[9px] font-mono", report?.physicalEligible ? "text-green-700 dark:text-green-400 font-bold" : "text-neutral-500 dark:text-neutral-400")} title="Physical Skills">
                        <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>{report?.skillsGradedCount}/{report?.totalSkillsCount}</span>
                      </span>
                    </div>

                    {/* Candidate Readiness Rank */}
                    <div className="shrink-0">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border font-mono",
                        candidate.rank === 'Gold' ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                        candidate.rank === 'Silver' ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" :
                        "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                      )}>
                        {t(`dash_${candidate.rank.toLowerCase()}_candidate` as any)} ({candidate.pri}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPriCandidates.length === 0 && (
              <div className="text-center py-8 border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1">
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-mono italic">{t('dash_no_promotion_candidates')}</p>
                {priSearch && (
                  <button
                    type="button"
                    onClick={() => setPriSearch('')}
                    className="text-[9px] sm:text-xs text-brand-ink hover:underline font-mono font-bold"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Module 4: Churn Hazard Roster with actions */}
        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex flex-col gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-brand-ink font-mono font-bold">{t('dash_retentivity_analyzer')}</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] leading-none">{t('dash_student_churn_hazard')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveHelpSection('retention')}
                className="p-1.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Guide"
              >
                <Question className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Filter Pills with Counts & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {[
                  { key: 'all', label: t('dash_all_risks'), count: churnHazardRoster.length },
                  { key: 'high', label: 'High Risk', count: healthScoreMetrics.highRiskCount },
                  { key: 'medium', label: 'Medium', count: healthScoreMetrics.mediumRiskCount },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setChurnFilter(tab.key as any)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] sm:text-[9.5px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap",
                      churnFilter === tab.key
                        ? "bg-brand text-white border-brand shadow-sm"
                        : "bg-white dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Hazard Search Box */}
              <div className="relative min-w-[150px] sm:min-w-[180px]">
                <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={churnSearch}
                  onChange={(e) => setChurnSearch(e.target.value)}
                  placeholder={t('dash_search_hazards')}
                  className="w-full bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded px-2.5 pl-7 py-1 text-[10px] sm:text-xs font-mono text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-brand"
                />
                {churnSearch && (
                  <button
                    type="button"
                    onClick={() => setChurnSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hazard List */}
          <div className="space-y-2 max-h-[300px] sm:max-h-[360px] overflow-y-auto pr-1">
            {filteredChurnHazards.map(hazard => {
              const isHigh = hazard.riskLevel === 'High';
              const whatsAppUrl = getWhatsAppOutreachUrl(hazard.student, hazard.daysSinceLastClass);

              return (
                <div key={hazard.student.id} className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-neutral-300 dark:hover:border-[#383838] transition-all">
                  {/* Student Details */}
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <SafeImage
                      src={hazard.student.profilePicturePath}
                      alt={hazard.student.englishName}
                      containerClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                      fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px] sm:text-xs">{hazard.student.englishName.charAt(0)}</span>}
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-none">{hazard.student.englishName}</h4>
                        {hazard.student.khmerName && (
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-sans leading-none">{hazard.student.khmerName}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono">
                        <span>Last Class: {hazard.lastDate === 'Never' ? 'Never' : hazard.lastDate}</span>
                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                        <span className="text-brand-ink font-bold">{hazard.daysSinceLastClass}d inactive</span>
                      </div>
                      <div className="text-[9px] sm:text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono leading-none">
                        Missed: <strong className="text-neutral-700 dark:text-neutral-300">{hazard.estimatedMissedClasses} classes</strong> (Expected {hazard.expectedWeeklyFrequency}x/wk)
                      </div>
                    </div>
                  </div>

                  {/* CRM Outreach Action Details */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-neutral-100 dark:border-[#1A1A1A] pt-2 sm:pt-0">
                    <div className="flex flex-col items-start sm:items-end leading-none">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider border font-mono",
                        isHigh ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25" :
                        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                      )}>
                        CPI: {hazard.cpi}% ({hazard.riskLevel})
                      </span>
                    </div>

                    {/* Action buttons: WhatsApp & Call */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {whatsAppUrl && (
                        <a
                          href={whatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 min-h-[28px] bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-transparent rounded-[6px] text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                          title="Direct WhatsApp check-in"
                        >
                          <PaperPlaneTilt className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      {hazard.student.emergencyContactPhone && (
                        <a
                          href={`tel:${hazard.student.emergencyContactPhone}`}
                          className="px-2.5 py-1 min-h-[28px] bg-brand/10 hover:bg-brand text-brand-ink hover:text-white border border-brand/20 hover:border-transparent rounded-[6px] text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                          title={`Call: ${hazard.student.emergencyContactPhone}`}
                        >
                          <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>{t('dash_call')}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredChurnHazards.length === 0 && (
              <div className="text-center py-8 border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-1">
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-mono italic">{t('dash_no_churn_detected')}</p>
                {churnSearch && (
                  <button
                    type="button"
                    onClick={() => setChurnSearch('')}
                    className="text-[9px] sm:text-xs text-brand-ink hover:underline font-mono font-bold"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Module 5: Belt Pyramid & Academy Demographic Funnel */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 lg:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2.5">
          <div className="space-y-0.5">
            <span className="text-[9px] sm:text-[9.5px] uppercase tracking-widest text-brand-ink font-mono font-bold">Pipeline Diagnostics</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-[#E4E4E4] flex items-center gap-1.5 leading-none">
              <ChartBar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-ink" />
              {t('dash_belt_demographics')}
            </h3>
          </div>
          <span className="text-[9px] sm:text-[9.5px] font-mono font-bold text-neutral-500 dark:text-neutral-400">
            {activeCount} Active Students Total
          </span>
        </div>

        {/* Belt Distribution Funnel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {beltDistribution.map(belt => (
            <div key={belt.key} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 sm:p-3 rounded-[8px] space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] sm:text-[9.5px] font-bold font-mono uppercase tracking-wider", belt.color)}>
                  {belt.name}
                </span>
                <span className="text-xs sm:text-sm font-bold font-mono text-neutral-900 dark:text-white">
                  {belt.count}
                </span>
              </div>
              <div className="space-y-1">
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 sm:h-2 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", belt.barColor)}
                    style={{ width: `${belt.pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                  <span>Roster Share</span>
                  <strong className="text-neutral-700 dark:text-neutral-300">{belt.pct}%</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

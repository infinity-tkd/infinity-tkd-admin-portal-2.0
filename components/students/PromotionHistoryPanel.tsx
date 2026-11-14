'use client';
import React from 'react';
import { useAppStore, BeltHistory } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';


interface PromotionHistoryPanelProps {
  t: ReturnType<typeof useT>;
  filteredHistory: BeltHistory[];
  historySearch: string;
  setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
  filterBranchHistory: number | "all";
  setFilterBranchHistory: React.Dispatch<React.SetStateAction<number | "all">>;
  state: ReturnType<typeof useAppStore>['state'];
  filterBeltHistory: string;
  setFilterBeltHistory: React.Dispatch<React.SetStateAction<string>>;
  BELT_RANK_ORDER: readonly string[];
  filterProgramHistory: string;
  setFilterProgramHistory: React.Dispatch<React.SetStateAction<string>>;
  handleExportHistoryCsv: () => void;
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  handleCopyLink: (historyId: number, url: string) => void;
  copiedHistoryId: number | null;
  handleOpenEditHistory: (h: BeltHistory) => void;
  isDeletingHistory: number | null;
  handleVoidPromotion: (historyId: number) => Promise<void>;
}

export function PromotionHistoryPanel({ t, filteredHistory, historySearch, setHistorySearch, filterBranchHistory, setFilterBranchHistory, state, filterBeltHistory, setFilterBeltHistory, BELT_RANK_ORDER, filterProgramHistory, setFilterProgramHistory, handleExportHistoryCsv, setSelectedStudentId, handleCopyLink, copiedHistoryId, handleOpenEditHistory, isDeletingHistory, handleVoidPromotion }: PromotionHistoryPanelProps) {
  return <>{(
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col flex-1 min-h-[380px] overflow-hidden animate-in fade-in shadow-xs">
              <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">{t('dir_history_title')}</h3>
                  <p className="text-micro text-neutral-500 dark:text-[#666] font-mono mt-0.5">
                    {filteredHistory.length} recorded promotions | Kukkiwon & Academy Log
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full xl:w-auto xl:justify-end">
                  <div className="relative w-full sm:w-48 xl:w-56">
                    <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                    <input
                      type="text"
                      placeholder={t('dir_history_search_placeholder')}
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-8 pr-2 h-9 pointer-coarse:h-11 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[6px] sm:rounded-[8px] text-micro sm:text-xs focus:outline-none focus:border-brand placeholder:text-neutral-400 dark:placeholder:text-[#666]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0">
                    <select aria-label="Filter by branch"
                      value={filterBranchHistory}
                      onChange={(e) => setFilterBranchHistory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-micro sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 h-9 pointer-coarse:h-11 shrink-0 focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="all">{t('dir_all_branches')}</option>
                      {state.branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>

                    <select aria-label="Filter by belt"
                      value={filterBeltHistory}
                      onChange={(e) => setFilterBeltHistory(e.target.value)}
                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-micro sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 h-9 pointer-coarse:h-11 shrink-0 focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="all">{t('dir_all_ranks')}</option>
                      {BELT_RANK_ORDER.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    <select aria-label="Filter by program"
                      value={filterProgramHistory}
                      onChange={(e) => setFilterProgramHistory(e.target.value)}
                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] sm:rounded-[8px] text-micro sm:text-xs text-neutral-900 dark:text-white px-2 sm:px-2.5 h-9 pointer-coarse:h-11 shrink-0 focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="all">{t('dir_all_programs')}</option>
                      {Array.from(new Set(state.beltHistories.map(h => h.program || 'Standard Class'))).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleExportHistoryCsv}
                      className="px-2.5 sm:px-3 h-9 pointer-coarse:h-11 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#DDD] hover:text-neutral-900 dark:hover:text-white rounded-[6px] sm:rounded-[8px] text-micro sm:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 touch-manipulation"
                      title="Export History to CSV"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block flex-1 overflow-auto">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-500 dark:text-[#666] uppercase tracking-widest font-bold sticky top-0 z-10 border-b border-neutral-200 dark:border-[#262626]">
                    <tr>
                      <th className="px-4 py-2.5">{t('dir_student_context')}</th>
                      <th className="px-4 py-2.5">{t('dir_target_rank')}</th>
                      <th className="px-4 py-2.5">{t('dir_promotion_date')}</th>
                      <th className="px-4 py-2.5">{t('dir_grade')}</th>
                      <th className="px-4 py-2.5">{t('dir_cert_ref_hash')}</th>
                      <th className="px-4 py-2.5 w-28 text-center">{t('dir_cert_link_label').replace(/\s*\(.*\)/, '')}</th>
                      <th className="px-4 py-2.5 w-20 text-center">{t('lib_bulk_action_col')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-[#141414]">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 dark:text-[#666] font-mono">
                          {t('dir_no_history')}
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map(history => {
                        const student = state.students.find(s => s.id === history.studentId);
                        return (
                          <tr key={history.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4]">
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() => { if (student) setSelectedStudentId(student.id); }}
                                className="flex items-center gap-2.5 text-left group/st cursor-pointer"
                              >
                                {student && (
                                  <SafeImage
                                    src={student.profilePicturePath}
                                    alt={student.englishName}
                                    containerClassName="w-7 h-7 rounded-full overflow-hidden bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center shrink-0"
                                  />
                                )}
                                <div>
                                  <div className="font-bold text-xs text-neutral-900 dark:text-white group-hover/st:text-brand-ink transition-colors">
                                    {student ? student.englishName : history.studentId}
                                  </div>
                                  <div className="text-micro text-neutral-500 dark:text-[#666] font-mono">
                                    {history.studentId} {student?.homeBranchId && `• ${state.branches.find(b => b.id === student.homeBranchId)?.name}`}
                                  </div>
                                </div>
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn("px-2 py-0.5 rounded text-micro font-bold border tracking-wider uppercase", history.beltLevel.toLowerCase().includes('poom') || history.beltLevel.toLowerCase().includes('dan') || history.beltLevel.toLowerCase() === 'black' ? "bg-neutral-900 text-white border-neutral-700 dark:bg-black dark:text-neutral-100 dark:border-neutral-700" : history.beltLevel === 'Red' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" : history.beltLevel === 'Brown' ? "bg-amber-900/10 text-amber-800 dark:text-amber-500 border-amber-800/30" : history.beltLevel === 'Blue' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : history.beltLevel === 'Green' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : history.beltLevel === 'White' ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200 border-neutral-300 dark:border-white/20" : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/40" )}>
                                {history.beltLevel}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-micro text-neutral-600 dark:text-[#999]">{history.promotionDate}</td>
                            <td className="px-4 py-2.5 font-mono text-micro text-neutral-700 dark:text-neutral-200">
                              {t('dir_test_score').replace(/\s*\(.*\)/, '')}: <span className="font-bold text-amber-600 dark:text-amber-400">{history.testScore || 80}</span> • {history.program || 'Standard'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-micro text-neutral-500 dark:text-[#888] tracking-wider">
                              {history.certificateRef || 'N/A'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {history.kukkiwonDanCardId && (history.kukkiwonDanCardId.startsWith('http') || history.kukkiwonDanCardId.includes('drive.google.com')) ? (
                                  <>
                                    <a
                                      href={history.kukkiwonDanCardId}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-500/25 hover:border-transparent text-emerald-700 dark:text-emerald-400 hover:text-white rounded text-micro font-black uppercase tracking-widest transition-all flex items-center gap-1 active:scale-95 touch-manipulation cursor-pointer"
                                      title="Open Uploaded Infinity TKD Certificate"
                                    >
                                      <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                                      View
                                    </a>
                                    <button
                                      onClick={() => handleCopyLink(history.id, history.kukkiwonDanCardId!)}
                                      className={cn(
                                        "p-1.5 rounded transition-all flex items-center justify-center border cursor-pointer active:scale-95 touch-manipulation",
                                        copiedHistoryId === history.id
                                          ? "bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-400"
                                          : "bg-neutral-100 hover:bg-neutral-200 border-neutral-200 dark:bg-[#1C1C1C] dark:border-[#262626] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white"
                                      )}
                                      title="Copy Share Link to Clipboard"
                                    >
                                      {copiedHistoryId === history.id ? (
                                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </>
                                ) : history.kukkiwonDanCardId ? (
                                  <span className="font-mono text-micro text-neutral-700 dark:text-[#999] bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] px-1.5 py-0.5 rounded" title="Kukkiwon ID / Custom Card ID">
                                    ID: {history.kukkiwonDanCardId}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditHistory(history)}
                                    className="text-micro font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                  >
                                    + Add Link
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenEditHistory(history)}
                                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#202020] text-neutral-400 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  title="Edit Promotion Log"
                                >
                                  <PencilSimple className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={isDeletingHistory === history.id}
                                  onClick={() => handleVoidPromotion(history.id)}
                                  className="p-1 rounded hover:bg-red-500/10 text-neutral-400 hover:text-red-600 dark:text-[#666] dark:hover:text-red-500 disabled:opacity-30 transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  title="Void Promotion"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Native History Cards */}
              <div className="block md:hidden divide-y divide-neutral-200 dark:divide-[#262626] overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <div className="py-10 text-center text-neutral-500 dark:text-[#666] font-mono text-xs">
                    {t('dir_no_history')}
                  </div>
                ) : (
                  filteredHistory.map(history => {
                    const student = state.students.find(s => s.id === history.studentId);
                    return (
                      <div key={history.id} className="p-3.5 space-y-2.5 bg-white dark:bg-[#141414]">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => { if (student) setSelectedStudentId(student.id); }}
                            className="font-bold text-xs text-neutral-900 dark:text-white hover:text-brand-ink text-left transition-colors cursor-pointer"
                          >
                            {student ? student.englishName : history.studentId}
                            <span className="text-micro text-neutral-500 font-mono font-normal ml-1">({history.studentId})</span>
                          </button>
                          <span className="px-2 py-0.5 rounded text-micro font-bold border uppercase tracking-wider bg-neutral-100 dark:bg-[#1C1C1C] border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white">
                            {history.beltLevel}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-micro font-mono text-neutral-600 dark:text-[#999] bg-neutral-50 dark:bg-[#0D0D0D] p-2 rounded border border-neutral-200/60 dark:border-[#202020]">
                          <div>Date: <span className="font-bold text-neutral-900 dark:text-white">{history.promotionDate}</span></div>
                          <div>Score: <span className="font-bold text-amber-600 dark:text-amber-400">{history.testScore || 80}</span></div>
                          <div className="truncate">Prog: {history.program || 'Standard'}</div>
                          <div className="truncate font-mono">Ref: {history.certificateRef || 'N/A'}</div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            {history.kukkiwonDanCardId && (history.kukkiwonDanCardId.startsWith('http') || history.kukkiwonDanCardId.includes('drive.google.com')) ? (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={history.kukkiwonDanCardId}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-500/25 hover:border-transparent text-emerald-700 dark:text-emerald-400 hover:text-white rounded text-micro font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1"
                                >
                                  <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>View Cert</span>
                                </a>
                                <button
                                  onClick={() => handleCopyLink(history.id, history.kukkiwonDanCardId!)}
                                  className="p-1 rounded bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400"
                                >
                                  {copiedHistoryId === history.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : history.kukkiwonDanCardId ? (
                              <span className="text-micro font-mono text-neutral-600 dark:text-neutral-400">ID: {history.kukkiwonDanCardId}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEditHistory(history)}
                                className="text-micro font-bold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                + Add Cert Link
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditHistory(history)}
                              className="p-1.5 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#242424] text-neutral-600 dark:text-[#999] hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                              title="Edit Log"
                            >
                              <PencilSimple className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isDeletingHistory === history.id}
                              onClick={() => handleVoidPromotion(history.id)}
                              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors cursor-pointer disabled:opacity-30"
                              title="Void Promotion"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}</>;
}

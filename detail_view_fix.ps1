$file = "components\LibraryView.tsx"
$lines = Get-Content $file

# Lines 2276-2363 (1-indexed) = indices 2275-2362 (0-indexed)
$startDel = 2275
$endDel = 2362

$replacement = @'
                      {/* Taekwondo Skill Details */}
                      {activeTab === 'tkd' && (() => {
                        const parsed = parseAssetDescription(selectedDetailAsset.description);
                        const hasPrereqs = parsed.prerequisites && parsed.prerequisites.length > 0;
                        const hasPrinciples = parsed.principles && parsed.principles.length > 0;
                        const hasDrilling = parsed.drillingMethods && parsed.drillingMethods.length > 0;
                        const hasMistakes = parsed.mistakes && parsed.mistakes.length > 0;
                        const hasPerformance = parsed.performance && parsed.performance.length > 0;
                        if (!hasPrereqs && !hasPrinciples && !hasDrilling && !hasMistakes && !hasPerformance) {
                          return null;
                        }
                        return (
                          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-[#262626]">
                            {/* Side-by-side: Prerequisites and Principles */}
                            {(hasPrereqs || hasPrinciples) && (
                              <div className="grid grid-cols-2 gap-4">
                                {hasPrereqs && (
                                  <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                                    <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-2">Skill Prerequisites</span>
                                    <ol className="space-y-1.5">
                                      {parsed.prerequisites!.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                          <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                          <span className="leading-relaxed">{item}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {hasPrinciples && (
                                  <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                                    <span className="block text-[8px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider mb-2">Principle of the Skill</span>
                                    <ol className="space-y-1.5">
                                      {parsed.principles!.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                          <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                          <span className="leading-relaxed">{item}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Drilling Methods */}
                            {hasDrilling && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Drilling Methods for Effective Training</span>
                                <div className="p-4 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                                  <ol className="space-y-1.5">
                                    {parsed.drillingMethods!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                        <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed">{item}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            )}

                            {/* Common Mistakes & Corrections */}
                            {hasMistakes && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Common Mistakes & Corrections</span>
                                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-[8px]">
                                  <ol className="space-y-1.5">
                                    {parsed.mistakes!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                                        <span className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed">{item}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            )}

                            {/* Performance & Application */}
                            {hasPerformance && (
                              <div className="space-y-2">
                                <span className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-wider">Performance & Application</span>
                                <div className="p-4 bg-red-500/[0.02] dark:bg-red-500/[0.01] border border-red-500/10 dark:border-red-500/5 rounded-[8px]">
                                  <ol className="space-y-1.5">
                                    {parsed.performance!.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                        <span className="w-4 h-4 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                        <span className="leading-relaxed">{item}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
'@

$result = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($i -eq $startDel) {
        $replacement -split "`n" | ForEach-Object { $result += $_ }
    }
    if ($i -ge $startDel -and $i -le $endDel) { continue }
    $result += $lines[$i]
}
$result | Set-Content $file -Encoding UTF8
Write-Host "Done. Detail view updated."

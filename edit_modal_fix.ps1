$file = "components\LibraryView.tsx"
$lines = Get-Content $file

# Lines 2014-2157 (1-indexed) = indices 2013-2156 (0-indexed)
$startDel = 2013
$endDel = 2156

$replacement = @'
                      {activeTab === 'tkd' && (
                        <>
                          {/* Skill Prerequisites Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Skill Prerequisites</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[10px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPrerequisiteSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPrerequisiteSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPrerequisiteSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[6px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`prereq-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Ap Chagi (Front Kick)" onChange={(e) => { const u = [...editPrerequisiteSteps]; u[idx] = e.target.value; setEditPrerequisiteSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPrerequisiteSteps]; u.splice(idx + 1, 0, ''); setEditPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPrerequisiteSteps]; u.splice(idx, 1); setEditPrerequisiteSteps(u); setTimeout(() => document.getElementById(`prereq-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPrerequisiteSteps.length > 1 && (<button type="button" onClick={() => setEditPrerequisiteSteps(editPrerequisiteSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPrerequisiteSteps([...editPrerequisiteSteps, '']); setTimeout(() => document.getElementById(`prereq-step-edit-${editPrerequisiteSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Prerequisite</button>
                          </div>

                          {/* Principle of the Skill Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Principle of the Skill</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[10px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPrincipleSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPrincipleSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPrincipleSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[6px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`principle-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Dynamic snap at knee joint" onChange={(e) => { const u = [...editPrincipleSteps]; u[idx] = e.target.value; setEditPrincipleSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPrincipleSteps]; u.splice(idx + 1, 0, ''); setEditPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPrincipleSteps]; u.splice(idx, 1); setEditPrincipleSteps(u); setTimeout(() => document.getElementById(`principle-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPrincipleSteps.length > 1 && (<button type="button" onClick={() => setEditPrincipleSteps(editPrincipleSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPrincipleSteps([...editPrincipleSteps, '']); setTimeout(() => document.getElementById(`principle-step-edit-${editPrincipleSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Principle</button>
                          </div>

                          {/* Drilling Methods Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Drilling Methods</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[10px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editDrillingSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editDrillingSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditDrillingSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[6px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`drilling-step-edit-${idx}`} type="text" value={step} placeholder="e.g. 3 rounds of 10 rapid repetitions per leg..." onChange={(e) => { const u = [...editDrillingSteps]; u[idx] = e.target.value; setEditDrillingSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editDrillingSteps]; u.splice(idx + 1, 0, ''); setEditDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editDrillingSteps]; u.splice(idx, 1); setEditDrillingSteps(u); setTimeout(() => document.getElementById(`drilling-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editDrillingSteps.length > 1 && (<button type="button" onClick={() => setEditDrillingSteps(editDrillingSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditDrillingSteps([...editDrillingSteps, '']); setTimeout(() => document.getElementById(`drilling-step-edit-${editDrillingSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Drilling Method</button>
                          </div>

                          {/* Common Mistakes & Corrections Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Common Mistakes & Corrections</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[10px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editMistakeSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editMistakeSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditMistakeSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-[6px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`mistake-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Dropping hands while kicking → Keep hands guarded" onChange={(e) => { const u = [...editMistakeSteps]; u[idx] = e.target.value; setEditMistakeSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editMistakeSteps]; u.splice(idx + 1, 0, ''); setEditMistakeSteps(u); setTimeout(() => document.getElementById(`mistake-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editMistakeSteps]; u.splice(idx, 1); setEditMistakeSteps(u); setTimeout(() => document.getElementById(`mistake-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editMistakeSteps.length > 1 && (<button type="button" onClick={() => setEditMistakeSteps(editMistakeSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditMistakeSteps([...editMistakeSteps, '']); setTimeout(() => document.getElementById(`mistake-step-edit-${editMistakeSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Mistake & Correction</button>
                          </div>

                          {/* Performance & Application Step Builder */}
                          <div>
                            <label className="block text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 mb-2">Performance & Application</label>
                            <div className="space-y-2 border border-neutral-200 dark:border-[#262626] rounded-[10px] p-4 bg-neutral-50/50 dark:bg-[#0c0c0c] max-h-60 overflow-y-auto">
                              {editPerformanceSteps.map((step, idx) => (
                                <div key={idx} draggable onDragStart={(e) => { setDraggedIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === idx) return; const updated = [...editPerformanceSteps]; const [d] = updated.splice(draggedIndex, 1); updated.splice(idx, 0, d); setEditPerformanceSteps(updated); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={cn("flex items-center gap-2 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 shadow-sm transition-all", draggedIndex === idx ? "opacity-40 scale-95 border-dashed border-[#EF2F38]" : "hover:border-neutral-300 dark:hover:border-[#3a3a3a]")}>
                                  <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-white shrink-0 p-1"><ListChecks className="w-4 h-4" /></div>
                                  <span className="text-[10px] font-mono font-bold bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 px-2 py-1 rounded-[6px] shrink-0 min-w-[32px] text-center">#{idx + 1}</span>
                                  <input id={`performance-step-edit-${idx}`} type="text" value={step} placeholder="e.g. Used for counter attacks in sparring..." onChange={(e) => { const u = [...editPerformanceSteps]; u[idx] = e.target.value; setEditPerformanceSteps(u); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const u = [...editPerformanceSteps]; u.splice(idx + 1, 0, ''); setEditPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-edit-${idx + 1}`)?.focus(), 30); } else if (e.key === 'Backspace' && !step && idx > 0) { e.preventDefault(); const u = [...editPerformanceSteps]; u.splice(idx, 1); setEditPerformanceSteps(u); setTimeout(() => document.getElementById(`performance-step-edit-${idx - 1}`)?.focus(), 30); } }} className="flex-1 min-w-0 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-medium" />
                                  {editPerformanceSteps.length > 1 && (<button type="button" onClick={() => setEditPerformanceSteps(editPerformanceSteps.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 shrink-0 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer border-0 bg-transparent"><Trash className="w-3.5 h-3.5" /></button>)}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setEditPerformanceSteps([...editPerformanceSteps, '']); setTimeout(() => document.getElementById(`performance-step-edit-${editPerformanceSteps.length}`)?.focus(), 30); }} className="mt-2 text-xs font-bold uppercase tracking-wider text-[#EF2F38] hover:text-[#EF2F38]/85 transition-colors flex items-center gap-1 cursor-pointer border-0 bg-transparent px-1 py-1"><Plus className="w-3.5 h-3.5" /> Add Performance Note</button>
                          </div>
                        </>
                      )}
'@

$result = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($i -eq $startDel) {
        # Insert replacement lines
        $replacement -split "`n" | ForEach-Object { $result += $_ }
    }
    if ($i -ge $startDel -and $i -le $endDel) { continue }
    $result += $lines[$i]
}
$result | Set-Content $file -Encoding UTF8
Write-Host "Done. Edit Modal TKD fields replaced."

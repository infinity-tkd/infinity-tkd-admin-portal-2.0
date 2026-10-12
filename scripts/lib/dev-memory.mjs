const MiB=1024*1024;

// Leave room for Webpack's native allocations, the browser and other apps.
export function developmentNodeOptions(existing='',totalBytes) {
 const requested=/(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s+)(\d+)(?=\s|$)/.exec(existing);
 if(requested)return {nodeOptions:existing,heapMiB:Number(requested[1]),automatic:false};
 // Keep the budget stable between launches. Free RAM fluctuates as browsers
 // and other portals run; shrinking this below the compiler's working set
 // makes Next's 80% heap watchdog repeatedly restart otherwise healthy builds.
 const heapMiB=totalBytes>=8*1024*MiB ? 2048 : 1024;
 return {nodeOptions:[existing.trim(),`--max-old-space-size=${heapMiB}`].filter(Boolean).join(' '),heapMiB,automatic:true};
}

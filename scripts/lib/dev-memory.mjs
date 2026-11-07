const MiB=1024*1024;

// Leave room for Webpack's native allocations, the browser and other apps.
export function developmentNodeOptions(existing='',totalBytes) {
 const requested=/(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s+)(\d+)(?=\s|$)/.exec(existing);
 if(requested)return {nodeOptions:existing,heapMiB:Number(requested[1]),automatic:false};
 // Keep the budget stable between launches. Free RAM fluctuates as browsers
 // and other portals run; shrinking this below the compiler's working set
 // makes Next's 80% heap watchdog repeatedly restart otherwise healthy builds.
 // The full portal's compiler graph can cross 1.6 GiB during routine hot
 // reloads. On a 16 GB workstation that was triggering Next's watchdog,
 // briefly dropping signed-in browser connections during normal navigation.
 const heapMiB=totalBytes>=24*1024*MiB ? 4096 : totalBytes>=12*1024*MiB ? 3072 : totalBytes>=8*1024*MiB ? 2048 : 1024;
 return {nodeOptions:[existing.trim(),`--max-old-space-size=${heapMiB}`].filter(Boolean).join(' '),heapMiB,automatic:true};
}

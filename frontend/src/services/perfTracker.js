// src/services/perfTracker.js
class PerfTracker {
  constructor() {
    this.logs = [];
    this.fps = 0;
    this.frames = 0;
    this.cpuStress = 0; // 0 to 100 proxy
    this.lastTime = performance.now();
    
    // Track "Long Tasks" (This is our CPU proxy)
    if (typeof PerformanceObserver !== 'undefined') {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // If a task takes > 50ms, the CPU is "Stressed"
                this.cpuStress = Math.min(100, Math.round(entry.duration * 2));
                setTimeout(() => { this.cpuStress = 0; }, 1000); 
            }
        });
        observer.observe({ entryTypes: ['longtask'] });
    }
  }

  start() {
    if (this.isTracking) return;
    this.isTracking = true;
    const loop = () => {
      this.frames++;
      const now = performance.now();
      if (now >= this.lastTime + 1000) {
        this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
        this.frames = 0;
        this.lastTime = now;
        this.snapshot();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  snapshot() {
    const mem = window.performance?.memory || { usedJSHeapSize: 0 };
    const nodes = document.querySelectorAll('.react-flow__node').length;
    
    this.logs.push({
      time: new Date().toLocaleTimeString([], { hour12: false }), // Simple: "14:30:05"
      fps: this.fps,
      cpu: this.cpuStress + "%",
      ram: mem.usedJSHeapSize ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : 'N/A',
      nodes: nodes
    });
    if (this.logs.length > 50) this.logs.shift();
  }

  exportLogs() {
    const headers = ["time", "fps", "cpu", "ram", "nodes"];
    const csv = [headers.join(","), ...this.logs.map(r => headers.map(h => r[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf-${Date.now()}.csv`;
    a.click();
  }
}
export const perfTracker = new PerfTracker();
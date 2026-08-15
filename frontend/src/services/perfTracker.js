// src/services/perfTracker.js
class PerfTracker {
  constructor() {
    this.logs = [];
    this.fps = 0;
    this.frames = 0;
    this.cpuLoad = 0;
    this.lastTime = performance.now();
    this.isTracking = false;

    // Detect CPU "Long Tasks" (CPU Load Proxy)
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.cpuLoad = Math.min(100, Math.round(entry.duration * 1.5));
          setTimeout(() => { this.cpuLoad = Math.max(0, this.cpuLoad - 20); }, 1000);
        });
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
      if (this.isTracking) requestAnimationFrame(loop);
    };
    loop();
  }

  snapshot() {
    const mem = window.performance?.memory;
    const nodes = document.querySelectorAll('.react-flow__node').length;
    
    this.logs.push({
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      fps: this.fps,
      cpu: this.cpuLoad + "%",
      ram: mem ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : 'N/A',
      nodes: nodes
    });
    if (this.logs.length > 100) this.logs.shift();
  }

  exportLogs() {
    const headers = ["time", "fps", "cpu", "ram", "nodes"];
    const csv = [headers.join(","), ...this.logs.map(r => headers.map(h => r[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf-report-${Date.now()}.csv`;
    a.click();
  }
}
export const perfTracker = new PerfTracker();
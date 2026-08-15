// src/services/perfTracker.js

class PerfTracker {
  constructor() {
    this.logs = [];
    this.fps = 0;
    this.frames = 0;
    this.lastTime = performance.now();
    this.isTracking = false;
  }

  start() {
    this.isTracking = true;
    this.measureFPS();
  }

  measureFPS() {
    const now = performance.now();
    this.frames++;
    if (now >= this.lastTime + 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
      this.frames = 0;
      this.lastTime = now;
      this.snapshot(); // Take a record every second
    }
    if (this.isTracking) requestAnimationFrame(() => this.measureFPS());
  }

  snapshot() {
    const mem = window.performance?.memory; // Chrome/Edge only
    const data = {
      timestamp: new Date().toISOString(),
      fps: this.fps,
      heapUsed: mem ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : 'N/A',
      heapTotal: mem ? Math.round(mem.totalJSHeapSize / 1048576) + 'MB' : 'N/A',
      nodeCount: document.querySelectorAll('.react-flow__node').length,
      edgeCount: document.querySelectorAll('.react-flow__edge').length,
    };
    this.logs.push(data);
    
    // Keep only last 10 minutes of data
    if (this.logs.length > 600) this.logs.shift();
  }

  // Export as CSV for verification in Excel/Sheets
  exportLogs() {
    const headers = ["timestamp", "fps", "heapUsed", "heapTotal", "nodeCount", "edgeCount"];
    const csvContent = [
      headers.join(","),
      ...this.logs.map(row => headers.map(h => row[h]).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuron-perf-${new Date().getTime()}.csv`;
    a.click();
  }
}

export const perfTracker = new PerfTracker();
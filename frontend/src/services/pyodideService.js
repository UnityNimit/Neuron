// src/services/pyodideService.js

export const loadPyodideEngine = async (onStdout, onStderr) => {
  return new Promise((resolve, reject) => {
    try {
      // 1. If Pyodide is already loaded in memory, resolve immediately!
      if (window.pyodide) {
        resolve(window.pyodide);
        return;
      }

      // 2. If the script tag is already downloading, wait for it
      if (document.querySelector('script[src*="pyodide.js"]')) {
        const checkInterval = setInterval(() => {
          if (window.pyodide) {
            clearInterval(checkInterval);
            resolve(window.pyodide);
          }
        }, 100);
        return;
      }

      console.log("Downloading WebAssembly Python Engine...");
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = async () => {
        const pyodide = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
          stdout: onStdout,
          stderr: onStderr
        });
        
        // ASSIGN TO WINDOW so handleRunCode can execute it!
        window.pyodide = pyodide;
        console.log("✅ Pyodide is locked and loaded!");
        resolve(pyodide);
      };
    } catch (err) {
      console.error("Pyodide failed to load:", err);
      reject(err);
    }
  });
};
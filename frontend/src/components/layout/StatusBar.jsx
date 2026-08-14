// src/components/layout/StatusBar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Bell, Code2, XCircle, CheckCircle2, X } from 'lucide-react';

export default function StatusBar({ 
  activeFile = "", 
  errorCount = 0, 
  warningCount = 0, 
  lineCount = 0, 
  wordCount = 0,
  encoding = "UTF-8" 
}) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef(null);

  // Mock initial notifications (in a real app, these would come from the backend or App.jsx)
  const [notifications, setNotifications] = useState([
    { id: 1, type: "success", text: "WASM Engine initialized successfully", time: "Just now" },
    { id: 2, type: "info", text: "Connected to Python AI Backend", time: "1 min ago" },
    { id: 3, type: "info", text: "Auto-save is currently active", time: "2 mins ago" }
  ]);

  // Handle clicking outside to close notifications
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearNotification = (id, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Smart File Type Detection based on extension
  const getFileType = (filename) => {
    if (!filename) return "No File";
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      'py': 'Python',
      'js': 'JavaScript',
      'jsx': 'JavaScript React',
      'ts': 'TypeScript',
      'tsx': 'TypeScript React',
      'json': 'JSON',
      'html': 'HTML',
      'css': 'CSS',
      'txt': 'Plain Text',
      'md': 'Markdown',
      'csv': 'CSV'
    };
    return map[ext] || ext.toUpperCase();
  };

  return (
    <div className="h-6 shrink-0 bg-[#181818] border-t border-[#2b2d31] text-slate-400 flex items-center justify-between px-3 text-[11px] font-sans select-none z-50">
      
      {/* LEFT SIDE: Branding & Problems */}
      <div className="flex items-center gap-3 h-full">
        <div className="flex items-center px-1.5 h-full hover:bg-[#2a2d31] hover:text-slate-200 cursor-pointer transition-colors" title="Neuron IDE">
          <span className="font-semibold tracking-wide">Neuron</span>
        </div>

        {/* Errors & Warnings (VS Code Style) */}
        <div className="flex items-center gap-2 h-full">
          <button className="flex items-center gap-1.5 px-1.5 h-full hover:bg-[#2a2d31] hover:text-slate-200 transition-colors" title="0 Errors">
            <XCircle size={13} className={errorCount > 0 ? "text-red-400" : "text-slate-400"} />
            <span>{errorCount}</span>
          </button>
          <button className="flex items-center gap-1.5 px-1.5 h-full hover:bg-[#2a2d31] hover:text-slate-200 transition-colors" title="0 Warnings">
            <AlertTriangle size={13} className={warningCount > 0 ? "text-yellow-400" : "text-slate-400"} />
            <span>{warningCount}</span>
          </button>
        </div>
      </div>

      {/* RIGHT SIDE: Metrics & Notifications */}
      <div className="flex items-center gap-1 h-full">
        {activeFile && (
          <>
            <button className="px-2 h-full hover:bg-[#2a2d31] hover:text-slate-200 transition-colors hidden sm:block">
              Ln {lineCount}, Col 1 ({wordCount} words)
            </button>
            <button className="px-2 h-full hover:bg-[#2a2d31] hover:text-slate-200 transition-colors uppercase hidden md:block">
              {encoding}
            </button>
            <button className="px-2 h-full hover:bg-[#2a2d31] hover:text-slate-200 transition-colors flex items-center gap-1.5">
              <Code2 size={13} className="text-slate-500" /> {getFileType(activeFile)}
            </button>
          </>
        )}

        {/* NOTIFICATIONS SYSTEM */}
        <div className="relative h-full flex items-center" ref={notifRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`px-2 h-full flex items-center justify-center transition-colors relative ${isNotificationsOpen ? 'bg-[#333] text-slate-200' : 'hover:bg-[#2a2d31] hover:text-slate-200'}`} 
            title="Notifications"
          >
            <Bell size={13} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-[#181818]"></span>
            )}
          </button>

          {/* Notifications Popover Menu */}
          {isNotificationsOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#252526] border border-[#454545] rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 z-[100]">
              <div className="px-3 py-2 border-b border-[#3c3c3c] flex items-center justify-between bg-[#1e1e1e]">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Notifications</span>
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-[10px] hover:text-slate-200 transition-colors">Clear All</button>
                )}
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-500 text-xs">
                    No new notifications
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="px-3 py-2.5 border-b border-[#333] hover:bg-[#2a2d31] transition-colors flex items-start justify-between group">
                      <div className="flex items-start gap-2.5">
                        {notif.type === 'success' ? (
                          <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <Bell size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-300 text-xs leading-tight">{notif.text}</span>
                          <span className="text-[9px] text-slate-500">{notif.time}</span>
                        </div>
                      </div>
                      <button onClick={(e) => clearNotification(notif.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-white p-0.5 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
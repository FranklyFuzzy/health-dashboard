"use client";

const NAV: { key: string; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { key: "log", label: "Daily Log", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { key: "bloodwork", label: "Blood Work", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { key: "raw", label: "Raw Data", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { key: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onSync: () => void;
  syncing: boolean;
}

export function Sidebar({ currentView, onViewChange, onSync, syncing }: SidebarProps) {
  return (
    <aside className="flex flex-col shrink-0 border-r justify-between" style={{ width: 190, background: "#000", borderColor: "#1a1a1a" }}>
      <div>
        <div style={{ padding: "1.25rem 1rem 1rem" }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", textTransform: "uppercase", color: "var(--accent)" }}>
            Health Dashboard
          </div>
        </div>
        <nav className="flex flex-col" style={{ padding: "0 0.5rem", gap: 1 }}>
          {NAV.map((item) => {
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onViewChange(item.key)}
                className="sidebar-nav-item flex items-center gap-2 text-left rounded-lg w-full"
                style={{
                  padding: "0.45rem 0.6rem",
                  fontSize: 13,
                  background: isActive ? "#1a1a1a" : "transparent",
                  color: isActive ? "#fff" : "#777",
                  border: "none",
                  fontFamily: "inherit",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div style={{ padding: "0.75rem" }}>
        <button onClick={onSync} disabled={syncing} className="flex items-center justify-center gap-2 w-full rounded-lg"
          style={{ background: "#1a1a1a", border: "1px solid #222", color: syncing ? "#555" : "#888", fontSize: 12, fontFamily: "inherit", padding: "0.5rem", fontWeight: 500 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={syncing ? { animation: "spin 1s linear infinite" } : {}}>
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {syncing ? "Syncing..." : "Sync All"}
        </button>
      </div>
    </aside>
  );
}

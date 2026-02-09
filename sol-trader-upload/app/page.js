"use client";
import { useState, useEffect, useRef } from "react";

export default function Dashboard() {
  const [prices, setPrices] = useState([]);
  const [wallet, setWallet] = useState({ sol: 0, usdc: 0, address: "Loading..." });
  const [trades, setTrades] = useState([]);
  const [config, setConfig] = useState({});
  const [stats, setStats] = useState({ totalTrades: 0, todayTrades: 0 });
  const [view, setView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  // Fetch price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const r = await fetch("/api/price");
        const d = await r.json();
        if (d.price) setPrices(p => { const n = [...p, { price: d.price, time: d.time }]; return n.length > 300 ? n.slice(-300) : n; });
      } catch {}
    }
    fetchPrice();
    const iv = setInterval(fetchPrice, 10000);
    return () => clearInterval(iv);
  }, []);

  // Fetch status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const r = await fetch("/api/status");
        const d = await r.json();
        if (d.wallet) setWallet(d.wallet);
        if (d.trades) setTrades(d.trades);
        if (d.config) setConfig(d.config);
        if (d.stats) setStats(d.stats);
        setLoading(false);
      } catch { setLoading(false); }
    }
    fetchStatus();
    const iv = setInterval(fetchStatus, 15000);
    return () => clearInterval(iv);
  }, []);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prices.length < 2) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    const d = prices.slice(-120);
    const v = d.map(p => p.price);
    const mn = Math.min(...v) - 0.3, mx = Math.max(...v) + 0.3, rg = mx - mn || 1;
    const bl = v[v.length - 1] >= v[0];

    ctx.strokeStyle = "rgba(255,255,255,0.02)"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText("$" + (mx - (i / 4) * rg).toFixed(2), 4, y - 4);
    }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, bl ? "rgba(107,189,124,0.12)" : "rgba(212,120,92,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    d.forEach((p, i) => { const x = (i / (d.length - 1)) * W, y = H - ((p.price - mn) / rg) * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    d.forEach((p, i) => { const x = (i / (d.length - 1)) * W, y = H - ((p.price - mn) / rg) * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = bl ? "#6bbd7c" : "#d4785c"; ctx.lineWidth = 1.5; ctx.stroke();
    const ly = H - ((v[v.length - 1] - mn) / rg) * H;
    ctx.beginPath(); ctx.arc(W - 1, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = bl ? "#6bbd7c" : "#d4785c"; ctx.fill();
    ctx.beginPath(); ctx.arc(W - 1, ly, 8, 0, Math.PI * 2);
    ctx.fillStyle = bl ? "rgba(107,189,124,0.15)" : "rgba(212,120,92,0.15)"; ctx.fill();
  }, [prices]);

  const cp = prices.length ? prices[prices.length - 1].price : 0;
  const pp = prices.length > 10 ? prices[prices.length - 10].price : cp;
  const pct = pp ? ((cp - pp) / pp * 100) : 0;
  const bl = pct >= 0;
  const clr = bl ? "#6bbd7c" : "#d4785c";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "chart", label: "Chart" },
    { id: "trades", label: "Trades" },
    { id: "config", label: "Config" },
  ];

  return (
    <div style={S.page}>
      {/* Top Bar */}
      <div style={S.top}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#c9a84c", opacity: 0.6 }}>◆</span>
          <div>
            <div style={S.logoText}>SOL TRADER</div>
            <div style={S.logoSub}>AUTONOMOUS · VERCEL</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6bbd7c", display: "inline-block", boxShadow: "0 0 8px rgba(107,189,124,0.3)" }} />
          <span style={S.statusText}>LIVE</span>
        </div>
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setView(t.id)} style={{
            ...S.navItem,
            color: view === t.id ? "#c9a84c" : "rgba(255,255,255,0.2)",
            borderBottom: view === t.id ? "2px solid #c9a84c" : "2px solid transparent",
          }}>{t.label}</div>
        ))}
      </div>

      <div style={S.content}>
        {loading && <div style={S.empty}>Loading...</div>}

        {/* OVERVIEW */}
        {!loading && view === "overview" && (
          <>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={S.pair}>SOL / USDC</div>
                  <div style={{ ...S.price, color: clr }}>${cp.toFixed(4)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...S.change, color: clr }}>{bl ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</div>
                  <div style={S.changeLabel}>session</div>
                </div>
              </div>
              <canvas ref={canvasRef} style={{ width: "100%", height: 180, display: "block" }} />
            </div>

            <div style={S.grid}>
              {[
                { v: (wallet.sol || 0).toFixed(4), l: "SOL" },
                { v: (wallet.usdc || 0).toFixed(2), l: "USDC" },
                { v: stats.totalTrades, l: "TOTAL TRADES" },
                { v: stats.todayTrades + "/" + stats.maxDaily, l: "TODAY" },
              ].map((s, i) => (
                <div key={i} style={S.stat}>
                  <div style={S.statVal}>{s.v}</div>
                  <div style={S.statLabel}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>RECENT TRADES</div>
              {trades.length === 0 ? (
                <div style={S.empty}>No trades yet. Bot runs every 5 minutes automatically.</div>
              ) : trades.slice(0, 6).map((t, i) => {
                const isBuy = (t.action || "").includes("BUY");
                return (
                  <div key={i} style={S.tradeRow}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: isBuy ? "#6bbd7c" : "#d4785c", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ color: isBuy ? "#6bbd7c" : "#d4785c", fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 600, letterSpacing: 2 }}>{t.action}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginLeft: 8 }}>{t.amount} @ {t.price}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace" }}>
                      {t.time ? new Date(t.time).toLocaleTimeString() : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={S.walletBar}>
              <span style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.08)" }}>WALLET</span>
              <a href={`https://solscan.io/account/${wallet.address}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "rgba(201,168,76,0.3)", textDecoration: "none" }}>
                {wallet.address}
              </a>
            </div>
          </>
        )}

        {/* CHART */}
        {!loading && view === "chart" && (
          <div style={{ ...S.card, padding: "18px 20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ ...S.price, color: clr, fontSize: 32 }}>${cp.toFixed(4)}</div>
              <div>
                <div style={{ ...S.change, color: clr, fontSize: 16 }}>{bl ? "+" : ""}{pct.toFixed(3)}%</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.08)", textAlign: "right" }}>{prices.length} points</div>
              </div>
            </div>
            <canvas ref={canvasRef} style={{ width: "100%", height: 360, display: "block" }} />
          </div>
        )}

        {/* TRADES */}
        {!loading && view === "trades" && (
          <div style={S.card}>
            <div style={S.cardTitle}>ALL TRADES ({trades.length})</div>
            {trades.length === 0 ? (
              <div style={S.empty}>No trades recorded yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Time", "Action", "Amount", "Price", "TX"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => {
                    const isBuy = (t.action || "").includes("BUY");
                    return (
                      <tr key={i}>
                        <td style={S.td}>{t.time ? new Date(t.time).toLocaleString() : ""}</td>
                        <td style={{ ...S.td, color: isBuy ? "#6bbd7c" : "#d4785c", fontWeight: 600 }}>{t.action}</td>
                        <td style={S.td}>{t.amount}</td>
                        <td style={S.td}>{t.price}</td>
                        <td style={S.td}>
                          {t.tx === "DRY_RUN" ? (
                            <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 9 }}>DRY RUN</span>
                          ) : t.tx ? (
                            <a href={`https://solscan.io/tx/${t.tx}`} target="_blank" rel="noreferrer" style={{ color: "rgba(201,168,76,0.3)", fontSize: 10 }}>
                              {t.tx.slice(0, 12)}...
                            </a>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {trades.length > 0 && trades[0].reason && (
              <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.1)" }}>
                Last signal: {trades[0].reason}
              </div>
            )}
          </div>
        )}

        {/* CONFIG */}
        {!loading && view === "config" && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>BOT CONFIGURATION</div>
              {[
                ["Strategy", config.strategy],
                ["Trade Size", config.trade_size],
                ["Slippage", config.slippage],
                ["Max Daily Trades", config.max_daily],
                ["Dry Run", config.dry_run],
              ].map(([k, v], i) => (
                <div key={i} style={S.configRow}>
                  <div style={S.configKey}>{k}</div>
                  <div style={{
                    ...S.configVal,
                    color: k === "Dry Run" ? (v === "YES" ? "#c9a84c" : "#6bbd7c") : "rgba(255,255,255,0.4)"
                  }}>{v || "—"}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>HOW IT WORKS</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 2.2 }}>
                The bot runs automatically every 5 minutes via Vercel Cron.<br />
                No computer needs to be on. No terminal. It just runs.<br /><br />
                To change settings: go to your Vercel dashboard → project → Settings → Environment Variables.<br /><br />
                To fund the bot: send SOL to the wallet address shown on the Overview tab.
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>LINKS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href={`https://solscan.io/account/${wallet.address}`} target="_blank" rel="noreferrer" style={S.link}>
                  View wallet on Solscan →
                </a>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.04); border-radius: 2px; }
      `}</style>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#060709", fontFamily: "'DM Sans', sans-serif", color: "#c8c3b8" },
  top: { position: "sticky", top: 0, zIndex: 100, background: "rgba(6,7,9,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.03)", padding: "0 20px", height: 52, display: "flex", justifyContent: "space-between", alignItems: "center" },
  logoText: { fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: 4, color: "rgba(255,255,255,0.5)" },
  logoSub: { fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.1)" },
  statusText: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 3, color: "rgba(255,255,255,0.2)" },
  nav: { display: "flex", borderBottom: "1px solid rgba(255,255,255,0.03)", padding: "0 20px", background: "rgba(6,7,9,0.5)" },
  navItem: { padding: "12px 20px", fontSize: 11, letterSpacing: 2, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "0.2s" },
  content: { maxWidth: 800, margin: "0 auto", padding: "16px 20px 60px" },
  card: { background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 12, padding: 18, marginBottom: 12, overflow: "hidden" },
  cardTitle: { fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.1)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 14 },
  pair: { fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.12)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 },
  price: { fontSize: 28, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 },
  change: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 13 },
  changeLabel: { fontSize: 8, color: "rgba(255,255,255,0.08)", letterSpacing: 2, marginTop: 2, textAlign: "right" },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 },
  stat: { background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px 8px", textAlign: "center" },
  statVal: { fontSize: 18, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.5)", marginBottom: 2 },
  statLabel: { fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.1)", fontFamily: "'JetBrains Mono', monospace" },
  tradeRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" },
  walletBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "rgba(255,255,255,0.01)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.02)" },
  th: { textAlign: "left", padding: "8px 6px", fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.08)", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(255,255,255,0.03)" },
  td: { padding: "8px 6px", fontSize: 11, color: "rgba(255,255,255,0.25)", borderBottom: "1px solid rgba(255,255,255,0.015)", fontFamily: "'JetBrains Mono', monospace" },
  configRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" },
  configKey: { fontSize: 11, color: "rgba(255,255,255,0.15)", letterSpacing: 1 },
  configVal: { fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 },
  link: { fontSize: 12, color: "rgba(201,168,76,0.4)", textDecoration: "none" },
  empty: { textAlign: "center", padding: 30, fontSize: 12, color: "rgba(255,255,255,0.06)" },
};

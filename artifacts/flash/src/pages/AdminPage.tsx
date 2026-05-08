import { useState, useEffect, useRef } from "react";
import type { GameItem } from "@/lib/types";

interface ServerItem extends GameItem {
  _index: number;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_auth") === "1");
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);

  const [activeTab, setActiveTab] = useState<"flash" | "yesno">("flash");
  const [items, setItems] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAnswers, setEditAnswers] = useState("");
  const excelRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [ynQuestions, setYnQuestions] = useState<string[]>([]);
  const ynCsvRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    const res = await fetch("/api/admin/items");
    const data = await res.json();
    setItems((data.items as GameItem[]).map((item, i) => ({ ...item, _index: i })));
  };

  const fetchYnQuestions = async () => {
    const res = await fetch("/api/admin/yesno-questions");
    const data = await res.json();
    setYnQuestions(data.questions || []);
  };

  useEffect(() => {
    if (authed) {
      fetchItems();
      fetchYnQuestions();
    }
  }, [authed]);

  const checkPassword = () => {
    if (pw === "admin123") {
      sessionStorage.setItem("admin_auth", "1");
      setAuthed(true);
      setPwErr(false);
    } else {
      setPwErr(true);
      setPw("");
    }
  };

  if (!authed) {
    return (
      <div className="admin-login-screen">
        <div className="admin-login-card">
          <div className="admin-login-logo">Flash <span className="admin-title-ar">/ لمحة</span></div>
          <h2 className="admin-login-title">Admin Panel</h2>
          <p className="admin-login-sub">Enter the admin password to continue</p>
          <input
            className="admin-login-input"
            type="password"
            value={pw}
            placeholder="Password"
            onChange={e => { setPw(e.target.value); setPwErr(false); }}
            onKeyDown={e => { if (e.key === "Enter") checkPassword(); }}
            autoFocus
          />
          {pwErr && <p className="admin-login-err">Incorrect password. Try again.</p>}
          <button className="admin-login-btn" onClick={checkPassword}>Enter</button>
          <a href="/" className="admin-login-back">← Back to Game</a>
        </div>
      </div>
    );
  }

  const toast = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 3500);
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload/excel", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) { toast("Error: " + data.error); }
      else {
        setItems((data.items as GameItem[]).map((item, i) => ({ ...item, _index: i })));
        toast(`Excel uploaded — ${data.items.length} total items`);
      }
    } catch { toast("Failed to upload Excel"); }
    setLoading(false);
    e.target.value = "";
  };

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    let lastItems: GameItem[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("image", file);
      form.append("label", file.name.replace(/\.[^.]+$/, ""));
      try {
        const res = await fetch("/api/upload/image", { method: "POST", body: form });
        const data = await res.json();
        lastItems = data.items;
      } catch { toast("Failed to upload " + file.name); }
    }
    if (lastItems.length) {
      setItems(lastItems.map((item, i) => ({ ...item, _index: i })));
      toast(`${files.length} image(s) added`);
    }
    setLoading(false);
    e.target.value = "";
  };

  const handleYnCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload/yesno-csv", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) { toast("Error: " + data.error); }
      else {
        setYnQuestions(data.questions || []);
        toast(`Added ${data.added} questions — ${data.questions.length} total`);
      }
    } catch { toast("Failed to upload CSV"); }
    setLoading(false);
    e.target.value = "";
  };

  const clearYnQuestions = async () => {
    if (!confirm("Clear all Yes/No questions?")) return;
    await fetch("/api/admin/yesno-questions/clear", { method: "POST" });
    setYnQuestions([]);
    toast("Questions cleared");
  };

  const removeItem = async (index: number) => {
    const res = await fetch("/api/admin/items/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    const data = await res.json();
    setItems((data.items as GameItem[]).map((item, i) => ({ ...item, _index: i })));
  };

  const moveItem = async (index: number, dir: -1 | 1) => {
    const toIndex = index + dir;
    if (toIndex < 0 || toIndex >= items.length) return;
    const res = await fetch("/api/admin/items/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromIndex: index, toIndex }),
    });
    const data = await res.json();
    setItems((data.items as GameItem[]).map((item, i) => ({ ...item, _index: i })));
  };

  const clearAll = async () => {
    if (!confirm("Clear all Flash items?")) return;
    await fetch("/api/admin/items/clear", { method: "POST" });
    setItems([]);
    toast("All items cleared");
  };

  const startEdit = (item: ServerItem) => {
    setEditIndex(item._index);
    setEditLabel(item.prompt);
    setEditAnswers(item.acceptedAnswers.join(", "));
  };

  const saveEdit = async () => {
    if (editIndex === null) return;
    const res = await fetch("/api/admin/items/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index: editIndex,
        label: editLabel.trim(),
        acceptedAnswers: editAnswers.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setItems((data.items as GameItem[]).map((item, i) => ({ ...item, _index: i })));
    setEditIndex(null);
    toast("Saved");
  };

  const flashReady = items.length >= 9;
  const ynReady = ynQuestions.length >= 1;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div>
            <h1 className="admin-title">Flash <span className="admin-title-ar">/ لمحة</span></h1>
            <p className="admin-subtitle">Admin Panel</p>
          </div>
          <div className="admin-header-actions">
            <button className="admin-logout-btn" onClick={() => { sessionStorage.removeItem("admin_auth"); setAuthed(false); }}>Log out</button>
            <a href="/" className="admin-back-link">← Game</a>
          </div>
        </div>
      </header>

      <div className="admin-body">
        {status && <div className="admin-toast">{status}</div>}

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "flash" ? "admin-tab-active" : ""}`}
            onClick={() => setActiveTab("flash")}
          >
            ⚡ Flash Game
            <span className={`admin-tab-badge ${flashReady ? "badge-ready" : "badge-warn"}`}>
              {items.length}
            </span>
          </button>
          <button
            className={`admin-tab ${activeTab === "yesno" ? "admin-tab-active yn-tab-active" : ""}`}
            onClick={() => setActiveTab("yesno")}
          >
            🚫 Yes / No
            <span className={`admin-tab-badge ${ynReady ? "badge-ready" : "badge-warn"}`}>
              {ynQuestions.length}
            </span>
          </button>
        </div>

        {activeTab === "flash" && (
          <>
            <div className="admin-stats">
              <div className={`stat-chip ${flashReady ? "stat-ready" : "stat-warn"}`}>
                <span className="stat-num">{items.length}</span>
                <span className="stat-label">items loaded</span>
              </div>
              <div className="stat-chip">
                <span className="stat-num">9</span>
                <span className="stat-label">rounds per game</span>
              </div>
              <div className={`stat-chip ${flashReady ? "stat-ready" : "stat-warn"}`}>
                {flashReady ? "✓ Ready to play" : `Need ${9 - items.length} more`}
              </div>
            </div>

            <div className="admin-sections">
              <div className="admin-section">
                <h2 className="admin-section-title">Upload Words / Numbers</h2>
                <p className="admin-section-desc">
                  Excel file (.xlsx, .xls) — one word or number per row in column A.
                  Words support fuzzy matching (typos OK). Numbers must match exactly.
                </p>
                <button className="admin-upload-btn" onClick={() => excelRef.current?.click()} disabled={loading}>
                  <span>📊</span> Choose Excel File
                </button>
                <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleExcel} />
              </div>

              <div className="admin-section">
                <h2 className="admin-section-title">Upload Images (PNG)</h2>
                <p className="admin-section-desc">
                  Upload PNG images. They flash inside the billboard. Filename (without extension) becomes the correct answer.
                </p>
                <button className="admin-upload-btn" onClick={() => imgRef.current?.click()} disabled={loading}>
                  <span>🖼️</span> Choose PNG Images
                </button>
                <input ref={imgRef} type="file" accept="image/png,image/webp" multiple style={{ display: "none" }} onChange={handleImages} />
              </div>
            </div>

            <div className="admin-items-section">
              <div className="admin-items-header">
                <h2 className="admin-section-title">Game Items ({items.length})</h2>
                {items.length > 0 && <button className="admin-clear-btn" onClick={clearAll}>Clear All</button>}
              </div>
              {items.length === 0 ? (
                <div className="admin-empty"><p>No items yet. Upload an Excel file or PNG images above.</p></div>
              ) : (
                <div className="admin-items-list">
                  {items.map((item, i) => (
                    <div key={i} className="admin-item-row">
                      <span className="admin-item-num">{i + 1}</span>
                      {item.type === "image" && item.mediaUrl
                        ? <img src={item.mediaUrl} alt={item.prompt} className="admin-item-img" />
                        : <span className="admin-item-type-dot text-dot">T</span>}
                      <div className="admin-item-info">
                        {editIndex === i ? (
                          <div className="admin-edit-form">
                            <input className="admin-edit-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Label / correct answer" />
                            <input className="admin-edit-input" value={editAnswers} onChange={e => setEditAnswers(e.target.value)} placeholder="Extra answers, comma separated" />
                            <div className="admin-edit-actions">
                              <button className="admin-save-btn" onClick={saveEdit}>Save</button>
                              <button className="admin-cancel-btn" onClick={() => setEditIndex(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="admin-item-label">{item.prompt}</span>
                            {item.acceptedAnswers.length > 0 && <span className="admin-item-alts">Also: {item.acceptedAnswers.join(", ")}</span>}
                          </>
                        )}
                      </div>
                      <span className={`admin-item-badge ${item.type}`}>{item.type}</span>
                      <div className="admin-item-btns">
                        <button className="admin-icon-btn" onClick={() => moveItem(i, -1)} disabled={i === 0}>↑</button>
                        <button className="admin-icon-btn" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>↓</button>
                        <button className="admin-icon-btn" onClick={() => startEdit(item)}>✏️</button>
                        <button className="admin-icon-btn danger" onClick={() => removeItem(i)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "yesno" && (
          <>
            <div className="admin-stats">
              <div className={`stat-chip ${ynReady ? "stat-ready" : "stat-warn"}`}>
                <span className="stat-num">{ynQuestions.length}</span>
                <span className="stat-label">questions loaded</span>
              </div>
              <div className={`stat-chip ${ynReady ? "stat-ready" : "stat-warn"}`}>
                {ynReady ? "✓ Ready to play" : "Upload questions below"}
              </div>
            </div>

            <div className="admin-section" style={{ maxWidth: 520 }}>
              <h2 className="admin-section-title">Upload Questions</h2>
              <p className="admin-section-desc">
                Excel / CSV file — one question per row in column A. Players must answer each question without saying "yes" or "no".
                Example questions: "Have you traveled abroad?" · "Do you own a pet?"
              </p>
              <button className="admin-upload-btn yn-upload-btn" onClick={() => ynCsvRef.current?.click()} disabled={loading}>
                <span>📋</span> Choose Excel / CSV
              </button>
              <input ref={ynCsvRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleYnCsv} />
            </div>

            <div className="admin-items-section">
              <div className="admin-items-header">
                <h2 className="admin-section-title">Questions ({ynQuestions.length})</h2>
                {ynQuestions.length > 0 && <button className="admin-clear-btn" onClick={clearYnQuestions}>Clear All</button>}
              </div>
              {ynQuestions.length === 0 ? (
                <div className="admin-empty"><p>No questions yet. Upload a file above.</p></div>
              ) : (
                <div className="admin-items-list">
                  {ynQuestions.map((q, i) => (
                    <div key={i} className="admin-item-row">
                      <span className="admin-item-num">{i + 1}</span>
                      <span className="admin-item-type-dot text-dot" style={{ background: "rgba(15,80,30,0.3)", color: "#6cff9a" }}>Q</span>
                      <span className="admin-item-label" style={{ flex: 1 }}>{q}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

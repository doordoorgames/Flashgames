import { useState, useEffect, useRef } from "react";
import type { GameItem } from "@/lib/types";

interface ServerItem extends GameItem {
  _index: number;
}

export default function AdminPage() {
  const [items, setItems] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAnswers, setEditAnswers] = useState("");
  const excelRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    const res = await fetch("/api/admin/items");
    const data = await res.json();
    setItems((data.items as GameItem[]).map((item, i) => ({ ...item, _index: i })));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const toast = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 3000);
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
        toast(`Added words/numbers from Excel — ${data.items.length} total items`);
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
    if (!confirm("Clear all items?")) return;
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

  const ready = items.length >= 9;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div>
            <h1 className="admin-title">Flash <span className="admin-title-ar">/ لمحة</span></h1>
            <p className="admin-subtitle">Admin Panel</p>
          </div>
          <a href="/" className="admin-back-link">← Game</a>
        </div>
      </header>

      <div className="admin-body">
        <div className="admin-stats">
          <div className={`stat-chip ${ready ? "stat-ready" : "stat-warn"}`}>
            <span className="stat-num">{items.length}</span>
            <span className="stat-label">items loaded</span>
          </div>
          <div className="stat-chip">
            <span className="stat-num">9</span>
            <span className="stat-label">rounds per game</span>
          </div>
          <div className={`stat-chip ${ready ? "stat-ready" : "stat-warn"}`}>
            {ready ? "✓ Ready to play" : `Need ${9 - items.length} more`}
          </div>
        </div>

        {status && <div className="admin-toast">{status}</div>}

        <div className="admin-sections">
          <div className="admin-section">
            <h2 className="admin-section-title">Upload Words / Numbers</h2>
            <p className="admin-section-desc">
              Excel file (.xlsx, .xls) — one word or number per row in column A.
              Numbers must match exactly. Words support fuzzy matching (typos OK).
            </p>
            <button
              className="admin-upload-btn"
              onClick={() => excelRef.current?.click()}
              disabled={loading}
            >
              <span>📊</span> Choose Excel File
            </button>
            <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleExcel} />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Upload Images (PNG)</h2>
            <p className="admin-section-desc">
              Upload PNG images with transparent backgrounds. They flash inside the billboard during the game.
              The filename (without extension) becomes the correct answer. You can edit it below.
            </p>
            <button
              className="admin-upload-btn"
              onClick={() => imgRef.current?.click()}
              disabled={loading}
            >
              <span>🖼️</span> Choose PNG Images
            </button>
            <input ref={imgRef} type="file" accept="image/png,image/webp" multiple style={{ display: "none" }} onChange={handleImages} />
          </div>
        </div>

        <div className="admin-items-section">
          <div className="admin-items-header">
            <h2 className="admin-section-title">Game Items ({items.length})</h2>
            {items.length > 0 && (
              <button className="admin-clear-btn" onClick={clearAll}>Clear All</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="admin-empty">
              <p>No items yet. Upload an Excel file or PNG images above.</p>
            </div>
          ) : (
            <div className="admin-items-list">
              {items.map((item, i) => (
                <div key={i} className="admin-item-row">
                  <span className="admin-item-num">{i + 1}</span>

                  {item.type === "image" && item.mediaUrl ? (
                    <img src={item.mediaUrl} alt={item.prompt} className="admin-item-img" />
                  ) : (
                    <span className="admin-item-type-dot text-dot">T</span>
                  )}

                  <div className="admin-item-info">
                    {editIndex === i ? (
                      <div className="admin-edit-form">
                        <input
                          className="admin-edit-input"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Correct answer / label"
                        />
                        <input
                          className="admin-edit-input"
                          value={editAnswers}
                          onChange={(e) => setEditAnswers(e.target.value)}
                          placeholder="Extra accepted answers, comma separated"
                        />
                        <div className="admin-edit-actions">
                          <button className="admin-save-btn" onClick={saveEdit}>Save</button>
                          <button className="admin-cancel-btn" onClick={() => setEditIndex(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="admin-item-label">{item.prompt}</span>
                        {item.acceptedAnswers.length > 0 && (
                          <span className="admin-item-alts">Also: {item.acceptedAnswers.join(", ")}</span>
                        )}
                      </>
                    )}
                  </div>

                  <span className={`admin-item-badge ${item.type}`}>{item.type}</span>

                  <div className="admin-item-btns">
                    <button className="admin-icon-btn" onClick={() => moveItem(i, -1)} disabled={i === 0} title="Move up">↑</button>
                    <button className="admin-icon-btn" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} title="Move down">↓</button>
                    <button className="admin-icon-btn" onClick={() => startEdit(item)} title="Edit label">✏️</button>
                    <button className="admin-icon-btn danger" onClick={() => removeItem(i)} title="Remove">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

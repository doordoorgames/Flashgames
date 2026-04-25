import { useState, useRef } from "react";
import { getSocket } from "@/lib/socket";
import type { GameItem } from "@/lib/types";
import * as XLSX from "xlsx";

interface AdminSetupProps {
  onRoomCreated: (code: string, playerId: string, name: string) => void;
}

interface PendingItem {
  id: string;
  value: string;
  type: "text" | "image";
  mediaUrl?: string;
  previewUrl?: string;
}

export default function AdminSetup({ onRoomCreated }: AdminSetupProps) {
  const [adminName, setAdminName] = useState("");
  const [items, setItems] = useState<PendingItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ url: string; name: string; previewUrl: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const newItems: PendingItem[] = [];
      for (const row of rows) {
        if (Array.isArray(row) && row[0] !== undefined && String(row[0]).trim() !== "") {
          newItems.push({
            id: Math.random().toString(36).slice(2),
            value: String(row[0]).trim(),
            type: "text",
          });
        }
      }
      setItems((prev) => [...prev, ...newItems]);
    } catch {
      setError("Failed to read Excel file");
    }
    e.target.value = "";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setLoading(true);
    for (const file of files) {
      const form = new FormData();
      form.append("image", file);
      try {
        const res = await fetch("/api/upload/image", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) {
          const previewUrl = URL.createObjectURL(file);
          setUploadedImages((prev) => [...prev, { url: data.url, name: file.name, previewUrl }]);
        }
      } catch {
        setError("Failed to upload image");
      }
    }
    setLoading(false);
    e.target.value = "";
  };

  const addImageAsItem = (img: { url: string; name: string; previewUrl: string }) => {
    const label = img.name.replace(/\.[^.]+$/, "");
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        value: label,
        type: "image",
        mediaUrl: img.url,
        previewUrl: img.previewUrl,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const handleCreate = () => {
    if (!adminName.trim()) { setError("Enter your name"); return; }
    if (items.length < 9) { setError("Need at least 9 items to play 9 rounds"); return; }
    setError("");
    const gameItems: GameItem[] = items.map((item) => ({
      type: item.type,
      prompt: item.value,
      mediaUrl: item.mediaUrl,
      correctAnswer: item.value,
      acceptedAnswers: [],
      flashDurationMs: 600,
    }));
    const socket = getSocket();
    socket.emit("create-room", { playerName: adminName.trim(), items: gameItems }, (res: { code: string; playerId: string }) => {
      onRoomCreated(res.code, res.playerId, adminName.trim());
    });
  };

  return (
    <div className="admin-setup">
      <div className="setup-card">
        <h2 className="setup-title">Host Setup</h2>
        <p className="setup-subtitle">Configure your Flash game</p>

        <div className="setup-section">
          <label className="setup-label">Your Name</label>
          <input
            className="game-input"
            placeholder="Host name"
            value={adminName}
            onChange={(e) => { setAdminName(e.target.value); setError(""); }}
            maxLength={20}
          />
        </div>

        <div className="setup-section">
          <label className="setup-label">Upload Words / Numbers (Excel)</label>
          <p className="setup-hint">Excel file with one word or number per row in column A</p>
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            Choose Excel File
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleExcelUpload} />
        </div>

        <div className="setup-section">
          <label className="setup-label">Upload Images (PNG with transparent background)</label>
          <p className="setup-hint">Upload PNG images — they will appear inside the billboard</p>
          <button className="btn-secondary" onClick={() => imgInputRef.current?.click()} disabled={loading}>
            {loading ? "Uploading..." : "Choose Images"}
          </button>
          <input ref={imgInputRef} type="file" accept="image/png,image/webp,image/gif" multiple style={{ display: "none" }} onChange={handleImageUpload} />

          {uploadedImages.length > 0 && (
            <div className="image-gallery">
              {uploadedImages.map((img, i) => (
                <div key={i} className="img-thumb-wrap">
                  <img src={img.previewUrl} alt={img.name} className="img-thumb" />
                  <p className="img-name">{img.name.slice(0, 15)}</p>
                  <button className="btn-tiny" onClick={() => addImageAsItem(img)}>+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="setup-section">
          <label className="setup-label">
            Game Items <span className="item-count">({items.length} / min 9)</span>
          </label>
          {items.length === 0 && (
            <p className="empty-items">No items yet. Upload Excel or add images above.</p>
          )}
          <div className="items-list">
            {items.map((item, idx) => (
              <div key={item.id} className="item-row">
                <span className="item-num">{idx + 1}</span>
                {item.type === "image" && item.previewUrl && (
                  <img src={item.previewUrl} alt={item.value} className="item-preview-img" />
                )}
                <span className="item-val">{item.value}</span>
                <span className="item-type-badge">{item.type}</span>
                <div className="item-actions">
                  <button className="btn-icon" onClick={() => moveItem(item.id, -1)} disabled={idx === 0}>↑</button>
                  <button className="btn-icon" onClick={() => moveItem(item.id, 1)} disabled={idx === items.length - 1}>↓</button>
                  <button className="btn-icon danger" onClick={() => removeItem(item.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          className="btn-primary btn-large"
          onClick={handleCreate}
          disabled={items.length < 9 || !adminName.trim()}
        >
          Create Room & Start Hosting
        </button>
      </div>
    </div>
  );
}

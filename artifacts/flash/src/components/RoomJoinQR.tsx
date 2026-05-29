import { useState, useCallback } from "react";
import QRCode from "react-qr-code";

interface Props {
  roomCode: string;
}

export default function RoomJoinQR({ roomCode }: Props) {
  const [copied, setCopied] = useState(false);

  const joinUrl =
    window.location.origin + window.location.pathname + "?room=" + roomCode;

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [roomCode]);

  const shareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: "انضم للعبة!", url: joinUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(joinUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }, [joinUrl]);

  if (!roomCode) return null;

  return (
    <div className="rjq-wrap">
      <div className="rjq-qr">
        <QRCode value={joinUrl} size={164} fgColor="#1a002e" bgColor="#ffffff" level="M" />
      </div>
      <p className="rjq-arabic-scan">امسح الكود للدخول</p>
      <p className="rjq-arabic-sub">أو أدخل الرمز يدويًا</p>
      <div className="rjq-buttons">
        <button className="rjq-btn rjq-copy" onClick={copyCode}>
          {copied ? "✓ تم النسخ" : "Copy code"}
        </button>
        <button className="rjq-btn rjq-share" onClick={shareLink}>
          Share link
        </button>
      </div>
    </div>
  );
}

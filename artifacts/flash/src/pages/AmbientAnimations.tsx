import { useState, useEffect, useRef } from "react";

const TRACTOR_URL = "/tractor.jpeg";
const BIRDS_URL = "/birds.png";

const TRACTOR_ANIM_MS = 9000;
const BIRDS_ANIM_MS = 7000;

interface Props {
  active: boolean;
}

export default function AmbientAnimations({ active }: Props) {
  const [tractorDir, setTractorDir] = useState<"ltr" | "rtl" | null>(null);
  const [tractorKey, setTractorKey] = useState(0);
  const [birdsDir, setBirdsDir] = useState<"ltr" | "rtl" | null>(null);
  const [birdsKey, setBirdsKey] = useState(0);

  const isActive = useRef(false);
  const tractorSchedule = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tractorAnim = useRef<ReturnType<typeof setTimeout> | null>(null);
  const birdsSchedule = useRef<ReturnType<typeof setTimeout> | null>(null);
  const birdsAnim = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearAll = () => {
      if (tractorSchedule.current) clearTimeout(tractorSchedule.current);
      if (tractorAnim.current) clearTimeout(tractorAnim.current);
      if (birdsSchedule.current) clearTimeout(birdsSchedule.current);
      if (birdsAnim.current) clearTimeout(birdsAnim.current);
    };

    if (!active) {
      isActive.current = false;
      clearAll();
      setTractorDir(null);
      setBirdsDir(null);
      return;
    }

    // Don't restart timers if already running (active toggled within same session)
    if (isActive.current) return;
    isActive.current = true;

    const doTractor = () => {
      if (!isActive.current) return;
      const dir = Math.random() < 0.5 ? "ltr" : "rtl";
      setTractorDir(dir);
      setTractorKey((k) => k + 1);
      tractorAnim.current = setTimeout(() => {
        if (!isActive.current) return;
        setTractorDir(null);
        // 7–12 seconds between passes
        const delay = (7 + Math.random() * 5) * 1000;
        tractorSchedule.current = setTimeout(doTractor, delay);
      }, TRACTOR_ANIM_MS);
    };

    const doBirds = () => {
      if (!isActive.current) return;
      const dir = Math.random() < 0.5 ? "ltr" : "rtl";
      setBirdsDir(dir);
      setBirdsKey((k) => k + 1);
      birdsAnim.current = setTimeout(() => {
        if (!isActive.current) return;
        setBirdsDir(null);
        // 6–14 seconds between passes
        const delay = (6 + Math.random() * 8) * 1000;
        birdsSchedule.current = setTimeout(doBirds, delay);
      }, BIRDS_ANIM_MS);
    };

    // First appearance: 3–7 seconds after gameplay starts
    tractorSchedule.current = setTimeout(doTractor, (3 + Math.random() * 4) * 1000);
    birdsSchedule.current = setTimeout(doBirds, (2 + Math.random() * 5) * 1000);

    return () => {
      isActive.current = false;
      clearAll();
    };
  }, [active]);

  if (!tractorDir && !birdsDir) return null;

  return (
    <div className="ambient-layer" aria-hidden="true">
      {tractorDir && (
        <div key={tractorKey} className={`ambient-tractor-wrap dir-${tractorDir}`}>
          <img src={TRACTOR_URL} alt="" draggable={false} />
        </div>
      )}
      {birdsDir && (
        <div key={birdsKey} className={`ambient-birds-wrap dir-${birdsDir}`}>
          <img src={BIRDS_URL} alt="" draggable={false} />
        </div>
      )}
    </div>
  );
}

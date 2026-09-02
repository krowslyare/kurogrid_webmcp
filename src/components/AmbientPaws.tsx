import type { CSSProperties } from "react";

type PawItem = {
  top: string;
  left?: string;
  right?: string;
  size: number;
  rotate: number;
  opacity: number;
};

const PAWS: PawItem[] = [
  // --- 1. HERO SECTION (0 - 750px) ---
  { top: "110px", left: "4%", size: 68, rotate: -22, opacity: 0.055 },
  { top: "150px", right: "7%", size: 76, rotate: 18, opacity: 0.05 },
  { top: "320px", left: "2%", size: 50, rotate: 12, opacity: 0.046 },
  { top: "440px", right: "5%", size: 58, rotate: -28, opacity: 0.048 },
  { top: "590px", left: "22%", size: 44, rotate: 36, opacity: 0.042 },
  { top: "710px", right: "12%", size: 64, rotate: -15, opacity: 0.05 },

  // --- 2. SERVICES SECTION (750 - 1450px) ---
  { top: "860px", left: "3.5%", size: 74, rotate: 26, opacity: 0.052 },
  { top: "960px", right: "3%", size: 82, rotate: -18, opacity: 0.048 },
  { top: "1100px", left: "16%", size: 48, rotate: -14, opacity: 0.04 },
  { top: "1250px", right: "15%", size: 54, rotate: 28, opacity: 0.044 },
  { top: "1380px", left: "5%", size: 66, rotate: -8, opacity: 0.05 },

  // --- 3. BOOKING SECTION (1450 - 2150px) ---
  { top: "1520px", right: "4%", size: 78, rotate: 32, opacity: 0.05 },
  { top: "1640px", left: "2.5%", size: 60, rotate: -25, opacity: 0.048 },
  { top: "1780px", right: "20%", size: 46, rotate: 16, opacity: 0.04 },
  { top: "1920px", left: "10%", size: 56, rotate: 42, opacity: 0.045 },
  { top: "2080px", right: "4.5%", size: 70, rotate: -16, opacity: 0.05 },

  // --- 4. OUR APPROACH & HOURS (2150 - 2850px) ---
  { top: "2220px", left: "3%", size: 80, rotate: -26, opacity: 0.052 },
  { top: "2350px", left: "47%", size: 48, rotate: 20, opacity: 0.04 },
  { top: "2480px", right: "3%", size: 70, rotate: 30, opacity: 0.05 },
  { top: "2640px", right: "18%", size: 52, rotate: -12, opacity: 0.042 },
  { top: "2780px", left: "5.5%", size: 64, rotate: 22, opacity: 0.048 },

  // --- 5. CLOSING BANNER & FOOTER (2850 - 3600px) ---
  { top: "2920px", right: "6%", size: 76, rotate: -24, opacity: 0.05 },
  { top: "3100px", left: "2%", size: 58, rotate: 15, opacity: 0.046 },
  { top: "3280px", right: "3%", size: 64, rotate: 34, opacity: 0.05 },
  { top: "3440px", left: "20%", size: 48, rotate: -16, opacity: 0.042 },
  { top: "3540px", right: "8%", size: 70, rotate: 22, opacity: 0.048 },
];

export function AmbientPaws() {
  return (
    <div aria-hidden="true" className="clinic-ambient-paws">
      {PAWS.map((paw, i) => {
        const style: CSSProperties = {
          top: paw.top,
          left: paw.left,
          right: paw.right,
          width: `${paw.size}px`,
          height: `${paw.size}px`,
          transform: `rotate(${paw.rotate}deg)`,
          opacity: paw.opacity,
        };
        return <PawSvg key={i} style={style} />;
      })}
    </div>
  );
}

function PawSvg({ style }: { style: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className="ambient-paw"
      style={style}
      viewBox="0 0 64 64"
    >
      <circle cx="19" cy="20" r="7" />
      <circle cx="32" cy="14" r="7" />
      <circle cx="45" cy="20" r="7" />
      <circle cx="51" cy="33" r="7" />
      <path d="M32 27c-11 0-19 9-19 19 0 7 5 10 11 8 5-2 6-5 8-5s3 3 8 5c6 2 11-1 11-8 0-10-8-19-19-19Z" />
    </svg>
  );
}

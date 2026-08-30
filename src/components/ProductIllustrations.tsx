type IllustrationProps = {
  className?: string;
};

export function AppointmentHandoffIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      className={`product-illustration product-illustration--handoff ${className}`}
      fill="none"
      viewBox="0 0 520 240"
    >
      <path className="illustration-ground" d="M21 204C126 187 204 222 304 205c74-13 123-10 194 5" />

      <g className="illustration-customer">
        <path className="illustration-soft" d="M27 60c0-18 15-33 33-33h93c18 0 33 15 33 33v122H27V60Z" />
        <circle className="illustration-acid" cx="76" cy="82" r="24" />
        <path className="illustration-ink" d="M63 75c4-11 19-14 28-5 6 6 7 17 2 25-4 7-13 11-21 8-12-4-15-18-9-28Z" />
        <path className="illustration-line" d="M64 83c-7-6-13-5-16 2M91 83c7-6 13-5 16 2M72 95c4 4 9 4 13 0" />
        <path className="illustration-paper" d="M48 125h117v74H48z" />
        <path className="illustration-line" d="M64 144h69M64 159h82M64 175h50" />
        <circle className="illustration-acid" cx="147" cy="176" r="9" />
      </g>

      <g className="illustration-path">
        <path className="illustration-route" d="M183 118c48-34 102-33 151 0" />
        <circle className="illustration-node illustration-node--one" cx="218" cy="101" r="5" />
        <circle className="illustration-node illustration-node--two" cx="260" cy="91" r="5" />
        <circle className="illustration-node illustration-node--three" cx="302" cy="101" r="5" />
        <g className="illustration-agent">
          <circle className="illustration-dark" cx="260" cy="139" r="41" />
          <path className="illustration-agent-mark" d="M245 124h30v30h-30zM252 131l16 16M268 131l-16 16" />
        </g>
      </g>

      <g className="illustration-clinic">
        <path className="illustration-forest" d="M334 75 417 25l82 50v124H334V75Z" />
        <path className="illustration-paper" d="M357 105h119v94H357z" />
        <path className="illustration-acid" d="M399 55h36v36h-36z" />
        <path className="illustration-forest" d="M413 62h8v22h-8zM406 69h22v8h-22z" />
        <path className="illustration-line" d="M373 125h86M373 143h53" />
        <rect className="illustration-confirm" x="373" y="160" width="70" height="21" rx="10.5" />
        <path className="illustration-check" d="m388 171 5 5 10-12" />
      </g>

      <g className="illustration-leaves">
        <path d="M9 168c20-3 31-14 34-34-20 3-31 14-34 34ZM478 20c-1 17 6 29 23 36 1-17-6-29-23-36Z" />
        <path d="M18 181c13-5 25-14 34-29M493 45c-6-8-10-16-11-26" />
      </g>
    </svg>
  );
}

export function ArboledaCareIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      className={`product-illustration product-illustration--care ${className}`}
      fill="none"
      viewBox="0 0 560 560"
    >
      <path className="care-arch" d="M74 502V220C74 103 166 27 280 27s206 76 206 193v282H74Z" />
      <circle className="care-halo" cx="280" cy="253" r="154" />

      <g className="care-animal">
        <path className="care-dog" d="M151 375c0-87 51-153 129-153s129 66 129 153v127H151V375Z" />
        <path className="care-ear" d="M220 270c-55-18-92 5-98 57 30 7 58 0 80-21l18-36ZM340 270c55-18 92 5 98 57-30 7-58 0-80-21l-18-36Z" />
        <path className="care-face" d="M224 304c19-19 93-19 112 0 17 17 14 54-6 78-13 16-31 26-50 26s-37-10-50-26c-20-24-23-61-6-78Z" />
        <circle className="care-eye" cx="242" cy="322" r="6" />
        <circle className="care-eye" cx="318" cy="322" r="6" />
        <path className="care-nose" d="M265 352c7-7 23-7 30 0-1 12-8 19-15 19s-14-7-15-19Z" />
        <path className="care-detail" d="M280 371v19M280 390c-12 0-20-5-26-13M280 390c12 0 20-5 26-13" />
      </g>

      <g className="care-botanical care-botanical--left">
        <path d="M101 451c23-70 46-123 83-170" />
        <path d="M129 381c-41-10-61-36-58-76 41 10 61 36 58 76ZM146 343c-4-40 14-68 51-84 4 40-14 68-51 84ZM111 424c-36 1-59-16-70-49 36-1 59 16 70 49Z" />
      </g>
      <g className="care-botanical care-botanical--right">
        <path d="M459 451c-23-70-46-123-83-170" />
        <path d="M431 381c41-10 61-36 58-76-41 10-61 36-58 76ZM414 343c4-40-14-68-51-84-4 40 14 68 51 84ZM449 424c36 1 59-16 70-49-36-1-59 16-70 49Z" />
      </g>

      <g className="care-sparkles">
        <path d="M112 159v34M95 176h34M450 112v25M438 124h25" />
        <circle cx="453" cy="220" r="6" />
      </g>
    </svg>
  );
}

export function WorkspacePulseIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      className={`product-illustration product-illustration--workspace ${className}`}
      fill="none"
      viewBox="0 0 420 240"
    >
      <rect className="workspace-art-bg" x="1" y="1" width="418" height="238" rx="22" />
      <path className="workspace-art-route" d="M48 120h79c24 0 28-38 57-38h51c30 0 35 76 66 76h71" />
      <circle className="workspace-art-node workspace-art-node--one" cx="48" cy="120" r="10" />
      <circle className="workspace-art-node workspace-art-node--two" cx="210" cy="82" r="10" />
      <circle className="workspace-art-node workspace-art-node--three" cx="372" cy="158" r="10" />

      <g className="workspace-art-card workspace-art-card--signal">
        <rect x="28" y="33" width="122" height="58" rx="12" />
        <path d="M47 53h57M47 70h78" />
        <circle cx="128" cy="52" r="6" />
      </g>
      <g className="workspace-art-card workspace-art-card--draft">
        <rect x="149" y="107" width="132" height="72" rx="12" />
        <path d="M168 129h73M168 147h93M168 163h55" />
      </g>
      <g className="workspace-art-card workspace-art-card--live">
        <rect x="286" y="35" width="105" height="72" rx="12" />
        <path d="M306 58h58M306 75h42" />
        <path className="workspace-art-check" d="m346 91 7 7 16-18" />
      </g>
      <text className="workspace-art-label" x="28" y="217">SIGNAL</text>
      <text className="workspace-art-label" x="185" y="217">DRAFT</text>
      <text className="workspace-art-label" x="338" y="217">LIVE</text>
    </svg>
  );
}

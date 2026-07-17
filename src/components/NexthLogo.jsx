export default function NexthLogo({ iconSize = 48, variant = 'full', className = '' }) {
  const icon = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="-40 0 1064 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id="nth-bG" x1="506" y1="112" x2="762" y2="913" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6D6DD0"/>
          <stop offset="0.48" stopColor="#4B4BC1"/>
          <stop offset="1" stopColor="#31319A"/>
        </linearGradient>
        <linearGradient id="nth-bT" x1="512" y1="112" x2="760" y2="913" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#005C3B" stopOpacity="0.35"/>
          <stop offset="30%" stopColor="#00A8FF" stopOpacity="0.35"/>
          <stop offset="55%" stopColor="#0076FF" stopOpacity="0.28"/>
          <stop offset="75%" stopColor="#0056C8" stopOpacity="0.24"/>
          <stop offset="90%" stopColor="#00B36B" stopOpacity="0.30"/>
          <stop offset="100%" stopColor="#005C3B" stopOpacity="0.55"/>
        </linearGradient>
        <linearGradient id="nth-hl" x1="470" y1="120" x2="760" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="nth-sh" x1="600" y1="550" x2="770" y2="920" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00000000"/>
          <stop offset="100%" stopColor="#00000022"/>
        </linearGradient>
        <linearGradient id="nth-sG" x1="70" y1="230" x2="520" y2="793" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#B8B8EF"/>
          <stop offset="0.52" stopColor="#8D8DDD"/>
          <stop offset="1" stopColor="#5D5DCF"/>
        </linearGradient>
      </defs>
      <path d="M393 112H764C792 112 817 127 831 151L1014 468C1028 493 1028 524 1014 549L831 866C817 890 792 913 764 913H393C365 913 340 890 326 866L143 549C129 524 129 493 143 468L326 151C340 127 365 112 393 112Z" fill="url(#nth-bG)"/>
      <path d="M393 112H764C792 112 817 127 831 151L1014 468C1028 493 1028 524 1014 549L831 866C817 890 792 913 764 913H393C365 913 340 890 326 866L143 549C129 524 129 493 143 468L326 151C340 127 365 112 393 112Z" fill="url(#nth-bT)"/>
      <path d="M393 112H764C792 112 817 127 831 151L1014 468C1028 493 1028 524 1014 549L831 866C817 890 792 913 764 913H393C365 913 340 890 326 866L143 549C129 524 129 493 143 468L326 151C340 127 365 112 393 112Z" fill="url(#nth-hl)"/>
      <path d="M393 112H764C792 112 817 127 831 151L1014 468C1028 493 1028 524 1014 549L831 866C817 890 792 913 764 913H393C365 913 340 890 326 866L143 549C129 524 129 493 143 468L326 151C340 127 365 112 393 112Z" fill="url(#nth-sh)"/>
      <path d="M178 231H431C459 231 485 246 499 270L624 486C638 511 638 541 624 566L499 754C485 778 459 793 431 793H178C150 793 124 778 110 754L-15 538C-29 513 -29 483 -15 458L110 270C124 246 150 231 178 231Z" fill="url(#nth-sG)" opacity="0.78"/>
    </svg>
  );

  if (variant === 'icon') return icon;

  if (variant === 'stacked') return (
    <div className={`nth-logo nth-logo--stacked ${className}`} aria-label="nex">
      {icon}
      <span className="nth-logo-nex">nex</span>
    </div>
  );

  const text = (
    <div className="nth-logo-text" aria-label="nex tech hub">
      <span className="nth-logo-nex">nex</span>
      <span className="nth-logo-techhub">tech hub</span>
    </div>
  );

  if (variant === 'text') return text;

  return (
    <div className={`nth-logo ${className}`}>
      {icon}
      {text}
    </div>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 32 36" width="29" height="32" aria-hidden="true">
        <path
          d="M16 9C4-1-4 16 8 29c6 7 10 7 16 0C36 16 28-1 16 9Z"
          fill="currentColor"
        />
        <path d="M17 8c0-6 5-8 10-7-1 5-4 8-10 7" fill="#bdb899" />
      </svg>
      <span>
        plum<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function HubspotMark() {
  return (
    <svg
      viewBox="0 0 28 28"
      width="25"
      height="25"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="18" cy="16" r="5" />
      <path d="M18 11V4M14 13 6 7M14 20l-5 5" />
      <circle cx="18" cy="3" r="1.5" fill="currentColor" />
      <circle cx="5" cy="6" r="2" fill="currentColor" />
      <circle cx="8" cy="25" r="1.5" fill="currentColor" />
    </svg>
  );
}

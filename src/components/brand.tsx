import Image from "next/image";

export function Brand() {
  return (
    <div className="brand">
      <Image
        className="brand-logo"
        src="/brand/plum-official.png"
        alt="Plum Infinity logo"
        width={48}
        height={48}
      />
      <span className="brand-name">
        PLUM<small>LENDING</small>
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

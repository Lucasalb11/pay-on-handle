interface CloakLogoProps {
  className?: string;
  active?: boolean;
}

export function CloakLogo({
  className = "w-5 h-5",
  active = false,
}: CloakLogoProps) {
  const color = active ? "#9945FF" : "rgba(255,255,255,0.4)";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cloak"
    >
      {/* Eye outline */}
      <path
        d="M1 12C1 12 5 5 12 5C19 5 23 12 23 12C23 12 19 19 12 19C5 19 1 12 1 12Z"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Iris */}
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.75" />
      {/* Slash — privacy / invisible */}
      <line
        x1="3"
        y1="3"
        x2="21"
        y2="21"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

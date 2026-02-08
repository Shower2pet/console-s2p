interface S2PLogoProps {
  variant?: 'icon' | 'full';
  className?: string;
  size?: number;
}

export const S2PLogo = ({ variant = 'icon', className = '', size = 40 }: S2PLogoProps) => {
  if (variant === 'icon') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        {/* Bubbles (ears) */}
        <circle cx="28" cy="20" r="16" fill="#79BDE8" />
        <circle cx="72" cy="20" r="12" fill="#79BDE8" opacity="0.7" />
        <ellipse cx="28" cy="18" rx="4" ry="6" fill="white" opacity="0.4" transform="rotate(-20 28 18)" />
        <ellipse cx="72" cy="18" rx="3" ry="5" fill="white" opacity="0.4" transform="rotate(-20 72 18)" />
        {/* Face */}
        <circle cx="50" cy="55" r="30" fill="#79BDE8" opacity="0.3" />
        {/* Eyes */}
        <path d="M36 48 Q38 42 42 48" stroke="#005596" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M58 48 Q60 42 64 48" stroke="#005596" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Nose */}
        <ellipse cx="46" cy="60" rx="6" ry="5" fill="#79BDE8" />
        <ellipse cx="54" cy="60" rx="6" ry="5" fill="#79BDE8" />
        <circle cx="44" cy="62" r="1.5" fill="#005596" />
        <circle cx="48" cy="63" r="1.5" fill="#005596" />
        <circle cx="52" cy="63" r="1.5" fill="#005596" />
        <circle cx="56" cy="62" r="1.5" fill="#005596" />
        {/* Mouth */}
        <path d="M44 70 Q50 78 56 70" fill="#005596" />
        {/* Small bubble */}
        <circle cx="80" cy="45" r="6" fill="#79BDE8" opacity="0.5" />
        <ellipse cx="79" cy="44" rx="1.5" ry="2.5" fill="white" opacity="0.4" transform="rotate(-20 79 44)" />
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <S2PLogo variant="icon" size={size} />
      <div className="flex items-baseline font-heading">
        <span className="text-2xl font-bold" style={{ color: '#005596' }}>Shower</span>
        <span className="text-2xl font-bold" style={{ color: '#79BDE8' }}>2</span>
        <span className="text-2xl font-bold" style={{ color: '#005596' }}>Pet</span>
      </div>
    </div>
  );
};

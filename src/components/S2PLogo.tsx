import logoOld from "@/assets/logo-old.jpg";
import logo3d from "@/assets/logo-3d-mockup.jpg";

interface S2PLogoProps {
  variant?: 'icon' | 'full' | 'horizontal';
  className?: string;
  size?: number;
  light?: boolean;
}

/** 
 * SVG logo replicating the brand manual symbol: 
 * dog face made of bubbles (cane + bolle = simbolo unico)
 */
export const S2PLogo = ({ variant = 'icon', className = '', size = 40, light = false }: S2PLogoProps) => {
  const primaryBlue = light ? '#ffffff' : '#005596';
  const lightBlue = light ? 'rgba(255,255,255,0.7)' : '#79BDE8';
  const bubbleHighlight = light ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)';

  const IconSvg = ({ iconSize = size }: { iconSize?: number }) => (
    <svg width={iconSize} height={iconSize} viewBox="0 0 120 120" fill="none" className={variant === 'icon' ? className : ''}>
      {/* Top-left bubble (ear) - large filled */}
      <circle cx="32" cy="28" r="20" fill={lightBlue} />
      <ellipse cx="28" cy="22" rx="5" ry="8" fill={bubbleHighlight} transform="rotate(-25 28 22)" />
      
      {/* Top-right bubble (ear) - outline style */}
      <circle cx="88" cy="28" r="16" stroke={lightBlue} strokeWidth="3" fill="none" />
      <circle cx="88" cy="28" r="14" fill={lightBlue} opacity="0.2" />
      <ellipse cx="84" cy="23" rx="3" ry="5" fill={bubbleHighlight} transform="rotate(-20 84 23)" />
      
      {/* Middle-left bubble */}
      <circle cx="18" cy="58" r="14" stroke={lightBlue} strokeWidth="2.5" fill="none" />
      <circle cx="18" cy="58" r="12" fill={lightBlue} opacity="0.15" />
      <ellipse cx="15" cy="54" rx="3" ry="4.5" fill={bubbleHighlight} transform="rotate(-20 15 54)" />
      
      {/* Middle-right bubble - filled */}
      <circle cx="102" cy="52" r="12" fill={lightBlue} />
      <ellipse cx="99" cy="48" rx="3" ry="4" fill={bubbleHighlight} transform="rotate(-20 99 48)" />
      
      {/* Eyes - arched */}
      <path d="M42 56 Q46 48 52 56" stroke={primaryBlue} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M68 56 Q72 48 78 56" stroke={primaryBlue} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      
      {/* Nose / Snout */}
      <ellipse cx="52" cy="72" rx="10" ry="8" fill={lightBlue} />
      <ellipse cx="68" cy="72" rx="10" ry="8" fill={lightBlue} />
      
      {/* Nostrils dots */}
      <circle cx="48" cy="74" r="2" fill={primaryBlue} />
      <circle cx="54" cy="75.5" r="2" fill={primaryBlue} />
      <circle cx="66" cy="75.5" r="2" fill={primaryBlue} />
      <circle cx="72" cy="74" r="2" fill={primaryBlue} />
      
      {/* Mouth smile */}
      <path d="M52 82 Q60 92 68 82" fill={primaryBlue} />
      
      {/* Small bubble bottom-right */}
      <circle cx="100" cy="85" r="7" fill={lightBlue} opacity="0.4" />
      <ellipse cx="98" cy="83" rx="2" ry="3" fill={bubbleHighlight} transform="rotate(-20 98 83)" />
      
      {/* Tiny bubble */}
      <circle cx="108" cy="72" r="4" stroke={lightBlue} strokeWidth="1.5" fill="none" />
    </svg>
  );

  if (variant === 'icon') {
    return <IconSvg />;
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <IconSvg iconSize={size} />
        <div className="flex items-baseline font-heading">
          <span className="text-2xl font-bold" style={{ color: light ? '#ffffff' : '#005596' }}>Shower</span>
          <span className="text-2xl font-bold" style={{ color: light ? 'rgba(255,255,255,0.7)' : '#79BDE8' }}>2</span>
          <span className="text-2xl font-bold" style={{ color: light ? '#ffffff' : '#005596' }}>Pet</span>
        </div>
      </div>
    );
  }

  // Full variant - vertical
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <IconSvg iconSize={size * 2} />
      <div className="flex items-baseline font-heading">
        <span className="text-3xl font-bold" style={{ color: light ? '#ffffff' : '#005596' }}>Shower</span>
        <span className="text-3xl font-bold" style={{ color: light ? 'rgba(255,255,255,0.7)' : '#79BDE8' }}>2</span>
        <span className="text-3xl font-bold" style={{ color: light ? '#ffffff' : '#005596' }}>Pet</span>
      </div>
    </div>
  );
};

// Export image assets for use elsewhere
export { logoOld, logo3d };

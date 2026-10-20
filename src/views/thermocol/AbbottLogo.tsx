import React, { useState } from 'react';

interface AbbottLogoProps {
  className?: string;
  customLogoUrl?: string;
  companyTitle?: string;
}

// Embedded High-Resolution Base64/SVG Data URI for 100% offline & cross-device persistence
export const ABBOTT_LOGO_SVG_DATA_URI = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 42" fill="none">
  <rect width="40" height="40" rx="9" fill="#002F6C"/>
  <path d="M 29 12 C 29 8 22 8 18 8 C 12 8 8 13 8 21 C 8 29 13 34 21 34 C 27 34 30 30 30 26 L 25 26 C 25 28 23 30 20 30 C 15 30 13 26 13 21 C 13 16 16 12 20 12 C 24 12 25 14 25 17 L 25 34 L 29 34 Z" fill="#FFFFFF"/>
  <path d="M 20.5 16 C 16.5 16 14 18.5 14 22 C 14 25.5 16.5 28 20.5 28 C 24.5 28 25.5 24.5 25.5 22 C 25.5 18.5 24 16 20.5 16 Z" fill="#009FE3"/>
  <text x="48" y="31" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" letter-spacing="-0.8" fill="#002F6C">Abbott</text>
</svg>
`);

export const AbbottLogo: React.FC<AbbottLogoProps> = ({
  className = 'h-9 w-auto',
  customLogoUrl,
  companyTitle = 'ABBOTT INDIA LIMITED'
}) => {
  const [imgError, setImgError] = useState(false);
  const displayTitle = (companyTitle || 'ABBOTT INDIA LIMITED').toUpperCase();

  const useCustom = customLogoUrl && customLogoUrl.trim() !== '' && !imgError;

  return (
    <div className="flex flex-col items-start gap-1">
      {useCustom ? (
        <img
          src={customLogoUrl}
          alt="Company Logo"
          onError={() => setImgError(true)}
          className={`object-contain max-h-12 ${className}`}
        />
      ) : (
        /* Official Abbott Vector Brandmark */
        <svg
          className={className}
          viewBox="0 0 170 42"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Abbott Logo"
        >
          {/* Abbott Emblem */}
          <g>
            <rect width="40" height="40" rx="9" fill="#002F6C" />
            <path
              d="M 29 12 C 29 8 22 8 18 8 C 12 8 8 13 8 21 C 8 29 13 34 21 34 C 27 34 30 30 30 26 L 25 26 C 25 28 23 30 20 30 C 15 30 13 26 13 21 C 13 16 16 12 20 12 C 24 12 25 14 25 17 L 25 34 L 29 34 Z"
              fill="#FFFFFF"
            />
            <path
              d="M 20.5 16 C 16.5 16 14 18.5 14 22 C 14 25.5 16.5 28 20.5 28 C 24.5 28 25.5 24.5 25.5 22 C 25.5 18.5 24 16 20.5 16 Z"
              fill="#009FE3"
            />
          </g>
          {/* Abbott Wordmark */}
          <text
            x="48"
            y="31"
            fontFamily="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
            fontSize="26"
            fontWeight="900"
            letterSpacing="-0.8"
            fill="#002F6C"
          >
            Abbott
          </text>
        </svg>
      )}

      {/* Company Title placed neatly directly below the logo image */}
      <span className="text-[9.5pt] font-black text-[#002f6c] tracking-tight uppercase leading-tight font-sans">
        {displayTitle}
      </span>
    </div>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import { getDirectImageUrl } from '@/lib/utils';
import { UserCircle } from '@phosphor-icons/react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: React.ReactNode;
  containerClassName?: string;
}

export function SafeImage({ 
  src, 
  alt = 'Avatar', 
  fallback, 
  containerClassName = 'w-9 h-9 rounded-full overflow-hidden bg-[#1A1A1A] border border-[#262626] flex items-center justify-center shrink-0',
  className = 'w-full h-full object-cover',
  ...props 
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const directSrc = src ? getDirectImageUrl(src) : '';

  // Reset error state if the src URL changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const defaultFallback = fallback || <UserCircle className="w-5 h-5 text-[#666]" />;

  if (hasError || !directSrc) {
    return (
      <div className={containerClassName}>
        {defaultFallback}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <img 
        src={directSrc} 
        alt={alt} 
        className={className}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        {...props} 
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import NextImage from 'next/image';
import { getDirectImageUrl } from '@/lib/utils';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'placeholder'> {
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
  width = 256,
  height = 256,
  onError,
  ...props
}: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const directSrc = src ? getDirectImageUrl(src) : '';

  const defaultFallback = fallback || <UserCircle className="w-5 h-5 text-[#666]" />;

  if (failedSrc === directSrc || !directSrc) {
    return (
      <div className={containerClassName}>
        {defaultFallback}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <NextImage
        {...props}
        src={directSrc}
        alt={alt}
        width={Number(width) || 256}
        height={Number(height) || 256}
        unoptimized
        className={className}
        referrerPolicy="no-referrer"
        onError={event => {
          setFailedSrc(directSrc);
          onError?.(event);
        }}
      />
    </div>
  );
}

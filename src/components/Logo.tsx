import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const logoSizes = {
  sm: 'h-14 w-14',
  md: 'h-20 w-20',
  lg: 'h-36 w-36',
  xl: 'h-80 w-80'
};

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => (
  <img
    src="/assets/monfredini-logo.png"
    alt="Monfredini Transportes"
    className={`shrink-0 object-contain mix-blend-screen ${logoSizes[size]} ${className}`}
  />
);

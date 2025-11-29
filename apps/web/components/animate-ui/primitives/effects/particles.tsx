'use client';

import * as React from 'react';

export type ParticlesEffectType = {
  type?: string;
};

export type ParticlesProps = {
  children?: React.ReactNode;
  className?: string;
  effect?: ParticlesEffectType;
  animate?: boolean;
};

export function Particles({ children, className, animate, ...props }: ParticlesProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export type ParticlesEffectProps = {
  delay?: number;
  className?: string;
};

export function ParticlesEffect({ delay, className, ...props }: ParticlesEffectProps) {
  return <div className={className} {...props} />;
}


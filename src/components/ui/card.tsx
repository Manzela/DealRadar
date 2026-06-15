import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-100 bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover-lg',
        className,
      )}
      {...props}
    />
  );
}

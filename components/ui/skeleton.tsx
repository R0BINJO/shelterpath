import React, { useState } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Shimmer } from './primitives/shimmer';

export interface SkeletonProps extends ViewProps {
  className?: string;
  variant?: 'default' | 'circular' | 'text';
}

export function Skeleton({ variant = 'default', className, ...props }: SkeletonProps) {
  const [width, setWidth] = useState(0);

  return (
    <View
      className={cn(
        'overflow-hidden bg-muted',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 rounded-sm',
        variant === 'default' && 'rounded-md',
        className,
      )}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...props}
    >
      {width > 0 && <Shimmer width={width} />}
    </View>
  );
}

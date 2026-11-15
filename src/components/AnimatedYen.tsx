import React, { useEffect, useRef, useState } from 'react';
import { formatYen } from '../utils/storage';

interface AnimatedYenProps {
  value: number;
  /** 指定すると直前の値からロールアップ/ダウンする。未指定時は前回レンダー値からアニメーション */
  fromValue?: number;
  /** 一意のトリガーID（同値再レンダーや明示的アニメーション用） */
  triggerKey?: number;
  durationMs?: number;
  className?: string;
}

export const AnimatedYen: React.FC<AnimatedYenProps> = ({
  value,
  fromValue,
  triggerKey,
  durationMs = 450,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(
    fromValue !== undefined ? fromValue : value
  );
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const prevValueRef = useRef<number>(fromValue !== undefined ? fromValue : value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = fromValue !== undefined ? fromValue : prevValueRef.current;
    const endVal = value;
    prevValueRef.current = endVal;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      setDirection(null);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || durationMs <= 0) {
      setDisplayValue(endVal);
      setDirection(null);
      return;
    }

    setDirection(endVal > startVal ? 'up' : 'down');
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endVal);
        setDirection(null);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, fromValue, triggerKey, durationMs]);

  return (
    <span
      className={`inline-block transition-transform duration-200 ${
        direction === 'up'
          ? 'scale-105'
          : direction === 'down'
            ? 'scale-95'
            : 'scale-100'
      } ${className}`}
    >
      {formatYen(displayValue)}
    </span>
  );
};

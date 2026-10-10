'use client';

import React, { useRef, useState, useEffect } from 'react';

export interface MarqueeTextProps {
  text: string;
  className?: string;
  containerClassName?: string;
  speed?: number; // duration in seconds for full loop
  pauseOnHover?: boolean;
}

export function MarqueeText({
  text,
  className = '',
  containerClassName = '',
  speed,
  pauseOnHover = true,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [duration, setDuration] = useState(14);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const checkOverflow = () => {
      if (!container || !textEl) return;
      if (container.clientWidth === 0) return; // Wait until container is laid out
      
      const overflow = textEl.scrollWidth > container.clientWidth + 2;
      setIsOverflowing(overflow);
      if (overflow) {
        // Comfortably readable reading speed (~32px per second)
        const scrollDistance = textEl.scrollWidth;
        const calcDuration = speed || Math.max(8, Math.round(scrollDistance / 32));
        setDuration(calcDuration);
      }
    };

    checkOverflow();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => checkOverflow());
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', checkOverflow);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [text, speed]);

  if (!isOverflowing) {
    return (
      <div
        ref={containerRef}
        className={`truncate min-w-0 w-full max-w-full block ${containerClassName}`}
        style={{ width: '100%', maxWidth: '100%' }}
      >
        <span ref={textRef} className={`truncate block ${className}`} title={text}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden whitespace-nowrap min-w-0 w-full max-w-full block group cursor-default select-text ${containerClassName}`}
      style={{
        width: '100%',
        maxWidth: '100%',
        contain: 'layout paint',
        maskImage: 'linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)',
      }}
      title={text}
    >
      <div
        className={`inline-flex items-center w-max max-w-none ${
          pauseOnHover ? 'group-hover:[animation-play-state:paused] active:[animation-play-state:paused]' : ''
        }`}
        style={{
          animation: `marquee-scroll ${duration}s linear infinite`,
          willChange: 'transform',
        }}
      >
        <span className="inline-flex items-center gap-3.5 pr-6 flex-shrink-0">
          <span ref={textRef} className={`inline-block ${className}`}>
            {text}
          </span>
          <span className="text-slate-400 font-bold select-none text-[10px]">•</span>
        </span>
        <span className="inline-flex items-center gap-3.5 pr-6 flex-shrink-0" aria-hidden="true">
          <span className={`inline-block ${className}`}>
            {text}
          </span>
          <span className="text-slate-400 font-bold select-none text-[10px]">•</span>
        </span>
      </div>
    </div>
  );
}


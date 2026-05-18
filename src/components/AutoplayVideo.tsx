"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  title: string;
  className?: string;
}

export function AutoplayVideo({ src, title, className }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (hidden) return null;

  return (
    <video
      ref={ref}
      src={src}
      title={title}
      autoPlay={!reduced}
      muted
      loop
      playsInline
      controls={reduced}
      preload="metadata"
      onError={() => setHidden(true)}
      className={className}
    />
  );
}

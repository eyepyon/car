"use client";

import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  className?: string;
  shimmerWidth?: number;
}

export default function ShinyText({
  text,
  className,
  shimmerWidth = 100,
}: ShinyTextProps) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-primary bg-[length:200%_auto] animate-shine",
        className,
      )}
      style={
        {
          // Custom CSS variable for shine animation width if we wanted to make it dynamic
        }
      }
    >
      {text}
    </span>
  );
}

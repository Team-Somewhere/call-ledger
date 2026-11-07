"use client";

import React, { useEffect, useState, useRef } from "react";

const LOWER_GLYPHS = "abcdefghijklmnopqrstuvwxyz";
const UPPER_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGIT_GLYPHS = "0123456789";

function getScrambledChar(char: string): string {
  if (
    char === " " ||
    char === "\n" ||
    char === "\t" ||
    char === "." ||
    char === "," ||
    char === "%" ||
    char === "&" ||
    char === "-" ||
    char === "/" ||
    char === "#" ||
    char === ":" ||
    char === "(" ||
    char === ")" ||
    char === "@" ||
    char === "$"
  ) {
    return char;
  }
  if (char >= "a" && char <= "z") {
    return LOWER_GLYPHS[Math.floor(Math.random() * LOWER_GLYPHS.length)] ?? char;
  }
  if (char >= "A" && char <= "Z") {
    return UPPER_GLYPHS[Math.floor(Math.random() * UPPER_GLYPHS.length)] ?? char;
  }
  if (char >= "0" && char <= "9") {
    return DIGIT_GLYPHS[Math.floor(Math.random() * DIGIT_GLYPHS.length)] ?? char;
  }
  return char;
}

interface TextScrambleProps {
  text: string;
  className?: string;
  duration?: number;
  delay?: number;
  trigger?: boolean;
}

export const TextScramble: React.FC<TextScrambleProps> = ({
  text,
  className = "",
  duration = 1200,
  delay = 100,
  trigger = true,
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!trigger || completedRef.current) return;

    let startTimestamp: number | null = null;
    let animId: number;

    setDisplayText(
      text
        .split("")
        .map((char) => getScrambledChar(char))
        .join("")
    );

    const timeoutId = setTimeout(() => {
      let lastUpdate = 0;
      const updateInterval = 42;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);

        if (timestamp - lastUpdate >= updateInterval || progress >= 1) {
          lastUpdate = timestamp;
          const scrambled = text
            .split("")
            .map((char, index) => {
              if (index / text.length < progress) {
                return char;
              }
              return getScrambledChar(char);
            })
            .join("");

          setDisplayText(scrambled);
        }

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          completedRef.current = true;
          setDisplayText(text);
        }
      };

      animId = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animId) cancelAnimationFrame(animId);
      if (completedRef.current) {
        setDisplayText(text);
      }
    };
  }, [trigger, text, duration, delay]);

  return <span className={className}>{displayText}</span>;
};

export default TextScramble;


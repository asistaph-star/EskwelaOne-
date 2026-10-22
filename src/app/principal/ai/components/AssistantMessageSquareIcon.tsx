import React from 'react';

interface AssistantMessageSquareIconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Optically centered MessageSquare chat SVG for circular avatars and badges.
 * Normalizes Lucide's bottom-left speech tail offset so the bubble body is
 * perfectly centered inside circular avatar treatments.
 */
export function AssistantMessageSquareIcon({
  size = 14,
  color = '#FFFFFF',
  style,
}: AssistantMessageSquareIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="-0.5 -2 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-message-square"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

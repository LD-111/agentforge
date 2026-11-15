import type { ReactNode } from "react";

export type IconName = "search" | "close" | "star" | "starFilled" | "pencil" | "plus" | "trash" | "copy" | "chevron" | "diff" | "send";

interface IconProps {
  name: IconName;
  className?: string;
}

const glyphs: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.4 10.4 13.5 13.5" />
    </>
  ),
  close: (
    <>
      <path d="M4 4 12 12" />
      <path d="M12 4 4 12" />
    </>
  ),
  star: <path d="M8 1.7 9.7 5.6l4.2.4-3.2 2.8.9 4.1L8 10.8 4.4 12.9l.9-4.1L2.1 6l4.2-.4L8 1.7z" />,
  starFilled: <path fill="currentColor" stroke="none" d="M8 1.7 9.7 5.6l4.2.4-3.2 2.8.9 4.1L8 10.8 4.4 12.9l.9-4.1L2.1 6l4.2-.4L8 1.7z" />,
  pencil: (
    <>
      <path d="M9.8 2.4 13.6 6.2 6.2 13.6H2.4V9.8Z" />
      <path d="M8.4 3.8 12.2 7.6" />
    </>
  ),
  plus: (
    <>
      <path d="M8 3v10" />
      <path d="M3 8h10" />
    </>
  ),
  trash: (
    <>
      <path d="M3 4.5h10" />
      <path d="M6.2 4.4V3h3.6v1.4" />
      <path d="M4.2 4.5l.7 9h6.2l.7-9" />
    </>
  ),
  copy: (
    <>
      <rect x="6" y="6" width="8" height="8" rx="1" />
      <path d="M10 6V3.2H2.5V11H6" />
    </>
  ),
  send: (
    <>
      <path d="M2.2 8.2 13.8 2.4 8.6 13.8 7.4 8.8 2.2 8.2z" />
      <path d="M7.4 8.8 13.8 2.4" />
    </>
  ),
  chevron: <path d="M6 3.5 10.5 8 6 12.5" />,
  diff: (
    <>
      <rect x="1.75" y="2.5" width="5" height="11" rx="1" />
      <rect x="9.25" y="2.5" width="5" height="11" rx="1" />
    </>
  ),
};

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[name]}
    </svg>
  );
}

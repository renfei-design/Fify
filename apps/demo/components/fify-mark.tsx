import type { SVGProps } from "react";

export function FifyMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        className="fify-mark-ribbon"
        fill="#49C3D2"
        d="M45.4 3.4 18.1 14.9c-6.3 2.7-9.5 7.5-8.6 13.3.8 5.3 4.2 8.5 10.5 10.1l8.8 2.4v-5.8c0-6.3 3.1-10.9 9.2-13.6l10.4-4.6c5.1-2.3 7.3-5.9 6-9.7-1.2-3.6-4.8-5.3-9-3.6Z"
      />
      <path
        className="fify-mark-ribbon"
        fill="#49C3D2"
        d="M28.8 39.4c5.7 1.7 8.6 5 8.6 10.1v2.2c0 5.5-3 9.3-8.5 10.5-5.8 1.3-13.2-.4-19.6-3.4-1.8-.9-1.8-3.1.1-4l11.7-5.4c5-2.3 7.7-5.6 7.7-10Z"
      />
      <path
        className="fify-mark-plane"
        fill="#071318"
        d="m36.5 21.9 13.4-6c4.8-2.1 8.6.4 8.6 5.5v28.2c0 3.6-1.7 6.3-5.1 8.1L34.7 64c3.5-3 5.2-6.6 5.2-10.9v-6.8c0-4.3-2.4-7-7.3-8.4l-3.8-1v-3.6c0-5.2 2.6-9 7.7-11.4Z"
      />
      <circle
        className="fify-mark-cutout"
        fill="white"
        cx="35.1"
        cy="33.7"
        r="3.35"
      />
      <path
        className="fify-mark-cutout"
        fill="white"
        d="M35.3 39.1c2.2 0 3.7 1.7 3.7 4v10.2c0 4.6-1.9 8.2-5.8 10.7h-4.9c2.7-2.6 4-6.1 4-10.4V43c0-2.2 1.1-3.9 3-3.9Z"
      />
    </svg>
  );
}

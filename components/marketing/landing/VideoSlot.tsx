"use client";

import { useRef } from "react";
import { track } from "@vercel/analytics";

export type LandingVideo = {
  /** File in public/videos, e.g. "/videos/individuals-demo.mp4". */
  src: string;
  /** Still frame shown before playing. */
  poster?: string;
  /** WebVTT captions, e.g. "/videos/individuals-demo.vtt". */
  captions?: string;
  /** What the video shows, for screen readers and as the caption. */
  label: string;
};

/**
 * A real screen recording of Surfdesk. Renders nothing until a recording exists
 * (see docs/marketing/landing-demo-shots.md). Muted, never autoplays, plays inline on phones.
 */
export function VideoSlot({ page, video }: { page: string; video: LandingVideo | null }) {
  if (!video) return null;
  return <Player page={page} video={video} />;
}

function Player({ page, video }: { page: string; video: LandingVideo }) {
  const started = useRef(false);
  return (
    <figure className="card overflow-hidden">
      <video
        className="block aspect-[4/5] w-full bg-bg sm:aspect-video"
        controls
        muted
        playsInline
        preload="metadata"
        poster={video.poster}
        aria-label={video.label}
        onPlay={() => {
          if (started.current) return;
          started.current = true;
          track("Video Play", { page });
        }}
        onEnded={() => track("Video Complete", { page })}
      >
        <source src={video.src} type="video/mp4" />
        {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
      </video>
      <figcaption className="px-5 py-3 text-xs text-text-muted">{video.label}</figcaption>
    </figure>
  );
}

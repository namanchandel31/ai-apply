import { type ReactNode } from "react";
import { ThumbsUp } from "lucide-react";
import { OneTapLogomark } from "@/components/OneTapLogomark";
import { cn } from "@/lib/utils";

const DEMO_POST = {
  author: "Sarah Chen",
  headline: "Head of Engineering · Stripe",
  time: "2h",
  avatar: "/feed-avatars/sarah-chen.jpg",
  body: "We're hiring Senior Backend Engineers for Payments Infrastructure. You'll design distributed systems handling millions of transactions daily. Remote-friendly across US time zones. Strong systems background required.",
  reactions: 47,
} as const;

function ActionButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <span className="m-li-post-action">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function CommentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

type Props = {
  className?: string;
  showExtensionCallout?: boolean;
};

function HandDrawnHighlightRing() {
  return (
    <svg
      className="m-li-onetap-highlight-ring"
      viewBox="0 0 100 44"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M14,30 C9,19 24,7 50,9 C80,11 93,21 91,31 C89,39 72,43 44,41 C22,39 11,35 14,30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalloutArrow() {
  return (
    <svg className="m-li-onetap-callout-arrow" viewBox="0 0 40 24" fill="none" aria-hidden>
      <path
        d="M34 6 C26 6 16 10 6 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 10 L6 14 L10 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkedInApplyVisual({ className, showExtensionCallout = true }: Props) {
  return (
    <div className={cn("m-li-post-visual", className)} aria-hidden>
      <article className="m-li-post">
        <header className="m-li-post-header">
          <img
            className="m-li-post-avatar"
            src={DEMO_POST.avatar}
            alt=""
            width={40}
            height={40}
            loading="eager"
            decoding="async"
          />
          <div className="m-li-post-meta">
            <p className="m-li-post-author">{DEMO_POST.author}</p>
            <p className="m-li-post-headline">{DEMO_POST.headline}</p>
            <p className="m-li-post-time">{DEMO_POST.time}</p>
          </div>
        </header>

        <p className="m-li-post-body">{DEMO_POST.body}</p>

        <p className="m-li-post-reactions">
          <span className="m-li-post-reaction-icons">
            <span className="m-li-post-reaction-like">
              <ThumbsUp size={10} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="m-li-post-reaction-celebrate">🎉</span>
          </span>
          {DEMO_POST.reactions} reactions
        </p>

        <div className="m-li-post-actions">
          <ActionButton label="Like" icon={<ThumbsUp size={16} strokeWidth={1.75} aria-hidden />} />
          <ActionButton label="Comment" icon={<CommentIcon />} />
          <ActionButton label="Repost" icon={<RepostIcon />} />
          <ActionButton label="Send" icon={<SendIcon />} />
          <div className="m-li-post-onetap-wrap">
            {showExtensionCallout ? <HandDrawnHighlightRing /> : null}
            <button type="button" className="m-li-post-onetap" tabIndex={-1}>
              <OneTapLogomark className="m-li-post-onetap-mark" />
              <span>OneTap</span>
            </button>
          </div>
        </div>
      </article>

      {showExtensionCallout ? (
        <div className="m-li-onetap-callout-side">
          <p className="m-li-onetap-callout-text">
            Install the extension - you&apos;ll see this button on every job post
          </p>
          <CalloutArrow />
        </div>
      ) : null}
    </div>
  );
}

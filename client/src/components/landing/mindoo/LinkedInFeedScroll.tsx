import { type CSSProperties, type ReactNode } from "react";
import { ThumbsUp } from "lucide-react";
import { OneTapLogomark } from "@/components/OneTapLogomark";

const DICEBEAR_STYLE = "notionists";

function dicebearAvatarUrl(seed: string) {
  const params = new URLSearchParams({
    seed,
    size: "80",
  });
  return `https://api.dicebear.com/10.x/${DICEBEAR_STYLE}/png?${params.toString()}`;
}

const POSTS = [
  {
    id: "stripe",
    author: "Sarah Chen",
    headline: "Head of Engineering · Stripe",
    time: "2h",
    body: "We're hiring Senior Backend Engineers for Payments Infrastructure. You'll design distributed systems handling millions of transactions daily. Remote-friendly across US time zones. Strong systems background required. Email sarah.chen@stripe.com or comment below.",
    reactions: 47,
  },
  {
    id: "notion",
    author: "Marcus Rivera",
    headline: "Engineering Manager · Notion",
    time: "5h",
    body: "Open role: Full Stack Engineer on our Editor team. You'll ship features used by millions of writers and teams every day. TypeScript, React, and a love for polished UX. Reach out at marcus@notion.so",
    reactions: 31,
  },
  {
    id: "linear",
    author: "Jade Kim",
    headline: "VP Product · Linear",
    time: "1d",
    body: "Linear is looking for a Staff Product Designer and a Senior iOS Engineer. Small team, high bar. You'll own end-to-end product work from discovery to ship. Hiring@linear.app. Tell us what you've built and what you want to build next.",
    reactions: 89,
  },
  {
    id: "figma",
    author: "Alex Liu",
    headline: "Director of Design · Figma",
    time: "1d",
    body: "We're expanding the design systems group in SF and NYC. If you've built tokens, docs, and tools designers actually use, we'd love to hear from you. Full-time roles open now; reach out on LinkedIn or alex@figma.com.",
    reactions: 62,
  },
] as const;

const CARD_COUNT = POSTS.length;

function LinkedInPostCard({ post }: { post: (typeof POSTS)[number] }) {
  return (
    <article className="m-li-post">
      <header className="m-li-post-header">
        <img
          className="m-li-post-avatar"
          src={dicebearAvatarUrl(post.author)}
          alt=""
          width={40}
          height={40}
          loading="eager"
          decoding="async"
        />
        <div className="m-li-post-meta">
          <p className="m-li-post-author">{post.author}</p>
          <p className="m-li-post-headline">{post.headline}</p>
          <p className="m-li-post-time">{post.time}</p>
        </div>
      </header>

      <p className="m-li-post-body">{post.body}</p>

      <p className="m-li-post-reactions" aria-hidden>
        <span className="m-li-post-reaction-icons">
          <span className="m-li-post-reaction-like">
            <ThumbsUp size={10} strokeWidth={2.25} aria-hidden />
          </span>
          <span className="m-li-post-reaction-celebrate">🎉</span>
        </span>
        {post.reactions} reactions
      </p>

      <div className="m-li-post-actions" aria-hidden>
        <ActionButton label="Like" icon={<ThumbsUp size={16} strokeWidth={1.75} aria-hidden />} />
        <ActionButton label="Comment" icon={<CommentIcon />} />
        <ActionButton label="Repost" icon={<RepostIcon />} />
        <ActionButton label="Send" icon={<SendIcon />} />
        <button type="button" className="m-li-post-onetap" tabIndex={-1}>
          <OneTapLogomark className="m-li-post-onetap-mark" />
          <span>OneTap</span>
        </button>
      </div>
    </article>
  );
}

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

export function LinkedInFeedScroll() {
  const loopPosts = [...POSTS, ...POSTS];

  return (
    <div
      className="m-li-feed"
      aria-hidden
      style={{ "--li-card-count": CARD_COUNT } as CSSProperties}
    >
      <div className="m-li-feed-window">
        <div className="m-li-feed-track">
          {loopPosts.map((post, index) => (
            <LinkedInPostCard key={`${post.id}-${index}`} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}

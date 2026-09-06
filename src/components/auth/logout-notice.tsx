"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export function LogoutNotice({ message, deletedMessage }: { message: string; deletedMessage: string }) {
  const searchParams = useSearchParams();
  const [notice] = useState(() => searchParams.get("accountDeleted") === "1"
    ? deletedMessage : searchParams.get("loggedOut") === "1" ? message : null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!notice) return;
    // Consume the completion marker so a reload or copied link does not
    // announce a new logout. Keep this visit's confirmation visible.
    const url = new URL(window.location.href);
    url.searchParams.delete("loggedOut");
    url.searchParams.delete("accountDeleted");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    const frame = window.requestAnimationFrame(() => noticeRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [notice]);

  if (!notice) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
      <p ref={noticeRef} tabIndex={-1} role="status" className="border-l-2 border-accent bg-surface-warm px-4 py-3 text-sm leading-6 text-brown focus:outline-none">
        {notice}
      </p>
    </div>
  );
}

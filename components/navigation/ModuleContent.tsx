"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export function ModuleContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setScrolled(false);
  }, [pathname]);

  useEffect(() => {
    const syncWindowScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", syncWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", syncWindowScroll);
  }, []);

  return (
    <section
      ref={contentRef}
      className={`module-content ${scrolled ? "is-scrolled" : ""}`}
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 24)}
    >
      {children}
    </section>
  );
}

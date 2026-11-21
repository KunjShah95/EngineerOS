"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";

/**
 * Mobile-only conversion bar. It stays out of the way until the hero has been
 * read, and it steps aside once the closing CTA is on screen so the page never
 * asks twice in the same viewport.
 */
export function StickyCta() {
  const [scrolled, setScrolled] = useState(false);
  const [atCta, setAtCta] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > 640);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const target = document.getElementById("cta");
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setAtCta(entry.isIntersecting),
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const visible = scrolled && !atCta;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={reduced ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? undefined : { y: 24, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-base/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">
                Start your workspace
              </p>
              <p className="truncate text-[11px] text-tertiary">
                Free · self-hosted on Supabase
              </p>
            </div>
            <Link href="/register" className="ml-auto shrink-0">
              <Button size="sm" className="h-9 px-3.5">
                Start free
                <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

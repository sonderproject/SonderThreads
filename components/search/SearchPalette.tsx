"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { SearchResultsPanel } from "@/components/search/SearchResultsPanel";
import { searchAll, type SearchResults } from "@/lib/actions/search";
import { Dictate } from "@/components/voice/Dictate";

/** Fire this to open the palette from anywhere (e.g. the mobile More menu). */
export const OPEN_SEARCH_EVENT = "sonderthreads:open-search";

/** ⌘K / Ctrl+K search across people, notes, lists and tasks. */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const seq = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  // Following a result closes the palette.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    const mine = ++seq.current;
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(async () => {
      const r = await searchAll(q);
      if (mine === seq.current) setResults(r);
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="> search">
      <Dictate value={query} onChange={setQuery}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="People, notes, lists, tasks..."
          enterKeyHint="search"
          className="input font-mono"
        />
      </Dictate>
      {results && <SearchResultsPanel query={query.trim()} results={results} />}
    </Modal>
  );
}

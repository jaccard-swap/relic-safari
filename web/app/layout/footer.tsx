const DOCS_URL = "https://jaccard-swap.github.io/docs/";

// Small and out of the way on purpose - the nav bar already carries
// GitHub/Discord (SOCIAL_LINKS in app-layout.tsx) since those need to stay
// reachable without scrolling. Docs is a "go deeper if you want to" link,
// not a primary action, so it lives down here instead.
export function Footer() {
  return (
    <footer className="border-t border-amber-900/20 px-4 py-4 text-center">
      <a
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-amber-200/50 underline decoration-amber-200/20 underline-offset-2 transition-colors hover:text-amber-200"
      >
        📖 Read the docs — how MinHash similarity, the diamond contract, and the full game loop actually work
      </a>
    </footer>
  );
}

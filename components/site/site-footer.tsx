import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Link href="/" className="brand-mark text-[1.65rem]">
            OpenlyTalk
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Speaking practice for more intentional communication in English.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm">
          <Link href="/practice" className="footer-link">Practice</Link>
          <Link href="/about" className="footer-link">About</Link>
        </div>
      </div>
    </footer>
  );
}

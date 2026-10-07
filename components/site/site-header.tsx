import Link from "next/link";

const links = [
  { href: "/practice", label: "Practice" },
  { href: "/about", label: "About" },
];

export function SiteHeader({ active }: { active?: "practice" | "about" }) {
  return (
    <header className="site-header">
      <div className="site-shell flex min-h-20 items-center justify-between gap-6">
        <Link href="/" className="brand-mark" aria-label="OpenlyTalk home">
          OpenlyTalk
        </Link>

        <nav className="hidden items-center gap-9 sm:flex" aria-label="Main navigation">
          {links.map((link) => {
            const selected = active === link.label.toLowerCase();
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={selected ? "page" : undefined}
                className={`nav-link ${selected ? "nav-link-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <details className="mobile-nav sm:hidden">
          <summary aria-label="Open navigation">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </summary>
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

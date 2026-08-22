import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">Q</span>
        <span>Quizmaster</span>
      </header>
      <section className="landing-copy">
        <p className="eyebrow">One room. Every screen in sync.</p>
        <h1>Quizmaster</h1>
        <p className="lede">
          A shared stage for party games, built for the host, the players, and
          the room.
        </p>
      </section>
      <nav className="role-links" aria-label="Application views">
        <Link href="/host"><span>01</span> Host dashboard</Link>
        <Link href="/play"><span>02</span> Player view</Link>
        <Link href="/display"><span>03</span> Public display</Link>
      </nav>
    </main>
  );
}

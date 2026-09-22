import Link from "next/link";
import { Analyzer } from "@/components/Analyzer";

export default function HomePage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="mark" aria-hidden="true" />
          RepoLens
        </Link>
        <p>Public GitHub repositories</p>
      </header>
      <main>
        <Analyzer />
      </main>
      <footer className="trust">
        <p>Public repositories only. API keys stay in the Vercel project environment and never reach the browser.</p>
      </footer>
    </div>
  );
}

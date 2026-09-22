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
        <section className="intro">
          <h1>Explain a repository in three panels.</h1>
          <p>
            Paste a public GitHub URL. RepoLens reads the tree on the server and returns a
            plain-English explainer, an architecture diagram, and the steps to run it.
          </p>
        </section>
        <Analyzer />
      </main>
    </div>
  );
}

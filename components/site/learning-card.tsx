import Link from "next/link";

import { EditorialArt } from "@/components/site/editorial-art";
import { pillarLabels, type LearningPiece } from "@/lib/content/learning-pieces";

export function LearningCard({ piece, large = false }: { piece: LearningPiece; large?: boolean }) {
  const content = (
    <>
      <EditorialArt variant={piece.art} compact={!large} />
      <div className={large ? "p-6 sm:p-8" : "p-5"}>
        <p className="eyebrow">{pillarLabels[piece.primaryPillar]}</p>
        <h3 className={`font-editorial text-ink ${large ? "mt-3 text-3xl leading-[1.05] sm:text-4xl" : "mt-2 text-2xl leading-tight"}`}>
          {piece.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted">{piece.description}</p>
        <div className="mt-5 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-quiet">
          <span>{piece.readingMinutes} min read</span>
          {piece.available ? <span className="card-arrow" aria-hidden="true">→</span> : <span>Coming soon</span>}
        </div>
      </div>
    </>
  );

  if (!piece.available) {
    return <article className={`learning-card ${large ? "learning-card-large" : ""}`}>{content}</article>;
  }

  return (
    <Link href={`/learn/${piece.slug}`} className={`learning-card learning-card-link ${large ? "learning-card-large" : ""}`}>
      {content}
    </Link>
  );
}

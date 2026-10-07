import type { LearningPiece } from "@/lib/content/learning-pieces";

export function EditorialArt({ variant, compact = false }: {
  variant: LearningPiece["art"];
  compact?: boolean;
}) {
  return (
    <div className={`editorial-art editorial-art-${variant} ${compact ? "editorial-art-compact" : ""}`} aria-hidden="true">
      <span className="art-shape art-shape-one" />
      <span className="art-shape art-shape-two" />
      <span className="art-shape art-shape-three" />
    </div>
  );
}

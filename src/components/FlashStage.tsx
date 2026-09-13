interface FlashStageProps {
  currentSrc: string;
  caption?: string;
  fill?: boolean;
}

export function FlashStage({ currentSrc, caption, fill }: FlashStageProps) {
  return (
    <div className={fill ? "live-stage" : "stage-wrap"} aria-label="Visual cycle preview">
      {currentSrc ? (
        <img key={currentSrc} src={currentSrc} alt={caption || "Current hypnotic visual"} />
      ) : (
        <div className="stage-caption">Add images to cycle</div>
      )}
      {caption && !fill ? <div className="stage-caption">{caption}</div> : null}
    </div>
  );
}

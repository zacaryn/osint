import { AUTHORITY_LABEL } from "@shared/infrastructure-authority";
import {
  REACTIVE_CONFIDENCE_LABEL,
  type ReactiveAssessment,
} from "@shared/infrastructure-reactive";
import { timeAgo } from "../../time";

export default function ReactiveStatusBanner({ reactive }: { reactive: ReactiveAssessment }) {
  const tone =
    reactive.confidence === "corroborated"
      ? "corroborated"
      : reactive.confidence === "provisional"
        ? "provisional"
        : "lead";

  return (
    <div className={`react react--${tone}`}>
      <div className="react__head mono">
        {REACTIVE_CONFIDENCE_LABEL[reactive.confidence]}
        {reactive.trafficAligned && <span className="react__tag">PortWatch aligned</span>}
      </div>
      <p className="react__summary">{reactive.summary}</p>
      <div className="react__meta mono">
        {AUTHORITY_LABEL[reactive.authority]}
        {reactive.observedAt ? ` · ${timeAgo(reactive.observedAt)}` : ""}
      </div>
      {reactive.confidence === "lead" && (
        <p className="react__note">Shown early — map severity unchanged until corroboration or a reviewed overlay.</p>
      )}
    </div>
  );
}

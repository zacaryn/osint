/**
 * The pact-class reference, moved out of the inline selector.
 *
 * These four paragraphs are the reason the alliance layer is trustworthy — they
 * are what stops a trade bloc reading like an Article 5 guarantee — so they are
 * relocated rather than deleted. Here each class also carries its own groupings
 * and the obligation each one actually imposes, which the inline panel never had
 * room to say.
 */
import { ALLIANCES, PACT_CLASS_ORDER } from "@shared/alliance-registry";
import { PACT_CLASS_BLURB, PACT_CLASS_LABEL, memberCount } from "@shared/alliances";
import Sheet from "../Sheet";

export default function PactClassSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet title="Pact classes" open={open} onClose={onClose} variant="modal">
      <div className="sheet__group">
        <p className="cad__intro">
          A binding obligation to treat an attack on one as an attack on all, a technology-sharing
          programme, a trade bloc and a phrase from a speech are four different objects. Rendering them
          alike would be the most misleading thing this board could do, so each class gets a treatment you
          can name without the legend.
        </p>
      </div>

      {PACT_CLASS_ORDER.map((pactClass) => (
        <div className="sheet__group" key={pactClass}>
          <div className="sheet__legend" data-class={pactClass}>
            {PACT_CLASS_LABEL[pactClass]}
          </div>
          <p className="cad__warn pactref__blurb" data-class={pactClass}>
            {PACT_CLASS_BLURB[pactClass]}
          </p>
          {ALLIANCES.filter((a) => a.pactClass === pactClass).map((a) => (
            <div className="row" key={a.id}>
              <div className="row__top">
                <i className="actor__dot" style={{ background: a.color }} />
                <span className="row__title">{a.short}</span>
                <span className="tag tag--grey">{memberCount(a)}</span>
              </div>
              <span className="row__meta">{a.name}</span>
              <span className="row__summary">{a.obligation}</span>
            </div>
          ))}
        </div>
      ))}
    </Sheet>
  );
}

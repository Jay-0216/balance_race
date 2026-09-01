import { useEffect, useState } from "react";
import { fetchPendingCards, voteCard, type PendingCard } from "../net/submissions";
import { isOnlineAvailable } from "../net/supabase";
import Offline from "../ui/Offline";
import "./CardVoteList.css";

/**
 * The other half of the card queue: cards someone else wrote, waiting on
 * enough votes to join the deck or get quietly dropped (see migrations/0010
 * for the thresholds). Your own submissions never show up here - there is
 * nothing to weigh in on your own card.
 */
export default function CardVoteList() {
  const [cards, setCards] = useState<PendingCard[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const online = isOnlineAvailable();

  useEffect(() => {
    if (!online) return;
    let alive = true;
    void fetchPendingCards().then((c) => alive && setCards(c));
    return () => {
      alive = false;
    };
  }, [online]);

  const cast = async (card: PendingCard, value: 1 | -1) => {
    if (busy) return;
    setBusy(card.id);
    try {
      const result = await voteCard(card.id, value);
      setCards((prev) =>
        (prev ?? [])
          .map((c) => (c.id === card.id ? { ...c, up: result.up, down: result.down, mine: value } : c))
          // decided the moment this vote crossed a threshold - nothing left
          // here to weigh in on
          .filter((c) => c.id !== card.id || result.status === "pending"),
      );
    } catch {
      // someone else's vote may have just decided it, or the network hiccuped -
      // either way a fresh list is simpler than guessing which
      void fetchPendingCards().then(setCards);
    } finally {
      setBusy(null);
    }
  };

  if (!online) return <Offline what="투표할 수" />;
  if (cards === null) return <p className="form-offline">불러오는 중…</p>;
  if (cards.length === 0) {
    return <p className="form-offline">지금은 투표할 카드가 없다. 나중에 다시 와줘.</p>;
  }

  return (
    <ul className="cv-list">
      {cards.map((card) => (
        <li key={card.id} className="cv-card">
          <div className="cv-head">
            <span className="cv-cat">{card.category}</span>
            {card.author && <span className="cv-by">{card.author}</span>}
          </div>

          <div className="cv-sides">
            <div className="cv-side a">
              <span className="cv-tag">A</span>
              <span className="cv-emoji">{card.aEmoji}</span>
              <span className="cv-text">{card.aText}</span>
            </div>
            <span className="cv-vs">VS</span>
            <div className="cv-side b">
              <span className="cv-tag">B</span>
              <span className="cv-emoji">{card.bEmoji}</span>
              <span className="cv-text">{card.bText}</span>
            </div>
          </div>

          <div className="cv-votes">
            <button
              className={"cv-vote up" + (card.mine === 1 ? " on" : "")}
              disabled={busy === card.id}
              onClick={() => cast(card, 1)}
            >
              👍 재밌다 <b>{card.up}</b>
            </button>
            <button
              className={"cv-vote down" + (card.mine === -1 ? " on" : "")}
              disabled={busy === card.id}
              onClick={() => cast(card, -1)}
            >
              👎 별로다 <b>{card.down}</b>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

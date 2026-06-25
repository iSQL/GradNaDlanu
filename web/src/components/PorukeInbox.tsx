import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mediaUrl } from '../lib/api';
import { formatDate } from '../lib/format';
import { MessageThread } from './MessageThread';
import type {
  ConversationDetail,
  ConversationSummary,
  MyServiceRequest,
  ServiceRequestStatus,
} from '../types';

const SR_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  pending: 'na čekanju',
  quoted: 'stigla ponuda',
  accepted: 'prihvaćeno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
  completed: 'završeno',
};

interface Props {
  currentUserId: number;
  conversations: ConversationSummary[] | null;
  serviceRequests: MyServiceRequest[] | null;
  reloadConversations: () => Promise<void>;
  reloadServiceRequests: () => Promise<void>;
}

type Selected =
  | { kind: 'conversation'; id: number }
  | { kind: 'service'; id: number }
  | null;

interface InboxThread {
  kind: 'conversation' | 'service';
  id: number;
  key: string;
  sortAt: string;
  title: string;
  counterparty: string;
  snippet: string;
  unread: number;
  statusLabel?: string;
  adArchived?: boolean;
}

export function PorukeInbox({
  currentUserId,
  conversations,
  serviceRequests,
  reloadConversations,
  reloadServiceRequests,
}: Props) {
  const [selected, setSelected] = useState<Selected>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threads = useMemo<InboxThread[]>(() => {
    const list: InboxThread[] = [];
    for (const c of conversations ?? []) {
      list.push({
        kind: 'conversation',
        id: c.id,
        key: `c-${c.id}`,
        sortAt: c.lastMessageAt,
        title: c.adTitleSnapshot ?? 'Razgovor',
        counterparty: c.counterpartyName,
        snippet: c.lastSnippet ?? '',
        unread: c.unreadCount,
        // adId set + not active ⇒ ad is archived (a purged ad would have CASCADE-
        // deleted this conversation, so it can't be "gone" while the thread exists).
        adArchived: c.adId !== null && !c.adActive,
      });
    }
    for (const s of serviceRequests ?? []) {
      list.push({
        kind: 'service',
        id: s.id,
        key: `s-${s.id}`,
        sortAt: s.createdAt,
        title: `Zahtev: ${s.locationName}`,
        counterparty: s.locationName,
        snippet: s.payload.description,
        unread: 0,
        statusLabel: SR_STATUS_LABELS[s.status],
      });
    }
    list.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
    return list;
  }, [conversations, serviceRequests]);

  // Load the selected conversation, mark it read, and refresh the list badge.
  useEffect(() => {
    if (selected?.kind !== 'conversation') {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    api
      .getConversation(selected.id)
      .then(async (d) => {
        if (cancelled) return;
        setDetail(d);
        try {
          await api.markConversationRead(selected.id);
          await reloadConversations();
        } catch {
          /* badge refresh is best-effort */
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, reloadConversations]);

  const selectedService =
    selected?.kind === 'service'
      ? (serviceRequests ?? []).find((s) => s.id === selected.id) ?? null
      : null;

  const sendMessage = async (body: string) => {
    if (selected?.kind !== 'conversation') return;
    await api.postMessage(selected.id, body);
    const fresh = await api.getConversation(selected.id);
    setDetail(fresh);
    await reloadConversations();
  };

  const deleteConversation = async (id: number) => {
    if (!window.confirm('Obrisati ovaj razgovor? Biće uklonjen i kod druge strane.')) return;
    try {
      await api.deleteConversation(id);
      setSelected(null);
      setDetail(null);
      await reloadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const acceptServiceRequest = async (id: number) => {
    if (!window.confirm('Prihvatiti ovu ponudu?')) return;
    try {
      await api.acceptServiceRequest(id);
      await reloadServiceRequests();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cancelServiceRequest = async (id: number) => {
    if (!window.confirm('Otkazati ovaj zahtev?')) return;
    try {
      await api.cancelServiceRequest(id);
      await reloadServiceRequests();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loading = conversations === null || serviceRequests === null;

  return (
    <div className="poruke">
      {error && <div className="ms-error">{error}</div>}
      {loading ? (
        <div className="ms-empty">Učitavanje…</div>
      ) : threads.length === 0 ? (
        <div className="ms-empty">Nemate poruka ni zahteva majstoru.</div>
      ) : (
        <div className="poruke-grid">
          <aside className="poruke-list">
            {threads.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`poruke-item ${
                  selected?.kind === t.kind && selected.id === t.id ? 'is-active' : ''
                }`}
                onClick={() => setSelected({ kind: t.kind, id: t.id } as Selected)}
              >
                <div className="poruke-item-top">
                  <span className="poruke-item-cp">{t.counterparty}</span>
                  {t.unread > 0 && <span className="poruke-unread">{t.unread}</span>}
                  {t.statusLabel && <span className="poruke-status">{t.statusLabel}</span>}
                </div>
                <div className="poruke-item-title">
                  {t.title}
                  {t.adArchived && <span className="poruke-archived-flag"> (arhiviran)</span>}
                </div>
                {t.snippet && <div className="poruke-item-snippet">{t.snippet}</div>}
                <div className="poruke-item-date">{formatDate(t.sortAt)}</div>
              </button>
            ))}
          </aside>

          <div className="poruke-detail">
            {selected === null ? (
              <div className="ms-empty">Izaberite razgovor ili zahtev sa leve strane.</div>
            ) : selected.kind === 'conversation' ? (
              detailLoading || !detail ? (
                <div className="ms-empty">Učitavanje razgovora…</div>
              ) : (
                <div className="poruke-conv">
                  <div className="poruke-conv-head">
                    <div className="poruke-conv-headline">
                      <h3 className="poruke-conv-title">{detail.counterpartyName}</h3>
                      <button
                        type="button"
                        className="poruke-conv-delete"
                        onClick={() => deleteConversation(detail.id)}
                        title="Obriši razgovor"
                      >
                        Obriši razgovor
                      </button>
                    </div>
                    {detail.adTitleSnapshot && (
                      <div className="poruke-conv-sub">
                        povodom oglasa{' '}
                        {detail.adActive && detail.adId ? (
                          <Link to={`/oglasi/${detail.adId}`}>{detail.adTitleSnapshot}</Link>
                        ) : (
                          <em>{detail.adTitleSnapshot}</em>
                        )}
                        {!detail.adActive && (
                          <span className="poruke-archived-flag"> (oglas arhiviran)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <MessageThread
                    messages={detail.messages}
                    currentUserId={currentUserId}
                    onSend={sendMessage}
                  />
                </div>
              )
            ) : selectedService ? (
              <article className="ms-order">
                <div className="ms-order-head">
                  <div className="ms-order-id">
                    <Link to={`/objekat/${selectedService.locationSlug}`} className="ms-ticket-loc">
                      {selectedService.locationName}
                    </Link>
                    <div className="ms-order-meta">
                      zahtev <span className="ms-order-num">№ {selectedService.id}</span> · poslato{' '}
                      {formatDate(selectedService.createdAt)}
                    </div>
                  </div>
                  <div className={`ms-stamp s-${selectedService.status}`}>
                    {SR_STATUS_LABELS[selectedService.status]}
                  </div>
                </div>

                <p className="ms-order-body">{selectedService.payload.description}</p>

                {selectedService.payload.photoIds.length > 0 && (
                  <div className="ms-order-thumbs">
                    {selectedService.payload.photoIds.map((id) => (
                      <a key={id} href={mediaUrl(id)} target="_blank" rel="noreferrer">
                        <img src={mediaUrl(id)} alt={`photo-${id}`} />
                      </a>
                    ))}
                  </div>
                )}

                {selectedService.quote && (
                  <div className="ms-quote">
                    <div className="ms-quote-label">— Ponuda majstora —</div>
                    <div className="ms-quote-main">
                      <strong>{selectedService.quote.priceRsd.toLocaleString('sr-RS')} RSD</strong> ·
                      termin {selectedService.quote.availableDate}
                    </div>
                    {selectedService.quote.note && (
                      <div className="ms-quote-note">{selectedService.quote.note}</div>
                    )}
                  </div>
                )}

                {selectedService.status === 'pending' && (
                  <div className="ms-order-actions">
                    <button
                      className="ms-btn ms-btn-danger ms-btn-sm"
                      onClick={() => cancelServiceRequest(selectedService.id)}
                    >
                      Otkaži zahtev
                    </button>
                  </div>
                )}
                {selectedService.status === 'quoted' && (
                  <div className="ms-order-actions">
                    <button
                      className="ms-btn ms-btn-primary ms-btn-sm"
                      onClick={() => acceptServiceRequest(selectedService.id)}
                    >
                      Prihvati ponudu
                    </button>
                    <button
                      className="ms-btn ms-btn-danger ms-btn-sm"
                      onClick={() => cancelServiceRequest(selectedService.id)}
                    >
                      Otkaži zahtev
                    </button>
                  </div>
                )}
              </article>
            ) : (
              <div className="ms-empty">Zahtev nije pronađen.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

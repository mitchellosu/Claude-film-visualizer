import { useState, useEffect, useCallback } from 'react';

const CATEGORIES = ['Sports', 'Tech & AI', 'Business', 'Create', 'Local'];

const CATEGORY_COLORS = {
  Sports:      { bg: '#1e3a5f', text: '#7dd3fc', border: '#2563eb' },
  'Tech & AI': { bg: '#1a2e1a', text: '#86efac', border: '#16a34a' },
  Business:    { bg: '#2d1f0e', text: '#fdba74', border: '#ea580c' },
  Create:      { bg: '#2e1a3a', text: '#c4b5fd', border: '#7c3aed' },
  Local:       { bg: '#1f2a1a', text: '#bef264', border: '#65a30d' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CategoryBadge({ category }) {
  if (!category) return null;
  const c = CATEGORY_COLORS[category] ?? { bg: '#1e293b', text: '#94a3b8', border: '#475569' };
  return (
    <span
      className="nl-category-badge"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {category}
    </span>
  );
}

// ─── Reader Modal ─────────────────────────────────────────────────────────────
function ReaderModal({ newsletter, onClose, onMarkRead }) {
  const [body, setBody] = useState(newsletter.body_html ?? null);
  const [loadingBody, setLoadingBody] = useState(!newsletter.full_content_fetched);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (newsletter.full_content_fetched) {
      setBody(newsletter.body_html);
      setLoadingBody(false);
      return;
    }
    setLoadingBody(true);
    fetch(`/api/newsletters/${newsletter.gmail_message_id}`)
      .then((r) => r.json())
      .then((d) => { setBody(d.body_html ?? null); setLoadingBody(false); })
      .catch(() => setLoadingBody(false));
  }, [newsletter.gmail_message_id, newsletter.full_content_fetched, newsletter.body_html]);

  useEffect(() => {
    if (!newsletter.is_read) onMarkRead(newsletter.gmail_message_id);
  }, [newsletter.gmail_message_id, newsletter.is_read, onMarkRead]);

  return (
    <div className="nl-modal-overlay" onClick={onClose}>
      <div className="nl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nl-modal-header">
          <div className="nl-modal-meta">
            <div className="nl-modal-sender">{newsletter.sender_name}</div>
            <div className="nl-modal-date">{timeAgo(newsletter.received_at)}</div>
          </div>
          <button className="nl-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="nl-modal-subject">{newsletter.subject}</div>
        <div className="nl-modal-tags">
          <CategoryBadge category={newsletter.category} />
        </div>

        <div className="nl-modal-body">
          {loadingBody ? (
            <div className="nl-loading-body">
              <div className="spinner" />
              <span>Loading content…</span>
            </div>
          ) : body ? (
            <iframe
              srcDoc={body}
              sandbox="allow-same-origin"
              className="nl-email-frame"
              title={newsletter.subject}
            />
          ) : (
            <div className="nl-no-body">
              No content available for this newsletter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Newsletter Card ──────────────────────────────────────────────────────────
function NewsletterCard({ item, onClick }) {
  return (
    <div
      className={`nl-card${item.is_read ? ' nl-card-read' : ''}`}
      onClick={() => onClick(item)}
    >
      <div className="nl-card-top">
        <span className="nl-card-sender">{item.sender_name}</span>
        <span className="nl-card-date">{timeAgo(item.received_at)}</span>
      </div>
      <div className="nl-card-subject">{item.subject}</div>
      <div className="nl-card-snippet">{item.snippet}</div>
      <div className="nl-card-bottom">
        <CategoryBadge category={item.category} />
      </div>
    </div>
  );
}

// ─── Sender Sidebar ───────────────────────────────────────────────────────────
function SenderPanel({ senders, selectedSender, selectedCategory, onSelectSender, onSelectCategory, onSync, syncing }) {
  const filteredSenders = selectedCategory === 'all'
    ? senders
    : senders.filter((s) => s.primary_category === selectedCategory);

  return (
    <div className="nl-sidebar">
      <div className="nl-sidebar-header">
        <div className="nl-sidebar-title">Newsletters</div>
        <button
          className={`nl-sync-btn${syncing ? ' nl-sync-btn-active' : ''}`}
          onClick={onSync}
          disabled={syncing}
          title="Sync from Gmail"
        >
          {syncing ? <span className="nl-sync-spin">↻</span> : '↻ Sync'}
        </button>
      </div>

      {/* Category filter pills */}
      <div className="nl-category-filter">
        <button
          className={`nl-cat-pill${selectedCategory === 'all' ? ' active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`nl-cat-pill${selectedCategory === cat ? ' active' : ''}`}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sender list */}
      <div className="nl-sender-list">
        {filteredSenders.length === 0 ? (
          <div className="nl-sender-empty">No newsletters yet — hit Sync</div>
        ) : (
          filteredSenders.map((s) => (
            <div
              key={s.email}
              className={`nl-sender-row${selectedSender === s.email ? ' active' : ''}`}
              onClick={() => onSelectSender(selectedSender === s.email ? null : s.email)}
            >
              <div className="nl-sender-info">
                <span className="nl-sender-name">{s.display_name || s.email.split('@')[0]}</span>
                {s.primary_category && (
                  <span className="nl-sender-cat">{s.primary_category}</span>
                )}
              </div>
              {s.unread_count > 0 && (
                <span className="nl-unread-badge">{s.unread_count}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main NewsletterReader ────────────────────────────────────────────────────
export default function NewsletterReader() {
  const [senders, setSenders] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedSender, setSelectedSender] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openItem, setOpenItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSender) params.set('senderEmail', selectedSender);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      params.set('limit', '60');

      const res = await fetch(`/api/newsletters?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();

      setSenders(data.senders ?? []);
      setNewsletters(data.newsletters ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('Could not load newsletters.');
    } finally {
      setLoading(false);
    }
  }, [selectedSender, selectedCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/newsletters/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setSyncMsg(`+${data.synced} new${data.nextPageToken ? ' (more available)' : ''}`);
      if (data.synced > 0) fetchData();
    } catch (err) {
      setSyncMsg(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkRead = useCallback(async (messageId) => {
    await fetch(`/api/newsletters/${messageId}/read`, { method: 'PATCH' }).catch(() => {});
    setNewsletters((prev) =>
      prev.map((n) => n.gmail_message_id === messageId ? { ...n, is_read: true } : n)
    );
    setSenders((prev) =>
      prev.map((s) => {
        const item = newsletters.find((n) => n.gmail_message_id === messageId);
        if (!item || s.email !== item.sender_email) return s;
        return { ...s, unread_count: Math.max(0, s.unread_count - 1) };
      })
    );
  }, [newsletters]);

  const headingText = selectedSender
    ? (senders.find((s) => s.email === selectedSender)?.display_name ?? selectedSender)
    : selectedCategory !== 'all'
    ? selectedCategory
    : 'All Newsletters';

  return (
    <div className="nl-wrap">
      <SenderPanel
        senders={senders}
        selectedSender={selectedSender}
        selectedCategory={selectedCategory}
        onSelectSender={setSelectedSender}
        onSelectCategory={(cat) => { setSelectedCategory(cat); setSelectedSender(null); }}
        onSync={handleSync}
        syncing={syncing}
      />

      <div className="nl-main">
        <div className="nl-main-header">
          <div className="nl-main-title">{headingText}</div>
          <div className="nl-main-meta">
            {syncMsg && <span className="nl-sync-msg">{syncMsg}</span>}
            {!loading && <span className="nl-count">{total} total</span>}
          </div>
        </div>

        {loading ? (
          <div className="nl-status">
            <div className="spinner" />
            <p>Loading newsletters…</p>
          </div>
        ) : error ? (
          <div className="nl-status">
            <p className="nl-error">{error}</p>
          </div>
        ) : newsletters.length === 0 ? (
          <div className="nl-status">
            <div className="nl-empty-icon">📬</div>
            <p className="nl-empty-title">
              {syncing ? 'Syncing…' : 'No newsletters here yet'}
            </p>
            <p className="nl-empty-sub">
              {selectedSender || selectedCategory !== 'all'
                ? 'Try selecting a different filter.'
                : 'Hit Sync to pull your newsletters from Gmail.'}
            </p>
          </div>
        ) : (
          <div className="nl-list">
            {newsletters.map((item) => (
              <NewsletterCard key={item.id} item={item} onClick={setOpenItem} />
            ))}
          </div>
        )}
      </div>

      {openItem && (
        <ReaderModal
          newsletter={openItem}
          onClose={() => setOpenItem(null)}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  );
}

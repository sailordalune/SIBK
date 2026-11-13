// FR-UI-03 / FR-UI-04 / FR-UI-02 (needs_review): metrik, tier, valuasi, narasi, tabel koreksi.
// R-11: simpan hasil ke sessionStorage supaya halaman tidak kosong saat di-refresh waktu demo.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { recompute } from '../api/client.js';
import ValidationBadge from '../components/ValidationBadge.jsx';
import MetricCard from '../components/MetricCard.jsx';
import TierCard from '../components/TierCard.jsx';
import ValuationCard from '../components/ValuationCard.jsx';
import ExtractionTable from '../components/ExtractionTable.jsx';
import NarrativePanel from '../components/NarrativePanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import mockResult from '../mock/analyze.json';

const STORAGE_KEY = 'telusurfin:last_result';
const INITIAL_STORAGE_KEY = 'telusurfin:initial_result';
const SHARES_STORAGE_KEY = 'telusurfin:shares_input';

const METRIC_GROUPS = [
  {
    title: 'Profitabilitas',
    items: [
      { key: 'roe', label: 'ROE', annualizedQuarterly: true },
      { key: 'roa', label: 'ROA', annualizedQuarterly: true },
      { key: 'net_margin', label: 'Margin laba bersih', annualizedQuarterly: false },
      { key: 'operating_margin', label: 'Margin usaha', annualizedQuarterly: false },
    ],
  },
  {
    title: 'Likuiditas',
    items: [{ key: 'current_ratio', label: 'Current ratio', annualizedQuarterly: false }],
  },
  {
    title: 'Solvabilitas',
    items: [
      { key: 'der', label: 'DER', annualizedQuarterly: false },
      { key: 'liability_to_asset', label: 'Liabilitas/aset', annualizedQuarterly: false },
    ],
  },
  {
    title: 'Pertumbuhan dan arus kas',
    items: [
      { key: 'revenue_growth', label: 'Pertumbuhan pendapatan', annualizedQuarterly: false },
      { key: 'earnings_growth', label: 'Pertumbuhan laba', annualizedQuarterly: false },
      { key: 'cash_conversion', label: 'Konversi kas', annualizedQuarterly: false },
      { key: 'ocf_to_assets', label: 'Arus kas operasi/aset', annualizedQuarterly: true },
    ],
  },
];

const SUMMARY_METRICS = [
  { key: 'roe', label: 'Imbal hasil atas ekuitas (ROE)' },
  { key: 'current_ratio', label: 'Rasio lancar' },
  { key: 'der', label: 'Liabilitas terhadap ekuitas (DER)' },
];

const periodFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'UTC' });

function ResultView({ id, activeSection, title, description, children }) {
  const headingId = `${id}-heading`;
  return (
    <section className="result-view" id={id} aria-labelledby={headingId} hidden={activeSection !== id}>
      <header className="result-view-heading">
        <h1 id={headingId} tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export default function ResultPage({ activeSection, features }) {
  const { state, pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState(() => {
    if (state?.result) return state.result;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return import.meta.env.VITE_USE_MOCK === 'true' ? mockResult : null;
  });

  const [initialResult, setInitialResult] = useState(() => {
    if (state?.initialResult) return state.initialResult;
    if (state?.result) return state.result;
    try {
      const savedInit = sessionStorage.getItem(INITIAL_STORAGE_KEY);
      if (savedInit) return JSON.parse(savedInit);
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return import.meta.env.VITE_USE_MOCK === 'true' ? mockResult : null;
  });

  const [sharesInput] = useState(() => {
    if (state?.sharesInput !== undefined) return state.sharesInput;
    try {
      const raw = sessionStorage.getItem(SHARES_STORAGE_KEY);
      if (raw != null && raw !== '') return Number(raw);
    } catch {}
    return null;
  });

  const [recomputing, setRecomputing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatLauncher = useRef(null);
  const chatRegion = useRef(null);
  const [recomputeError, setRecomputeError] = useState(null);

  function openChat() {
    setChatOpen(true);
    requestAnimationFrame(() => chatRegion.current?.focus());
  }

  function closeChat() {
    setChatOpen(false);
    chatLauncher.current?.focus();
  }

  useEffect(() => {
    if (!state?.result) return;
    setResult(state.result);
    setInitialResult(state.initialResult ?? state.result);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.result));
      sessionStorage.setItem(INITIAL_STORAGE_KEY, JSON.stringify(state.initialResult ?? state.result));
    } catch {}
    // REV-01: hapus state dari history agar refresh membaca sessionStorage
    navigate({ pathname, search, hash }, { replace: true, state: null });
  }, [state?.result, state?.initialResult, pathname, search, hash, navigate]);

  function saveResult(next) {
    setResult(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  async function handleRecomputeFields(nextFields) {
    if (!result) return;
    setRecomputing(true);
    setRecomputeError(null);
    try {
      const next = await recompute({
        entity: result.entity,
        fields: nextFields,
        ticker: result.entity.ticker,
        shares: sharesInput ?? null,
        market: result.market ?? null, // REV-02: pertahankan sumber & waktu harga
      });
      saveResult(next);
    } catch (err) {
      setRecomputeError(err.message);
    } finally {
      setRecomputing(false);
    }
  }

  async function handleApplyPrice(price) {
    if (!result) return;
    setRecomputing(true);
    setRecomputeError(null);
    try {
      const next = await recompute({
        entity: result.entity,
        fields: result.fields,
        ticker: result.entity.ticker,
        shares: sharesInput ?? null,
        price,
      });
      saveResult(next);
    } catch (err) {
      setRecomputeError(err.message);
    } finally {
      setRecomputing(false);
    }
  }

  async function handleResetFields() {
    if (!result || !initialResult) return;
    setRecomputing(true);
    setRecomputeError(null);
    try {
      const next = await recompute({
        entity: initialResult.entity,
        fields: structuredClone(initialResult.fields),
        ticker: initialResult.entity.ticker,
        shares: sharesInput ?? null,
        market: result.market ?? null, // REV-02: pertahankan sumber & waktu harga
      });
      saveResult(next);
    } catch (err) {
      setRecomputeError(err.message);
    } finally {
      setRecomputing(false);
    }
  }

  if (!result) {
    return (
      <main id="main-content" className="page-container empty-state card" tabIndex={-1}>
        <h1>Belum ada hasil analisis</h1>
        <p>Unggah laporan keuangan PDF terlebih dahulu untuk melihat hasil analisis.</p>
        <Link to="/" className="btn-primary">
          Kembali ke Halaman Unggah
        </Link>
      </main>
    );
  }

  const { entity, validation, metrics, tiering, market, valuation } = result;
  const isQuarterly = ['Q1', 'Q2', 'Q3', '9M', 'H1'].includes(entity?.period_type);
  const periodDate = Date.parse(entity?.period_end);
  const periodLabel = Number.isFinite(periodDate) ? periodFormatter.format(periodDate) : entity?.period_end;

  return (
    <main id="main-content" className="page-container result-page" tabIndex={-1}>
      <header className="result-header card">
        <div className="result-title-group">
          <div className="entity-summary">
            <span className="ticker-heading">{entity?.ticker || 'Emiten'}</span>
            {entity?.period_type && <span className="period-badge">{entity.period_type}</span>}
          </div>
          <div className="result-context-meta">
            {periodLabel && <span>Periode berakhir <time dateTime={entity.period_end}>{periodLabel}</time></span>}
            {entity?.unit && <span>Satuan laporan <strong>{entity.unit}</strong></span>}
          </div>
        </div>

        <div className="result-context-actions">
          <ValidationBadge validation={validation} />
          {entity?.file_url && (
            <a href={entity.file_url} target="_blank" rel="noreferrer" className="pdf-source-link">
              Buka PDF sumber <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </header>

      {recomputeError && (
        <div className="alert-error" role="alert">
          {recomputeError}
        </div>
      )}

      <ResultView
        id="ringkasan"
        activeSection={activeSection}
        title="Ringkasan"
        description="Gambaran umum kondisi keuangan dari laporan yang kamu unggah."
      >
        {validation?.needs_review && (
          <p className="result-review-link">
            <Link to="#data-ekstraksi">Periksa angka di Data Ekstraksi <span aria-hidden="true">→</span></Link>
          </p>
        )}
        <div className="result-summary-grid">
          <div>
            <NarrativePanel result={result} />
            <section className="tf-chat-launch" aria-label="Asisten AI untuk laporan">
              <div className="tf-chat-launch-copy">
                <h2>Tanyakan ke Asisten AI</h2>
                <p>{features === null ? 'Memeriksa ketersediaan asisten…' : features.chat
                  ? 'Tanyakan arti rasio atau telusuri angka ke halaman PDF sumber.'
                  : 'Asisten AI belum tersedia pada server analisis yang sedang terhubung.'}</p>
              </div>
              {features?.chat && (
                <button ref={chatLauncher} type="button" className="btn-primary"
                  aria-expanded={chatOpen} aria-controls={chatOpen ? 'report-chat' : undefined}
                  onClick={chatOpen ? closeChat : openChat}>
                  {chatOpen ? 'Tutup percakapan' : 'Mulai bertanya'}
                </button>
              )}
            </section>
            {chatOpen && features?.chat && (
              <div id="report-chat" ref={chatRegion} tabIndex={-1}>
                <ChatPanel key={entity?.file_id} result={result}
                  canExpand={features.chat_page} onClose={closeChat} />
              </div>
            )}
          </div>
          <section className="summary-figures" aria-labelledby="summary-figures-heading">
            <h2 id="summary-figures-heading">Angka utama</h2>
            <dl>
              {SUMMARY_METRICS.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{metrics?.[key]?.display ?? '—'}</dd>
                </div>
              ))}
            </dl>
            <Link to="#rasio">Lihat Rasio &amp; Tier <span aria-hidden="true">→</span></Link>
          </section>
        </div>
      </ResultView>

      <ResultView
        id="rasio"
        activeSection={activeSection}
        title="Rasio & Tier"
        description="Baca rasio per kelompok dan lihat posisi emiten dalam klaster."
      >
        <div className="result-ratio-grid">
          <TierCard tiering={tiering} />
          <section className="metrics-column card">
            <div className="section-header">
              <h2>Rasio kesehatan keuangan</h2>
              {isQuarterly && (
                <p className="meta-note">* Rasio bertanda bintang disetahunkan dari periode {entity.period_type}.</p>
              )}
            </div>
            <div className="metric-groups">
              {METRIC_GROUPS.map((group) => (
                <div key={group.title} className="metric-group">
                  <h3 className="metric-group-title">{group.title}</h3>
                  <div className="metric-cards-grid">
                    {group.items.map((item) => (
                      <MetricCard
                        key={item.key}
                        label={item.label}
                        metric={metrics?.[item.key]}
                        annualized={item.annualizedQuarterly && isQuarterly}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ResultView>

      <ResultView
        id="valuasi"
        activeSection={activeSection}
        title="Valuasi"
        description="Bandingkan harga saham dengan laba, nilai buku, dan penjualan perusahaan."
      >
        <ValuationCard
          valuation={valuation}
          market={market}
          isQuarterly={isQuarterly}
          onApplyPrice={handleApplyPrice}
          loading={recomputing}
        />
      </ResultView>

      <ResultView
        id="data-ekstraksi"
        activeSection={activeSection}
        title="Data Ekstraksi"
        description="Telusuri angka ke halaman PDF sumber dan koreksi angka jika diperlukan."
      >
        <ExtractionTable
          result={result}
          onRecompute={handleRecomputeFields}
          onReset={handleResetFields}
          loading={recomputing}
        />
      </ResultView>
    </main>
  );
}

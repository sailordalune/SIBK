// PER, PBV, P/S, Nilai Wajar Graham + harga & waktu ambil (FR-VLN, FR-MKT-03)
import { useState, useEffect } from 'react';
import { fmtRupiah, fmtNumber } from '../utils/format.js';
import '../styles/valuation.css';

function parsePriceInput(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^Rp\s*/i, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = Number(cleaned);
  return cleaned === '' || !Number.isFinite(num) || num <= 0 ? null : num;
}

function ValuationItem({ label, description, item, annualized = false }) {
  const hasVal = item && item.value != null && item.display && item.display !== '—';
  const isAnn = item?.annualized ?? annualized;

  return (
    <div className="valuation-item">
      <dt className="valuation-item-label">
        <strong>
          {label}
          {isAnn && <sup className="annualized-mark" title="Disetahunkan">*</sup>}
        </strong>
        {description && <small className="item-subnote">{description}</small>}
        {isAnn && <small className="item-subnote">Disetahunkan</small>}
      </dt>
      <dd className="valuation-item-value">
        {hasVal ? (
          <strong>{item.display}</strong>
        ) : (
          <span className="unavailable-reason">
            {item?.unavailable_reason || 'Tidak tersedia'}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function ValuationCard({ valuation, market, isQuarterly, onApplyPrice, loading = false }) {
  const [priceText, setPriceText] = useState(
    market?.price != null ? fmtNumber(market.price, 0) : ''
  );
  const [priceError, setPriceError] = useState(null);

  useEffect(() => {
    if (market?.price != null) {
      setPriceText(fmtNumber(market.price, 0));
    }
  }, [market?.price]);

  function handleSubmit(e) {
    e.preventDefault();
    const parsed = parsePriceInput(priceText);
    if (parsed == null) {
      setPriceError('Masukkan harga saham positif (mis. 3000 atau 3.000)');
      return;
    }
    setPriceError(null);
    onApplyPrice?.(parsed);
  }

  const shares = valuation?.shares_outstanding;
  const fv = valuation?.fair_value;
  const pd = valuation?.premium_discount;
  const hasFv = fv && fv.value != null && fv.display && fv.display !== '—';
  const hasPd = pd && pd.value != null && pd.display && pd.display !== '—';
  const marketSource = market?.source === 'manual' ? 'Input manual'
    : market?.source === 'yahoo-finance2' ? 'Yahoo Finance' : market?.source;

  return (
    <div className="ValuationCard">
      <div className="valuation-quote-strip">
        <section className="market-price-box" aria-labelledby="market-heading">
          <div className="market-current">
            <h2 id="market-heading">Harga saham</h2>
            {market?.price != null ? (
              <>
                <div className="market-price-value">{fmtRupiah(market.price)}</div>
                <div className="market-meta">
                  {marketSource && <div>Sumber harga <strong>{marketSource}</strong></div>}
                  {market.fetched_at && (
                    <div>
                      {market.source === 'manual' ? 'Waktu input ' : 'Waktu pengambilan '}
                      <time dateTime={market.fetched_at}>{new Date(market.fetched_at).toLocaleString('id-ID')}</time>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="market-missing-message">
                Harga pasar belum tersedia. Masukkan harga per saham untuk menghitung PER, PBV, P/S, dan selisih terhadap nilai wajar.
              </p>
            )}
          </div>
        </section>
        <section className="graham-box" aria-labelledby="graham-heading">
          <div className="graham-header">
            <h2 id="graham-heading">Nilai wajar</h2>
            <span className="graham-method">Graham Number</span>
          </div>
          <div className="graham-grid">
            <div>
              <small className="graham-sub">Estimasi nilai wajar</small>
              <div className="graham-val">
                {hasFv ? (
                  <strong>{fv.display}</strong>
                ) : (
                  <span className="unavailable-reason">{fv?.unavailable_reason || 'Tidak tersedia'}</span>
                )}
              </div>
            </div>
            <div>
              <small className="graham-sub">Premium atau diskon terhadap nilai wajar</small>
              <div className="graham-val">
                {hasPd ? (
                  <strong className={pd.value <= 0 ? 'text-success' : 'text-warning'}>
                    {pd.display}
                  </strong>
                ) : (
                  <span className="unavailable-reason">{pd?.unavailable_reason || 'Harga belum tersedia'}</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <form onSubmit={handleSubmit} className="manual-price-form">
        <label htmlFor="manual-price-input">Harga manual per saham (Rp)</label>
        <div className="manual-price-row">
          <input
            id="manual-price-input"
            type="text"
            inputMode="numeric"
            placeholder="Contoh: 3.000"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            disabled={loading}
            aria-invalid={priceError ? true : undefined}
            aria-describedby={priceError ? 'manual-price-error' : undefined}
          />
          <button type="submit" className="btn-secondary" disabled={loading}>
            Pakai harga
          </button>
        </div>
        {priceError && <small id="manual-price-error" className="text-danger" role="alert">{priceError}</small>}
      </form>

      <section className="valuation-ledger" aria-labelledby="valuation-ledger-heading">
        <h2 id="valuation-ledger-heading">Ukuran valuasi</h2>
        <dl className="valuation-list">
          <ValuationItem label="EPS" description="Laba per saham" item={valuation?.eps} annualized={isQuarterly} />
          <ValuationItem label="BVPS" description="Nilai buku per saham" item={valuation?.bvps} />
          <ValuationItem label="PER" description="Harga terhadap laba" item={valuation?.per} annualized={isQuarterly} />
          <ValuationItem label="PBV" description="Harga terhadap nilai buku" item={valuation?.pbv} />
          <ValuationItem label="P/S" description="Harga terhadap penjualan" item={valuation?.ps} annualized={isQuarterly} />
          <ValuationItem label="Kapitalisasi pasar" item={valuation?.market_cap} />
        </dl>
        {shares && (
          <div className="shares-footnote">
            <div>
              Jumlah saham <strong>{shares.display || '—'}</strong> lembar
            </div>
            {shares.unavailable_reason && (
              <small className="unavailable-reason">{shares.unavailable_reason}</small>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

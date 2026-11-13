// FR-UI-01: unggah PDF + kode saham BEI (+ jumlah saham opsional).
// Selama POST /api/analyze berjalan (sinkron), tampilkan AnalyzingOverlay; hasil diteruskan ke /result.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyze } from '../api/client.js';
import AnalyzingOverlay from '../components/AnalyzingOverlay.jsx';
import financialReport from '../assets/financial-report-v2.webp';
import reportMark from '../assets/report-mark.svg';
import metricMark from '../assets/metric-mark.svg';
import sourceMark from '../assets/source-mark.svg';

const STORAGE_KEY = 'telusurfin:last_result';
const INITIAL_STORAGE_KEY = 'telusurfin:initial_result';
const SHARES_STORAGE_KEY = 'telusurfin:shares_input';

const FEATURES = [
  { icon: reportMark, title: 'Tiga laporan inti', detail: 'Posisi keuangan, laba rugi, dan arus kas.' },
  { icon: metricMark, title: 'Rasio dan valuasi', detail: 'Metrik kesehatan, tier klaster, dan nilai wajar.' },
  { icon: sourceMark, title: 'Sumber bisa dibuka', detail: 'Periksa kembali angka di halaman PDF.' },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get('file');

    if (file && file instanceof File && file.name && !file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Berkas harus PDF');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rawShares = String(formData.get('shares') ?? '').trim();
      const sharesInput = rawShares !== '' ? Number(rawShares) : null;
      const result = await analyze(formData);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        sessionStorage.setItem(INITIAL_STORAGE_KEY, JSON.stringify(result));
        if (sharesInput != null && Number.isFinite(sharesInput)) {
          sessionStorage.setItem(SHARES_STORAGE_KEY, String(sharesInput));
        } else {
          sessionStorage.removeItem(SHARES_STORAGE_KEY);
        }
      } catch {}
      navigate('/result', { state: { result, initialResult: result, sharesInput } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="page-container upload-page" tabIndex={-1}>
      <section className="upload-stage" aria-labelledby="cover-title">
        <div className="upload-hero">
          <img className="upload-hero-photo" src={financialReport} alt="" />
          <header className="upload-intro">
            <p className="cover-eyebrow">Laporan keuangan emiten BEI</p>
            <h1 id="cover-title">Baca laporan.<br />Lacak asal angkanya.</h1>
            <p className="cover-description">
              Unggah PDF untuk membaca rasio, tier klaster, valuasi, dan ringkasan dari angka yang bisa ditelusuri.
            </p>
          </header>
          <div className="cover-source-note">
            <strong>Dari rasio ke halaman sumber</strong>
            <p>Periksa angka yang dipakai langsung di PDF.</p>
          </div>
        </div>
        <section className="upload-card card" aria-labelledby="upload-heading">
          <header className="upload-header">
            <h2 id="upload-heading">Analisis baru</h2>
            <p className="subtitle">Pilih PDF digital dan isi kode saham emiten.</p>
          </header>

          <form onSubmit={onSubmit} className="upload-form" noValidate>
            <div className="form-field upload-file-field">
              <label htmlFor="file-input">Berkas laporan keuangan (PDF) *</label>
              <div className="upload-file-control">
                <input
                  id="file-input"
                  type="file"
                  name="file"
                  accept="application/pdf,.pdf"
                  aria-describedby="file-hint"
                  required
                  disabled={loading}
                  onChange={(event) => setFileName(event.currentTarget.files[0]?.name ?? '')}
                />
                <img src={reportMark} width="32" height="32" alt="" />
                <span className="upload-file-copy" aria-hidden="true">
                  <span className="upload-file-action">Pilih berkas PDF</span>
                  <span className="upload-file-name" title={fileName}>{fileName || 'Belum ada berkas'}</span>
                </span>
              </div>
              <small id="file-hint" className="field-hint">PDF teks dari emiten atau BEI. Maks. 50 MB.</small>
            </div>

            <div className="upload-details">
              <div className="form-field">
                <label htmlFor="ticker-input">Kode saham BEI (Ticker) *</label>
                <input
                  id="ticker-input"
                  type="text"
                  name="ticker"
                  placeholder="Contoh: SMGR, AKRA, AADI"
                  defaultValue="SMGR"
                  required
                  disabled={loading}
                />
                <small className="field-hint">4 huruf kode saham tanpa akhiran .JK.</small>
              </div>

              <div className="form-field">
                <label htmlFor="shares-input">Jumlah saham beredar (opsional)</label>
                <input
                  id="shares-input"
                  type="number"
                  name="shares"
                  min="1"
                  step="1"
                  placeholder="Contoh: 6751540090"
                  disabled={loading}
                />
                <small className="field-hint">Kosongkan untuk memakai jumlah saham dari laporan.</small>
              </div>
            </div>

            {error && (
              <div className="alert-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary btn-block" disabled={loading}>
              {loading ? 'Menganalisis…' : 'Analisis Laporan'}
            </button>
          </form>
        </section>
      </section>

      <ul className="upload-features">
        {FEATURES.map(({ icon, title, detail }) => (
          <li key={title} className="upload-feature">
            <span className="feature-icon"><img src={icon} alt="" width="24" height="24" /></span>
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {loading && <AnalyzingOverlay />}
    </main>
  );
}

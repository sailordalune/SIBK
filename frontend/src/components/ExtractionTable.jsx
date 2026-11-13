// Tabel angka ekstraksi yang bisa dikoreksi; koreksi -> /api/recompute (FR-UI-04)
import { useState, useMemo } from 'react';
import SourcePageLink from './SourcePageLink.jsx';
import { fmtNumber, fmtPct } from '../utils/format.js';
import '../styles/extraction.css';

export const parseId = (s) => {
  const t = String(s ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/^\((.*)\)$/, '-$1');
  const v = Number(t);
  return t === '' || !Number.isFinite(v) ? null : v;
};

export default function ExtractionTable({
  result,
  hasCommittedChanges = false,
  onRecompute,
  onReset,
  loading = false,
}) {
  const [edits, setEdits] = useState({});
  const fields = result?.fields ?? {};
  const entity = result?.entity ?? {};

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(fields).map(([key, item], index) => ({
      key,
      item,
      index,
    }));
    entries.sort((a, b) => {
      const pageA = a.item?.page ?? 999;
      const pageB = b.item?.page ?? 999;
      if (pageA !== pageB) return pageA - pageB;
      return a.index - b.index;
    });
    return entries;
  }, [fields]);

  const changedKeys = useMemo(() => {
    return Object.keys(edits).filter((k) => {
      const parsed = parseId(edits[k]);
      return parsed !== null && parsed !== fields[k]?.value;
    });
  }, [edits, fields]);

  const hasLocalEdits = Object.keys(edits).length > 0;
  const anyFieldCorrected = Object.values(fields).some((f) => f?.corrected);
  const canReset = hasLocalEdits || anyFieldCorrected || hasCommittedChanges;

  function handleChange(key, rawValue) {
    setEdits((prev) => ({ ...prev, [key]: rawValue }));
  }

  async function handleRecomputeClick() {
    if (changedKeys.length === 0) return;
    const nextFields = { ...fields };
    for (const k of changedKeys) {
      const parsed = parseId(edits[k]);
      if (parsed !== null) {
        nextFields[k] = {
          ...nextFields[k],
          value: parsed,
          corrected: true,
        };
      }
    }
    await onRecompute?.(nextFields);
    setEdits({});
  }

  async function handleResetClick() {
    setEdits({});
    await onReset?.();
  }

  return (
    <section className="ExtractionTable" aria-labelledby="extraction-table-title">
      <div className="extraction-header">
        <div>
          <h2 id="extraction-table-title">Angka dari laporan</h2>
          <p className="section-subtitle">
            Buka halaman PDF untuk memeriksa sumbernya. Untuk mengoreksi angka, ubah kolom <strong>Nilai</strong>,
            lalu pilih <strong>Hitung ulang</strong>. Kamu bisa memakai titik ribuan, misalnya <code>47.792.046</code>.
          </p>
        </div>

        <div className="extraction-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetClick}
            disabled={!canReset || loading}
          >
            Batalkan perubahan
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleRecomputeClick}
            disabled={changedKeys.length === 0 || loading}
          >
            {loading ? 'Menghitung…' : `Hitung ulang${changedKeys.length > 0 ? ` (${changedKeys.length})` : ''}`}
          </button>
        </div>
      </div>

      <p className="extraction-scroll-hint">Geser tabel untuk melihat kolom lainnya.</p>
      <div className="table-responsive" role="region" aria-label="Tabel angka ekstraksi" tabIndex={0}>
        <table className="data-table">
          <colgroup>
            <col className="extraction-col-label" />
            <col className="extraction-col-value" />
            <col className="extraction-col-prior" />
            <col className="extraction-col-page" />
            <col className="extraction-col-confidence" />
            <col className="extraction-col-status" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Pos laporan</th>
              <th scope="col" className="col-num">Nilai ({entity.unit || 'juta IDR'})</th>
              <th scope="col" className="col-num">Pembanding</th>
              <th scope="col" className="col-center">Halaman</th>
              <th scope="col" className="col-center">Kecocokan</th>
              <th scope="col" className="col-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(({ key, item }) => {
              const hasDraft = Object.prototype.hasOwnProperty.call(edits, key);
              const displayValue = hasDraft ? edits[key] : fmtNumber(item?.value);
              const parsedDraft = hasDraft ? parseId(edits[key]) : item?.value;
              const isDraftChanged = hasDraft && parsedDraft !== null && parsedDraft !== item?.value;
              const isInvalidDraft = hasDraft && parsedDraft === null;
              const isCorrected = Boolean(item?.corrected) || isDraftChanged;

              return (
                <tr
                  key={key}
                  className={isDraftChanged ? 'row-dirty' : item?.corrected ? 'row-corrected' : ''}
                >
                  <th scope="row">
                    <div className="pos-label">{item?.label || key}</div>
                    <code className="pos-key">{key}</code>
                  </th>
                  <td className="col-num">
                    <input
                      type="text"
                      aria-label={`Nilai ${key}`}
                      aria-invalid={isInvalidDraft || undefined}
                      data-field-key={key}
                      className={`cell-input ${isInvalidDraft ? 'input-invalid' : ''}`}
                      value={displayValue}
                      onChange={(e) => handleChange(key, e.target.value)}
                      disabled={loading}
                    />
                  </td>
                  <td className="col-num text-muted">{fmtNumber(item?.prior)}</td>
                  <td className="col-center">
                    <SourcePageLink
                      fileId={entity.file_id}
                      fileUrl={entity.file_url}
                      page={item?.page}
                    />
                  </td>
                  <td className="col-center">
                    {item?.confidence != null ? fmtPct(item.confidence, 0) : '—'}
                  </td>
                  <td className="col-center">
                    {isDraftChanged ? (
                      <span className="status-chip status-waspada">Diubah</span>
                    ) : isCorrected ? (
                      <span className="status-chip status-corrected">Dikoreksi</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

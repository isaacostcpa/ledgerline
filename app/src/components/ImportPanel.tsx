import { useCallback, useRef, useState } from 'react';
import { importMatrix, type ImportResult } from '../domain/importGl';
import { suggestGroupCode } from '../domain/coa';
import { formatCents } from '../domain/money';
import { toCents } from '../domain/money';
import { parseCsvMatrix } from '../lib/parseCsv';
import type { EngagementBundle } from '../lib/types';
import { buildBundleFromImport } from '../data/buildBundle';
import './import.css';

const SAMPLE = `Account #,Account Name,Type,Debit,Credit
1000,Operating Cash,ASSET,"48,200",
1200,Accounts Receivable,,"36,500",
1300,Inventory,,"22,000",
1400,Prepaid Insurance,,"3,600",
1500,Equipment,,"65,000",
1510,Accumulated Depreciation,,,"18,000"
2000,Accounts Payable,,,"19,300"
2500,Note Payable - Bank,,,"40,000"
3000,Owner's Capital,,,"30,000"
3100,Retained Earnings,,,"19,300"
4000,Sales Revenue,,,"285,000"
5000,Cost of Goods Sold,,"142,000",
6000,Salaries & Wages,,"58,000",
6100,Rent Expense,,"24,000",
6300,Interest Expense,,"2,400",
6400,Office & Meals,,"9,900",
Total,,,"411,600","411,600"`;

export function ImportPanel({
  base,
  onLoad,
}: {
  base: EngagementBundle;
  onLoad: (bundle: EngagementBundle) => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runText = useCallback((csv: string) => {
    setResult(importMatrix(parseCsvMatrix(csv)));
  }, []);

  const analyzeText = useCallback(() => {
    if (!text.trim()) return;
    runText(text);
  }, [text, runText]);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const content = await file.text();
      // Keep the textarea readable for very large exports.
      setText(content.length > 20000 ? `${content.slice(0, 20000)}\n…(${content.length.toLocaleString()} chars total)` : content);
      runText(content);
    },
    [runText],
  );

  const load = () => {
    if (!result || result.accounts.length === 0) return;
    onLoad(buildBundleFromImport(result.accounts, base.groups, base.engagement, base.client));
  };

  const groupNameFor = (code: string) =>
    base.groups.find((g) => g.code === code)?.name ?? '—';

  return (
    <section className="import">
      <header className="import-head">
        <div>
          <h2>Import General Ledger / Trial Balance</h2>
          <p className="sub">
            Drop a CSV, paste the data, or load the sample. Ledgerline detects the
            layout, standardizes accounts, and checks that it ties out.
          </p>
        </div>
      </header>

      <div className="import-body">
        <div
          className={`dropzone ${dragging ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void onFile(e.dataTransfer.files[0]);
          }}
        >
          <textarea
            className="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste CSV rows here, or drag a file onto this box…"
            spellCheck={false}
            rows={8}
          />
          <div className="import-actions">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <button className="btn btn-primary btn-sm" type="button" onClick={analyzeText} disabled={!text.trim()}>
              Analyze
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => fileRef.current?.click()}>
              Choose file…
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                setText(SAMPLE);
                runText(SAMPLE);
              }}
            >
              Load sample
            </button>
          </div>
        </div>

        {result && <ImportResultView result={result} groupNameFor={groupNameFor} onLoad={load} />}
      </div>
    </section>
  );
}

function ImportResultView({
  result,
  groupNameFor,
  onLoad,
}: {
  result: ImportResult;
  groupNameFor: (code: string) => string;
  onLoad: () => void;
}) {
  const balanced = toCents(result.outOfBalance) === 0;
  return (
    <div className="import-result">
      <div className="result-bar">
        <div className="result-facts">
          <span className="chip neutral">{result.format}</span>
          <span className="chip neutral">{result.accounts.length} accounts</span>
          <span className={`chip ${balanced ? 'ok' : 'bad'}`}>
            {balanced ? 'Ties out' : `Out by ${formatCents(toCents(result.outOfBalance))}`}
          </span>
        </div>
        <button className="btn btn-primary btn-sm" type="button" onClick={onLoad} disabled={result.accounts.length === 0}>
          Load into Working TB →
        </button>
      </div>

      {result.warnings.length > 0 && (
        <ul className="warnings">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="preview-scroll">
        <table className="preview">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th>Leadsheet group</th>
            </tr>
          </thead>
          <tbody>
            {result.accounts.map((a, i) => {
              const groupCode = suggestGroupCode(a.name, a.code, a.type);
              return (
                <tr key={`${a.code}-${i}`}>
                  <td className="mono muted">{a.code || '—'}</td>
                  <td>{a.name}</td>
                  <td className="type">{a.type}</td>
                  <td className="num mono tnum">{a.debit ? formatCents(toCents(a.debit)) : ''}</td>
                  <td className="num mono tnum">{a.credit ? formatCents(toCents(a.credit)) : ''}</td>
                  <td className="group">{groupCode ? groupNameFor(groupCode) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

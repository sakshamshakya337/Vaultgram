import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileCode,
  File,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Table,
  HardDrive,
  Clock,
  Tag,
  Loader2
} from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { api, formatBytes, formatRelativeTime } from '../../services/api';

export const DocumentViewerModal = ({
  document: activeDoc,
  items = [],
  currentIndex = 0,
  onIndexChange,
  onClose,
  onDelete,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Content states
  const [docxHtml, setDocxHtml] = useState('');
  const [sheetData, setSheetData] = useState({ sheets: [], currentSheet: '', tables: {} });
  const [csvRows, setCsvRows] = useState([]);
  const [plainText, setPlainText] = useState('');
  const [copied, setCopied] = useState(false);

  const doc = activeDoc || (items && items[currentIndex]);
  const docId = doc?._id || doc?.id;

  // Determine file type category & extension
  const extension = useMemo(() => {
    if (!doc) return '';
    if (doc.extension) return doc.extension.toLowerCase().replace(/^\./, '');
    const title = doc.title || '';
    const match = title.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : '';
  }, [doc]);

  const mimeType = useMemo(() => {
    return (doc?.mimeType || '').toLowerCase();
  }, [doc]);

  const fileFormat = useMemo(() => {
    if (extension === 'pdf' || mimeType === 'application/pdf') return 'pdf';
    if (extension === 'docx' || mimeType.includes('wordprocessingml')) return 'docx';
    if (extension === 'xlsx' || extension === 'xls' || mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) return 'xlsx';
    if (extension === 'csv' || mimeType === 'text/csv') return 'csv';
    if (
      ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'php', 'rb', 'sql', 'sh', 'yaml', 'yml', 'xml', 'log', 'env'].includes(extension) ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json'
    ) {
      return 'text';
    }
    return 'unsupported';
  }, [extension, mimeType]);

  const inlineUrl = useMemo(() => {
    if (!docId) return '';
    return api.stream.getUrl(docId, false);
  }, [docId]);

  const downloadUrl = useMemo(() => {
    if (!docId) return '';
    return api.stream.getUrl(docId, true);
  }, [docId]);

  // Load document content depending on format
  useEffect(() => {
    if (!docId || !doc) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setDocxHtml('');
    setSheetData({ sheets: [], currentSheet: '', tables: {} });
    setCsvRows([]);
    setPlainText('');

    if (fileFormat === 'pdf') {
      // Browser iframe handles PDF rendering natively
      setLoading(false);
      return;
    }

    if (fileFormat === 'unsupported') {
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      try {
        const streamUrl = api.stream.getUrl(docId, false);
        const res = await fetch(streamUrl);
        if (!res.ok) {
          throw new Error(`Failed to load file content (${res.status} ${res.statusText})`);
        }

        if (!isMounted) return;

        if (fileFormat === 'docx') {
          const arrayBuffer = await res.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (isMounted) {
            setDocxHtml(result.value || '<p class="text-zinc-500 italic">Document has no readable text content.</p>');
          }
        } else if (fileFormat === 'xlsx') {
          const arrayBuffer = await res.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheets = workbook.SheetNames || [];
          const tables = {};

          sheets.forEach((name) => {
            const sheet = workbook.Sheets[name];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            tables[name] = jsonData;
          });

          if (isMounted) {
            setSheetData({
              sheets,
              currentSheet: sheets[0] || '',
              tables,
            });
          }
        } else if (fileFormat === 'csv') {
          const text = await res.text();
          const parsed = Papa.parse(text, { skipEmptyLines: true });
          if (isMounted) {
            setCsvRows(parsed.data || []);
          }
        } else if (fileFormat === 'text') {
          const text = await res.text();
          if (isMounted) {
            setPlainText(text);
          }
        }
      } catch (err) {
        console.error('[DocumentViewer load error]:', err);
        if (isMounted) {
          setError(err.message || 'Failed to render document preview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      isMounted = false;
    };
  }, [docId, doc, fileFormat]);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0 && onIndexChange) {
        onIndexChange(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1 && onIndexChange) {
        onIndexChange(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentIndex, items.length, onIndexChange]);

  const handleCopyText = () => {
    if (!plainText) return;
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-2 sm:p-6 animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl h-[92vh] max-h-[92vh] rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              {fileFormat === 'pdf' ? (
                <FileText className="w-5 h-5 text-rose-400" />
              ) : fileFormat === 'docx' ? (
                <FileText className="w-5 h-5 text-blue-400" />
              ) : fileFormat === 'xlsx' || fileFormat === 'csv' ? (
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              ) : fileFormat === 'text' ? (
                <FileCode className="w-5 h-5 text-cyan-400" />
              ) : (
                <File className="w-5 h-5 text-zinc-400" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate max-w-md sm:max-w-lg">
                {doc.title || 'Untitled Document'}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                <span className="uppercase text-cyan-400 font-semibold">{extension || 'DOC'}</span>
                <span>•</span>
                <span>{formatBytes(doc.fileSizeBytes || 0)}</span>
                {doc.createdAt && (
                  <>
                    <span>•</span>
                    <span>{formatRelativeTime(doc.createdAt)}</span>
                  </>
                )}
                {doc.category && doc.category !== 'General' && (
                  <>
                    <span>•</span>
                    <span className="text-zinc-300">#{doc.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Direct Download Button */}
            <a
              href={downloadUrl}
              download={doc.title || 'document'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            {/* Open Raw in New Tab */}
            <a
              href={inlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer hidden sm:flex"
              title="Open Raw File in New Window"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close Preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Middle Document Body */}
        <div className="relative flex-1 bg-zinc-900/40 overflow-hidden flex flex-col justify-center items-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-cyan-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-semibold text-zinc-400">Loading document preview...</p>
            </div>
          ) : error ? (
            <div className="max-w-md p-8 rounded-3xl bg-zinc-900 border border-white/10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Preview Unavailable</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
              </div>
              <a
                href={downloadUrl}
                download={doc.title || 'document'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download to View</span>
              </a>
            </div>
          ) : fileFormat === 'pdf' ? (
            /* PDF Native Browser Iframe */
            <div className="w-full h-full p-2 sm:p-4">
              <iframe
                src={`${inlineUrl}#toolbar=1&navpanes=1`}
                title={doc.title || 'PDF Preview'}
                className="w-full h-full rounded-2xl bg-zinc-950 border border-white/10"
              />
            </div>
          ) : fileFormat === 'docx' ? (
            /* DOCX Clean Reader Card */
            <div className="w-full h-full overflow-y-auto p-4 sm:p-8 flex justify-center">
              <div className="w-full max-w-4xl bg-white text-zinc-900 shadow-2xl rounded-2xl p-6 sm:p-12 font-serif text-sm leading-relaxed overflow-x-auto select-text docx-content">
                <div
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                  className="prose prose-zinc max-w-none"
                />
              </div>
            </div>
          ) : fileFormat === 'xlsx' ? (
            /* XLSX Multi-Sheet Table Viewer */
            <div className="w-full h-full flex flex-col">
              {/* Sheet Tabs */}
              {sheetData.sheets.length > 1 && (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border-b border-white/10 overflow-x-auto shrink-0 no-scrollbar">
                  <span className="text-[11px] text-zinc-500 font-semibold mr-1">Sheets:</span>
                  {sheetData.sheets.map((sheet) => (
                    <button
                      key={sheet}
                      onClick={() => setSheetData((prev) => ({ ...prev, currentSheet: sheet }))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        sheetData.currentSheet === sheet
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {sheet}
                    </button>
                  ))}
                </div>
              )}

              {/* Table Render */}
              <div className="flex-1 overflow-auto p-4 select-text">
                {(() => {
                  const rows = sheetData.tables[sheetData.currentSheet] || [];
                  if (rows.length === 0) {
                    return (
                      <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                        This sheet is empty.
                      </div>
                    );
                  }
                  const previewRows = rows.slice(0, 500);
                  const isTruncated = rows.length > 500;

                  return (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 overflow-hidden bg-zinc-950 shadow-xl inline-block min-w-full">
                        <table className="w-full text-xs text-left border-collapse font-mono">
                          <tbody>
                            {previewRows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={
                                  rIdx === 0
                                    ? 'bg-zinc-900 font-bold text-cyan-300 border-b border-white/10 sticky top-0'
                                    : 'border-b border-white/5 hover:bg-white/5 text-zinc-300'
                                }
                              >
                                <td className="px-3 py-2 text-zinc-600 border-r border-white/5 text-[10px] w-8 text-center bg-zinc-900/60 select-none">
                                  {rIdx + 1}
                                </td>
                                {Array.isArray(row) &&
                                  row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="px-3.5 py-2 border-r border-white/5 whitespace-pre-wrap max-w-xs truncate"
                                    >
                                      {cell !== null && cell !== undefined ? String(cell) : ''}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {isTruncated && (
                        <p className="text-[11px] text-zinc-500 text-center font-mono py-2">
                          Showing first 500 of {rows.length} rows. Download file to view complete dataset.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : fileFormat === 'csv' ? (
            /* CSV Table Viewer */
            <div className="w-full h-full overflow-auto p-4 select-text">
              {csvRows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  CSV file is empty.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 overflow-hidden bg-zinc-950 shadow-xl inline-block min-w-full">
                    <table className="w-full text-xs text-left border-collapse font-mono">
                      <tbody>
                        {csvRows.slice(0, 500).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-zinc-900 font-bold text-emerald-300 border-b border-white/10 sticky top-0'
                                : 'border-b border-white/5 hover:bg-white/5 text-zinc-300'
                            }
                          >
                            <td className="px-3 py-2 text-zinc-600 border-r border-white/5 text-[10px] w-8 text-center bg-zinc-900/60 select-none">
                              {rIdx + 1}
                            </td>
                            {Array.isArray(row) &&
                              row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="px-3.5 py-2 border-r border-white/5 whitespace-pre-wrap max-w-xs truncate"
                                >
                                  {cell}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {csvRows.length > 500 && (
                    <p className="text-[11px] text-zinc-500 text-center font-mono py-2">
                      Showing first 500 of {csvRows.length} rows. Download file to view complete data.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : fileFormat === 'text' ? (
            /* Plain Text / Code Scrollable Viewer */
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-white/10 text-xs">
                <span className="font-mono text-zinc-400 text-[11px]">
                  {plainText.split('\n').length} lines
                </span>
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 select-text">
                <pre className="p-6 rounded-2xl bg-zinc-950 border border-white/10 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre">
                  {plainText || '(Empty File)'}
                </pre>
              </div>
            </div>
          ) : (
            /* Unsupported File Fallback */
            <div className="max-w-md p-8 rounded-3xl bg-zinc-900 border border-white/10 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center mx-auto">
                <File className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">
                  Preview Not Available
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  In-app preview is not supported for <span className="font-mono text-cyan-400">.{extension || 'file'}</span> formats. You can download the file to view it on your device.
                </p>
              </div>
              <a
                href={downloadUrl}
                download={doc.title || 'file'}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download File ({formatBytes(doc.fileSizeBytes || 0)})</span>
              </a>
            </div>
          )}
        </div>

        {/* Bottom Bar: Prev / Next Navigation */}
        {items.length > 1 && onIndexChange && (
          <div className="px-5 py-3 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <button
              onClick={() => onIndexChange(currentIndex - 1)}
              disabled={currentIndex <= 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Document</span>
            </button>

            <span className="text-xs font-mono text-zinc-400">
              {currentIndex + 1} of {items.length}
            </span>

            <button
              onClick={() => onIndexChange(currentIndex + 1)}
              disabled={currentIndex >= items.length - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <span>Next Document</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

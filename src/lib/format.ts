export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago', ...options }).format(new Date(date));
}
export function readTime(text: string) { return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 210)); }
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(s => [...s][0] || '').join('').toUpperCase(); }
export function slugify(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90).replace(/-$/, '') || 'a-new-idea'; }
export function safeUrl(value: string) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null; } catch { return null; } }
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!)); }
export function csvCell(value: unknown) { let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value); if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }

/** RFC 4180 quoting plus spreadsheet formula protection for untrusted text. */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function toCsv(headers: unknown[], rows: unknown[][]): string {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

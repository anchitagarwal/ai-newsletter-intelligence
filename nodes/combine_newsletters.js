// n8n node: Combine Newsletter Content
// Merges all Gmail items into a single cleaned text block for Claude.
const items = $input.all();

const newsletters = items.map(item => {
  const msg = item.json;
  const subject = msg.subject || msg.Subject || 'No subject';
  const sender = msg.from?.text || msg.From || 'Unknown';
  const body = msg.text || msg.textAsHtml || msg.snippet || '';
  const cleaned = body
    .replace(/https?:\/\/[^\s\]]+/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/͏/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .trim();
  return `--- NEWSLETTER ---\nFrom: ${sender}\nSubject: ${subject}\n\n${cleaned.substring(0, 4000)}`;
});

return [{ json: { combined_text: newsletters.join('\n\n'), count: items.length } }];

// n8n node: Parse and Merge Output
// Splits Claude's response into KB/Projects/Summary sections, applies EXISTING_UPDATEs inline,
// appends new scored items, and builds Discord messages.
// Anthropic node outputs content array; Code node fallback for local testing
const claudeText = $input.first().json.content?.[0]?.text || $input.first().json.claude_response || '';
const existingKB = $node['Collect All Context'].json.kb_content || '';
const existingProjects = $node['Collect All Context'].json.projects_content || '';

const extract = (content, marker, endMarker) => {
  const start = content.indexOf(marker);
  if (start === -1) return '';
  const end = endMarker ? content.indexOf(endMarker, start) : content.length;
  return content.slice(start + marker.length, end === -1 ? content.length : end).trim();
};

const today = new Date().toISOString().split('T')[0];
const kb = extract(claudeText, '===KNOWLEDGE_BASE===', '===PROJECTS===');
const projects = extract(claudeText, '===PROJECTS===', '===SUMMARY===');
const summary = extract(claudeText, '===SUMMARY===', null);

// Apply EXISTING_UPDATEs inline to existing content
const applyUpdates = (existing, newContent) => {
  let updated = existing;
  const lines = newContent.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('EXISTING_UPDATE:')) {
      const conceptName = lines[i].replace('EXISTING_UPDATE:', '').trim();
      const angleLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('EXISTING_UPDATE:') && !lines[i].startsWith('SCORE:')) {
        angleLines.push(lines[i]);
        i++;
      }
      const newAngle = angleLines.join('\n').trim();
      if (newAngle && updated.includes(`**${conceptName}**`)) {
        updated = updated.replace(`**${conceptName}**`, `**${conceptName}**\n> **New angle (${today}):** ${newAngle}`);
      }
    } else {
      i++;
    }
  }
  return updated;
};

// Strip EXISTING_UPDATEs, keep only new scored items
const stripUpdates = (content) => {
  const lines = content.split('\n');
  const result = [];
  let skip = false;
  for (const line of lines) {
    if (line.startsWith('EXISTING_UPDATE:')) { skip = true; continue; }
    if (skip && line.startsWith('SCORE:')) skip = false;
    if (!skip) result.push(line);
  }
  return result.join('\n').trim();
};

const newKBItems = stripUpdates(kb);
const newProjectItems = stripUpdates(projects);

let updatedKB = applyUpdates(existingKB, kb);
if (newKBItems.length > 50) {
  updatedKB = updatedKB + `\n\n---\n\n## Added ${today}\n\n` + newKBItems;
}

let updatedProjects = applyUpdates(existingProjects, projects);
if (newProjectItems.length > 50) {
  updatedProjects = updatedProjects + `\n\n---\n\n## Added ${today}\n\n` + newProjectItems;
}

// Chunk content into Discord-safe messages. Discord limit is 2000 chars; we
// target 1900 to leave room for the header. Split at item boundaries
// (`\n\n---\n\n`); hard-split only if a single item exceeds the cap.
const chunkForDiscord = (header, body, limit = 1900) => {
  if (!body || body.length < 50) return [];
  const items = body.split('\n\n---\n\n');
  const chunks = [];
  let current = '';
  const cap = limit - header.length - 10;
  const flush = () => { if (current) { chunks.push(current); current = ''; } };
  for (const item of items) {
    const sep = current ? '\n\n---\n\n' : '';
    if (current.length + sep.length + item.length > cap) {
      flush();
      if (item.length > cap) {
        let rest = item;
        while (rest.length > cap) {
          const nl = rest.lastIndexOf('\n', cap);
          const split = nl > cap / 2 ? nl : cap;
          chunks.push(rest.substring(0, split));
          rest = rest.substring(split).trimStart();
        }
        current = rest;
      } else {
        current = item;
      }
    } else {
      current += sep + item;
    }
  }
  flush();
  return chunks.map((c, i) => `${i === 0 ? header : header + ' (cont.)'}\n${c}`);
};

const summaryMsg = `## Latent Space — Daily Intelligence ${today}\n\n**Today's Signals**\n${summary}`;
const kbMsgs = chunkForDiscord('**New Concepts Added**', newKBItems);
const projectsMsgs = chunkForDiscord('**New Project Ideas Added**', newProjectItems);

return [{ json: {
  date: today,
  updated_kb: updatedKB,
  updated_projects: updatedProjects,
  summary_msg: summaryMsg,
  kb_msgs: kbMsgs,
  projects_msgs: projectsMsgs,
  has_new_kb: kbMsgs.length > 0,
  has_new_projects: projectsMsgs.length > 0
} }];

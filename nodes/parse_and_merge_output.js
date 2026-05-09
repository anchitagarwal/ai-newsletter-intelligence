// n8n node: Parse and Merge Output
// Splits Claude's response into KB/Projects/Summary sections, applies EXISTING_UPDATEs inline,
// appends new scored items, and builds Discord messages.
const claudeText = $input.first().json.claude_response || '';
const existingKB = $input.first().json.kb_content || '';
const existingProjects = $input.first().json.projects_content || '';

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

const summaryMsg = `## Latent Space — Daily Intelligence ${today}\n\n**Today's Signals**\n${summary}`;
const kbMsg = newKBItems.length > 50 ? `**New Concepts Added**\n${newKBItems.substring(0, 1800)}` : null;
const projectsMsg = newProjectItems.length > 50 ? `**New Project Ideas Added**\n${newProjectItems.substring(0, 1800)}` : null;

return [{ json: {
  date: today,
  updated_kb: updatedKB,
  updated_projects: updatedProjects,
  summary_msg: summaryMsg,
  kb_msg: kbMsg,
  projects_msg: projectsMsg,
  has_new_kb: newKBItems.length > 50,
  has_new_projects: newProjectItems.length > 50
} }];

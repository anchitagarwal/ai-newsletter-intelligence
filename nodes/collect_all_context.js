// n8n node: Collect All Context
// Merges kb_content, projects_content, and combined_text into one object for Call Claude.
const projectsContent = $input.first().json.content || '';
const kbContent = $input.first().json.kb_content || '';
const combinedText = $input.first().json.combined_text || '';

return [{ json: {
  combined_text: combinedText,
  kb_content: kbContent,
  projects_content: projectsContent
} }];

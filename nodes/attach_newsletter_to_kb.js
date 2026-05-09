// n8n node: Attach Newsletter to KB
// Pulls kb_content from Obsidian read result and combined_text from the ancestor node.
// $node[] works here because Combine Newsletter Content is a direct ancestor with no branching.
const kbContent = $input.first().json.content || '';
const newsletterText = $node['Combine Newsletter Content'].json.combined_text || '';
return [{ json: { kb_content: kbContent, combined_text: newsletterText } }];

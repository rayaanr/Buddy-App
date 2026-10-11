/** "Kavindu" from "Kavindu Perera", for chat lines and short labels. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * A message in one line, for notifications and the Chats list: the text, or
 * "📷 Photo" / "📊 <question>" when there's no text to show.
 */
export function messageSummary(m: {
  body: string;
  hasImage?: boolean;
  pollQuestion?: string | null;
}) {
  if (m.pollQuestion) return `📊 ${m.pollQuestion}`;
  if (m.hasImage) return m.body ? `📷 ${m.body}` : '📷 Photo';
  return m.body;
}

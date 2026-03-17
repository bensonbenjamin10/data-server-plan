export function getFileIcon(name: string, mimeType: string | null): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType?.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf" || ext === "pdf") return "📕";
  if (mimeType?.startsWith("video/") || /^(mp4|webm|mov|avi|mkv)$/i.test(ext)) return "🎬";
  if (mimeType?.startsWith("audio/") || /^(mp3|wav|ogg|flac|m4a)$/i.test(ext)) return "🎵";
  if (/^(doc|docx)$/i.test(ext)) return "📘";
  if (/^(xls|xlsx)$/i.test(ext)) return "📗";
  if (/^(ppt|pptx)$/i.test(ext)) return "📙";
  if (/^(zip|rar|7z|tar|gz)$/i.test(ext)) return "📦";
  if (/^(txt|md|json|xml|html|css|js|ts|tsx|jsx)$/i.test(ext)) return "📝";
  return "📄";
}

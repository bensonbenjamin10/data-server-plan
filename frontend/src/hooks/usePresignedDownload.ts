import { useCallback } from "react";
import { useApi } from "@/lib/api-context";

export function usePresignedDownload() {
  const api = useApi();

  const download = useCallback(
    async (fileId: string, fileName: string) => {
      const { url } = await api.getDownloadUrl(fileId);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    [api]
  );

  return { download };
}

// Update document.title on mount — keeps browser tab/screen reader in sync with current page
import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} - KolShek`;
  }, [title]);
}

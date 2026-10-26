// "Скачать PDF": the browser's print dialog on the A4 page, where the owner picks "Save as PDF" (spec §4, row 5).
// No server-side PDF in the MVP.

/**
 * Opens the print dialog. `title` becomes the page title while the dialog is open, because Chrome offers it as
 * the file name ("КП-2026-0001.pdf"). It waits for the web fonts, so ₸ and the Kazakh letters are drawn with the
 * document font and not with a stand-in.
 */
export async function printDocument(title?: string): Promise<void> {
  const previous = document.title
  if (title) {
    document.title = title
    const restore = () => {
      document.title = previous
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
  }
  try {
    await document.fonts?.ready
  } catch {
    // A font that failed to load must not stop the printing.
  }
  window.print()
}

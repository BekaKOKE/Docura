// Search key for clients, articles and documents: casefold, then ё → е, so "Ёлкина" finds "елкина".
// Kazakh letters (Ә Ғ Қ Ң Ө Ұ Ү Һ І) are only lower-cased, never replaced, and «ёлочки» stay as typed.
export function searchKey(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е')
}

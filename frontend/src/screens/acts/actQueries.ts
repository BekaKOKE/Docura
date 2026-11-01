// The query keys of the act screens. The act's own card uses the key every document detail uses (quoteKey), so an act
// saved or issued on its card is the act the preview (S08) shows.

export const actsListKey = (limit: number) => ['documents', 'list', { type: 'act', limit }] as const

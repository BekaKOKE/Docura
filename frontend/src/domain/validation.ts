// A validator returns null when the value is valid, otherwise a Russian message for the user.
// The messages live here, in the domain, so the rules and their wording are tested together; moving them
// into `src/i18n` is a follow-up once the i18n shell (#10) has settled.
export type Validation = string | null

/** Ein Bewerbungs-/Suchprofil, gegen das Angebote bewertet werden. */
export type Profile = {
  id: number;
  name: string;
  role: string | null;
  focus: string | null;
  industries: string | null;
  region: string | null;
  languages: string | null;
  /** Skills je Kategorie (ai_agentic, frontend, backend, devops_testing, methods). */
  skills: Record<string, string[]>;
  strongSignals: string[];
  weakSignals: string[];
  /** Genau ein Profil ist aktiv — es bestimmt Dashboard-Sicht und künftige Analysen. */
  active: boolean;
};

/** Payload zum Anlegen/Ändern (id/active verwaltet das Backend). */
export type ProfileDraft = Omit<Profile, 'id' | 'active'>;

/** Kostenvorschau einer Re-Analyse. */
export type AnalysisPreview = {
  candidates: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

export const SKILL_CATEGORIES = ['ai_agentic', 'frontend', 'backend', 'devops_testing', 'methods'] as const;

/** Profil in einen bearbeitbaren Draft überführen; Listen werden kopiert, nicht geteilt. */
export function draftOf(profile: Profile): ProfileDraft {
  return {
    name: profile.name,
    role: profile.role,
    focus: profile.focus,
    industries: profile.industries,
    region: profile.region,
    languages: profile.languages,
    skills: structuredClone(profile.skills),
    strongSignals: [...profile.strongSignals],
    weakSignals: [...profile.weakSignals],
  };
}

export function emptyDraft(): ProfileDraft {
  return {
    name: '',
    role: null,
    focus: null,
    industries: null,
    region: null,
    languages: null,
    skills: Object.fromEntries(SKILL_CATEGORIES.map((category) => [category, []])),
    strongSignals: [],
    weakSignals: [],
  };
}

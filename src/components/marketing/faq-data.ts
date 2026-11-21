export const LANDING_FAQS = [
  {
    q: "What is EngineerOS?",
    a: "An AI-native workspace that combines notes, tasks, projects, daily entries, and decisions in one connected system. Semantic search, a knowledge graph, and an assistant that cites the note behind each answer — running on your own Supabase project.",
  },
  {
    q: "What is an AI-native workspace?",
    a: "One built with AI as a core feature rather than an add-on. Every note, task, and daily entry is indexed for retrieval, and the assistant can answer questions about your workspace with citations back to the source. When no API key is configured, keyword search and extractive answers keep the workspace useful.",
  },
  {
    q: "How does search work?",
    a: "Every object is indexed for hybrid retrieval: keyword scoring for exact terms, embeddings for meaning when a provider is configured, and fusion with reranking. With no API key, keyword search remains the default. The ranking can be inspected, and the measured floors are checked into the repo.",
  },
  {
    q: "Can I see why an answer said what it said?",
    a: "Yes. Every answer opens into a source panel showing which passages were retrieved, whether each came from keyword or semantic ranking, its score, and the exact chunk quoted. Notes edited since a pinned date show what changed. The assistant names what it could not reconstruct instead of paraphrasing around it.",
  },
  {
    q: "Can I ask what I believed on a past date?",
    a: "Yes. Pin a question to any date and the assistant answers from your notes as they existed then, reconstructing historical bodies from stored versions. Where a note changed after that date, the citation says so. It will not answer a question about the past using today's text.",
  },
  {
    q: "Is EngineerOS free?",
    a: "Free to start with no credit card. Your data lives in your own Supabase project, and paid plans only apply when billing is configured. See the pricing page for the current details.",
  },
  {
    q: "How does the knowledge graph work?",
    a: "Wikilinks in notes resolve to backlinks, tasks attach to projects, and decisions cite the note they came from. The graph is built from those relationships, so it reflects work you already did rather than a separate diagram to maintain.",
  },
  {
    q: "Can I automate repetitive tasks?",
    a: "Yes. Recurring-task rules, quick captures that auto-triage by keyword, and daily rollover of unfinished work. Automation runs against the same schema as everything else.",
  },
  {
    q: "Where does my data live?",
    a: "In your own Supabase project. EngineerOS connects through the Supabase client and row-level security; no workspace data is stored on EngineerOS servers. AI calls go only to the provider you configure, and you can export your data at any time.",
  },
  {
    q: "What makes EngineerOS different from Notion or Obsidian?",
    a: "Notion is a document tool with databases; Obsidian is a local graph of markdown. EngineerOS is built so the note, the task, the decision, and the daily entry are the same kind of object — and so every AI answer can show the passage it came from.",
  },
  {
    q: "Who is EngineerOS built for?",
    a: "Engineers, researchers, and builders who work across several projects and keep losing the reason behind a decision. It assumes you are comfortable with markdown, keyboard shortcuts, and owning your own infrastructure.",
  },
  {
    q: "Does EngineerOS work as a second brain?",
    a: "Yes, with a narrower meaning than most: a second brain that can be queried and audited. Every capture is indexed, every link is stored, and every answer points back to the note it came from. It is not a passive archive.",
  },
] as const;

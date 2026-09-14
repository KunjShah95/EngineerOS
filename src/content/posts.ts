export type Post = {
  slug: string;
  title: string;
  /** Used for <title> and OG. Kept under ~60 chars where possible. */
  seoTitle: string;
  /** Meta description. 140–160 chars. */
  description: string;
  /** A direct, quotable one-paragraph answer. Rendered first, and reused
   *  in Article schema. This is the block AI engines tend to lift. */
  answer: string;
  date: string;
  updated: string;
  readingMinutes: number;
  tags: string[];
  body: string;
  /** FAQ items for AEO — each is a question/answer pair optimized for
   *  featured snippets and AI Overviews. */
  faq: { question: string; answer: string }[];
};

export const POSTS: Post[] = [
  {
    slug: "agents-md-cursor-rules-claude-skills",
    title:
      "AGENTS.md, Cursor rules, and Claude skills are all solving the same problem — badly",
    seoTitle: "AGENTS.md vs Cursor Rules vs Claude Skills",
    description:
      "Three formats, one problem: agents forget your project. A practical comparison of AGENTS.md, .cursor/rules, and Claude skills — what each is actually for, and where all three fall short.",
    answer:
      "AGENTS.md, Cursor rules, and Claude skills solve three different layers of the same problem. AGENTS.md is a portable, plain-markdown description of how your repo works, read by most agents. Cursor rules are Cursor-only and scope instructions to file globs. Claude skills package a procedure the agent invokes on demand. The rough split: rules and AGENTS.md are ambient — always-on adjectives describing your project. Skills are invokable verbs the agent reaches for. All three break for the same reason: they only carry what someone remembered to write down, and none of them capture the decisions that happened outside the repo.",
    date: "2026-08-12",
    updated: "2026-09-01",
    readingMinutes: 8,
    tags: ["AI agents", "Developer tools", "Context"],
    faq: [
      {
        question: "What is AGENTS.md?",
        answer: "AGENTS.md is a plain markdown file at your repo root that describes how your project works — build commands, conventions, and context for AI agents. It's read by most coding agents including Claude Code, Codex, Gemini CLI, and Cursor. Its virtue is portability: it's a convention, not a product, so it costs nothing to adopt.",
      },
      {
        question: "What's the difference between AGENTS.md, Cursor rules, and Claude skills?",
        answer: "AGENTS.md is a portable markdown file read by most agents. Cursor rules live in .cursor/rules/ with file-glob scoping, useful for large repos with different conventions per directory. Claude skills are folders with a SKILL.md plus scripts and templates, loaded on demand for multi-step procedures. Rules and AGENTS.md are ambient adjectives; skills are invokable verbs.",
      },
      {
        question: "Why do AI agents forget my project context?",
        answer: "Every instruction format is a write-ahead log for context — you anticipate what the agent will need and write it down in advance. The failure modes are drift (the file describes the project as it was when you wrote it), fragmentation (multiple agents have files that disagree), and unwritten reasoning (the decisions behind your code are in Slack, PRs, or your head — not in the repo).",
      },
      {
        question: "How long should AGENTS.md be?",
        answer: "Keep it short and true. Fifteen lines you actually maintain beat two hundred that rot. Every line is a maintenance liability — if you would not update it during a refactor, cut it. Date your notes so readers know which parts might be stale.",
      },
      {
        question: "Should I write down decisions or just rules in my instructions file?",
        answer: "Write down decisions, not just rules. A one-paragraph note per non-obvious decision, dated, with the reasoning and the alternatives you rejected. 'We use pgvector over a separate vector DB because we were already running Postgres and the operational cost of a second datastore was not worth the recall improvement at our scale' survives being questioned. 'We use pgvector' just gets overruled.",
      },
    ],
    body: `I keep a folder of other people's config files. It started as research and turned into something closer to a hobby. \`.cursorrules\`, \`AGENTS.md\`, \`CLAUDE.md\`, \`.github/copilot-instructions.md\`, a growing pile of \`SKILL.md\` folders. At last count the biggest public collection of Cursor rules has north of forty thousand stars, which tells you this is not a niche concern.

Read enough of them and a pattern shows up that nobody advertises. Almost every one of these files is a person trying to explain their project to something that will forget the explanation.

That is the actual problem. The three formats are three different guesses at how to solve it.

## The three formats, briefly

**AGENTS.md** is the boring one, and boring is the point. Plain markdown at your repo root. No frontmatter, no metadata, no activation modes. You describe how the project works — build commands, conventions, the things a new hire would ask in week one — and most agents will read it. Claude Code, Codex, Gemini CLI, Cursor, and others all pick it up. Its virtue is that it is a convention rather than a product, so it costs nothing to adopt and nothing to abandon.

**Cursor rules** live in \`.cursor/rules/\` and buy you scoping. Each rule carries frontmatter with file globs, so a rule about your API layer only activates when you are in the API layer. This is genuinely useful in a large repo where a single instructions file would either be too vague to help or too long to fit. The catch is portability: they are Cursor's format, and they do not travel to Claude Code, Codex, or Copilot.

**Claude skills** are a different shape entirely. A skill is a folder with a \`SKILL.md\` plus whatever scripts, templates, and reference files it needs, and the agent loads it when the task calls for it. The distinction I find most useful: skills are verbs, rules are adjectives. A rule says *this project uses Tailwind and prefers server components*. A skill says *here is the procedure for cutting a release*.

## What to use when

If you use exactly one agent and you have a large codebase with genuinely different conventions per directory, Cursor rules earn their keep. The scoping is real.

If more than one agent touches your repo — or you think one might, or a teammate uses something else — write AGENTS.md. Portability beats features here. A file every tool reads at 80% fidelity is worth more than a file one tool reads perfectly.

If you have a multi-step procedure that you keep re-explaining, that is a skill. Deploy steps, a review checklist, a migration you run quarterly. Anything where the answer is a sequence rather than a preference.

Most repos want AGENTS.md plus two or three skills. The scoped-rules-per-directory approach tends to be an answer to a problem you should fix in the codebase instead.

## Where all three break

Here is the thing that took me too long to notice.

Every one of these formats is a **write-ahead log for context**. You anticipate what the agent will need, you write it down in advance, and you hope you guessed right. When you guessed right, it works beautifully. When you did not, the agent confidently does the wrong thing, and you go add another line to the file.

That failure mode has three parts.

**Drift.** The file describes the project as it was on the day you wrote it. Code changes daily. Nobody has a habit of updating \`AGENTS.md\` in the same commit that changes the convention it documents. Within a few weeks you have a file that is 80% true, and the 20% is invisible — you cannot tell which parts have gone stale by looking. A stale instruction is worse than a missing one, because a missing one produces a question and a stale one produces confident garbage.

**Fragmentation.** Once you have three agents you have three files, and they disagree. AGENTS.md was meant to fix this and largely does, but only for the ambient layer. Skills and rules still fragment. I have watched a team maintain both \`CLAUDE.md\` and \`.cursor/rules/\` where the two contradicted each other on error handling, and neither author knew.

**The part nobody writes down.** This is the big one. The reason you chose Supabase over Firebase. The bug that made you add a seemingly pointless \`await\`. The customer conversation that killed a feature. The three approaches you tried before the fourth one worked.

None of that is in the repo. It is in Slack, a PR comment thread, a design doc, or somebody's head. And it is *exactly* what a competent collaborator needs. A new engineer gets it through osmosis — standups, code review, asking someone who was there. An agent gets nothing, because the only channel you have given it is a markdown file that documents conclusions and throws away reasoning.

You can watch this happen. Ask an agent to change something load-bearing and it will cheerfully undo a fix, because the code looks redundant and the reason it exists was never written down anywhere it could read.

## The framing that helped me

The instructions file is not documentation. It is a **cache**. It is a small, hand-maintained, hand-invalidated cache in front of a much larger body of knowledge that lives in your repo history, your issue tracker, your notes, and your conversations.

Once you see it that way, the ergonomics make sense. Caches go stale. Caches need invalidation, and manual invalidation is the kind humans are worst at. And a cache is only as good as its hit rate — which here means: only as good as your ability to predict, in advance, what will be asked.

That prediction problem is not solvable by writing a better file. You cannot pre-write the answer to a question you have not been asked.

## So what actually helps

I do not think the answer is a fourth format. Some things that measurably helped:

**Write down decisions, not just rules.** A one-paragraph note per non-obvious decision, dated, with the reasoning and the alternatives you rejected. Not "we use pgvector" — "we use pgvector over a separate vector DB because we were already running Postgres and the operational cost of a second datastore was not worth the recall improvement at our scale." The second one survives being questioned. The first one just gets overruled.

**Put the reasoning where it can be retrieved, not just where it can be read.** A decision log that is one 4000-line markdown file is a decision log nobody reads. The value is in getting the *relevant* three paragraphs at the moment they matter. That is a retrieval problem, not a writing problem — and it is the reason semantic search over your own notes is more useful than it sounds.

**Keep AGENTS.md short and true over long and comprehensive.** Fifteen lines you actually maintain beat two hundred that rot. Every line is a maintenance liability. If you would not update it during a refactor, cut it.

**Let stale things die visibly.** Date your notes. A dated note that says something from eight months ago reads as history. An undated one reads as current fact.

## The uncomfortable version

The reason these formats feel unsatisfying is that they ask you to solve a retrieval problem with a writing problem. Write more, write better, write in advance. But the failure was never that you wrote too little. It was that the thing you needed was written somewhere — in a PR, a note, a message — and nothing could find it and hand it over at the right moment.

Which is, when you look at it directly, the same problem you have. You wrote it down. You cannot find it either.

That is the part I find genuinely interesting: the reason your coding agent keeps forgetting your project is a slightly sharper version of the reason you keep re-deriving decisions you already made. Fixing it for the agent and fixing it for yourself turn out to be the same piece of work.`,
  },

  {
    slug: "semantic-search-over-your-own-notes",
    title: "Your AI assistant is only as good as what it can retrieve",
    seoTitle: "Semantic Search Over Your Own Notes",
    description:
      "Most AI note-taking tools fail at retrieval, not generation. How embedding-based semantic search actually works over a personal knowledge base — and why citations matter more than fluency.",
    answer:
      "Semantic search finds notes by meaning rather than exact words. Each note is converted into an embedding — a vector of numbers positioned so that related ideas sit near each other — and a query is converted the same way, then compared by cosine similarity. This is why searching \"how does login work\" can surface a note titled \"JWT refresh flow\" that shares no keywords. For a personal knowledge base the practical rules are: chunk notes into sections rather than embedding whole documents, combine semantic search with keyword search since exact terms still matter, and always show citations so a wrong answer is verifiable rather than merely convincing.",
    date: "2026-08-19",
    updated: "2026-09-01",
    readingMinutes: 9,
    tags: ["Semantic search", "Embeddings", "AI"],
    faq: [
      {
        question: "What is semantic search?",
        answer: "Semantic search finds notes by meaning rather than exact words. Each note is converted into an embedding — a vector of numbers positioned so that related ideas sit near each other. A query is converted the same way, then compared by cosine similarity. This is why searching 'how does login work' can surface a note titled 'JWT refresh flow' that shares no keywords.",
      },
      {
        question: "Why does keyword search fail for personal knowledge bases?",
        answer: "Traditional keyword search matches words, not meaning. You search 'how do users log in' and have a note titled 'JWT refresh flow' — zero shared keywords, zero results. For a personal knowledge base this failure is common because you're searching for things you half-remember. If you remembered the exact words, you wouldn't need to search.",
      },
      {
        question: "What is chunking and why does it matter for embeddings?",
        answer: "Chunking is splitting notes into sections before embedding them. A vector is a fixed size regardless of input length — embed a 3,000-word note covering four topics and you get a vector that means 'approximately the average of all of that,' which is nothing in particular. Split on markdown headings, overlap slightly across boundaries, and prepend the note title to each chunk.",
      },
      {
        question: "Should I use semantic search or keyword search?",
        answer: "Use both. Semantic search is bad at exact matches (error codes, function names, ticket numbers), while keyword search nails those instantly. The standard approach is reciprocal rank fusion: score each result by its rank position in each list, then merge. This handles 'how does login work' and 'ERR_JWT_EXPIRED' equally well.",
      },
      {
        question: "Why are citations important in AI search?",
        answer: "An answer without sources is unfalsifiable — it's fluent and plausible, but you have no way to check it. An answer with citations lets you verify every claim in seconds. Citations also create a second-order effect: you start noticing which notes are load-bearing (which ones keep getting cited), giving you signal about what you actually know.",
      },
    ],
    body: `Almost every AI note-taking tool demos the same way. Someone types a question, and a well-formatted answer appears. It looks like magic and it usually is not — because the hard part is not writing the answer. Language models have been good at that for years.

The hard part is finding the right four paragraphs out of your two thousand notes and putting them in front of the model. Get that wrong and you have built a very confident liar with access to your journal.

This is a retrieval problem, and it is worth understanding, because whether a tool is useful or annoying is decided almost entirely here.

## Keyword search and its failure mode

Traditional search matches words. You type \`auth\`, it finds documents containing \`auth\`. Postgres full-text search adds stemming and ranking, so \`running\` matches \`run\`, and this is genuinely good technology — fast, predictable, cheap, and when you remember the exact term you want, unbeatable.

The failure is specific: it cannot match on meaning. You search *how do users log in* and you have a note titled *JWT refresh flow*. Zero shared keywords. Zero results. The note is sitting right there, it is the exact note you want, and the search engine has no way to know.

For a personal knowledge base this failure is common rather than rare, because you are searching for things you half-remember. If you remembered the exact words you would not need to search — you would just open the note.

## What embeddings do

An embedding model reads text and returns a list of numbers — a vector, typically several hundred to a couple thousand of them. The useful property is how those vectors are arranged: text with similar *meaning* produces vectors that are close together in that space, even when the words differ.

So *how do users log in* and *JWT refresh flow* land near each other, because the model has learned from a great deal of text that these concepts are related. Search becomes geometry. Embed the query, find the nearest note vectors, return them ranked by distance. The usual distance measure is cosine similarity, which measures the angle between two vectors and ignores their length — you get a score from -1 to 1, and in practice anything above about 0.75 is worth looking at.

That is the whole idea. Everything else is engineering.

## Chunking is where it goes wrong

Here is the mistake that quietly ruins most implementations: embedding entire documents.

A vector is a fixed size regardless of input length. Embed four words and you get a vector that means those four words. Embed a 3,000-word note covering database schema, auth, deployment, and a rant about your CI provider, and you get a vector that means *approximately the average of all of that* — which is to say, nothing in particular. It sits in a vague middle region of the space, moderately close to everything and genuinely close to nothing. It will rank mediocre-ly for every query and win none of them.

The fix is chunking: split notes into sections and embed each one. Now the auth section has its own vector that is *sharply* about auth.

The tradeoffs are real and there is no universally correct answer. Chunk too small and you lose context — a paragraph that says "this approach did not work" is useless without knowing which approach. Chunk too large and you are back to averaging. A few things that hold up in practice:

- **Split on structure, not character count.** Markdown headings are a gift here. The author already told you where the topics change; use that instead of guessing at 500-character boundaries.
- **Overlap slightly.** Carrying a sentence or two across the boundary keeps ideas that straddle a heading from being cut in half.
- **Prepend the note title to each chunk.** Cheap, and it stops a chunk from losing all sense of what document it belongs to.

## Semantic search alone is not enough

Having argued for embeddings, the honest position is that you want both.

Semantic search is bad at exact matches. Search for an error code, a function name, a person's name, or a specific ticket number, and embeddings will hand you things that are *thematically related* — which is precisely wrong. You wanted that string. Keyword search nails it instantly.

So: run both, then merge. The standard approach is reciprocal rank fusion, which sounds fancier than it is — score each result by its *rank position* in each list rather than its raw score, then add the scores. It sidesteps the problem that a cosine similarity of 0.82 and a BM25 score of 4.7 are not on comparable scales.

The result is a search that handles *how does login work* and \`ERR_JWT_EXPIRED\` equally well, which is what you actually need, because you search for both kinds of thing.

One caveat I only learned by measuring it: fusion is not free. When we built an eval for this — twenty questions over a corpus seeded with deliberately confusable notes — equal-weight fusion scored *worse* than keyword search alone. The reason turned out to be boring and important: the semantic leg in that harness was a bag-of-words fingerprint standing in for a real embedding model, so we were fusing a lexical ranker with another lexical ranker. No independent signal, just noise. Down-weighting the semantic side recovered parity but never beat it.

The lesson is not "hybrid retrieval is overrated." It is that fusion only pays when the two rankers fail *differently*, and you cannot know whether yours do without measuring. If you take one thing from this section, take that: build the eval before you tune the weights.

## Citations are not a nicety

Once retrieval works, you can feed the top chunks to a model and get an answer. This is the part that looks impressive in a demo, and it is also where the tool earns or loses your trust permanently.

An answer without sources is unfalsifiable. It is fluent, it is plausible, and you have no way to check it short of manually searching for what you just asked. If it is subtly wrong — a date off by a month, two decisions conflated, a detail imported from the model's training rather than your notes — you will not catch it. You will act on it.

An answer with citations is a different object. Every claim links to the note it came from. You skim the sources, you see whether they support the claim, you move on in about four seconds. And critically, the failure modes become *visible*: if the answer cites nothing relevant, you can tell the retrieval missed rather than assuming the answer is right.

There is a second-order effect worth naming. Once answers carry citations, you start noticing which of your notes are load-bearing — which ones keep getting cited. That is real signal about what you actually know versus what you merely wrote down once.

## What this looks like when it works

The honest version of a good day with this setup:

You are six months past a decision and cannot remember why you made it. You ask, in ordinary words, *why did we not use Firebase*. Retrieval finds a chunk from a note you wrote in March, a comment on a task, and a paragraph from a daily entry the week you were deciding. The answer summarizes the tradeoff and cites all three. You click the March note, confirm it, and get back to work.

Total elapsed time: fifteen seconds. Without it: either ten minutes of searching, or — far more likely — you re-derive the decision from scratch and possibly reach a different conclusion than your past self did, for no reason other than that you could not find what you already knew.

That second outcome is the expensive one, and it is invisible. Nobody logs the hours lost to re-deriving. It just feels like work.

## Practical notes if you are building this

A few things that are not obvious until you hit them:

**Re-embed on edit, not on read.** Embeddings go stale when the text changes. Do it on write, in the background. Users will not wait.

**Store the model version alongside the vector.** You will change embedding models eventually, and vectors from different models are not comparable. Without a version column you will have a silently broken index and a very confusing afternoon.

**pgvector is usually enough.** If you are already running Postgres, an \`HNSW\` index over a \`vector\` column will comfortably serve a personal knowledge base — we are talking thousands to hundreds of thousands of chunks, not billions. A dedicated vector database is a second system to operate, and at this scale it buys you very little.

**Show the scores while developing.** Displaying the similarity score next to each result during development is the fastest way to build intuition about what your thresholds should be, and to notice when chunking has gone wrong.

## The point

Retrieval quality is the product. A brilliant model over bad retrieval produces confident nonsense. An ordinary model over good retrieval produces something that feels like a colleague who has actually read your notes.

Most of the work — and most of the value — is in the unglamorous half: how you chunk, how you combine ranking signals, and whether you show your sources.`,
  },

  {
    slug: "self-hosted-second-brain-supabase-pgvector",
    title: "Self-hosting your second brain, and why data ownership stopped being paranoid",
    seoTitle: "Self-Hosted Second Brain With Supabase",
    description:
      "Notion, Evernote, and Obsidian make different bets on where your notes live. A practical look at self-hosting a second brain on Postgres and pgvector — costs, tradeoffs, and what you actually get.",
    answer:
      "A self-hosted second brain means your notes live in a database you control rather than a vendor's cloud. In practice this usually means Postgres — with pgvector for semantic search — running on a host you own, on infrastructure you can point at. The tradeoffs are honest: you take on backups, upgrades, and availability, and you give up the polish of a well-funded product team. What you get is a real export path, the ability to query your own data with SQL, no per-seat pricing on your own thoughts, and immunity to a product decision made in a meeting you were not in. For a knowledge base you expect to keep for a decade, that last point does most of the work.",
    date: "2026-08-26",
    updated: "2026-09-01",
    readingMinutes: 8,
    tags: ["Self-hosting", "Supabase", "Data ownership"],
    faq: [
      {
        question: "What does self-hosted mean for a second brain?",
        answer: "Self-hosted means the database is yours — a Postgres instance under your account, on a provider you chose, that you can connect to with any Postgres client, back up with pg_dump, and point at a different application tomorrow. The app that renders your notes is replaceable. The data underneath it is not going anywhere without your say-so.",
      },
      {
        question: "Why Postgres for a note-taking app?",
        answer: "Once your notes are in Postgres, some things become easy: you can query your notes with SQL (which tags do I use most?), semantic search comes nearly free via pgvector, relationships between notes/tasks/projects are actual foreign keys, and the backup story is boring in the best way — pg_dump produces a file that restores into any Postgres anywhere.",
      },
      {
        question: "What are the costs of self-hosting a second brain?",
        answer: "You own the operations (backups, upgrades), you give up a product team (mobile, offline sync, collaborative editing), and there's a setup cost (typically 20 minutes with managed Postgres). Managed Postgres has made this dramatically less demanding than it was, but it's not zero.",
      },
      {
        question: "When does data ownership actually matter?",
        answer: "When pricing changes (a tool introduces a seat minimum), when product direction changes (the feature you depend on gets deprioritized), when shutdown happens (rare but not rare enough), or when you want to build something custom on your own data. Ownership is worth nothing right up until the moment it's worth everything, and you can't buy it retroactively.",
      },
      {
        question: "Is self-hosting more private than using Notion?",
        answer: "Self-hosting doesn't automatically make your data more private or secure. A misconfigured Postgres with row-level security disabled and a public connection string is considerably worse than Notion's cloud. You have to actually configure the security controls. The benefit is that you have the option to lock it down — the data is in your hands.",
      },
    ],
    body: `Every note-taking tool makes a bet about where your notes should live, and the bet is usually invisible until it costs you something.

Notion bets on their cloud. Everything is a block in their database, the collaboration is genuinely excellent, and the export is a zip of HTML or markdown that loses most of the structure that made it useful. Obsidian bets on local files, which is a strong position — plain markdown on your disk, yours forever — and then you spend a weekend on sync and another on plugins to get search that works across devices. Evernote bet on their cloud too, and then spent several years teaching a large number of people what it feels like when a company you have trusted with a decade of notes changes its pricing and its priorities.

There is a fourth option that has quietly become reasonable: run a database you control, and build on top of it.

## What "self-hosted" means here

It is a loaded term, so let me be specific about the version I mean.

Not: a server in your closet. Not: you become a sysadmin. Not: you compile things.

What I mean is that the **database is yours** — a Postgres instance under your account, on a provider you chose, that you can connect to with any Postgres client, back up with \`pg_dump\`, and point at a different application tomorrow. The app that renders your notes is replaceable. The data underneath it is not going anywhere without your say-so.

Supabase is the path of least resistance here, though the argument holds for any managed Postgres. You get Postgres with row-level security, auth, and \`pgvector\` for embeddings, on a free tier that comfortably fits a personal knowledge base. It is your project, in your account, with your connection string.

The distinction that matters is not "who runs the server." It is **who can revoke your access.**

## Why Postgres specifically

Once your notes are in a real relational database, some things become easy that are otherwise impossible.

**You can query it.** Your notes are rows. Which tags do I use most and never revisit? Which projects have tasks that have been open more than sixty days? How much did I write each month last year? These are four-line SQL queries. In a closed product they are feature requests, and the answer is usually no.

**Semantic search comes nearly free.** \`pgvector\` adds a \`vector\` column type and the index types to search it. Your embeddings live in the same database as the text they came from, in the same transaction. No second datastore, no sync job between your notes and your search index, no class of bug where the two disagree.

**Relationships are actual relationships.** A note linked to a task linked to a project is three rows and two foreign keys. The knowledge graph is not a feature someone built — it is a query over data that was already shaped correctly.

**The backup story is boring, which is the highest compliment.** \`pg_dump\` produces a file. That file restores into any Postgres anywhere. This is thirty-year-old technology and it will outlive every note-taking startup currently operating.

## The honest costs

Anyone who tells you self-hosting is free is selling something.

**You own the operations.** Nobody is paging themselves at 2am because your notes are down. If you skip backups, you have no backups. The mitigating fact is that managed Postgres has made this dramatically less demanding than it was — automated backups are a checkbox, upgrades are mostly a button — but it is not zero, and pretending otherwise is how people lose data.

**You give up a product team.** A well-funded company shipping a note-taking app full-time will out-polish you on mobile, on offline sync, on the hundred small interactions you never think about until they are missing. Real-time collaborative editing in particular is genuinely hard, and if you need several people typing in the same document simultaneously, this is the wrong tradeoff and Notion is a good product.

**There is a setup cost.** It is a project, an environment variable, and a schema migration rather than a signup form. Twenty minutes if things go well. Some people will bounce off that, entirely reasonably.

## When ownership actually pays

The argument for owning your data usually gets made in the abstract — sovereignty, lock-in, principle — and abstract arguments are easy to nod at and ignore. The concrete versions:

**Pricing changes.** A tool you have used for four years introduces a seat minimum, or moves the feature you depend on into a higher tier. If your data is in their cloud, your options are pay or lose the workflow. If your data is in your Postgres, your option is to keep using it.

**Product direction changes.** The tool pivots to enterprise, or to AI, or to whatever the market is rewarding this year, and the thing you loved gets deprioritized. This happens constantly and it is nobody's fault — it is just what companies do. It is only a catastrophe if you cannot leave.

**Shutdown.** Rarer than the internet suggests, but not rare enough. Usually there is a merciful window and an export button. Sometimes the export is bad.

**You want to build something.** This is the underrated one. Once you have SQL access to your own notes, you can write the small tool you have always wanted — a weekly digest, a script that flags notes nobody has opened in a year, a custom view for one specific project. Not a plugin API someone designed for you. Actual queries against actual data.

The pattern in all four: ownership is worth nothing right up until the moment it is worth everything, and you cannot buy it retroactively.

## What this does not solve

Being fair to the alternatives.

Self-hosting does not make your data more private from yourself, and it does not automatically make it secure. A misconfigured Postgres with row-level security disabled and a public connection string is considerably worse than Notion's cloud. You have to actually turn the locks.

It does not solve sync. It relocates it. Your data being in Postgres means every client hits the same database, which is a simpler model than file sync, but it does mean you are online or you are working from cache.

And it does not make the app good. A well-designed product on a closed backend beats a badly-designed one on an open backend every single day of the week. Ownership is a floor, not a ceiling. It guarantees you can leave. It does not guarantee you will want to stay.

## The ten-year test

Here is the question I find clarifying: **where do you want your notes to be in ten years?**

Not next quarter. Ten years. A second brain is a compounding asset — its value comes almost entirely from accumulation, from the note you wrote in 2019 turning out to answer a question you have in 2029. That only works if the notes survive continuously, and surviving ten years means surviving pricing changes, acquisitions, pivots, and at least one product decision you strongly disagree with.

A zip of markdown in a folder passes that test. A Postgres dump passes it. A proprietary cloud with a lossy export button probably does not, and you will not find out which until the day you need it to.

That is the whole argument, and it is not really about technology. It is about which failure you would rather be exposed to: the inconvenience of running a database, or the possibility that a decade of your thinking becomes read-only in someone else's product.

For most notes, most of the time, either is fine. For the ones you would be upset to lose, the choice makes itself.`,
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getSortedPosts(): Post[] {
  return [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

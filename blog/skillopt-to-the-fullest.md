# SkillOpt to the Fullest: Train Your Agent Skills Like You Train Neural Networks

Your model is frozen. Your skills don't have to be.

[SkillOpt](https://github.com/microsoft/SkillOpt) (Microsoft, MIT license, arXiv:2605.23904) starts from one idea: a skill's markdown is a trainable parameter. You don't fine-tune the model — you run it on real tasks, let a second model reflect on the transcripts, and accept only the edits that measurably beat a held-out validation score. Epochs, minibatches, learning rates, validation gates — all of it, in text space.

The numbers earn the attention: on GPT-5.5, a trained skill added +23.5 points in direct chat, +24.8 in Codex CLI, and +19.1 in Claude Code. Biggest gains land on procedural work — SpreadsheetBench +39, OfficeQA +39, LiveMathematicianBench +29.3. And the output is just a markdown file (typically 300–2,000 tokens) you deploy unchanged: zero inference-time overhead, and it transfers across model scales and harnesses.

The [skillopt entry is live on SkillMake](https://skillmake.xyz/marketplace) — this guide is the long version: how the loop works, and the four levels of using it, from a zero-risk demo to a nightly autopilot.

## The core loop

```
            frozen agent (weights never change)
                          │
        ┌─────────────────▼──────────────────┐
        │  FORWARD PASS                      │
        │  run training tasks WITH current   │
        │  SKILL.md → scored trajectories    │
        └─────────────────┬──────────────────┘
                          │ minibatch of transcripts
        ┌─────────────────▼──────────────────┐
        │  BACKWARD PASS (optimizer model)   │
        │  reflect on failures → propose     │
        │  ≤N bounded add/delete/replace     │
        │  edits   («textual learning rate») │
        └─────────────────┬──────────────────┘
                          │ candidate SKILL.md
        ┌─────────────────▼──────────────────┐
        │  VALIDATION GATE                   │
        │  held-out tasks: strictly better?  │
        │    yes → accept edit               │
        │    no  → rejected-edit buffer ─────┼──▶ negative feedback
        └─────────────────┬──────────────────┘        next epoch
                          │ repeat epochs
                          ▼
                   best_skill.md  (300–2,000 tokens, ships as-is)
```

Three design choices do the heavy lifting:

- **The edit budget is a learning rate.** Every update is a small set of bounded add/delete/replace operations. Remove the cap and the optimizer destabilizes — same failure mode as a too-hot learning rate. Real deployments typically land only 1–4 accepted edits. Expect refinement, not rewrites.
- **The validation gate is strict.** A candidate must *strictly* improve the held-out score or it's rejected. Rejected edits aren't discarded — they go into a rejected-edit buffer that feeds back as negative examples, and epoch-wise "slow" updates consolidate longer-horizon lessons.
- **The optimizer is a separate model.** The agent being improved never grades its own homework.

## Level 0 — taste it with zero risk

The sleep engine's default backend is `mock`: deterministic, no API key, no spend.

```bash
pip install skillopt        # Python ≥ 3.10
skillopt-sleep dry-run --project "$PWD" --source auto --backend mock
```

There's even a self-contained demo that asserts an improvement without any API key:

```bash
python -m skillopt_sleep.experiments.run_experiment --persona researcher --assert-improves
```

If the concepts click here, everything after is the same loop with real models plugged in.

## Level 1 — the Claude Code plugin

The official plugin ships inside the repo (`plugins/claude-code`), not the PyPI wheel, so clone first:

```bash
git clone https://github.com/microsoft/SkillOpt.git
```

Then inside Claude Code:

```
/plugin marketplace add ./SkillOpt/plugins/claude-code
/plugin install skillopt-sleep@skillopt-sleep
/skillopt-sleep status
```

You get `/skillopt-sleep dry-run | run | status | adopt | schedule | unschedule`, plus `/skillopt-sleep-handoff run` (the current session answers the model calls itself — no second API bill). Requires `claude` or `codex` on PATH. Adoption writes into your `CLAUDE.md` / `SKILL.md` with backups.

## Level 2 — nightly autopilot (SkillOpt-Sleep)

This is the "to the fullest" part. Your agent transcripts already encode what keeps going wrong; Sleep mines them while you're not working:

```
  day: you work in Claude Code            night (cron, e.g. 03:17):
  ─────────────────────────────           ──────────────────────────────
  transcripts pile up in ~/.claude   ──▶  HARVEST   read transcripts (read-only)
                                          MINE      find recurring task shapes
                                          REPLAY    re-run them offline vs SKILL.md
                                          CONSOLIDATE  propose bounded edits
                                          STAGE     write proposal + backup
                                               │
  morning: skillopt-sleep status  ◀───────────┘
           review diff → skillopt-sleep adopt   (human gate — default ON)
                    │
                    ▼
        your SKILL.md / CLAUDE.md got measurably better overnight
```

```bash
# one real pass against a specific skill
skillopt-sleep run --project "$PWD" \
  --target-skill-path .claude/skills/my-skill/SKILL.md \
  --source auto --backend claude

# make it nightly
skillopt-sleep schedule --hour 3 --minute 17

# the morning ritual
skillopt-sleep status --project "$PWD"   # what got staged?
skillopt-sleep adopt  --project "$PWD"   # accept after reading the diff
```

Bound the spend with `--max-sessions` / `--max-tasks`. Real-world numbers from the docs: SearchQA 0.802 → 0.848, SpreadsheetBench 0.279 → 0.314.

**On `--auto-adopt`:** the docs are blunt — only with independent rollback and validation in place. The human review gate is the product, not friction. Two more reasons to keep it: real backends transmit transcript excerpts to model providers and secret redaction is *not guaranteed*, and the validation gate is not a security boundary — a candidate that passes evals can still carry injected instructions. Read the diff.

## Level 3 — full training runs

For benchmark-grade optimization, use the research engine directly:

```bash
git clone https://github.com/microsoft/SkillOpt.git && cd SkillOpt
python -m pip install -e ".[searchqa]"
python scripts/materialize_searchqa.py
python scripts/train.py --config configs/searchqa/default.yaml

# evaluate the artifact on a held-out split
python scripts/eval_only.py --config configs/searchqa/default.yaml \
  --skill outputs/<run>/best_skill.md --split valid_unseen

# watch runs in the dashboard
python -m skillopt_webui.app --port 7860
```

Credentials go in `.env` (copy `.env.example`). Backends cover Azure OpenAI (`openai_chat`), anything OpenAI-compatible (DeepSeek, vLLM, Ollama), `claude_chat`, `qwen_chat`, `minimax_chat`, plus execution backends `codex_exec` and `claude_code_exec` for harness-in-the-loop training.

The highest-leverage move at this level: **train on your own tasks.** `skillopt/envs/searchqa/` is the template; `docs/guide/new-benchmark.md` walks through wrapping your task set and evaluator as a benchmark package. Which points at the real prerequisite —

**SkillOpt shines exactly where tasks recur and correctness is automatically checkable.** Tests pass or fail, spreadsheets match or don't, answers grade cleanly. No verifier, no gradient. If your workflow has no automatic check, build that first; it pays for itself the moment you point any optimizer at it.

## Power knobs (deliberately, not first)

Three experimental Sleep knobs, all off by default:

- `dream_rollouts` — replay each mined task K times and learn contrastively from the spread
- `recall_k` — pull K similar past tasks into context when replaying (the SearchQA 0.848 run used `recall_k=20`)
- `dream_factor` — generate synthetic task variants to densify sparse task sets

Turn them on one at a time, watch the validation delta, keep what earns its place. Which is, fittingly, the SkillOpt method applied to SkillOpt itself.

## SkillOpt × SkillMake

SkillMake's own pipeline is built on the same pattern — bounded edits under a budget, a static validation gate on every candidate, and protected sections that pin curator knowledge against fast iteration:

```
  SkillMake catalog ──/i/<name>──▶ installed SKILL.md ──▶ daily agent use
        ▲                                                      │
        │   (protectedSections pin curator knowledge;          ▼
        │    the validation gate on every candidate is    skillopt-sleep
        │    the same pattern SkillOpt trains with)        nightly run
        └────────── improved skill, re-submitted ◀─────── adopted edits
```

So the full loop is: install a skill from the catalog, let SkillOpt-Sleep evolve it against your actual work, and the edits that survive the gate flow back as a better skill. The catalog gives you a good starting checkpoint; SkillOpt does the training.

## Gotchas, compressed

- Transcript excerpts leave your machine on real backends; redaction isn't guaranteed — review harvest files before adopt
- `--auto-adopt` only with independent rollback; the review gate is the product
- No recurring, checkable tasks → no signal; build the verifier first
- Default backend is `mock` — you're not optimizing anything real until you pass `--backend claude|codex`
- Validation gates ≠ security boundaries; read every diff you adopt
- The Claude Code plugin is in the repo, not the wheel
- 1–4 accepted edits is success, not failure

---

*SkillOpt: [repo](https://github.com/microsoft/SkillOpt) · [docs](https://microsoft.github.io/SkillOpt/) · [MSR blog](https://www.microsoft.com/en-us/research/blog/skillopt-agent-skills-as-trainable-parameters/) · paper arXiv:2605.23904. Install the skill from [SkillMake](https://skillmake.xyz/marketplace).*

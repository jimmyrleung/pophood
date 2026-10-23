# Naming discussion

- **Date:** 2026-10-20
- **Context:** in the grill (Q31), the owner decided to choose the name after the spike. Until then, `pc-bench-monitor` was the placeholder.
- **Result:** **Pophood**
- **Format:** each round lists the owner's request **verbatim**, the candidates suggested, the availability checks, and the outcome.

## How availability was checked

For each candidate:
- **GitHub:** a repository search by name (`/search/repositories?q=<name>+in:name`), recording the total count and the top match by stars.
- **crates.io:** whether a crate with that exact name exists (`/api/v1/crates/<name>`).

These are snapshots from 2026-10-20, not reservations. Nothing has been registered yet.

## Round 1: first suggestions

**Request:**
> give me some nice name suggestions

**Candidates, by theme:**

| Theme | Name | Idea |
|---|---|---|
| Trust and transparency | Openhood | "Pop the hood" on your PC, and the hood is open, as in open source |
| | Glassrig | A rig you can see through, with a read-only helper you can audit |
| | Underhood | Same idea as Openhood, a little softer |
| Measuring performance | Dynorig | A dyno is the machine that measures an engine's power: you put your rig on the dyno |
| | Rigdyno | The same idea in the other order |
| | Benchwise | Benchmark wisely by comparing against your own history |

**Checked and dropped:**

| Name | Why |
|---|---|
| rigscope | GitHub `lkarlslund/rigscope`, "Continuous hardware telemetry scope for rigs": same domain |
| pitwall | 875 GitHub repos and taken on crates.io |
| glassbench | Taken on crates.io (a well-known Rust benchmarking crate, `Canop/glassbench`) |
| tachy | Taken on crates.io |
| siliscope | Free on crates.io, but GitHub `Arharim/siliscope` (an unrelated firmware checker) uses it |
| kelvinbench | Free, but not proposed |

**Check results for the proposed names:**

| Name | GitHub | crates.io | Verdict |
|---|---|---|---|
| Dynorig | 0 repos | free | Completely free |
| Rigdyno | 0 repos | free | Completely free |
| Glassrig | 1 repo (`eawesley/GlassRig`, no description) | free | Effectively free |
| Openhood | 25 repos; top match is an old `openhood` org (Ruby on Rails PayPal plugins) | free | Usable as `<you>/openhood`, but the org name is taken and search results would be mixed |
| Benchwise | 11 repos, including a `Benchwise/benchwise` org | free | Taken as an org |
| Underhood | 71 repos, including `TreeTide/underhood`, a known code browser | free | Dropped |

**Recommendation:** first Openhood (before the GitHub check), then Dynorig (confirmed free everywhere) or Glassrig (best for the trust story) after it.

## Round 2: names like Openhood

**Request:**
> dang it I liked openhood, can we explore similar names following that idea?

**Candidates:** all on the theme of popping the hood to look at your PC's engine.

| Name | Idea | GitHub | crates.io |
|---|---|---|---|
| **Hoodlight** | The work lamp a mechanic hangs under the hood. It covers monitoring (shining light on the hardware) and is open by nature. | 0 repos | free |
| **Pophood** | "Pop the hood": the action of opening up your PC to look inside. Playful, and close to the sound of Openhood. | 0 repos | free |
| **Clearhood** | A transparent hood: see the engine and see inside the tool (trust, read-only) | 0 repos | free |
| Hoodview | Looking under the hood | 2 small repos | free |
| Hoodup | The hood is up and you're working on the engine | 16 repos (an old Backbone.js library, `andru/hoodup`) | free |
| ~~Openbay~~ | The engine bay is open | 70 repos (`isohuntto/openbay`, a well-known torrent project) | free |
| ~~Rigbay~~ | | 3 repos, including a `Rigbay` org | free |
| ~~Baylight~~ | | 6 repos (an unrelated game site) | free |

**Recommendation:** Hoodlight, as the closest in meaning to Openhood. Pophood if the owner wanted something more playful and closer to the sound of Openhood. Openhood itself stayed usable as `<you>/openhood`, at the cost of shared search results and no `openhood` GitHub org.

## Round 3: the choice

**Answer:**
> I think I liked pophood better as you mentioned it is more playful

**Outcome:** The project is named **Pophood**. The repo is `C:\Users\jimmy\projects\pophood`, and the specs moved from `second_brain/specs/pc-bench-monitor/` to `specs/v0.1.0/`. Runners-up, in order: Hoodlight, Clearhood, Dynorig.

## Still to do

- Create the public GitHub repo (`<owner>/pophood`). This wasn't done, because `gh` isn't installed and publishing is the owner's call.
- Optionally reserve the `pophood` crate name on crates.io, if the Rust core ever gets published as a crate (not planned).

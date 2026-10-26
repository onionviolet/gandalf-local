# Facilitator guide

The aim is to help students notice the difference between asking an AI to obey a rule and enforcing a rule in application code. The hidden words are fictional, different for each browser, and replaceable with a fresh run.

## A short session

1. **Explore together, 3 minutes.** Project level 1. Ask the group what to try before typing anything. Let them see how naturally a model repeats something in its context.
2. **Try in pairs, 10 minutes.** Let teams work through levels 2–5. Use the nudge sparingly. Encourage them to describe why a question worked, not just collect an answer.
3. **Compare defenses, 5 minutes.** Discuss exact text checks versus meaning. Which checks saw the question? Which saw the answer?
4. **Finish with layers, 5 minutes.** Demonstrate the AI input check and combined level. The last level may remain unsolved; use a recorded rehearsal example if needed.
5. **Debrief, 3 minutes.** Ask where a real application should keep an actual password. An AI’s accessible context should not be the secret store.

Treat these durations as a proposed lesson plan, not measured playtime. A full seven-level race may run longer, especially with a stronger model.

## Rehearse before inviting a room

Run `OLLAMA_MODEL=your-model npm run calibrate`. Then play through the browser. Confirm a direct question succeeds on level 1, a direct request meets more resistance on level 2, the exact output filter catches a literal leak, and benign questions work through the AI guards. Find at least one usable bypass at the levels you plan to demonstrate. Do not promise that a prompt from another model will work.

Some local models follow secrecy instructions exceptionally well; others volunteer the word. Both make the lesson harder to pace. Choose the model after a rehearsal and keep the same model/version during the session. Changing a model resets a browser’s run to prevent comparing unrelated results as though they were one progression.

The first request can include loading the model. The final level uses up to three local inference calls. Test simultaneous requests from the expected number of teams. The server queues requests rather than spawning more copies of the model.

## Hints and expected observations

| Level | A hint to offer | What to discuss |
| --- | --- | --- |
| 1 | What would you ask a person who knew the word? | Context can be repeated. |
| 2 | Can a story, clue, or rephrasing change the task? | A language instruction can be interpreted or bypassed. |
| 3 | Could information appear without the whole word? | Exact matching misses alternate representations. |
| 4 | What would a reader recognize as a clue? | A second model makes a judgment, not a proof. |
| 5 | What other words could you use to ask? | Intent and keywords differ; another language may matter. |
| 6 | What ordinary task could have a second purpose? | Intent can be ambiguous. |
| 7 | Which earlier ideas could work together? | Defense in depth changes the attack, but does not make context a safe place for secrets. |

A guard error, timeout, or empty model response is a technical failure, not a successful defense. The app displays these separately and withholds unreviewed output if an AI reader fails.

## Reset, sharing, and privacy

Open **Facilitator settings → Start a fresh run**. Resetting affects only the current browser. Other teams keep their own words and progress. Server restart resets every team. A browser refresh preserves progress while its cookie and server session remain valid, but clears the visible answer.

Use the same hostname throughout a run: `localhost`, `127.0.0.1`, and the LAN IP have different browser cookie scopes. A phone’s `localhost` means the phone, not the facilitator’s laptop. Share the laptop’s LAN IP when using the deliberate LAN mode.

Use made-up information. There are no real bank accounts, email tools, filesystem tools, or agents taking external actions. An unexpected model answer is still model-generated text; it never runs as code in this app.

Before outreach, take a few screenshots of successful and blocked attempts. That gives you a demonstration if networking or inference becomes slow. No automatic transcript collection is included.

## Fidelity

The seven-level architecture follows the original published mechanic. Word selection, judge instructions, and backend implementation are new. The player layout follows the original, and the wizard images are recovered Lakera artwork; the historical frontend is preserved separately. The original evolving eighth level is deliberately not presented as recovered. The app does not claim identical responses or a fixed probability of success.

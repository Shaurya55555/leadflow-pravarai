# LeadFlow demo video script (about 2 minutes)

Record at 1280x720 or larger, with the app freshly seeded (`python -m app.seed --reset`).
Keep the browser zoom at 100% and close other tabs. Run the backend and frontend first
(see the README), and start recording on `http://localhost:3000`.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show the login screen, type a wrong password, then the demo account (`demo@leadflow.test` / `leadflow123`) | "LeadFlow is protected by login. A wrong password gets a clear error, and the API returns 401 without a token." |
| 0:10 | Show the list | "This is LeadFlow, a single-screen lead tracker built with Next.js and FastAPI. Today's follow-ups are pinned at the top, overdue ones are red, and closed deals are dimmed." |
| 0:12 | Point at a row | "Each row shows the status, the last note and how long ago it was." |
| 0:20 | Click the **Contacted** filter, then **All** | "Status filters work for all six stages." |
| 0:28 | Type part of a name in the search box, then clear it | "Search by name composes with the filters." |
| 0:38 | Click a lead | "Clicking a lead opens a dialog, not a new page. History is newest first and ends with the lead creation event." |
| 0:48 | Type "Wants a call on Friday to finalise the contract" | "As I type, it suggests a follow-up from the note text. This is a simple rule-based suggestion, not an AI call." |
| 1:00 | Click **Use suggestion**, then **Save Note** | "It only fills the form when I choose to. Saving logs the note and schedules the follow-up." |
| 1:10 | Close the dialog and point at the updated row | "The list updated immediately, with the new note and follow-up chip." |
| 1:18 | Re-open the lead, change the status dropdown | "Status can be changed here and is persisted." |
| 1:26 | Click **Edit details**, change the company, **Save changes** | "Lead details can be edited here too." |
| 1:36 | Type half a note, press **Esc** | "If I close with an unsaved note, it asks before discarding." Click **Keep editing**. |
| 1:44 | Click **+ Add New Lead**, fill Full Name only, **Save Lead** | "Only the name is required, and the status defaults to New." |
| 1:54 | Press F5 | "Everything persists after a reload." |

Optional last 10 seconds: show `http://localhost:8000/docs` and say "The API is documented, and there are 108 API tests and 86 frontend tests running in CI."

Tip: if a take goes wrong, run `python -m app.seed --reset` in `backend/` and refresh to start from clean data.

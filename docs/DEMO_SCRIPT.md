# LeadFlow demo video script (about 90 seconds)

Record at 1280x720 or larger, with the app freshly seeded (`python -m app.seed --reset`).
Keep the browser zoom at 100% and close other tabs.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show the list at `localhost:3000` | "This is LeadFlow, a single-screen lead tracker. Today's follow-ups are pinned at the top, overdue ones are red, and closed deals are dimmed." |
| 0:10 | Point at a row | "Each row shows the status, the last note and how long ago it was." |
| 0:18 | Click the **Contacted** filter, then **All** | "Status filters work for all six stages." |
| 0:25 | Type part of a name in the search box, then clear it | "Search by name composes with the filters." |
| 0:35 | Click a lead | "Clicking a lead opens a dialog, not a new page. History is newest first and ends with the lead creation event." |
| 0:45 | Type a note, tick **Set Follow-up**, leave the prefilled tomorrow 10:00, click **Save Note** | "I log a discussion and schedule a follow-up." |
| 0:58 | Close the dialog and point at the updated row | "The list updated immediately, with the new note and follow-up chip." |
| 1:05 | Re-open the lead, change the status dropdown | "Status can be changed here and is persisted." |
| 1:12 | Type half a note, press **Esc** | "If I close with an unsaved note, it asks before discarding." Click **Keep editing**. |
| 1:20 | Click **+ Add New Lead**, fill Full Name only, **Save Lead** | "Only the name is required, and the status defaults to New." |
| 1:30 | Press F5 | "Everything persists after a reload." |

Optional last 10 seconds: show `http://localhost:8000/docs` and say "The API is documented and tested."

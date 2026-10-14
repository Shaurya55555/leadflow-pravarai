# Testing and edge cases

LeadFlow has **108 backend tests** (pytest) and **86 frontend tests** (Vitest + Testing Library),
all run in CI on every push. This page lists what is covered, grouped by the kind of failure it
guards against, so a reviewer can find the evidence for any claim quickly.

```bash
cd backend  && pytest -q      # 108 passed
cd frontend && npm test       # 86 passed
```

## Real bugs the tests found (all fixed, each with a regression test)

| Found by | Bug | Fix |
| --- | --- | --- |
| Edge-case API tests | `PATCH /leads/{id}` with `{"name": null}` or a blank name returned **500** | Explicit 422 with a readable message |
| Robustness tests | `GET /leads/999999999999999999999999999999` returned **500** (integer overflow in SQLite) | Path ids are validated to the database's integer range, so the answer is 404/422 |
| Fresh-clone run | `tsc` failed on a clean checkout because of a framework-generated type | Explicit prop types |
| Fresh-clone run | Production build failed offline because of a font download | System font stack |
| CI | Plain `pytest` could not import the app | `pytest.ini` sets the import path |

## 1. Input validation (the API never trusts the client)

| Case | Expected | Test |
| --- | --- | --- |
| Lead without a name, empty name, whitespace-only name | 422 | `test_blank_or_missing_name_is_422` |
| Wrong types (`name: 123`, list, object) and unknown status (`"won"`, `"Archived"`) | 422 | `test_wrong_types_and_values_are_422` |
| Name over 120 chars, note over the limit | 422 | `test_name_and_note_length_limits` |
| Empty or whitespace-only note | 422 | `test_empty_note_rejected` |
| Unparseable follow-up date (`"tomorrow"`, `2026-13-45`, empty string) | 422 | `test_unparseable_follow_up_is_422` |
| Malformed JSON body, non-JSON content type | 422, never 500 | `test_malformed_json_body_is_422_not_500` |
| Invalid status filter (`?status=bogus`) | 422 | `test_invalid_status_filter_is_422` |
| PATCH that tries to blank the name or null the status | 422, record untouched | `test_patch_cannot_blank_required_fields` |
| Empty PATCH | no-op, 200 | `test_empty_patch_is_a_noop` |

## 2. Resources that do not exist

| Case | Expected | Test |
| --- | --- | --- |
| Unknown id on get, patch, delete, list discussions, add discussion | 404 with a readable message | `test_unknown_lead_for_every_write`, `test_404_has_a_readable_detail` |
| Non-numeric, negative, zero or fractional id | 404 or 422, never 500 | `test_bad_ids_are_422_or_404` |
| Absurdly large id | 404 or 422, never 500 | `test_absurdly_large_id_is_handled` |
| Lead deleted, then fetched again or deleted twice | 404 everywhere, discussions cascade | `test_deleted_lead_is_gone_everywhere`, `test_delete_cascades` |
| Unsupported HTTP method | 405 | `test_unsupported_method_is_405` |

## 3. Hostile and awkward text

| Case | Expected | Test |
| --- | --- | --- |
| Unicode (accents, CJK, Arabic), emoji, zero-width characters, tabs | Stored and returned unchanged | `test_awkward_text_round_trips_unchanged` |
| SQL injection strings in name, note, search and login | Treated as plain text, tables intact | `test_sql_injection_strings_do_not_damage_anything`, `test_login_sql_injection_attempt_fails_cleanly` |
| `%`, `_` and `\` in search | Matched literally, not as wildcards | `test_search_treats_wildcards_literally` |
| HTML and script tags in names, companies and notes | Rendered as text, nothing executes | `LeadFlowApp.test.tsx` "never interprets markup" |
| 500-character name with no spaces | Layout survives | `LeadFlowApp.test.tsx` "very long unbroken names" |
| 10,000-character search string | 200, no results | `test_blank_and_very_long_search_are_safe` |

## 4. Time and dates (the classic source of bugs)

| Case | Expected | Test |
| --- | --- | --- |
| One second before local midnight vs exactly at midnight | "Due today" flips at the right instant | `time.test.ts` "around local midnight" |
| Viewer's day differs from the UTC date | Local day wins | `time.test.ts` "uses the viewer's local day" |
| Follow-up sent with a `+05:30` offset | Stored as the same instant in UTC | `test_follow_up_with_offset_is_stored_as_the_same_instant` |
| Naive timestamps | Treated as UTC; every output ends in `Z` | `test_naive_datetime_is_treated_as_utc`, `test_timestamps_are_always_serialized_as_utc` |
| Year 1970 and year 2099 | Accepted and returned exactly | `test_extreme_follow_up_dates_are_accepted` |
| Won and Lost leads with a stale follow-up | Never shown as overdue or pinned | `time.test.ts` "never flags closed leads", `LeadRow.test.tsx` |
| "Next Friday", "in 3 days", month and year rollover | Correct date, never "today" | `suggest.test.ts` |
| Two notes with the identical timestamp | Stable, newest-by-insertion first | `test_identical_timestamps_fall_back_to_insertion_order` |

## 5. Business rules

| Rule | Test |
| --- | --- |
| A new lead defaults to status New; input is trimmed | `test_create_defaults_to_new_and_trims` |
| A note with a follow-up updates the lead's follow-up | `test_discussion_updates_lead_followup_and_last_note` |
| A note **without** a follow-up never erases an existing one | `test_discussion_without_followup_keeps_existing_followup` |
| A follow-up can be cleared explicitly | `test_followup_can_be_cleared` |
| Status can move through every stage and back | `test_status_can_move_through_every_stage_and_back` |
| Duplicate names are allowed and fully independent | `test_duplicate_names_are_allowed_and_independent` |
| 60 notes in a row keep a stable newest-first order | `test_many_notes_keep_a_stable_newest_first_order` |
| Discussions never leak between leads | `test_discussions_are_isolated_per_lead` |
| The seed script can be run twice without duplicating data | `test_seed_is_idempotent_and_covers_every_status` |

## 6. Authentication and security

| Case | Expected | Test |
| --- | --- | --- |
| Every `/leads` route without a token | 401 with `WWW-Authenticate: Bearer` | `test_lead_routes_reject_anonymous_requests` |
| Garbage, expired, forged (wrong key) or deleted-user token | 401 | `test_garbage_token_is_rejected`, `test_expired_token_is_rejected`, `test_token_signed_with_another_key_is_rejected`, `test_token_for_deleted_user_is_rejected` |
| Malformed `Authorization` headers (`Basic`, empty, extra parts) | 401 | `test_malformed_authorization_headers_are_401` |
| Wrong password vs unknown email | Identical response, so accounts cannot be enumerated | `test_login_does_not_reveal_whether_the_email_exists` |
| Missing or null login fields, non-JSON body | 422 | `test_login_with_missing_fields_is_422` |
| 100,000-character and unicode passwords | 401, no crash | `test_login_survives_huge_and_unicode_passwords` |
| Password storage | Salted PBKDF2, never plain text | `test_password_hash_is_salted_and_verifiable` |
| CORS | Only the configured frontend origin is allowed | `test_cors_allows_the_frontend_origin_only` |

## 7. Frontend failure handling

| Case | Expected | Test |
| --- | --- | --- |
| API unreachable on load | Error message with a working **Retry** | `LeadFlowApp.test.tsx` "shows the error with a working Retry" |
| Network failure inside any call | "Cannot reach the server. Is the API running?" | `api.test.ts` |
| Validation errors from the server | Flattened to `field: message` | `api.test.ts` |
| Non-JSON error body (for example a proxy 502) | Generic message, no crash | `api.test.ts` |
| Session expires mid-use | Token cleared, login screen shown | `api.test.ts`, `AuthGate.test.tsx` |
| Failed login | Stays on the form with the server message | `LoginScreen.test.tsx` |
| No leads, or no matches for a filter | Distinct, friendly empty states | `LeadFlowApp.test.tsx` |
| Save fails | Typed text kept, error shown, button re-enabled | `LeadTimelineDialog.test.tsx`, `AddLeadDialog.test.tsx` |
| Double click on Save | One request only | `LeadTimelineDialog.test.tsx`, `AddLeadDialog.test.tsx` |
| Closing with unsaved input (X, Esc, backdrop) | Asks before discarding | `LeadTimelineDialog.test.tsx` |
| Whitespace-only name or note | Blocked before any request | `AddLeadDialog.test.tsx`, `LeadTimelineDialog.test.tsx` |
| Follow-up ticked without date or time | Blocked with a message | `LeadTimelineDialog.test.tsx` |
| Status change fails | Error shown, list not changed | `LeadTimelineDialog.test.tsx` |

## What is not automated

Being clear about limits is part of the job:

- **No browser end-to-end suite.** The full flow was exercised by hand in a real browser, and the UI is covered by component tests.
- **No load or concurrency testing.** SQLite is chosen for zero setup; the README names Postgres as the next step.
- **Phone width** was checked in a 390px viewport, not on a physical device.
- **No accessibility audit** beyond labels, focus handling and Esc support.

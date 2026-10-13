# Seafarer Application & Bio-Data implementation review

Reviewed on 13 October 2026 against commit `a031c9f` and the public deployment at `https://seasshipping.com`.

**Verdict: the main full-application workflow is implemented and passes the current integration suite, but it is not fully complete. Eight confirmed defects and several production acceptance checks remain.** Application code and server settings were not changed during this review.

**Confirmed defects, in recommended fix order**

All eight findings are P2: observable correctness or reliability defects that should be fixed in the normal development cycle. They are not claims that every normal submission fails.

| Finding | Source | Trigger and impact | Recommended correction |
| --- | --- | --- | --- |
| 1. Required medical explanations can be bypassed | `includes/application_validation.php:32–34`; `js/application-validation.js:26` | A valid synthetic request with a medical answer of `" Yes "` is normalized and stored as `Yes`, but conditional requirements compare the original answer. Blank explanations are accepted. All nine medical answers are affected; medical sign-off also accepts missing vessel and occurrence date. Exact `Yes` correctly rejects those blanks. | Normalize scalar values before evaluating any conditional requirement, and apply the same normalized comparisons in client validation. |
| 2. Accepted offshore certificate details can disappear from the Word file | `includes/application_docx.php:75` | Enter the combined offshore certificate's issuer and issue/expiry dates while leaving its number blank. Validation accepts and retains those values, but the generator emits the row only when `stcw_offshore_no` is populated. A synthetic generation reproduced the omission. | Either reject incomplete populated certificate records or emit the row whenever any of its fields is populated. |
| 3. Combined certificate cells lose number/date associations | `scripts/build-application-schema.js:31`; `includes/application_docx.php:68` | Main ECDIS/GMDSS/HV entries and their other-flag entries share cells. Values are joined independently, skipping blanks. In a validated synthetic ECDIS example, the document showed two certificate numbers and two issue dates, but only one unlabelled expiry belonging to the second certificate. The reader cannot reliably associate the expiry with its number. | Emit separate certificate rows or label each record's grouped values so optional blanks cannot shift their meaning. |
| 4. The success-page print button does not print the completed Bio-Data | `js/apply.js:876`, `js/apply.js:899–900` | Successful submission replaces the entire form card with an acknowledgement. “Print Form RPS 01-A (A4)” then calls `window.print()` on that acknowledgement, with the application fields gone. The completed DOCX download remains available. | Provide a print view containing saved application data, or clearly direct applicants to download and print the completed Word file. |
| 5. Reloading a family draft can lose a parent relationship | `apply.html:460–464`; `js/apply.js:343–351`, `js/apply.js:595–601` | Add a second family row, select Father or Mother, enter a name, delete the original row, save, and reload. The retained row is renumbered to row one, but the original first-row select has no Father/Mother option. Restoring that value clears the select. | Use the same relationship options for original and added rows and test deletion followed by draft restoration. |
| 6. Staff dashboard counts and status controls can misrepresent saved data | `js/admin.js:170`, `js/admin.js:184–213`, `js/admin.js:275–289` | Counts use only the current page of up to 50 items. With 51 applications, “Total Applications” shows 50 on page one and 1 on page two. A failed status update leaves the newly selected status visible despite the failure. Successful updates leave counts and filtered rows unchanged until refresh. | Use appropriate aggregate counts, reconcile the dropdown with the server result, and refresh affected statistics/filter results after a successful mutation. |
| 7. Client sea-service duration can contain negative days | `js/apply.js:670–679` | The actual client function computes `1M -2D` for 31 January 2025 to 1 March 2025 because borrowing February's days still leaves a negative value. PHP recalculates the saved duration as `0M 29D`, so the generated Word file is corrected, but the applicant's displayed value is wrong. | Use a consistent calendar-duration calculation and cover month-end/leap-year cases. |
| 8. The advertised phone search is not implemented | `admin.html:380`; `api.php:34` | The staff search field promises phone search, but the SQL predicate searches only reference, name, email and INDOS. A phone-only query cannot locate its applicant unless the digits also happen to appear in a searched column. | Include phone in the search predicate, with consistent handling of spaces/country codes if normalized searching is intended. |

Medical validation, offshore document omission and combined-certificate ambiguity were reproduced with fictional in-memory PHP payloads. Client duration and dashboard counts were reproduced by executing the actual functions. Print, family restoration, failed status controls and phone search were established from the complete relevant source paths; browser interaction was not available for this review.

An additional consistency issue needs a product decision: normal Step 5 navigation rejects a blank sea-service row because its owner/vessel/rank controls are required (`apply.html:1207–1227`), while shared validation and the backend allow an empty sea-service list. Direct navigation from an earlier valid step to Step 7 can therefore submit no history. Decide whether applicants without prior sea service may apply, then make both paths enforce that decision.

**Implemented and verified locally**

| Area | Evidence and status |
| --- | --- |
| Field coverage | Build checks cover 465 scalar fields and six repeat groups; form/schema coverage checks pass. |
| Validation | Required fields, formats, date ordering, declarations, upload checks and normal conditional cases are implemented. The medical normalization defect above remains. |
| Private persistence | Full applications are stored in private SQLite, with uploaded CVs and generated DOCX files outside the public document root. Reservation, completion and failure handling pass integration checks. |
| Duplicate retries | Same-key/same-payload submissions reuse an application; changed payloads are rejected; failed generation can be retried. Validation errors occur before reservation, so correcting them does not consume the key. |
| Staff access | Local tests cover login, HttpOnly sessions, session checks, CSRF, search/list, complete dossier data, review status, protected downloads and logout. UI defects above remain. |
| Applicant downloads | Local tests cover private capability downloads and one-hour expiry. |
| Bio-Data generation | Exact cell mapping, blank optional fields, repeat overflow, ten-vessel boundaries and declaration preservation pass. Non-document ZIP entries remain byte-identical to the source template. The offshore partial-record and combined-certificate defects above remain. |
| Recovery and notifications | Recovery is implemented and tested with synthetic abandoned reservations. The optional notification outbox/worker is implemented; actual mail delivery was not exercised. |

`npm test` passed **52 integration checks** on 13 October 2026 using an isolated localhost PHP server, synthetic credentials and temporary private storage. `npm run build` passed syntax checks for **17 PHP and 11 JavaScript files**, schema coverage and the pinned template check. The first sandboxed test attempt could not bind a localhost port; the isolated run with localhost permission then passed.

Fresh generated QA documents were rendered and every page visually inspected using the documents skill's renderer: sample **8 pages**, fully populated **10 pages**, and family/education overflow **9 pages**. Normal mapped data and overflow entries were visible; legal declarations and company receiving/signature areas were preserved. Some inherited fixed labels touch table rules, and continuation tables lack repeated headers. Native Microsoft Word rendering was not checked.

**Live deployment checks on 13 October 2026**

| Check | Result |
| --- | --- |
| Homepage, `/apply`, `/admin` | HTTP 200 |
| `/.env`, `/applications_roster.json`, `/NEW-APPLICATION-FORMAT-1.docx`, `/includes/application_bootstrap.php`, `/data/`, `/storage/`, `/uploads/`, `/test-output/`, `/scratch/`, `/test-mail.php` | All ten returned HTTP 403 to HEAD requests; private contents were not downloaded. |
| Unauthenticated `/api.php?route=admin/me` | HTTP 401, `Staff sign-in required.` |
| Public applicant/staff pages and assets | `apply.html`, `admin.html`, `js/apply.js`, `js/admin.js`, `js/application-validation.js`, `js/application-schema.json`, and `css/apply.css` matched local source after line-ending normalization. |

These checks establish public availability and the checked access controls. They do not establish full deployed PHP source equivalence, live document generation, effective upload limits, or authenticated staff operations today. Existing documentation records a successful live login/session/logout check on 7 October; that authenticated check was not repeated during this review.

**Remaining production acceptance work**

1. Verify effective PHP settings on the actual web handler: advertised 10 MB CV support needs `upload_max_filesize=10M`, `post_max_size=12M`, and the documented `max_input_vars=3000`. The last captured settings in `README.md:115–121` were 2M, 8M and 1000; this review did not read hosting settings.
2. After correcting the defects, complete a controlled hosted test submission, applicant download, staff roster/dossier/CV/DOCX review, status update, and access denial after logout. Live submissions and email sends were not performed in this review.
3. Verify scheduled recovery, optional notification delivery if enabled, and a consistent database-plus-files backup/restore procedure.
4. Complete desktop/mobile wizard, draft restoration, print-preview and native Word checks. The current integration suite focuses on the PHP/API/data flow and does not catch several browser defects listed above.
5. Resolve existing-record/intake expectations. Homepage Quick Apply still writes legacy `applications_roster.json` (`submit_application.php:556–580`), while the staff portal reads only private SQLite (`api.php:31–39`). Legacy and quick-intake applications are therefore absent from the new portal. This is a documented separate workflow, not a failure of full-form persistence; migration/unified intake is needed if staff must manage all applications in one roster.

The documented implementation produces DOCX. Server PDF generation, handwritten/electronic signature capture, multiple staff accounts/roles, government INDOS/CDC verification, malware scanning and automatic retention deletion are outside its current scope. Interview/company fields deliberately remain for staff completion in Word. Treat those as further requirements only if they are part of the intended product.

Full acceptance should follow correction of the confirmed defects and completion of the hosted workflow checks above. Passing the present test suite alone is insufficient to mark all functionality complete.

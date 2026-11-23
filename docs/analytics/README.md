# Analytics

What the website reports to Google Analytics 4, and how to switch it on.

## How it works

1. Each page loads Google Tag Manager (container `GTM-TL7MM2F3`) in its `<head>`, behind Consent Mode: no cookie is stored until the visitor accepts in the cookie banner (`assets/consent.js`).
2. `assets/analytics.js` pushes an event to the `dataLayer` for everything listed below.
3. Tag Manager forwards these events to GA4. This step is set up in Tag Manager, not in the code: import `gtm-container.json`.

## Switching it on (once)

1. In Google Analytics: Admin → Data streams → your web stream. Copy the Measurement ID (`G-…`). Leave Enhanced measurement on.
2. In Tag Manager: Admin → Import Container → choose `docs/analytics/gtm-container.json` → existing workspace → **Merge**, "Rename conflicting tags".
3. Variables → "GA4 Measurement ID" → replace `G-XXXXXXXXXX` with your ID.
4. If the container already had a Google tag for GA4, delete one of the two, or every page view is counted twice.
5. Preview, check the events arrive, then **Submit** to publish.
6. In Google Analytics: Admin → Events → mark `book_call_click` (and, if you like, `sample_report_click`) as a **key event**.
7. In Google Analytics: Admin → Custom definitions → create an event-scoped custom dimension for each parameter you want in reports (the "Parameters" column below). `seconds`, `percent`, `metric_value` are better as custom metrics. Without this step the events are counted, but their details are not shown in reports.
8. Admin → Data retention: 14 months. Keep Google Signals and ads personalisation off (the privacy policy says so).

## Events

| Event | When | Parameters | What it answers |
| --- | --- | --- | --- |
| `book_call_click` | A "Book a call" button is clicked (the visitor leaves for Calendly) | `cta_location`, `cta_text`, `plan` | Which button and which plan bring the calls. The main conversion. |
| `sample_report_click` | The sample report is opened or downloaded | `file_action`, `cta_location` | Do visitors look at the product before they book? |
| `section_view` | A section reaches the middle of the window (once per page view) | `section_id` | How far down the page visitors get, section by section. |
| `section_time` | The visitor leaves the page or hides the tab | `section_id`, `seconds` | Which sections hold attention. |
| `scroll_depth` | 25, 50, 75, 100% of the page | `percent` | Where visitors stop. (GA4's own `scroll` is 90% only.) |
| `story_step` | A point of "What we do" or a step of "How it works" is reached | `step_section`, `step_number`, `step_name` | Do visitors finish the scroll-told sections? |
| `star_track_open` | Star Track has taken over the page | | Did the visitor get past Products? |
| `faq_open` | A question is opened | `question`, `faq_group` | The objections visitors really have. |
| `nav_click` | A link inside the site (menu, footer, contents list, in-text) | `link_text`, `link_target`, `link_location` | What visitors look for. |
| `partner_click` | A link to another website (clients, listings) | `link_text`, `link_target`, `link_location` | Is the trust section used? |
| `email_click` | An email link is clicked | `link_location` | Contact by email instead of a call. |
| `scroll_cue_click` | The arrow under the hero is clicked | | |
| `text_copy` | Text is copied from the page | `copied_text` (first 100 characters), `section_id` | What visitors take with them (a price, the address). |
| `page_print` | The page is printed | | Mostly the terms. |
| `consent_choice` | Accept or Decline in the cookie banner | `method` (`granted` / `denied`) | The acceptance rate. |
| `cookie_settings_open` | "Cookie settings" in the footer | | |
| `web_vital` | Leaving the page: one event per metric | `metric_name` (LCP, CLS, INP, FCP, TTFB), `metric_value`, `metric_rating` | How fast the page was for real visitors. |
| `js_error` | A script error (at most 5 per page view) | `error_message`, `error_source` | Is the page broken for someone? |

GA4 adds by itself (Enhanced measurement): page views, sessions, first visits, engagement time, traffic source and campaign (UTM), country, device, browser, language, outbound clicks, file downloads.

## What cannot be tracked from here

- **Completed bookings.** They happen on Calendly's pages. To count them, connect Google Analytics inside Calendly (Integrations → Google Analytics), or send visitors to a thank-you page on this site after booking.
- **Who the visitor is.** No names, emails or other personal details are sent, and they must not be added (the privacy policy forbids it, and so do Google's terms).
- Visitors who decline cookies are still counted, without a cookie, so their visits cannot be joined into one person.

## Changing it

- A new event: add a `track('name', {...})` call in `assets/analytics.js`, add the name to the trigger's list in Tag Manager, and to the table above.
- A new parameter: add it to `PARAMS` in `assets/analytics.js`, and in Tag Manager add a Data Layer Variable and a row in the "GA4 - Website events" tag.

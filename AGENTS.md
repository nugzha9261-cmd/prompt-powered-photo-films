<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Photo-to-video runs through server functions in `src/lib/video.functions.ts` (create job + poll) calling the AI gateway `/v1/videos`; the browser polls every few seconds. Why: generation takes minutes and must not block one request.
- Video rows (`public.videos`) and files (private `videos` bucket, `<user_id>/...`) are written only server-side with the admin client inside auth'd server fns; users get SELECT/DELETE via RLS. Why: users must not forge job ids or statuses.
- `syncVideo` polls the job and, on completion, copies the MP4 into storage; both the studio and the library call it for `generating` rows. Why: gateway download links expire, and videos must save even if the user leaves the page.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate); session state comes from the single `AuthProvider` in `src/hooks/use-auth.tsx`. Why: one auth listener, no SSR session.
- Shared validation and request-building rules (photo modes, per-mode photo counts, prompt tags) live in `src/lib/video-request.ts` (client-safe, covered by tests). Storyboards send images as [first, last, ...middle]. Why: one source of truth for form and server; the model binds frame tags by part order.
- Video editing validation and section planning live in `src/lib/video-edit.ts`; browser-only FFmpeg processing in `src/lib/video-processing.ts` splits long uploads into model-supported edits and joins completed files, saved through an authenticated server function verifying ownership of ready sections. Why: the provider limits each edit, and Workers cannot run native FFmpeg.
- The AI Director prompt chat streams from the server route `src/routes/api/director.ts` (`src/lib/director.server.ts`, bearer-token checked) via the AI SDK Responses API; chats are threads stored only in browser localStorage (`src/lib/director-threads.ts`), one page per thread at `/director/$threadId`. Why: the user chose device-only multi-chat history, and model calls/keys must stay server-side.
- The assistant hands prompts over in a fenced ```prompt studio|edit block parsed by `splitPromptBlock` in `src/lib/director.ts` (tested); Studio/Edit accept it via a `?prompt=` search param. Why: one parse rule shared by the chat card and tests.
- iOS/Android apps are a Capacitor shell (`capacitor.config.ts`) that loads the published URL; `mobile-shell/` is only the offline fallback and `assets/` holds icon/splash sources. Why: the app is SSR (no static build to bundle), and web publishes reach phones without store releases. Steps live in `MOBILE.md`.
- Credits: balances live in `public.user_credits` (read-only to users); `startVideo`/`startEdit` spend atomically via service-role-only `spend_credits` before calling the gateway and refund via `add_credits` on gateway errors; shared costs/packs in `src/lib/credits.ts` (tested). Why: users must not grant themselves credits, and failed starts shouldn't cost.
- Finishing (music, voiceover, social shapes, free-plan watermark) runs in the browser via `createVideoProcessor().finish`; voiceover audio comes from the `generateVoiceover` server fn (AI Gateway SDK, speech surface), mini-movies join ready films in-browser and save via `saveMovie` (ownership verified). Rules live in `src/lib/finishing.ts` (tested). Why: Workers cannot run FFmpeg and model keys stay server-side.
- Self-account deletion uses an authenticated server function and tested cleanup adapter, scoped only to context.userId; remove private storage through its API before rows and auth identity. Why: prevent cross-account deletion and permit retries when cleanup fails.
- Public legal/support pages and footer remain accessible without sign-in; support contact is configured only from the owner's confirmed address. Why: store reviewers and users need accessible policies without invented contacts.
- Website brand images use a CDN asset pointer; favicon/touch icons and the native icon source are derived local files. Why: keep web media lightweight while native tooling and browsers need real icon files.

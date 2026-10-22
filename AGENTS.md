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

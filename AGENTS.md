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
- Finished MP4s are streamed to the browser via the `/api/video/$id` server route and kept only as a local blob (no storage/backend). Why: no Cloud is enabled; gateway download links are short-lived.
- Shared validation and request-building rules live in `src/lib/video-request.ts` (client-safe, covered by tests). Why: one source of truth for form and server.

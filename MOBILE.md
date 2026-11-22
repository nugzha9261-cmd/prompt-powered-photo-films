# CineFlow AI for iOS and Android

The phone apps are a native shell (Capacitor) around the published website
(`https://cineflow.adsai.studio`). Any change you publish on the
web shows up in the apps immediately — you only resubmit to the stores when the
icon, name or native settings change.

## One-time setup on your computer

You need: Node.js (or Bun), Git, **Android Studio** (for Android) and, for iOS,
a **Mac with Xcode**.

1. In Lovable, connect the project to GitHub, then clone it:
   `git clone <your-repo-url> && cd <repo>`
2. Install packages: `npm install`
3. Register `com.nexonelabs.cineflow` in App Store Connect and Google Play. This
   bundle identifier is already configured; keep it stable after submission.
4. Add the native projects:
   - `npx cap add android`
   - `npx cap add ios` (Mac only)
5. Generate icons and splash screens from `assets/`: `npm run cap:icons`
6. Copy settings into the native projects: `npx cap sync`

## Build and test

- Android: `npx cap open android` → Run on a phone/emulator → for the store use
  **Build → Generate Signed App Bundle** (.aab) and upload it in Google Play Console.
- iOS: `npx cap open ios` → choose your Team under *Signing & Capabilities* →
  Run on a phone → **Product → Archive** → *Distribute App* to App Store Connect.

After pulling new changes from GitHub, run `npm install && npx cap sync` again.

## Good to know

- Sign-in inside the apps is email + password (Google blocks its sign-in page
  inside apps). Google sign-in still works on the website.
- If you sell credits or subscriptions inside the apps, Apple and Google require
  their own in-app purchase systems for digital goods.
- Store reviewers need a working test account: create one and put the email and
  password in the review notes.
- Both stores need a privacy policy link and a support contact.

## Before submitting to Apple

- Publish the latest web changes, then run `npx cap sync` so the shell loads
  `https://cineflow.adsai.studio`.
- Privacy URL: `https://cineflow.adsai.studio/privacy`
- Support URL: `https://cineflow.adsai.studio/support`
- Terms URL: `https://cineflow.adsai.studio/terms` (Apple Standard EULA is linked).
- Supply your confirmed public support email before submission and have the
  legal text reviewed for your business and audience; it is not legal advice.
- Account deletion is available in Account. Test it with a disposable account,
  including saved films. Do not use the reviewer or owner account for this test.
- Subscription offers are hidden until native purchasing is connected. Do not
  advertise paid plans in store screenshots or metadata yet.
- Complete App Privacy disclosures using the privacy page as an inventory.
  Disclose account email, user ID, uploaded user content and applicable usage/
  diagnostic data; check provider retention and Apple's definitions yourself.
- Review the generated native project's privacy manifests and required-reason
  APIs in Xcode, plus any permissions added by plugins. Native projects have not
  been built or audited in Lovable.
- Test on a real iPhone: signup, confirmation email, password recovery, photo and
  video upload, generation, saved library, voiceover, export/share, deletion and
  offline retry. Browser checks do not replace device checks.
- Password recovery screens exist, but hosted email delivery, redirect allowlists
  and an actual emailed recovery-link journey must still be verified before submission.
- Add final app icon, screenshots, age rating, copyright, review contact and a
  working reviewer account with enough credits in App Store Connect. Never store
  reviewer passwords in this repository.
- A remote-web Capacitor shell may face Apple's minimum-functionality review
  (Guideline 4.2). These web updates do not guarantee approval; validate native
  usability and substantive app functionality before submitting.

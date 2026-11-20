# CineFlow AI for iOS and Android

The phone apps are a native shell (Capacitor) around the published website
(`https://prompt-powered-photo-films.lovable.app`). Any change you publish on the
web shows up in the apps immediately — you only resubmit to the stores when the
icon, name or native settings change.

## One-time setup on your computer

You need: Node.js (or Bun), Git, **Android Studio** (for Android) and, for iOS,
a **Mac with Xcode**.

1. In Lovable, connect the project to GitHub, then clone it:
   `git clone <your-repo-url> && cd <repo>`
2. Install packages: `npm install`
3. Before the first store upload, open `capacitor.config.ts` and change `appId`
   to your own id, e.g. `com.nexonelabs.cineflow`. It can't be changed later.
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

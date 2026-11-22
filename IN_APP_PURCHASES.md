# CineFlow AI: in-app purchase setup

Purchases are not connected yet. RevenueCat coordinates Apple's and Google's billing; those stores collect payment and pay you through your developer payment agreements. Start with iOS, then add Android to the same RevenueCat project.

## 1. Prepare Apple payments

1. Open App Store Connect and complete the Paid Apps agreement, banking and tax details under Business (Agreements, Tax and Banking on older screens).
2. Create/select CineFlow AI with bundle ID `com.nexonelabs.cineflow`.
3. Under Monetization → Subscriptions, create one subscription group named CineFlow Premium. Using one group prevents overlapping Apple subscriptions.
4. Add these auto-renewable subscriptions. Product IDs must match exactly in the store and RevenueCat:

| Product ID | Duration | Target USD price | Credits per paid period |
| --- | --- | --- | --- |
| cineflow_weekly | 1 week | $4.99 | 12 |
| cineflow_monthly | 1 month | $14.99 | 50 |
| cineflow_quarterly | 3 months | $34.99 | 180 |

5. Set regional availability, localized names/descriptions, prices, and subscription review screenshots. Local prices/taxes may vary. The quarterly allowance is 180 per three-month payment, not per month.

## 2. Connect RevenueCat to Apple

1. Create a RevenueCat account and a project named CineFlow AI.
2. Add an Apple App Store app with the same bundle ID.
3. In App Store Connect → Users and Access → Integrations → In-App Purchase, generate an In-App Purchase key. Download its `.p8` file once and keep it private.
4. Upload it directly to RevenueCat's Apple app configuration and enter its Key ID and Issuer ID. Never put this private key in app code, chat, or GitHub.
5. Supply any additional App Store Connect integration fields RevenueCat requests for product import.

Official guide: https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/in-app-purchase-key-configuration

## 3. Configure the catalog

1. Import all three Apple products into RevenueCat's product catalog.
2. Create an entitlement named `premium` and associate all three subscriptions.
3. Create an offering named `default`, with weekly, monthly and three-month packages.
4. Copy the Apple **public SDK key** from RevenueCat's API keys page. This public key may be shared for app integration; do not share a secret API key.

## 4. Connect purchases to the app (implementation still needed)

The app developer must:

- Install RevenueCat's Capacitor SDK and sync the native projects. Do not separately install the iOS RevenueCat SDK.
- Configure the platform-specific public SDK key once and link purchases to the signed-in CineFlow account's stable user ID, not its email. Handle account switches deliberately.
- Load localized price and duration from store products rather than hardcoding checkout prices.
- Provide purchase, Restore Purchases and Manage Subscription controls, plus cancellation/error states.
- Include renewal terms, privacy policy and terms before purchase.
- Create an authenticated RevenueCat webhook endpoint; verify its shared authorization secret, deduplicate events, verify products/account identity, and grant credits server-side only for verified initial payments and renewals. A restore must not award credits again. Out-of-order/retried events must be safe.
- Read entitlement status from a verified source for premium features; never trust the browser to grant credits or premium access.

Before implementation, decide whether unused subscription credits roll over or expire, and how refunds/revocations and plan changes affect balances. Existing free/test credits must remain distinguishable if paid credits expire. Credits pay for generation requests/edited sections; a long split edit spends multiple credits, so do not advertise an unconditional number of finished films.

SDK guide: https://www.revenuecat.com/docs/getting-started/installation/capacitor

## 5. Test on iPhone

1. Enable the In-App Purchase capability in Xcode; build and upload to TestFlight.
2. Configure Apple's sandbox testers as needed. TestFlight purchases use Apple's test environment, not real charges.
3. Test each plan, accelerated renewal, cancellation, restore, reinstall, account switching, duplicate webhook events, failed payments, refunds and credit spending.
4. Confirm paid credits appear in the signed-in account, not just in a success message.
5. Submit the first subscriptions with the app version and provide review screenshots and a working reviewer account.

## 6. Add Android

1. Complete Google Play's payments profile; create the app with package `com.nexonelabs.cineflow` and upload a build to internal testing.
2. Under Monetize with Play → Products → Subscriptions, create equivalent subscriptions with active auto-renewing base plans (1 week, 1 month, 3 months), prices and regions.
3. Add a Google Play app in the same RevenueCat project. Follow its service-account setup guide, granting only the documented access to the relevant app; upload the private JSON credential directly to RevenueCat, never to chat or app code.
4. Import the Google products and attach them to the same `premium` entitlement and offering packages as Apple.
5. Supply the Google public SDK key for Android. Store-specific product identifiers/base plans must match RevenueCat's configuration.
6. Add license testers and run internal-track purchase, renewal, restore and account-switch tests before production.

Google guide: https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials

## Ready to hand over

Provide the Apple public SDK key, Google public SDK key when Android is ready, exact product identifiers and confirmation that the offering is configured. The developer will request webhook authorization through a secure form after the endpoint exists. No Apple private key, Google credential JSON, or RevenueCat secret API key should be pasted into chat.
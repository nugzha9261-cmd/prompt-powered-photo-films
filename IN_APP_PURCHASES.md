# CineFlow AI: in-app purchase setup

Apple purchase integration is implemented with RevenueCat's Capacitor SDK. Checkout stays unavailable until the webhook authorization is saved. RevenueCat coordinates billing; Apple collects payment and pays you through your developer payment agreement. Real StoreKit purchases still need testing on your Mac/iPhone. Android checkout is not enabled yet.

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

## 4. Activate the Apple integration

Already implemented:

- The supplied Apple public SDK key is configured. Purchases use the signed-in CineFlow account UUID, never email or an anonymous purchaser.
- The `default` offering supplies all three Apple packages and their localized prices/periods. Entitlement identifier must be exactly `premium`.
- Your credits in the iPhone app provides Subscribe, Restore Purchases and Manage Subscription, plus renewal terms and legal links.
- Authorized webhook events grant credits atomically, deduplicating both event IDs and store transaction IDs. Restoring never grants credits again.
- Server-verified subscription status determines watermark-free exports. The browser cannot grant credits or paid access.

Owner-confirmed policy: unused paid credits carry over on renewal. Refunded customers keep their credits, but premium access ends. Plan changes do not award credits by themselves; the allowance is granted for the new product's actual paid transaction. Keep all Apple plans in one subscription group. Do not enable free trials or Family Sharing unless their credit policies are separately reviewed; trial/shared events do not award paid credits.

### Set up automatic credit delivery

1. Publish the latest version so the endpoint below exists.
2. In RevenueCat → Integrations → Webhooks → Add new configuration, name it `CineFlow Apple credits`.
3. Use URL: `https://cineflow.adsai.studio/api/public/revenuecat`.
4. In the app owner's secure form for `REVENUECAT_WEBHOOK_AUTH`, use Generate, copy the generated value into RevenueCat's **Authorization header** field exactly, and save it in both places. Do not add `Bearer` unless it is also part of the saved value. Never put this value in chat or code.
5. Limit the configuration to **CineFlow AI (App Store)** and send all subscription lifecycle events. Production events are accepted by default. Sandbox events are ignored unless the server setting below is enabled.
6. Set RevenueCat's restore/transfer behavior to **Keep with original App User ID**. Purchases remain attached to the original CineFlow account; sign in to that account to restore. Automatic transfers between accounts are deliberately not supported.
7. Save and send RevenueCat's test webhook. Confirm a 200 response. A test event does not award credits.
8. Publish after saving the authorization so the published app receives the setting. Verify the test again against the published endpoint before allowing purchases.

RevenueCat webhook access requires its current Pro plan; review its current pricing. Newer RevenueCat accounts generally use that pricing model, but confirm your account has Webhooks access.

### Sandbox / TestFlight

Sandbox processing is off by default to protect live balances. For controlled testing, enable the server configuration `REVENUECAT_ALLOW_SANDBOX` with the fixed value `true`, publish, and send sandbox events to the same endpoint. Use dedicated test accounts: sandbox awards will affect their real CineFlow credit balance. Disable this setting before public launch, publish again, and set the RevenueCat webhook to Production. Do not use an owner/customer account for accelerated sandbox renewals.

Credit confirmation may take time after Apple completes payment. The app waits for a verified payment receipt and refreshes the actual account balance; if delayed, do not purchase again. Reopening the app reads the saved balance/subscription status even if the original purchase screen was closed.

SDK guide: https://www.revenuecat.com/docs/getting-started/installation/capacitor

## 5. Test on iPhone

1. Update your Mac's project from GitHub, run `npm install`, `npx cap sync ios`, then `npx cap open ios`. The new native purchase plugin requires a new app build, not only a web publish. Do not add the RevenueCat iOS SDK separately.
2. In Xcode choose the app target → Signing & Capabilities → + Capability → In-App Purchase. Check Swift version is at least 5.0. Run and upload to TestFlight.
3. Configure Apple's sandbox testers as needed and enable the controlled sandbox handling above. TestFlight purchases use Apple's test environment, not real charges. Local Xcode StoreKit configuration files do not necessarily send real RevenueCat webhooks; use sandbox/TestFlight for delivery verification.
4. Test each plan, accelerated renewal, cancellation, restore, reinstall, account switching, duplicate webhook events, failed payments, refunds and credit spending. Confirm the wrong CineFlow account cannot take another account's Apple subscription.
5. Confirm exactly 12/50/180 paid-period credits appear in the signed-in account, not just in a success message. Restore must not increase the balance. Refund must retain credits and remove premium access.
6. Submit the first subscriptions with the app version and provide review screenshots and a working reviewer account. Deleting a CineFlow account does not cancel its Apple subscription.

## 6. Add Android

1. Complete Google Play's payments profile; create the app with package `com.nexonelabs.cineflow` and upload a build to internal testing.
2. Under Monetize with Play → Products → Subscriptions, create equivalent subscriptions with active auto-renewing base plans (1 week, 1 month, 3 months), prices and regions.
3. Add a Google Play app in the same RevenueCat project. Follow its service-account setup guide, granting only the documented access to the relevant app; upload the private JSON credential directly to RevenueCat, never to chat or app code.
4. Import the Google products and attach them to the same `premium` entitlement and offering packages as Apple.
5. Supply the Google public SDK key for Android. Store-specific product identifiers/base plans must match RevenueCat's configuration.
6. Add license testers and run internal-track purchase, renewal, restore and account-switch tests before production.

Google guide: https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials

## Ready to hand over

Apple public SDK key is already supplied and implemented. Finish webhook authorization and the native test checklist above. Android still needs its public SDK key and store product/base-plan mapping before checkout can be enabled. No Apple private key, Google credential JSON, or RevenueCat secret API key should be pasted into chat.
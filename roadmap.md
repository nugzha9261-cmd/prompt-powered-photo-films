# Longer video edits
- [x] Accept and validate clips up to 30 seconds.
- [x] Split into supported clips, edit sequentially, join and save to account.
- [x] Verify limits, media processing, and authenticated editing flow (real 12-second edit saved and read back in My films; 30-second section planning tested).
- [x] User credit system (2 free on signup, block at 0, paywall window)
- [x] Apple RevenueCat purchase implementation: native plans, restore/manage, verified credit delivery and premium access.
- [x] Paid credits carry over on renewal and remain after refunds; refunds end premium access.
- [x] Verify webhook authorization/deduplication, database grants, account ownership and saved test-payment readback through signed-in UI; 50 focused tests passed.
- [ ] Publish Apple purchase changes — owner approved publication.
- [ ] Apple payment activation — blocked: secure webhook authorization and RevenueCat offering/entitlement/restore configuration.
- [ ] Native StoreKit purchase/renewal/restore verification — blocked: owner's updated iPhone build, controlled sandbox configuration and Apple sandbox/TestFlight testing.
- [ ] Android purchases — blocked: Google Play public SDK key and store catalog configuration.

# Phase 1 growth
- [x] Style templates in Studio
- [x] Background music on finished videos
- [x] Daily free video credit
- [x] Phase 2: AI voiceover
- [x] Phase 3: mini-movies, social export, watermark

# iPhone submission preparation
- [x] Apply the supplied icon to the website, favicon and native icon source.
- [x] Audit visible platform branding; badge already hidden, no public social sign-in buttons; preserve truthful privacy disclosures.
- [ ] Branded password-reset emails — blocked: owner must verify a sender domain in email setup.
- [x] Provide step-by-step RevenueCat subscription setup instructions in IN_APP_PURCHASES.md.
- [x] Public privacy, terms and support pages.
- [x] Public support email — studio@nexonelabs.com confirmed by the owner.
- [x] In-app account deletion with private files and account data removed.
- [x] Hide unfinished purchases; point mobile shell to the custom domain.
- [x] Verify deletion and public pages; document remaining store submission steps.
- [ ] Final iPhone submission — deferred until conversion: real-device checks, final icon, legal review, store disclosures and reviewer account.

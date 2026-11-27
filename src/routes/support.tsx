import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, KeyRound, UserRound } from "lucide-react";
import { LegalPage } from "@/components/legal-page";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, legalHead } from "@/lib/legal";

export const Route = createFileRoute("/support")({
  head: () => legalHead("Support", "Get help with CineFlow AI sign-in, password recovery, films, credits and account deletion."),
  component: SupportPage,
});
function SupportPage() {
  return <LegalPage title="Support">
    <section><h2>Contact NexoneLabs</h2>{SUPPORT_EMAIL
      ? <><p>For account help, privacy requests or problems with your films, email us. Include the problem and approximate time, but never send your password.</p><Button asChild variant="outline" className="mt-3"><a href={`mailto:${SUPPORT_EMAIL}`}><Mail />{SUPPORT_EMAIL}</a></Button></>
      : <p>A public support email will be added before the app is submitted to the stores.</p>}</section>
    <section><h2>Sign-in and password recovery</h2><p>Choose Forgot password? on the sign-in page, enter your account email and open the link in your inbox. Check your spam folder too. Open the recovery link on the same device where you want to set the new password.</p><Button asChild variant="outline" className="mt-3"><Link to="/auth"><KeyRound />Go to sign in</Link></Button></section>
    <section><h2>Films and credits</h2><p>Your completed films appear in My films. Generation may take several minutes. If a film is still processing, return to Studio or My films to check its status. Keep a separate download of important films. Your credit balance is available from the credit counter.</p><p>For Apple subscriptions, open Your credits in the iPhone app to Restore Purchases or Manage Subscription. Restore while signed into the CineFlow account that made the purchase and the same Apple account. Restoring does not add credits again. If a payment completed but credits have not appeared, do not purchase again; contact us with the approximate purchase time and your CineFlow account email. Refunds can be requested through <a href="https://reportaproblem.apple.com/" target="_blank" rel="noreferrer">Apple's purchase support</a>.</p></section>
    <section><h2>Delete your account</h2><p>Sign in, open Account, choose Delete account and confirm. This permanently removes saved films, preview images, film records, credits and your sign-in account. Locally saved AI Director chats on this device are cleared too. Remove chat copies and downloaded films from other devices yourself.</p><Button asChild variant="outline" className="mt-3"><Link to="/account"><UserRound />Open Account</Link></Button></section>
  </LegalPage>;
}
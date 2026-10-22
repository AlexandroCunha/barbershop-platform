import { useTenant } from "../tenant-context";

/** The entry point for the shop's team and owner: each one goes to their own sign-in. */
export function AccessPage() {
  const { slug, business } = useTenant();

  return (
    <main className="container access-page">
      <p className="eyebrow">{business.name}</p>
      <h1>Access</h1>
      <p className="lede">Choose how you want to sign in.</p>

      <div className="access-choices">
        <a className="access-choice" href={`/${slug}/admin`}>
          <span className="access-choice-title">Owner</span>
          <span className="muted">Customise the site, the team, prices and the shop's address.</span>
        </a>
        <a className="access-choice" href={`/${slug}/barber`}>
          <span className="access-choice-title">Barber</span>
          <span className="muted">See your upcoming bookings and organise your own availability.</span>
        </a>
      </div>

      <p className="muted">
        <a className="link-arrow" href={`/${slug}`}>
          Back to the site
        </a>
      </p>
    </main>
  );
}

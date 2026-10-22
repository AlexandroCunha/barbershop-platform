/** Shown while no barbershop has been created, so there is nothing to book yet. */
export function NoHomeShop({ message }: { message?: string | null }) {
  return (
    <main className="container static-page">
      <p className="eyebrow">Barbershop Platform</p>
      <h1>No barbershop is published yet</h1>
      <p className="lede">{message ?? "Online booking will open here soon."}</p>
    </main>
  );
}

export function NotFound({ message }: { message: string }) {
  return (
    <main className="container static-page">
      <p className="eyebrow">Not found</p>
      <h1>{message}</h1>
      <p className="lede">
        <a className="link-arrow" href="/">
          Back to the start
        </a>
      </p>
    </main>
  );
}

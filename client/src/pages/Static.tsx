export function Landing() {
  return (
    <main className="container static-page">
      <p className="eyebrow">Barbearia</p>
      <h1>Online booking for barbershops</h1>
      <p className="lede">Each barbershop gets its own address, a booking calendar and an owner area to keep it up to date.</p>
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

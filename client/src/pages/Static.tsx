import { useState, type FormEvent } from "react";

export function Landing() {
  const [address, setAddress] = useState("");

  function openShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = address.trim().toLowerCase();
    if (slug) {
      window.location.assign(`/${encodeURIComponent(slug)}`);
    }
  }

  return (
    <main className="container static-page">
      <p className="eyebrow">Barbershop Platform</p>
      <h1>Online booking for barbershops</h1>
      <p className="lede">Each barbershop gets its own address, a booking calendar and an owner area to keep it up to date.</p>

      <form className="landing-open" onSubmit={openShop}>
        <label htmlFor="shop-address">Open a barbershop by its address</label>
        <div className="landing-open-row">
          <input
            id="shop-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="northgate"
            autoComplete="off"
          />
          <button type="submit">Open</button>
        </div>
      </form>

      <p className="lede">
        <a className="link-arrow" href="/platform">
          Platform owner sign-in
        </a>
      </p>
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

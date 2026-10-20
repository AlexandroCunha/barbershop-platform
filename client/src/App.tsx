import { useEffect, useState } from "react";
import { AdminPage } from "./admin/AdminPage";
import { Barbers } from "./components/Barbers";
import { BookingBar } from "./components/BookingBar";
import { BookingSection } from "./components/BookingSection";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Services } from "./components/Services";
import { Ticker } from "./components/Ticker";
import { Visit } from "./components/Visit";
import { BusinessContext, useBusinessProfile, useProfessionals, useServices } from "./hooks";

export default function App() {
  // The owner area is a separate screen of the same app, reached at /admin.
  if (window.location.pathname === "/admin") {
    return <AdminPage />;
  }
  return <SitePage />;
}

function SitePage() {
  const business = useBusinessProfile();
  const services = useServices();
  const professionals = useProfessionals();

  // Choices made in the Services and Barbers sections carry into the booking flow.
  const [serviceId, setServiceId] = useState<number | undefined>();
  const [professionalId, setProfessionalId] = useState<number | undefined>();

  // Sections fade in as they reach the viewport. Reduced-motion users see them at once.
  useEffect(() => {
    if (!business.data) return;

    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [business.data]);

  useEffect(() => {
    if (business.data) {
      document.title = business.data.tagline ? `${business.data.name} — ${business.data.tagline}` : business.data.name;
    }
  }, [business.data]);

  if (business.loading) {
    return <p className="status page-status">Loading…</p>;
  }
  if (!business.data) {
    return (
      <p className="status status-error page-status" role="alert">
        {business.error}
      </p>
    );
  }

  return (
    <BusinessContext.Provider value={business.data}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Header />

      <main id="main">
        <Hero />

        <Ticker items={services.data?.map((service) => service.name) ?? []} />

        <section id="barbers" className="block block-tinted" data-reveal aria-labelledby="barbers-title">
          <div className="container showcase">
            <Barbers
              selectedId={professionalId}
              professionals={professionals.data}
              loading={professionals.loading}
              error={professionals.error}
              onChoose={setProfessionalId}
            />

            <Services
              selectedId={serviceId}
              services={services.data}
              loading={services.loading}
              error={services.error}
              onChoose={setServiceId}
            />
          </div>
        </section>

        <BookingSection
          services={services.data}
          professionals={professionals.data}
          loadError={services.error ?? professionals.error}
          serviceId={serviceId}
          professionalId={professionalId}
          onServiceChange={setServiceId}
        />

        <Visit />
      </main>

      <Footer />
      <BookingBar />
    </BusinessContext.Provider>
  );
}

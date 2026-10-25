import { useEffect, useState } from "react";
import { Barbers } from "../components/Barbers";
import { BookingBar } from "../components/BookingBar";
import { BookingSection } from "../components/BookingSection";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { Ticker } from "../components/Ticker";
import { Visit } from "../components/Visit";
import { STEP_BARBER, STEP_SERVICE } from "../components/booking/steps";
import { useAsync } from "../hooks";
import { useTenant } from "../tenant-context";

/** The public website of one barbershop. */
export function SitePage() {
  const { api } = useTenant();
  const services = useAsync(() => api.services(), [api]);
  const professionals = useAsync(() => api.professionals(), [api]);

  // The booking flow's choices and its current step live here, so a barber tapped above starts the flow.
  const [step, setStep] = useState(STEP_BARBER);
  const [serviceId, setServiceId] = useState<number | undefined>();
  const [professionalId, setProfessionalId] = useState<number | undefined>();

  function bookWith(id: number) {
    setProfessionalId(id);
    setStep(STEP_SERVICE);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Sections fade in as they reach the viewport. Reduced-motion users see them at once.
  useEffect(() => {
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
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Header />

      <main id="main">
        <Hero />

        <Ticker items={services.data?.map((service) => service.name) ?? []} />

        <section id="barbers" className="block block-tinted" data-reveal aria-labelledby="barbers-title">
          <div className="container">
            <Barbers
              selectedId={professionalId}
              professionals={professionals.data}
              loading={professionals.loading}
              error={professionals.error}
              onChoose={bookWith}
            />
          </div>
        </section>

        <BookingSection
          services={services.data}
          professionals={professionals.data}
          loadError={services.error ?? professionals.error}
          step={step}
          serviceId={serviceId}
          professionalId={professionalId}
          onStepChange={setStep}
          onServiceChange={setServiceId}
          onProfessionalChange={setProfessionalId}
        />

        <Visit />
      </main>

      <Footer />
      <BookingBar />
    </>
  );
}

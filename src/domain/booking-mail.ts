import { renderEmail } from "./email-template.js";

/** What a customer's booking e-mail says. Every field is shown as plain text in both versions. */
export interface BookingMailDetails {
  shopName: string;
  /** The shop's own address, as one line. Empty when the owner has not set one. */
  shopAddress: string;
  shopPhone: string;
  /** Where the shop is on a map. Empty when the owner has not set one. */
  mapsUrl: string;
  serviceName: string;
  barberName: string;
  /** ISO date, YYYY-MM-DD, in the shop's own calendar. */
  date: string;
  startTime: string;
  endTime: string;
  durationText: string;
  priceText: string;
  customerName: string;
  /** The link where the customer can see, cancel or move the booking. */
  manageUrl: string;
  /** The shop's own address on the web, for customers who want to book again. */
  shopUrl: string;
}

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

export function confirmationMail(d: BookingMailDetails): MailContent {
  const subject = `Booking confirmed at ${d.shopName}`;
  const when = whenOf(d);
  return {
    subject,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `Your appointment at ${d.shopName} is confirmed. Here are the details:`,
      "",
      `Service: ${d.serviceName}`,
      `Barber: ${d.barberName}`,
      `When: ${when}`,
      `Duration: ${d.durationText}`,
      `Total: ${d.priceText}`,
      ...(d.shopAddress ? [`Where: ${d.shopAddress}`] : []),
      ...(d.shopPhone ? [`Phone: ${d.shopPhone}`] : []),
      "",
      `To see, change or cancel this booking, use this link: ${d.manageUrl}`,
      "",
      `We look forward to seeing you.`,
      `${d.shopName}`,
    ].join("\n"),
    html: renderEmail({
      shopName: d.shopName,
      preheader: `Your appointment on ${when} is confirmed.`,
      heading: `See you soon, ${firstName(d)}.`,
      paragraphs: [`Your appointment at ${d.shopName} is confirmed. Here are the details.`],
      details: [
        { label: "Service", value: d.serviceName },
        { label: "Barber", value: d.barberName },
        { label: "When", value: when },
        { label: "Duration", value: d.durationText },
        { label: "Total", value: d.priceText },
        ...(d.shopAddress ? [{ label: "Where", value: d.shopAddress }] : []),
      ],
      button: { label: "See, change or cancel my booking", url: d.manageUrl },
      footer: [
        ...(d.mapsUrl ? [`Directions: ${d.mapsUrl}`] : []),
        ...(d.shopPhone ? [`Phone: ${d.shopPhone}`] : []),
        `Booked a different time? Visit ${d.shopUrl}`,
      ],
    }),
  };
}

export function reminderMail(d: BookingMailDetails): MailContent {
  const subject = `Reminder: your appointment at ${d.shopName}`;
  const when = whenOf(d);
  return {
    subject,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `A reminder of your appointment tomorrow at ${d.shopName}:`,
      "",
      `Service: ${d.serviceName}`,
      `Barber: ${d.barberName}`,
      `When: ${when}`,
      ...(d.shopAddress ? [`Where: ${d.shopAddress}`] : []),
      "",
      `Need to change it? Use this link: ${d.manageUrl}`,
    ].join("\n"),
    html: renderEmail({
      shopName: d.shopName,
      preheader: `Reminder: ${d.serviceName} on ${when}.`,
      heading: "Your appointment is tomorrow.",
      paragraphs: [`Hello ${firstName(d)}, here is a reminder of your appointment at ${d.shopName}.`],
      details: [
        { label: "Service", value: d.serviceName },
        { label: "Barber", value: d.barberName },
        { label: "When", value: when },
        ...(d.shopAddress ? [{ label: "Where", value: d.shopAddress }] : []),
      ],
      button: { label: "Change or cancel", url: d.manageUrl },
      footer: [...(d.shopPhone ? [`Phone: ${d.shopPhone}`] : [])],
    }),
  };
}

export function cancellationMail(d: BookingMailDetails): MailContent {
  const subject = `Your appointment at ${d.shopName} was cancelled`;
  const when = whenOf(d);
  return {
    subject,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `Your appointment was cancelled: ${d.serviceName} with ${d.barberName}, ${when}.`,
      "",
      `We are sorry for the change. To book another time, visit ${d.shopUrl}`,
    ].join("\n"),
    html: renderEmail({
      shopName: d.shopName,
      preheader: `Your appointment on ${when} was cancelled.`,
      heading: "Your appointment was cancelled.",
      paragraphs: [
        `Hello ${firstName(d)}, your appointment at ${d.shopName} has been cancelled. The time is free again.`,
      ],
      details: [
        { label: "Service", value: d.serviceName },
        { label: "Barber", value: d.barberName },
        { label: "Was", value: when },
      ],
      button: { label: "Book another time", url: d.shopUrl },
      footer: [...(d.shopPhone ? [`Questions? Phone ${d.shopPhone}`] : [])],
    }),
  };
}

export function movedMail(d: BookingMailDetails): MailContent {
  const subject = `Your appointment at ${d.shopName} has moved`;
  const when = whenOf(d);
  return {
    subject,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `Your appointment has moved to ${when}: ${d.serviceName} with ${d.barberName}.`,
      "",
      `To see, cancel or move it again, use this link: ${d.manageUrl}`,
    ].join("\n"),
    html: renderEmail({
      shopName: d.shopName,
      preheader: `Your appointment is now ${when}.`,
      heading: "Your appointment has moved.",
      paragraphs: [`Hello ${firstName(d)}, your appointment at ${d.shopName} is now at a new time.`],
      details: [
        { label: "Service", value: d.serviceName },
        { label: "Barber", value: d.barberName },
        { label: "New time", value: when },
      ],
      button: { label: "See, change or cancel my booking", url: d.manageUrl },
      footer: [...(d.shopPhone ? [`Phone: ${d.shopPhone}`] : [])],
    }),
  };
}

/**
 * What a barber's new-booking e-mail says: the same summary the customer is shown, plus the customer's
 * contact details so the barber can reach them.
 */
export interface BarberMailDetails {
  shopName: string;
  barberName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationText: string;
  priceText: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** The barber's own area, where they see their upcoming bookings. */
  agendaUrl: string;
}

export function barberBookingMail(d: BarberMailDetails): MailContent {
  return barberNote(d, {
    subject: `New booking: ${d.customerName}, ${shortDay(d.date)} at ${d.startTime}`,
    heading: "You have a new booking.",
    sentence: "A new appointment has been booked in your chair.",
  });
}

export function barberCancellationMail(d: BarberMailDetails): MailContent {
  return barberNote(d, {
    subject: `Cancelled: ${d.customerName}, ${shortDay(d.date)} at ${d.startTime}`,
    heading: "A booking was cancelled.",
    sentence: "An appointment in your chair has been cancelled. The time is free again.",
  });
}

export function barberMovedMail(d: BarberMailDetails): MailContent {
  return barberNote(d, {
    subject: `Moved: ${d.customerName}, now ${shortDay(d.date)} at ${d.startTime}`,
    heading: "A booking has moved.",
    sentence: "An appointment in your chair has moved. The new time is below.",
  });
}

/** The wording that differs between the barber's notes. The summary and the layout are shared. */
interface BarberNoteWording {
  subject: string;
  heading: string;
  sentence: string;
}

function barberNote(d: BarberMailDetails, wording: BarberNoteWording): MailContent {
  const when = whenText(d.date, d.startTime, d.endTime);
  const first = d.barberName.split(" ")[0];
  return {
    subject: wording.subject,
    text: [
      `Hello ${first},`,
      "",
      wording.sentence,
      "",
      `Service: ${d.serviceName}`,
      `When: ${when}`,
      `Duration: ${d.durationText}`,
      `Total: ${d.priceText}`,
      "",
      `Customer: ${d.customerName}`,
      `Email: ${d.customerEmail}`,
      `Phone: ${d.customerPhone}`,
      "",
      `Your upcoming bookings: ${d.agendaUrl}`,
    ].join("\n"),
    html: renderEmail({
      shopName: d.shopName,
      preheader: `${d.customerName}, ${when}.`,
      heading: wording.heading,
      paragraphs: [`Hello ${first}, ${wording.sentence}`],
      details: [
        { label: "Service", value: d.serviceName },
        { label: "When", value: when },
        { label: "Duration", value: d.durationText },
        { label: "Total", value: d.priceText },
        { label: "Customer", value: d.customerName },
        { label: "Email", value: d.customerEmail },
        { label: "Phone", value: d.customerPhone },
      ],
      button: { label: "Open my bookings", url: d.agendaUrl },
      footer: [],
    }),
  };
}

const firstName = (d: { customerName: string }): string => d.customerName.split(" ")[0] ?? d.customerName;

const shortDay = (isoDate: string): string =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Tuesday 7 January at 10:00 to 10:30". The date is read in UTC, so no server time zone shifts it. */
function whenOf(d: { date: string; startTime: string; endTime: string }): string {
  return whenText(d.date, d.startTime, d.endTime);
}

const whenText = (isoDate: string, startTime: string, endTime: string): string =>
  `${new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} at ${startTime} to ${endTime}`;

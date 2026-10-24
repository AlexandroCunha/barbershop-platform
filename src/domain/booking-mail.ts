/** What a booking e-mail says. Every field is plain text; none of it is rendered as HTML. */
export interface BookingMailDetails {
  shopName: string;
  serviceName: string;
  barberName: string;
  /** ISO date, YYYY-MM-DD, in the shop's own calendar. */
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  /** The link where the customer can see, cancel or move the booking. */
  manageUrl: string;
  /** The shop's own address, for customers who want to book again. */
  shopUrl: string;
}

export interface MailContent {
  subject: string;
  text: string;
}

export function confirmationMail(d: BookingMailDetails): MailContent {
  return {
    subject: `Booking confirmed at ${d.shopName}`,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `Your booking is confirmed: ${d.serviceName} with ${d.barberName}, ${whenOf(d)}.`,
      "",
      `To see, cancel or move this booking, use this link: ${d.manageUrl}`,
      "",
      `See you soon at ${d.shopName}.`,
    ].join("\n"),
  };
}

export function reminderMail(d: BookingMailDetails): MailContent {
  return {
    subject: `Reminder: your appointment at ${d.shopName}`,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `A reminder of your appointment: ${d.serviceName} with ${d.barberName}, ${whenOf(d)}.`,
      "",
      `Need to change it? Use this link: ${d.manageUrl}`,
    ].join("\n"),
  };
}

export function cancellationMail(d: BookingMailDetails): MailContent {
  return {
    subject: `Your appointment at ${d.shopName} was cancelled`,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `Your appointment was cancelled: ${d.serviceName} with ${d.barberName}, ${whenOf(d)}.`,
      "",
      `To book another time, visit ${d.shopUrl}`,
    ].join("\n"),
  };
}

export function movedMail(d: BookingMailDetails): MailContent {
  return {
    subject: `Your appointment at ${d.shopName} has moved`,
    text: [
      `Hello ${firstName(d)},`,
      "",
      `Your appointment has moved to ${whenOf(d)}: ${d.serviceName} with ${d.barberName}.`,
      "",
      `To see, cancel or move it again, use this link: ${d.manageUrl}`,
    ].join("\n"),
  };
}

const firstName = (d: BookingMailDetails): string => d.customerName.split(" ")[0] ?? d.customerName;

/** "Tuesday 3 November at 14:30 to 15:00". The date is read in UTC, so no server time zone shifts it. */
function whenOf(d: BookingMailDetails): string {
  const day = new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${day} at ${d.startTime} to ${d.endTime}`;
}

/** What a barber's new-booking e-mail says. Contact details are for the barber to reach the customer. */
export interface BarberMailDetails {
  shopName: string;
  barberName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** The barber's own area, where they see their upcoming bookings. */
  agendaUrl: string;
}

export function barberBookingMail(d: BarberMailDetails): MailContent {
  return {
    subject: `New booking: ${d.customerName}, ${shortDay(d.date)} at ${d.startTime}`,
    text: [
      `Hello ${d.barberName.split(" ")[0]},`,
      "",
      `You have a new booking at ${d.shopName}.`,
      "",
      `Customer: ${d.customerName}`,
      `Service: ${d.serviceName}`,
      `When: ${whenText(d.date, d.startTime, d.endTime)}`,
      `Email: ${d.customerEmail}`,
      `Phone: ${d.customerPhone}`,
      "",
      `Your upcoming bookings: ${d.agendaUrl}`,
    ].join("\n"),
  };
}

const shortDay = (isoDate: string): string =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const whenText = (isoDate: string, startTime: string, endTime: string): string =>
  `${new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} at ${startTime} to ${endTime}`;

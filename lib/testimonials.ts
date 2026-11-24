/**
 * Real quotes from people who've used Surfdesk, shown on the marketing pages
 * (components/marketing/landing/Testimonials.tsx). Only add quotes the person
 * gave with permission to publish, in their words and with the attribution they
 * chose. Never write or edit a quote's meaning.
 */
export type Testimonial = { quote: string; who: string; audience: "nonprofit" | "business" | "individual" };

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Before Surfdesk, I had to check three places to figure out who needed a follow-up. Now I can see who we met with, what we talked about, and what happens next.",
    who: "Program Manager, nonprofit organization",
    audience: "nonprofit",
  },
  {
    quote:
      "My favorite part is having our check-ins and outcomes in one place. When it's time to put together a report, I'm not digging through a month of notes.",
    who: "Program Manager, nonprofit organization",
    audience: "nonprofit",
  },
  {
    quote:
      "I used to keep client notes in my phone and hope I remembered to call people back. Now I open Surfdesk in the morning and know exactly who I owe a follow-up.",
    who: "Business owner, downtown San Diego",
    audience: "business",
  },
  {
    quote:
      "When a customer calls back, I can pull up where we left off without scrolling through old texts. That's the part I use every day.",
    who: "Business owner, downtown San Diego",
    audience: "business",
  },
];

/**
 * Starter forms. Every template is editable after it's created. On purpose, none of them
 * ask for Social Security numbers, medical history, government IDs or other highly
 * sensitive information (scripts/form-templates.test.mts checks this).
 */
import type { FormField, IntakeMode } from "./forms-shared";

export type FormTemplate = {
  key: string;
  name: string;
  audience: "individual" | "business" | "nonprofit";
  description: string;
  intake: IntakeMode;
  fields: Omit<FormField, "id">[];
};

const NAME: Omit<FormField, "id">[] = [
  { type: "short_text", label: "First name", required: true, mapTo: "first_name" },
  { type: "short_text", label: "Last name", required: true, mapTo: "last_name" },
];
const CONTACT: Omit<FormField, "id">[] = [
  { type: "email", label: "Email", mapTo: "email" },
  { type: "phone", label: "Phone", mapTo: "phone" },
];
const CONSENT: Omit<FormField, "id"> = {
  type: "consent",
  label: "I agree that my answers can be stored and used to follow up with me.",
  required: true,
};

export const FORM_TEMPLATES: FormTemplate[] = [
  // Individuals
  {
    key: "contact",
    name: "Contact form",
    audience: "individual",
    description: "A simple way for people to reach you.",
    intake: "review",
    fields: [...NAME, ...CONTACT, { type: "long_text", label: "How can I help?", required: true }, CONSENT],
  },
  {
    key: "event-registration",
    name: "Event registration",
    audience: "individual",
    description: "Collect sign-ups for an event or class.",
    intake: "auto",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "number", label: "How many people are coming?", min: 1, max: 20 },
      { type: "long_text", label: "Anything we should know?" },
      CONSENT,
    ],
  },
  {
    key: "appointment-request",
    name: "Appointment request",
    audience: "individual",
    description: "Let people ask for a time that works.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "date", label: "Preferred date", required: true },
      { type: "time", label: "Preferred time" },
      { type: "long_text", label: "What is the appointment for?" },
      CONSENT,
    ],
  },
  {
    key: "questionnaire",
    name: "Personal questionnaire",
    audience: "individual",
    description: "A few questions before you meet someone.",
    intake: "none",
    fields: [
      { type: "short_text", label: "Your name", required: true, mapTo: "full_name" },
      { type: "long_text", label: "What would you like to get out of this?" },
      { type: "multiple_choice", label: "How did you hear about me?", options: ["A friend", "Social media", "Search", "Other"] },
      { type: "rating", label: "How urgent is this for you?" },
    ],
  },
  // Businesses
  {
    key: "customer-intake",
    name: "New customer intake",
    audience: "business",
    description: "Everything you need from a new customer, in one go.",
    intake: "auto",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "date", label: "Birthday (optional)", mapTo: "birthday" },
      { type: "multiple_choice", label: "How did you hear about us?", options: ["A friend", "Google", "Instagram", "Walked by", "Other"] },
      { type: "long_text", label: "Anything we should know?" },
      CONSENT,
    ],
  },
  {
    key: "service-request",
    name: "Service request",
    audience: "business",
    description: "Let customers request a job or service.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "dropdown", label: "What do you need?", required: true, options: ["Service A", "Service B", "Something else"] },
      { type: "long_text", label: "Tell us more", required: true },
      { type: "date", label: "When would you like it?" },
      CONSENT,
    ],
  },
  {
    key: "customer-feedback",
    name: "Customer feedback",
    audience: "business",
    description: "Hear how a visit went.",
    intake: "none",
    fields: [
      { type: "rating", label: "How was your visit?", required: true },
      { type: "yes_no", label: "Would you recommend us?" },
      { type: "long_text", label: "What could we do better?" },
      { type: "email", label: "Email (if you'd like a reply)" },
    ],
  },
  {
    key: "consultation-request",
    name: "Consultation request",
    audience: "business",
    description: "Book a first conversation with a new lead.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "long_text", label: "What would you like to discuss?", required: true },
      { type: "checkboxes", label: "Best times to reach you", options: ["Mornings", "Afternoons", "Evenings"] },
      CONSENT,
    ],
  },
  {
    key: "lead-qualification",
    name: "Lead qualification",
    audience: "business",
    description: "Learn about a lead before you call.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "short_text", label: "Company" },
      { type: "dropdown", label: "Budget", options: ["Under $500", "$500–$2,000", "$2,000–$10,000", "Over $10,000"] },
      { type: "dropdown", label: "Timeline", options: ["This month", "In 1–3 months", "Later", "Not sure"] },
      CONSENT,
    ],
  },
  // Nonprofits
  {
    key: "participant-registration",
    name: "Participant registration",
    audience: "nonprofit",
    description: "Sign up new participants for your programs.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "date", label: "Date of birth", mapTo: "birthday" },
      { type: "checkboxes", label: "Which services are you interested in?", options: ["Housing help", "Food assistance", "Job readiness", "Benefits help"] },
      { type: "multiple_choice", label: "How did you hear about us?", options: ["A friend or family", "Another agency", "Social media", "Walked in", "Other"] },
      CONSENT,
    ],
  },
  {
    key: "workforce-intake",
    name: "Workforce program intake",
    audience: "nonprofit",
    description: "Intake for job training and placement programs.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "dropdown", label: "Current work status", options: ["Unemployed", "Working part-time", "Working full-time", "In school"] },
      { type: "checkboxes", label: "Interested in", options: ["Resume help", "Interview practice", "Job placement", "Certification courses"] },
      { type: "yes_no", label: "Do you have reliable transportation?" },
      { type: "long_text", label: "What kind of work are you looking for?" },
      CONSENT,
    ],
  },
  {
    key: "nonprofit-event",
    name: "Event registration",
    audience: "nonprofit",
    description: "Collect sign-ups for a community event.",
    intake: "auto",
    fields: [...NAME, ...CONTACT, { type: "number", label: "How many people are coming?", min: 1, max: 20 }, CONSENT],
  },
  {
    key: "volunteer-registration",
    name: "Volunteer registration",
    audience: "nonprofit",
    description: "Sign up volunteers and their availability.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "checkboxes", label: "When can you help?", options: ["Weekday mornings", "Weekday afternoons", "Evenings", "Weekends"] },
      { type: "long_text", label: "Skills or interests" },
      CONSENT,
    ],
  },
  {
    key: "program-feedback",
    name: "Program feedback",
    audience: "nonprofit",
    description: "Hear from participants about a program.",
    intake: "none",
    fields: [
      { type: "rating", label: "How helpful was the program?", required: true },
      { type: "long_text", label: "What helped the most?" },
      { type: "long_text", label: "What could be better?" },
    ],
  },
  {
    key: "nonprofit-service-request",
    name: "Service request",
    audience: "nonprofit",
    description: "Let people ask for help with a specific service.",
    intake: "review",
    fields: [
      ...NAME,
      ...CONTACT,
      { type: "dropdown", label: "What do you need help with?", required: true, options: ["Housing", "Food", "Employment", "Benefits", "Something else"] },
      { type: "long_text", label: "Tell us a little more" },
      { type: "checkboxes", label: "Best way to reach you", options: ["Phone call", "Text", "Email"] },
      CONSENT,
    ],
  },
];

/** Words that must never appear in a template's labels (sensitive data we don't collect by default). */
export const SENSITIVE_TERMS = /social security|\bssn\b|passport|driver'?s licen[cs]e|government id|medical|diagnos|medication|immigration status|criminal|bank account|credit card/i;

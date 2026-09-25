"use client";

import { createContext, useContext } from "react";

export type Directory = {
  people: { id: string; display_name: string }[];
  lists: { id: string; name: string }[];
};

const DirectoryContext = createContext<Directory>({ people: [], lists: [] });

/** People and list names, for @/# autocomplete in the command bar. */
export const DirectoryProvider = DirectoryContext.Provider;
export const useDirectory = () => useContext(DirectoryContext);

/** Window events other parts of the app use to drive the command sheet. */
export const OPEN_COMMAND_EVENT = "sonderthreads:open-command";
export const VOICE_STOP_EVENT = "sonderthreads:voice-stop";

export type OpenCommandDetail = {
  voice?: boolean;
  hold?: boolean;
  compose?: string;
  followUp?: "note" | "task" | "list" | "person";
};

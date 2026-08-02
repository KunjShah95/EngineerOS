import { create } from "zustand";

interface UiState {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  quickCaptureOpen: false,
  setQuickCaptureOpen: (quickCaptureOpen) => set({ quickCaptureOpen }),
}));

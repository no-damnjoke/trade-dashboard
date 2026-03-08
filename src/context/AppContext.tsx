import { createContext } from 'preact';
import { useContext, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Alert, PanelId } from '../types';

interface AppState {
  focusedPanel: PanelId | null;
  alerts: Alert[];
  showAlerts: boolean;
  showPalette: boolean;
  showHelp: boolean;
}

interface AppContextValue extends AppState {
  setFocusedPanel: (id: PanelId | null) => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
  toggleAlerts: () => void;
  closeAlerts: () => void;
  togglePalette: () => void;
  closePalette: () => void;
  toggleHelp: () => void;
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: ComponentChildren }) {
  const [focusedPanel, setFocusedPanel] = useState<PanelId | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const addAlert = useCallback((alert: Alert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 50));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const toggleAlerts = useCallback(() => setShowAlerts(p => !p), []);
  const closeAlerts = useCallback(() => setShowAlerts(false), []);
  const togglePalette = useCallback(() => setShowPalette(p => !p), []);
  const closePalette = useCallback(() => setShowPalette(false), []);
  const toggleHelp = useCallback(() => setShowHelp(p => !p), []);

  return (
    <AppContext.Provider value={{
      focusedPanel, setFocusedPanel,
      alerts, setAlerts, addAlert, dismissAlert, clearAlerts,
      showAlerts, toggleAlerts, closeAlerts,
      showPalette, togglePalette, closePalette,
      showHelp, toggleHelp,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

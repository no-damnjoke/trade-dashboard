import { Layout } from './components/Layout';
import { AppProvider } from './context/AppContext';
import { useKeyboardNavigation } from './hooks/useKeyboard';

function AppInner() {
  useKeyboardNavigation();
  return <Layout />;
}

export function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

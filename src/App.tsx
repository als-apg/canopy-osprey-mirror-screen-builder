import { Shell } from './app/Shell';
import { registerBuiltinWidgets } from './widgets/registry/registerBuiltins';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Register widgets once at app startup
registerBuiltinWidgets();

export default function App() {
  useKeyboardShortcuts();
  return <Shell />;
}

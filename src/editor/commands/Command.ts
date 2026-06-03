import type { EditorStore } from '../model/EditorStore';

/**
 * Command pattern for undo/redo support.
 * Every editing operation is captured as a command.
 */
export interface Command {
  readonly description: string;
  execute(state: EditorStore, set: (fn: (s: EditorStore) => void) => void): void;
  undo(state: EditorStore, set: (fn: (s: EditorStore) => void) => void): void;
}

import { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEditorStore } from '../model/EditorStore';
import { generateTSX } from './generateTSX';
import { parseTSX } from './parseTSX';
import './CodeEditor.scss';

export function CodeEditor() {
  const screen = useEditorStore((s) => s.screen);
  const setScreen = useEditorStore((s) => s.setScreen);
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const isDark = editorTheme === 'g90' || editorTheme === 'g100';

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isExternalUpdate, setIsExternalUpdate] = useState(false);
  const lastModelVersion = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate TSX from current model
  const currentCode = generateTSX(screen);

  // Track model version to detect canvas-side changes
  const modelVersion = JSON.stringify({
    meta: screen.meta,
    ids: screen.rootWidgetIds,
    widgets: Object.fromEntries(
      Object.entries(screen.widgets).map(([k, v]) => [k, { ...v, zIndex: 0 }])
    ),
  });

  // Update Monaco when canvas changes (but not when code editor triggered the change)
  useEffect(() => {
    const version = modelVersion.length;
    if (version !== lastModelVersion.current && editorRef.current && !isExternalUpdate) {
      const editor = editorRef.current;
      const pos = editor.getPosition();
      const scroll = editor.getScrollTop();

      // Only update if the generated code differs from current editor content
      const editorValue = editor.getValue();
      const generated = generateTSX(screen);
      if (editorValue !== generated) {
        setIsExternalUpdate(true);
        editor.setValue(generated);
        if (pos) editor.setPosition(pos);
        editor.setScrollTop(scroll);
        setTimeout(() => setIsExternalUpdate(false), 50);
      }
    }
    lastModelVersion.current = version;
  }, [modelVersion, screen, isExternalUpdate]);

  // Handle code changes from Monaco → parse back to model
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (!value || isExternalUpdate) return;

      // Debounce parsing to avoid thrashing
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        try {
          const parsed = parseTSX(value);
          // Only update if parse succeeded and produced widgets
          if (parsed.rootWidgetIds.length > 0 || Object.keys(parsed.widgets).length === 0) {
            setIsExternalUpdate(true);
            setScreen(parsed);
            setTimeout(() => setIsExternalUpdate(false), 50);
          }
        } catch {
          // Parse error — don't update model, show error in Monaco
          // (Monaco's own TSX validation will show syntax errors)
        }
      }, 800);
    },
    [setScreen, isExternalUpdate]
  );

  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;

    // Configure TypeScript/TSX defaults
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.React,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowJs: true,
      esModuleInterop: true,
      strict: true,
    });

    // Add type declarations for our custom types
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
        declare module '@pydm/types' {
          export interface ScreenProps {
            title: string;
            width: number;
            height: number;
            backgroundColor: string;
            macros: Record<string, string>;
          }
        }
        declare module '@pydm/runtime' {
          export const Screen: React.FC<{ meta: import('@pydm/types').ScreenProps; macros?: Record<string, string>; children?: React.ReactNode }>;
        }
        declare module '@pydm/hooks' {
          export function usePV(pvName: string): {
            value: number | string;
            displayValue: string;
            severity: number;
            connected: boolean;
            timestamp: number;
            units: string;
            put: (value: number | string) => void;
          };
        }
        declare module '@pydm/widgets' {
          interface PVWidgetProps {
            pv?: string;
            x: number;
            y: number;
            w: number;
            h: number;
            label?: string;
            [key: string]: any;
          }
          export const PVTextDisplay: React.FC<PVWidgetProps>;
          export const PVTextInput: React.FC<PVWidgetProps>;
          export const PVButton: React.FC<PVWidgetProps>;
          export const PVSlider: React.FC<PVWidgetProps>;
          export const PVToggle: React.FC<PVWidgetProps>;
          export const PVLed: React.FC<PVWidgetProps>;
          export const PVProgressBar: React.FC<PVWidgetProps>;
          export const PVDropdown: React.FC<PVWidgetProps>;
          export const PVCheckbox: React.FC<PVWidgetProps>;
          export const PVRadioGroup: React.FC<PVWidgetProps>;
          export const PVSpinbox: React.FC<PVWidgetProps>;
          export const PVMeter: React.FC<PVWidgetProps>;
          export const PVGauge: React.FC<PVWidgetProps>;
          export const PVTank: React.FC<PVWidgetProps>;
          export const PVThermometer: React.FC<PVWidgetProps>;
          export const PVByteIndicator: React.FC<PVWidgetProps>;
        }
        declare module '@pydm/drawing' {
          interface DrawingProps { x: number; y: number; w: number; h: number; [key: string]: any; }
          export const Rectangle: React.FC<DrawingProps>;
          export const Ellipse: React.FC<DrawingProps>;
          export const Line: React.FC<DrawingProps>;
          export const Arc: React.FC<DrawingProps>;
          export const StaticLabel: React.FC<DrawingProps & { text?: string }>;
          export const ScreenImage: React.FC<DrawingProps>;
        }
        declare module '@pydm/containers' {
          interface ContainerProps { x: number; y: number; w: number; h: number; children?: React.ReactNode; [key: string]: any; }
          export const Group: React.FC<ContainerProps>;
          export const EmbeddedScreen: React.FC<ContainerProps & { file?: string; macros?: Record<string, string> }>;
        }
        `,
      'file:///pydm-types.d.ts'
    );
  }, []);

  return (
    <div className="code-editor">
      <div className="code-editor__header">
        Code Editor
        <span className="code-editor__filename">
          {useEditorStore.getState().filePath ?? 'untitled.tsx'}
        </span>
      </div>
      <div className="code-editor__body">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          defaultValue={currentCode}
          path="screen.tsx"
          theme={isDark ? 'vs-dark' : 'light'}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'IBM Plex Mono', 'Fira Code', Consolas, monospace",
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            tabSize: 2,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    </div>
  );
}

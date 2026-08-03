import { useMemo, useCallback, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  TextInput,
  NumberInput,
  Toggle,
  Select,
  SelectItem,
  Tag,
  Button,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useEditorStore } from '../model/EditorStore';
import { widgetRegistry } from '../../widgets/registry/WidgetRegistry';
import type { PropSchema } from '../../widgets/registry/WidgetRegistry';
import './PropertyInspector.scss';

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identity',
  layout: 'Layout',
  pv: 'PV Channel',
  display: 'Display',
  appearance: 'Appearance',
  alarm: 'Alarm',
  behavior: 'Behavior',
};

const SECTION_ORDER = ['identity', 'layout', 'pv', 'display', 'appearance', 'alarm', 'behavior'];

export function PropertyInspector() {
  const selection = useEditorStore((s) => s.selection);
  const screen = useEditorStore((s) => s.screen);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const updateWidgetProps = useEditorStore((s) => s.updateWidgetProps);
  const updateWidgetLayout = useEditorStore((s) => s.updateWidgetLayout);
  const updateScreenMeta = useEditorStore((s) => s.updateScreenMeta);

  const selectedWidget =
    selection.selectedIds.length === 1 ? screen.widgets[selection.selectedIds[0]] : null;

  const definition = selectedWidget ? widgetRegistry.get(selectedWidget.type) : null;

  const schemaBySection = useMemo(() => {
    if (!definition) return {};
    const map: Record<string, PropSchema[]> = {};
    for (const schema of definition.propsSchema) {
      if (!map[schema.section]) map[schema.section] = [];
      map[schema.section].push(schema);
    }
    return map;
  }, [definition]);

  const handlePropChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedWidget) return;
      updateWidgetProps(selectedWidget.id, { [key]: value });
    },
    [selectedWidget, updateWidgetProps]
  );

  const handleLayoutChange = useCallback(
    (key: string, value: number) => {
      if (!selectedWidget) return;
      updateWidgetLayout(selectedWidget.id, { [key]: value });
    },
    [selectedWidget, updateWidgetLayout]
  );

  const handleNameChange = useCallback(
    (value: string) => {
      if (!selectedWidget) return;
      updateWidget(selectedWidget.id, { name: value });
    },
    [selectedWidget, updateWidget]
  );

  if (!selectedWidget) {
    if (selection.selectedIds.length > 1) {
      return (
        <div className="property-inspector">
          <div className="property-inspector__header">Properties</div>
          <div className="property-inspector__empty">
            {`${selection.selectedIds.length} widgets selected`}
          </div>
        </div>
      );
    }

    return (
      <div className="property-inspector">
        <div className="property-inspector__header">Properties</div>
        <div className="property-inspector__widget-type">
          <Tag type="cool-gray" size="sm">
            Screen
          </Tag>
        </div>

        <Accordion size="sm">
          <AccordionItem title="Screen" open>
            <div className="property-inspector__field">
              <TextInput
                id="screen-title"
                labelText="Title"
                size="sm"
                value={screen.meta.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateScreenMeta({ title: e.target.value })
                }
              />
            </div>
            <div className="property-inspector__layout-grid">
              <NumberInput
                id="screen-width"
                label="Width"
                size="sm"
                min={1}
                max={10000}
                value={screen.meta.width}
                onChange={(_, { value }) => {
                  const v = Number(value);
                  if (v >= 1 && v <= 10000) updateScreenMeta({ width: v });
                }}
                hideSteppers
              />
              <NumberInput
                id="screen-height"
                label="Height"
                size="sm"
                min={1}
                max={10000}
                value={screen.meta.height}
                onChange={(_, { value }) => {
                  const v = Number(value);
                  if (v >= 1 && v <= 10000) updateScreenMeta({ height: v });
                }}
                hideSteppers
              />
            </div>
            <div className="property-inspector__field">
              <TextInput
                id="screen-bg"
                labelText="Background Color"
                size="sm"
                type="color"
                value={screen.meta.backgroundColor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateScreenMeta({ backgroundColor: e.target.value })
                }
              />
            </div>
            <div className="property-inspector__field">
              <Select
                id="screen-theme"
                labelText="Theme"
                size="sm"
                value={screen.meta.theme ?? 'g90'}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  updateScreenMeta({
                    theme: e.target.value as 'white' | 'g10' | 'g90' | 'g100',
                  })
                }
              >
                <SelectItem value="white" text="White" />
                <SelectItem value="g10" text="Gray 10" />
                <SelectItem value="g90" text="Gray 90" />
                <SelectItem value="g100" text="Gray 100" />
              </Select>
            </div>
          </AccordionItem>

          <AccordionItem title="Grid" open>
            <div className="property-inspector__field">
              <NumberInput
                id="screen-grid-size"
                label="Grid size (px)"
                size="sm"
                min={1}
                max={100}
                value={screen.meta.gridSize}
                onChange={(_, { value }) => {
                  const v = Number(value);
                  if (v >= 1 && v <= 100) updateScreenMeta({ gridSize: v });
                }}
                hideSteppers
              />
            </div>
            <div className="property-inspector__field">
              <Toggle
                id="screen-show-grid"
                labelText="Show grid"
                size="sm"
                toggled={screen.meta.showGrid}
                onToggle={(checked: boolean) => updateScreenMeta({ showGrid: checked })}
              />
            </div>
            <div className="property-inspector__field">
              <Toggle
                id="screen-snap-grid"
                labelText="Snap to grid"
                size="sm"
                toggled={screen.meta.snapToGrid}
                onToggle={(checked: boolean) => updateScreenMeta({ snapToGrid: checked })}
              />
            </div>
          </AccordionItem>

          <AccordionItem title="Scrolling" open>
            <div className="property-inspector__field">
              <Toggle
                id="screen-scroll-h"
                labelText="Horizontal scrollbar"
                size="sm"
                toggled={screen.meta.showHorizontalScrollbar !== false}
                onToggle={(checked: boolean) =>
                  updateScreenMeta({ showHorizontalScrollbar: checked })
                }
              />
            </div>
            <div className="property-inspector__field">
              <Toggle
                id="screen-scroll-v"
                labelText="Vertical scrollbar"
                size="sm"
                toggled={screen.meta.showVerticalScrollbar !== false}
                onToggle={(checked: boolean) =>
                  updateScreenMeta({ showVerticalScrollbar: checked })
                }
              />
            </div>
          </AccordionItem>

          <AccordionItem title="Macros" open>
            <ScreenMacrosEditor
              macros={screen.meta.macros}
              onChange={(next) => updateScreenMeta({ macros: next })}
            />
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return (
    <div className="property-inspector">
      <div className="property-inspector__header">Properties</div>
      <div className="property-inspector__widget-type">
        <Tag type="blue" size="sm">
          {definition?.label ?? selectedWidget.type}
        </Tag>
      </div>

      <Accordion size="sm">
        {/* Identity section */}
        <AccordionItem title="Identity" open>
          <div className="property-inspector__field">
            <TextInput
              id="widget-name"
              labelText="Name"
              size="sm"
              value={selectedWidget.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleNameChange(e.target.value)
              }
            />
          </div>
          <div className="property-inspector__field">
            <TextInput
              id="widget-type"
              labelText="Type"
              size="sm"
              value={selectedWidget.type}
              readOnly
            />
          </div>
        </AccordionItem>

        {/* Layout section */}
        <AccordionItem title="Layout" open>
          <div className="property-inspector__layout-grid">
            <NumberInput
              id="layout-x"
              label="X"
              size="sm"
              value={selectedWidget.layout.x}
              onChange={(_, { value }) => handleLayoutChange('x', Number(value))}
              hideSteppers
            />
            <NumberInput
              id="layout-y"
              label="Y"
              size="sm"
              value={selectedWidget.layout.y}
              onChange={(_, { value }) => handleLayoutChange('y', Number(value))}
              hideSteppers
            />
            <NumberInput
              id="layout-w"
              label="W"
              size="sm"
              value={selectedWidget.layout.width}
              min={1}
              onChange={(_, { value }) => handleLayoutChange('width', Number(value))}
              hideSteppers
            />
            <NumberInput
              id="layout-h"
              label="H"
              size="sm"
              value={selectedWidget.layout.height}
              min={1}
              onChange={(_, { value }) => handleLayoutChange('height', Number(value))}
              hideSteppers
            />
          </div>
        </AccordionItem>

        {/* Dynamic sections from schema */}
        {SECTION_ORDER.filter((s) => s !== 'identity' && s !== 'layout' && schemaBySection[s]).map(
          (section) => (
            <AccordionItem key={section} title={SECTION_LABELS[section] ?? section} open>
              {schemaBySection[section].map((schema) => (
                <div key={schema.key} className="property-inspector__field">
                  <PropertyField
                    schema={schema}
                    value={selectedWidget.props[schema.key]}
                    onChange={(val) => handlePropChange(schema.key, val)}
                  />
                </div>
              ))}
            </AccordionItem>
          )
        )}
      </Accordion>
    </div>
  );
}

// ── Property Field Renderer ─────────────────────────────────────────────────

interface PropertyFieldProps {
  schema: PropSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PropertyField({ schema, value, onChange }: PropertyFieldProps) {
  switch (schema.type) {
    case 'string':
    case 'pv':
      return (
        <TextInput
          id={`prop-${schema.key}`}
          labelText={schema.label}
          size="sm"
          value={(value as string) ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={schema.type === 'pv' ? 'e.g. DEMO:QUAD1:BDES' : undefined}
        />
      );

    case 'number':
      return (
        <NumberInput
          id={`prop-${schema.key}`}
          label={schema.label}
          size="sm"
          value={(value as number) ?? 0}
          min={schema.min}
          max={schema.max}
          step={schema.step ?? 1}
          onChange={(_, { value: v }) => onChange(Number(v))}
          hideSteppers
        />
      );

    case 'boolean':
      return (
        <Toggle
          id={`prop-${schema.key}`}
          labelText={schema.label}
          size="sm"
          toggled={(value as boolean) ?? false}
          onToggle={(checked: boolean) => onChange(checked)}
        />
      );

    case 'color':
      return (
        <div className="property-inspector__color-field">
          <label className="cds--label">{schema.label}</label>
          <div className="property-inspector__color-input">
            <input
              type="color"
              value={(value as string) ?? '#000000'}
              onChange={(e) => onChange(e.target.value)}
            />
            <TextInput
              id={`prop-${schema.key}-text`}
              labelText=""
              hideLabel
              size="sm"
              value={(value as string) ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            />
          </div>
        </div>
      );

    case 'select':
      return (
        <Select
          id={`prop-${schema.key}`}
          labelText={schema.label}
          size="sm"
          value={(value as string) ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        >
          {schema.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} text={opt.label} />
          ))}
        </Select>
      );

    default:
      return null;
  }
}

// ── Screen Macros Editor ────────────────────────────────────────────────────

interface ScreenMacrosEditorProps {
  macros: Record<string, string>;
  onChange: (macros: Record<string, string>) => void;
}

function ScreenMacrosEditor({ macros, onChange }: ScreenMacrosEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = Object.entries(macros);

  const updateValue = (key: string, value: string) => {
    onChange({ ...macros, [key]: value });
  };

  const removeKey = (key: string) => {
    const next = { ...macros };
    delete next[key];
    onChange(next);
  };

  const addMacro = () => {
    const key = newKey.trim();
  const addMacro = () => {
    const key = newKey.trim();
    if (!key || key in macros || !/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) return;
    onChange({ ...macros, [key]: newValue });
    setNewKey('');
    setNewValue('');
  };
    onChange({ ...macros, [key]: newValue });
    setNewKey('');
    setNewValue('');
  };

  return (
    <div className="property-inspector__macros">
      {entries.length === 0 && (
        <div className="property-inspector__macros-empty">No macros defined</div>
      )}
      {entries.map(([key, value]) => (
        <div key={key} className="property-inspector__macro-row">
          <TextInput
            id={`macro-key-${key}`}
            labelText=""
            hideLabel
            size="sm"
            value={key}
            readOnly
          />
          <TextInput
            id={`macro-val-${key}`}
            labelText=""
            hideLabel
            size="sm"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateValue(key, e.target.value)}
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={TrashCan}
            iconDescription="Remove macro"
            tooltipPosition="left"
            onClick={() => removeKey(key)}
          />
        </div>
      ))}
      <div className="property-inspector__macro-row">
        <TextInput
          id="macro-new-key"
          labelText=""
          hideLabel
          size="sm"
          placeholder="Name"
          value={newKey}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKey(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') addMacro();
          }}
        />
        <TextInput
          id="macro-new-val"
          labelText=""
          hideLabel
          size="sm"
          placeholder="Value"
          value={newValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewValue(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') addMacro();
          }}
        />
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Add}
          iconDescription="Add macro"
          tooltipPosition="left"
          onClick={addMacro}
          disabled={!newKey.trim() || newKey.trim() in macros}
        />
      </div>
    </div>
  );
}

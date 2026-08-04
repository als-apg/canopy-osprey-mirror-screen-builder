import { useMemo, useCallback } from 'react';
import {
  Accordion,
  AccordionItem,
  TextInput,
  NumberInput,
  Toggle,
  Select,
  SelectItem,
  Tag,
} from '@carbon/react';
import { useEditorStore } from '../model/EditorStore';
import { useScreen, useSelection } from '../model/hooks';
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
  const selection = useSelection();
  const screen = useScreen();
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
                value={screen.meta.width}
                onChange={(_, { value }) => updateScreenMeta({ width: Number(value) })}
                hideSteppers
              />
              <NumberInput
                id="screen-height"
                label="Height"
                size="sm"
                min={1}
                value={screen.meta.height}
                onChange={(_, { value }) => updateScreenMeta({ height: Number(value) })}
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

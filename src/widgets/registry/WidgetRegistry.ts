import type { ComponentType } from 'react';
import type { WidgetType, WidgetProps, AbsoluteLayout } from '../../types/widget';

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  category: 'display' | 'input' | 'indicator' | 'container' | 'chart' | 'drawing' | 'navigation';
  icon: string; // Carbon icon name or emoji placeholder
  defaultLayout: AbsoluteLayout;
  defaultProps: Partial<WidgetProps>;
  component: ComponentType<WidgetRendererProps>;
  propsSchema: PropSchema[];
}

export interface PropSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'pv';
  section: 'identity' | 'layout' | 'pv' | 'display' | 'appearance' | 'alarm' | 'behavior';
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface WidgetRendererProps {
  id: string;
  type: WidgetType;
  layout: AbsoluteLayout;
  props: WidgetProps;
  isSelected: boolean;
  isEditing: boolean;
}

class WidgetRegistryImpl {
  private definitions = new Map<WidgetType, WidgetDefinition>();

  register(definition: WidgetDefinition) {
    this.definitions.set(definition.type, definition);
  }

  get(type: WidgetType): WidgetDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): WidgetDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByCategory(category: WidgetDefinition['category']): WidgetDefinition[] {
    return this.getAll().filter((d) => d.category === category);
  }

  getCategories(): WidgetDefinition['category'][] {
    const cats = new Set(this.getAll().map((d) => d.category));
    return Array.from(cats);
  }
}

export const widgetRegistry = new WidgetRegistryImpl();

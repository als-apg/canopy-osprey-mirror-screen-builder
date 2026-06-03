import { AlarmSeverity } from '../types/widget';

const ALARM_COLORS: Record<AlarmSeverity, string> = {
  [AlarmSeverity.NO_ALARM]: 'var(--pydm-alarm-none)',
  [AlarmSeverity.MINOR]: 'var(--pydm-alarm-minor)',
  [AlarmSeverity.MAJOR]: 'var(--pydm-alarm-major)',
  [AlarmSeverity.INVALID]: 'var(--pydm-alarm-invalid)',
  [AlarmSeverity.DISCONNECTED]: 'var(--pydm-alarm-disconnected)',
};

const ALARM_BORDER_COLORS: Record<AlarmSeverity, string> = {
  [AlarmSeverity.NO_ALARM]: 'transparent',
  [AlarmSeverity.MINOR]: 'var(--pydm-alarm-minor)',
  [AlarmSeverity.MAJOR]: 'var(--pydm-alarm-major)',
  [AlarmSeverity.INVALID]: 'var(--pydm-alarm-invalid)',
  [AlarmSeverity.DISCONNECTED]: 'var(--pydm-alarm-disconnected)',
};

export function alarmColor(severity: AlarmSeverity): string {
  return ALARM_COLORS[severity] ?? ALARM_COLORS[AlarmSeverity.NO_ALARM];
}

export function alarmBorderColor(severity: AlarmSeverity): string {
  return ALARM_BORDER_COLORS[severity] ?? 'transparent';
}

export function alarmBorderStyle(severity: AlarmSeverity, sensitive: boolean): React.CSSProperties {
  if (!sensitive || severity === AlarmSeverity.NO_ALARM) return {};
  return {
    borderColor: alarmBorderColor(severity),
    borderWidth: 2,
    borderStyle: 'solid',
  };
}

import { Participant, ScreenId } from './types';

/**
 * Initial participants for group room simulation
 */
export const INITIAL_PARTICIPANTS: Participant[] = [
  {
    id: 'p1',
    name: 'Alex Rivers',
    initials: 'AR',
    role: 'host',
    device: 'Pixel 8 Pro • In Pocket',
    status: 'Grounded',
    lifts: 0,
    violationSeconds: 0,
  },
  {
    id: 'p2',
    name: 'Minh Tran',
    initials: 'MT',
    role: 'member',
    device: 'iPhone 15 • Flat on Desk',
    status: 'Armed & Ready',
    lifts: 0,
    violationSeconds: 0,
    isCurrentUser: true,
  },
  {
    id: 'p3',
    name: 'Sarah Jenkins',
    initials: 'SJ',
    role: 'member',
    device: 'Galaxy S23 • Moving',
    status: 'Calibrating',
    lifts: 2,
    violationSeconds: 18,
  },
  {
    id: 'p4',
    name: 'David K.',
    initials: 'DK',
    role: 'member',
    device: 'Nothing Phone • Screen Down',
    status: 'Ready',
    lifts: 1,
    violationSeconds: 4,
  },
];

/**
 * Human-readable subtitle for each screen
 */
export const SCREEN_TITLES: Record<ScreenId, string> = {
  '01-login': 'Auth & Profile',
  '02-solo-select': 'Solo Focus',
  '03-solo-timer': 'Solo Session Active',
  '04-solo-summary': 'Focus Summary',
  '05-group-lobby': 'Group Room #8821',
  '06-group-active': 'Group Session Active',
  '07-bill-allocation': 'Host Bill Split',
  '08-vietqr-settlement': 'VietQR Settlement',
  '09-activation': 'Pro Activation',
  '10-hardware-diagnostics': 'Hardware Health',
};

/**
 * Formats seconds into MM:SS
 */
export function formatTime(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats numbers into Vietnamese Đồng currency string (vi-VN locale)
 */
export function formatVND(val: number): string {
  return new Intl.NumberFormat('vi-VN').format(val);
}

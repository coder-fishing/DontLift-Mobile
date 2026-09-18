export type ScreenId =
  | '01-login'
  | '02-solo-select'
  | '03-solo-timer'
  | '04-solo-summary'
  | '05-group-lobby'
  | '06-group-active'
  | '07-bill-allocation'
  | '08-vietqr-settlement'
  | '09-activation'
  | '10-hardware-diagnostics';

export type FocusModeType = 'countdown' | 'stopwatch';

export type ParticipantStatus =
  | 'Grounded'
  | 'Armed & Ready'
  | 'Calibrating'
  | 'Ready'
  | 'Breach';

export interface Participant {
  id: string;
  name: string;
  initials: string;
  role: 'host' | 'member';
  device: string;
  status: ParticipantStatus;
  lifts: number;
  violationSeconds: number;
  isCurrentUser?: boolean;
}

export interface BillParticipantShare extends Participant {
  baseShare: number;
  penaltyShare: number;
  totalShare: number;
}

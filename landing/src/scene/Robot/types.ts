export type EmoteState = 'calm' | 'curious' | 'scanning' | 'concerned' | 'happy';

export const EMOTE_INDEX: Record<EmoteState, number> = {
  calm:      0,
  curious:   1,
  scanning:  2,
  concerned: 3,
  happy:     4,
};

export interface EyeStateParams {
  hw:            number;
  hh:            number;
  rot:           number;
  mode:          number;
  sweep:         number;
  flicker:       number;
  pulse:         number;
  brightness:    number;
  blinkInterval: number;
}

export interface RobotProps {
  emote?: EmoteState;
}

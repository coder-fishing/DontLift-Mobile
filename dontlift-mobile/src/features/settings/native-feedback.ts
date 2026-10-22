import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Vibration } from 'react-native';

let violationPlayer: AudioPlayer | null = null;
let audioModeReady: Promise<void> | null = null;

async function playViolationBeep(): Promise<void> {
  // Keep the app's existing silent-mode behavior and mix with other short audio.
  audioModeReady ??= setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  await audioModeReady;
  violationPlayer ??= createAudioPlayer(require('../../../assets/audio/violation-alert.wav'));
  await violationPlayer.seekTo(0);
  violationPlayer.play();
}

export const nativeFeedbackAdapters = {
  async vibrate(): Promise<void> {
    Vibration.vibrate([0, 200, 100, 200]);
  },
  playSound: playViolationBeep,
};

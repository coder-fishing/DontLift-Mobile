import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { Vibration } from "react-native";
import type { FeedbackAdapters } from "./feedback-service";

let violationPlayer: AudioPlayer | null = null;
let endSessionPlayer: AudioPlayer | null = null;
let audioModeReady: Promise<void> | null = null;

async function playTimes(player: AudioPlayer, playCount: number): Promise<void> {
  player.loop = false;
  await player.seekTo(0);

  await new Promise<void>((resolve) => {
    let completedPlays = 0;
    let handlingCompletion = false;
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish || handlingCompletion) return;
      handlingCompletion = true;
      completedPlays += 1;

      if (completedPlays >= playCount) {
        subscription.remove();
        resolve();
        return;
      }

      void player.seekTo(0).then(() => {
        handlingCompletion = false;
        player.play();
      }).catch(() => {
        subscription.remove();
        resolve();
      });
    });
    player.play();
  });
}

async function playViolationBeep(): Promise<void> {
  audioModeReady ??= setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
  });

  await audioModeReady;

  violationPlayer ??= createAudioPlayer(
    require("../../../assets/audio/notification_message-notification-alert-2-331726.mp3"),
  );

  await playTimes(violationPlayer, 1);
}

async function playEndSessionRing(): Promise<void> {
  audioModeReady ??= setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
  });

  await audioModeReady;
  endSessionPlayer ??= createAudioPlayer(
    require("../../../assets/audio/sound_1_drop_ring.mp3"),
  );
  await playTimes(endSessionPlayer, 3);
}

export const nativeFeedbackAdapters: FeedbackAdapters = {
  async vibrate() {
    Vibration.vibrate(50);
  },
  playSound: playViolationBeep,
  playEndSessionSound: playEndSessionRing,
};

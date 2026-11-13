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

async function playThreeTimes(player: AudioPlayer): Promise<void> {
  player.loop = false;
  await player.seekTo(0);

  await new Promise<void>((resolve) => {
    let completedPlays = 0;
    let handlingCompletion = false;
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish || handlingCompletion) return;
      handlingCompletion = true;
      completedPlays += 1;

      if (completedPlays >= 3) {
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

  await playThreeTimes(violationPlayer);
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
  await playThreeTimes(endSessionPlayer);
}

export const nativeFeedbackAdapters: FeedbackAdapters = {
  async vibrate() {
    Vibration.vibrate(50);
  },
  playSound: playViolationBeep,
  playEndSessionSound: playEndSessionRing,
};

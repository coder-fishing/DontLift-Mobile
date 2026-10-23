import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { Vibration } from "react-native";

let violationPlayer: AudioPlayer | null = null;
let audioModeReady: Promise<void> | null = null;

async function playViolationBeep(): Promise<void> {
  audioModeReady ??= setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: "mixWithOthers",
  });

  await audioModeReady;

  violationPlayer ??= createAudioPlayer(
    require("../../../assets/audio/notification_message-notification-alert-2-331726.mp3"),
  );

  const player = violationPlayer;

  for (let i = 0; i < 2; i++) {
    await player.seekTo(0);

    await new Promise<void>((resolve) => {
      const subscription = player.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (status.didJustFinish) {
            subscription.remove();
            resolve();
          }
        },
      );

      player.play();
    });
  }
}
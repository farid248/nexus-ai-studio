"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * Records audio from the microphone via MediaRecorder and hands the
 * resulting blob to `onComplete` (e.g. to send it for transcription).
 */
export function useVoiceRecorder(onComplete: (blob: Blob) => void) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = React.useRef(onComplete);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stop = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSeconds(0);
  }, []);

  const start = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) onCompleteRef.current(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast({
        title: "Microphone unavailable",
        description: "Grant microphone permission or upload an audio file instead.",
        variant: "destructive",
      });
    }
  }, [toast]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return { isRecording, seconds, start, stop };
}

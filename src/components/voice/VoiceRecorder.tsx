"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Mic, Square, Loader2 } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";

interface VoiceRecorderProps {
  onRecordingComplete?: (voiceNoteId: Id<"voiceNotes">) => void;
  onProcessingComplete?: (result: { conceptCount: number }) => void;
}

export function VoiceRecorder({
  onRecordingComplete,
  onProcessingComplete,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateUploadUrl = useMutation(api.voiceNotes.generateUploadUrl);
  const createVoiceNote = useMutation(api.voiceNotes.create);
  const processVoiceNote = useAction(api.voiceNotes.process);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Try to use a format that Whisper accepts
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);
      setStatus("Recording...");

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setStatus("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    setIsProcessing(true);
    setStatus("Uploading...");

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const recordedDuration = duration;

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        // Create blob from chunks
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        try {
          // Upload to Convex
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          const { storageId } = await response.json();

          // Create voice note record
          const voiceNoteId = await createVoiceNote({
            fileId: storageId,
            duration: recordedDuration,
          });

          onRecordingComplete?.(voiceNoteId);
          setStatus("Transcribing...");

          // Trigger processing (transcription + AI)
          try {
            const result = await processVoiceNote({ voiceNoteId });
            setStatus(`Created ${result.conceptCount} notes!`);
            onProcessingComplete?.(result);

            // Clear status after a moment
            setTimeout(() => {
              setStatus("");
            }, 3000);
          } catch (processError) {
            console.error("Processing failed:", processError);
            setStatus("Processing failed");
          }
        } catch (error) {
          console.error("Failed to upload recording:", error);
          setStatus("Upload failed");
        } finally {
          setIsRecording(false);
          setIsProcessing(false);
          setDuration(0);
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [
    duration,
    generateUploadUrl,
    createVoiceNote,
    processVoiceNote,
    onRecordingComplete,
    onProcessingComplete,
  ]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Status message */}
      {status && (
        <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm shadow-lg max-w-[200px]">
          {status}
        </div>
      )}

      {/* Recording duration */}
      {isRecording && (
        <div className="bg-destructive text-destructive-foreground rounded-full px-4 py-2 text-sm font-mono animate-pulse">
          {formatDuration(duration)}
        </div>
      )}

      {/* Main button - larger on mobile for better touch targets */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          w-16 h-16 md:w-14 md:h-14 rounded-full flex items-center justify-center
          transition-all shadow-lg hover:shadow-xl active:scale-95
          touch-manipulation
          ${
            isRecording
              ? "bg-destructive hover:bg-destructive/90"
              : "bg-primary hover:bg-primary/90"
          }
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title={isRecording ? "Stop recording" : "Start voice note"}
        aria-label={isRecording ? "Stop recording" : "Start voice note"}
      >
        {isProcessing ? (
          <Loader2 className="w-7 h-7 md:w-6 md:h-6 text-primary-foreground animate-spin" />
        ) : isRecording ? (
          <Square className="w-6 h-6 md:w-5 md:h-5 text-destructive-foreground fill-current" />
        ) : (
          <Mic className="w-7 h-7 md:w-6 md:h-6 text-primary-foreground" />
        )}
      </button>
    </div>
  );
}

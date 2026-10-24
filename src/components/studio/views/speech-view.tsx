"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  AlertTriangle,
  AudioLines,
  Check,
  Copy,
  Download,
  FileAudio,
  Languages,
  Loader2,
  Mic,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { TTS_MAX_CHARS, TTS_VOICES, type TranscriptionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Speech-to-Text tab                                                  */
/* ------------------------------------------------------------------ */

function SttPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const [qualityWarning, setQualityWarning] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: history, isLoading: historyLoading } = useQuery<TranscriptionDTO[]>({
    queryKey: ["transcriptions"],
    queryFn: async () => {
      const res = await fetch("/api/transcriptions");
      if (!res.ok) throw new Error("Failed to load transcriptions");
      return res.json();
    },
  });

  const transcribe = React.useCallback(
    async (blob: Blob, fileName: string) => {
      setLoading(true);
      setResult(null);
      setQualityWarning(false);
      try {
        const fd = new FormData();
        fd.append("file", blob, fileName);
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.text) {
          throw new Error(data.error ?? "Transcription returned empty");
        }
        setResult(data.text);
        setQualityWarning(Boolean(data.qualityWarning));
        await queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
        await queryClient.invalidateQueries({ queryKey: ["stats"] });
      } catch (err) {
        toast({
          title: "Transcription failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [queryClient, toast]
  );

  const { isRecording, seconds, start, stop } = useVoiceRecorder((blob) =>
    transcribe(blob, "microphone-recording.webm")
  );

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setQualityWarning(false);
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-4">
      {/* Honest language-support notice (verified by round-trip testing) */}
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
      >
        <Languages className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Language support:&nbsp;</span>
          the ASR engine is optimized for{" "}
          <span className="font-semibold">English &amp; Chinese</span> (near-perfect round-trip
          accuracy, incl. microphone webm/opus).{" "}
          <span className="font-semibold">Arabic speech is not supported</span> — Arabic
          transcripts come out as inaccurate phonetic guesses and are flagged with a warning.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4 text-primary" /> Audio source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/80 bg-secondary/20 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
              <FileAudio className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">
              {file ? file.name : "Choose an audio file"}
            </p>
            <p className="text-xs text-muted-foreground">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB · click to replace`
                : "WAV, MP3, M4A, OGG, WebM…"}
            </p>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={isRecording ? stop : start}
              aria-pressed={isRecording}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 fill-current text-destructive" />
                  Stop · <span className="font-mono">{seconds}s</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" /> Record from microphone
                </>
              )}
            </Button>
            <Button
              className="gap-2"
              disabled={(!file && !isRecording) || loading}
              onClick={() => file && transcribe(file, file.name)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Transcribing…
                </>
              ) : (
                <>
                  <AudioLines className="h-4 w-4" /> Transcribe
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AudioLines className="h-4 w-4 text-primary" /> Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : result ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/70 bg-secondary/30 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {result}
                  </p>
                </div>
                {qualityWarning && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      This transcript looks like Arabic speech. The current ASR engine
                      does not reliably support Arabic — the text above is likely
                      inaccurate. Use English (or Chinese) for accurate transcription.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {result.trim().split(/\s+/).length} words
                  </span>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={copyResult}>
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-36 flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  No transcript yet
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                  Upload audio or record your voice — the ASR model converts it
                  to text in seconds.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Recent transcripts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : !history || history.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Transcripts you generate will appear here.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {history.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-border/60 bg-secondary/20 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {t.fileName}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground/70">
                        {format(new Date(t.createdAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/85">
                      {t.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text-to-Speech tab                                                  */
/* ------------------------------------------------------------------ */

function TtsPanel() {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [voice, setVoice] = React.useState<string>("tongtong");
  const [speed, setSpeed] = React.useState(1);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const audioUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const generate = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), voice, speed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "TTS failed" }));
        throw new Error(data.error ?? "TTS request failed");
      }
      const blob = await res.blob();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
    } catch (err) {
      toast({
        title: "Speech synthesis failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const overLimit = text.length > TTS_MAX_CHARS;

  return (
    <div className="space-y-4">
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
      >
        <Languages className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Voice languages:&nbsp;</span>
          the 7 neural voices are tuned for English &amp; Chinese. Other languages
          (incl. Arabic) may produce unnatural or broken speech — best used with
          English text.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Volume2 className="h-4 w-4 text-primary" /> Text
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Write anything — the TTS model will turn it into natural speech…"
              aria-label="Text to speak"
              className={cn(
                "w-full resize-none rounded-lg border bg-secondary/30 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1",
                overLimit
                  ? "border-destructive/60 focus:border-destructive focus:ring-destructive/30"
                  : "border-border/70 focus:border-primary/50 focus:ring-primary/30"
              )}
            />
            <p
              className={cn(
                "text-right font-mono text-[10px]",
                overLimit ? "text-destructive" : "text-muted-foreground/70"
              )}
            >
              {text.length} / {TTS_MAX_CHARS}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Voice</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TTS_VOICES.map((v) => {
                const active = voice === v.value;
                return (
                  <button
                    key={v.value}
                    onClick={() => setVoice(v.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left transition-all",
                      active
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/70 bg-secondary/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    <span className="block text-xs font-medium">{v.label}</span>
                    <span className="block text-[10px] opacity-70">{v.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Speed</p>
              <span className="font-mono text-xs text-primary">{speed.toFixed(1)}×</span>
            </div>
            <Slider
              value={[speed]}
              min={0.5}
              max={2}
              step={0.1}
              onValueChange={(vals) => setSpeed(vals[0])}
              aria-label="Speech speed"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/60">
              <span>0.5×</span>
              <span>1.0×</span>
              <span>2.0×</span>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            disabled={!text.trim() || overLimit || loading}
            onClick={generate}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Synthesizing speech…
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" /> Generate speech
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AudioLines className="h-4 w-4 text-primary" /> Audio output
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audioUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-secondary/30 p-4">
                <audio controls src={audioUrl} className="w-full">
                  <track kind="captions" />
                </audio>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Voice:{" "}
                    <span className="font-mono text-foreground">
                      {TTS_VOICES.find((v) => v.value === voice)?.label}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Speed: <span className="font-mono text-foreground">{speed.toFixed(1)}×</span>
                  </p>
                </div>
                <a href={audioUrl} download="nexus-speech.wav">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download WAV
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary/60">
                <Volume2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No audio yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Write some text, pick a voice and speed, then generate — playback
                and download appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Speech Lab view                                                     */
/* ------------------------------------------------------------------ */

export function SpeechView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <AudioLines className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Speech Lab</h1>
              <p className="text-xs text-muted-foreground">
                Bidirectional speech — ASR transcription &amp; TTS synthesis
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06 }}
        >
          <Tabs defaultValue="stt">
            <TabsList className="mb-4">
              <TabsTrigger value="stt" className="gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Speech → Text
              </TabsTrigger>
              <TabsTrigger value="tts" className="gap-1.5">
                <Volume2 className="h-3.5 w-3.5" /> Text → Speech
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stt">
              <SttPanel />
            </TabsContent>
            <TabsContent value="tts">
              <TtsPanel />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

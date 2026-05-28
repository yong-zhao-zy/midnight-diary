"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import { Mic, Loader2, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

// ─── Web Speech API Types ─────────────────────────────────────────────────────

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getIsIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function getSpeechRecognitionClass():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// ─── Hook: useVoiceRecognition ────────────────────────────────────────────────

type VoiceStatus = "idle" | "recording" | "recognizing" | "done";

interface UseVoiceRecognitionOptions {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
}

function useVoiceRecognition({ onResult, onInterim }: UseVoiceRecognitionOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const manualStopRef = useRef(false);
  const startTimeRef = useRef(0);
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isIOS = useRef(getIsIOS()).current;
  const SpeechRecognitionClass = useRef(getSpeechRecognitionClass()).current;
  const isSupported = SpeechRecognitionClass !== null;

  const clearTimers = useCallback(() => {
    if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 3000);
  }, []);

  const createRecognition = useCallback((): SpeechRecognitionInstance | null => {
    if (!SpeechRecognitionClass) return null;
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = !isIOS;
    return recognition;
  }, [SpeechRecognitionClass, isIOS]);

  const start = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    if (status === "recording" || status === "recognizing") return;

    manualStopRef.current = false;
    setInterimText("");
    setErrorMessage(null);

    // iOS requires fresh instance each time
    const recognition = isIOS
      ? createRecognition()
      : recognitionRef.current || createRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setStatus("recording");
      startTimeRef.current = Date.now();
      // 60s soft reminder
      reminderTimerRef.current = setTimeout(() => {
        showError("建议停顿一下再继续");
      }, 60000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          setInterimText("");
          onResult(transcript);
          // Flash done state briefly
          setStatus("done");
          if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
          doneTimerRef.current = setTimeout(() => {
            if (!manualStopRef.current) {
              setStatus("recording");
            } else {
              setStatus("idle");
            }
          }, 400);
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        setInterimText(interim);
        onInterim?.(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errMap: Record<string, string> = {
        "not-allowed": "请允许麦克风权限以使用语音输入",
        "service-not-allowed": "请允许麦克风权限以使用语音输入",
        network: "识别失败，请检查网络",
        "no-speech": "没听清，请重试",
        aborted: "",
      };
      const msg = errMap[event.error] || "语音识别出错，请重试";
      if (msg) showError(msg);
      if (event.error !== "no-speech") {
        setStatus("idle");
        setInterimText("");
        manualStopRef.current = true;
      }
    };

    recognition.onend = () => {
      if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);

      if (!manualStopRef.current) {
        // Auto-restart for continuous recognition
        const delay = isIOS ? 300 : 50;
        restartTimerRef.current = setTimeout(() => {
          if (!manualStopRef.current && recognitionRef.current) {
            try {
              // iOS needs fresh instance
              if (isIOS) {
                const fresh = createRecognition();
                if (fresh) {
                  // Copy handlers
                  fresh.onstart = recognition.onstart;
                  fresh.onresult = recognition.onresult;
                  fresh.onerror = recognition.onerror;
                  fresh.onend = recognition.onend;
                  recognitionRef.current = fresh;
                  fresh.start();
                }
              } else {
                recognition.start();
              }
            } catch {
              setStatus("idle");
              setInterimText("");
            }
          }
        }, delay);
      } else {
        setStatus((prev) => (prev === "done" ? prev : "idle"));
        setInterimText("");
      }
    };

    try {
      recognition.start();
    } catch {
      showError("语音识别启动失败，请重试");
      setStatus("idle");
    }
  }, [
    SpeechRecognitionClass,
    status,
    isIOS,
    createRecognition,
    onResult,
    onInterim,
    showError,
  ]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    setStatus("idle");
    setInterimText("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (recognitionRef.current) {
        manualStopRef.current = true;
        try {
          recognitionRef.current.abort();
        } catch {
          // noop
        }
      }
    };
  }, [clearTimers]);

  return { isSupported, status, interimText, errorMessage, start, stop };
}

// ─── Component: VoiceTextInput ────────────────────────────────────────────────

interface VoiceTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export function VoiceTextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
}: VoiceTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef(0);
  const isIOS = useRef(getIsIOS()).current;

  // Keep cursor position in sync
  const updateCursorPos = useCallback(() => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart;
    }
  }, []);

  const handleResult = useCallback(
    (transcript: string) => {
      const pos = cursorPosRef.current;
      const selEnd = textareaRef.current?.selectionEnd ?? pos;
      const before = value.slice(0, pos);
      const after = value.slice(selEnd);
      let insertion = transcript;

      if (maxLength) {
        const available = maxLength - before.length - after.length;
        if (available <= 0) return;
        if (insertion.length > available) {
          insertion = insertion.slice(0, available);
        }
      }

      const newValue = before + insertion + after;
      onChange(newValue);
      const newPos = pos + insertion.length;
      cursorPosRef.current = newPos;

      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newPos;
          textareaRef.current.selectionEnd = newPos;
          textareaRef.current.focus();
        }
      });
    },
    [value, maxLength, onChange]
  );

  const { isSupported, status, interimText, errorMessage, start, stop } =
    useVoiceRecognition({
      onResult: handleResult,
    });

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      if (maxLength && newVal.length > maxLength) return;
      onChange(newVal);
      cursorPosRef.current = e.target.selectionStart;
    },
    [maxLength, onChange]
  );

  const handleVoiceToggle = useCallback(() => {
    if (status === "idle") {
      start();
    } else {
      stop();
    }
  }, [status, start, stop]);

  // Compute mirror content
  const showMirror = interimText && !isIOS;
  const mirrorBefore = showMirror ? value.slice(0, cursorPosRef.current) : "";
  const mirrorAfter = showMirror ? value.slice(cursorPosRef.current) : "";

  return (
    <div className="relative">
      {/* Mirror div for interim text display */}
      {showMirror && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words rounded-xl bg-white/5 border border-transparent px-4 py-3 text-foreground",
            className
          )}
        >
          <span>{mirrorBefore}</span>
          <span className="text-muted/60 italic">{interimText}</span>
          <span>{mirrorAfter}</span>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={updateCursorPos}
        onClick={updateCursorPos}
        onKeyUp={updateCursorPos}
        onFocus={updateCursorPos}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          "relative z-10 w-full resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors",
          showMirror && "text-transparent caret-foreground bg-transparent border-white/10",
          className
        )}
        style={showMirror ? { caretColor: "var(--color-foreground)" } : undefined}
      />

      {/* Voice button */}
      {isSupported && (
        <button
          type="button"
          onClick={handleVoiceToggle}
          className={cn(
            "absolute bottom-2 right-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-all duration-200",
            status === "idle" &&
              "text-muted/70 hover:text-glow-gold hover:bg-white/5",
            status === "recording" &&
              "text-red-400 bg-red-400/10 animate-pulse",
            status === "recognizing" && "text-glow-gold bg-glow-gold/10",
            status === "done" && "text-green-400 bg-green-400/10"
          )}
          aria-label={status === "recording" ? "停止录音" : "语音输入"}
        >
          {status === "idle" && <Mic className="h-4 w-4" />}
          {status === "recording" && (
            <>
              <Mic className="h-4 w-4" />
              <span>正在聆听…</span>
            </>
          )}
          {status === "recognizing" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {status === "done" && <Check className="h-4 w-4" />}
        </button>
      )}

      {/* Error / hint toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute -bottom-7 left-0 right-0 text-center text-xs text-red-300/80"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoiceTextInput;

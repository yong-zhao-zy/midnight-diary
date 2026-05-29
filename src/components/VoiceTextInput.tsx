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
  onAutoStop?: () => void;
}

function useVoiceRecognition({
  onResult,
  onInterim,
  onAutoStop,
}: UseVoiceRecognitionOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const manualStopRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isIOS = useRef(getIsIOS()).current;
  const SpeechRecognitionClass = useRef(getSpeechRecognitionClass()).current;
  const isSupported = SpeechRecognitionClass !== null;

  const clearTimers = useCallback(() => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
  }, []);

  const showError = useCallback((msg: string, duration = 3000) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), duration);
  }, []);

  const createRecognition = useCallback((): SpeechRecognitionInstance | null => {
    if (!SpeechRecognitionClass) return null;
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = !isIOS;
    return recognition;
  }, [SpeechRecognitionClass, isIOS]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    // Brief recognizing state while final results arrive
    setStatus((prev) => (prev === "recording" ? "recognizing" : prev));
  }, []);

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
      // 60s auto-stop timer
      autoStopTimerRef.current = setTimeout(() => {
        manualStopRef.current = true;
        try {
          recognition.stop();
        } catch {
          // noop
        }
        onAutoStop?.();
      }, 60000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalTranscript) {
        setInterimText("");
        onResult(finalTranscript);
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
        if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      }
    };

    recognition.onend = () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);

      if (!manualStopRef.current) {
        // Auto-restart for continuous recognition while holding
        const delay = isIOS ? 300 : 50;
        setTimeout(() => {
          if (!manualStopRef.current && recognitionRef.current) {
            try {
              if (isIOS) {
                const fresh = createRecognition();
                if (fresh) {
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
        // Manual stop or auto-stop: show done briefly
        setInterimText("");
        setStatus("done");
        if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
        doneTimerRef.current = setTimeout(() => setStatus("idle"), 400);
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
    onAutoStop,
    showError,
  ]);

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

  return { isSupported, status, interimText, errorMessage, start, stop, showError };
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
  const pressStartRef = useRef(0);
  const isPressedRef = useRef(false);
  const isTouchRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const handleAutoStop = useCallback(() => {
    isPressedRef.current = false;
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const {
    isSupported,
    status,
    interimText,
    errorMessage,
    start,
    stop,
    showError,
  } = useVoiceRecognition({
    onResult: handleResult,
    onAutoStop: handleAutoStop,
  });

  // Start progress bar countdown
  const startProgress = useCallback(() => {
    setProgress(1);
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / 60000);
      setProgress(remaining);
      if (remaining <= 0) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 100);
  }, []);

  const handlePressStart = useCallback(() => {
    isPressedRef.current = true;
    pressStartRef.current = Date.now();
    start();
    startProgress();
  }, [start, startProgress]);

  const handlePressEnd = useCallback(() => {
    if (!isPressedRef.current) return;
    isPressedRef.current = false;
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const pressDuration = Date.now() - pressStartRef.current;
    if (pressDuration < 300) {
      // Mistouch: too short
      stop();
      showError("按久一点再说话", 2000);
      return;
    }

    stop();
  }, [stop, showError]);

  // Mouse events (desktop)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchRef.current) return; // Prevent duplicate from touch
      e.preventDefault();
      handlePressStart();
    },
    [handlePressStart]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchRef.current) return;
      e.preventDefault();
      handlePressEnd();
    },
    [handlePressEnd]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchRef.current) return;
      if (isPressedRef.current) {
        e.preventDefault();
        handlePressEnd();
      }
    },
    [handlePressEnd]
  );

  // Touch events (mobile)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isTouchRef.current = true;
      e.preventDefault();
      handlePressStart();
    },
    [handlePressStart]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      handlePressEnd();
    },
    [handlePressEnd]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      if (maxLength && newVal.length > maxLength) return;
      onChange(newVal);
      cursorPosRef.current = e.target.selectionStart;
    },
    [maxLength, onChange]
  );

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

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
          showMirror &&
            "text-transparent caret-foreground bg-transparent border-white/10",
          className
        )}
        style={
          showMirror ? { caretColor: "var(--color-foreground)" } : undefined
        }
      />

      {/* Voice button - press and hold */}
      {isSupported && (
        <div className="relative mt-2">
          <button
            type="button"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={cn(
              "relative z-20 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs transition-all duration-200 overflow-hidden select-none",
              "[user-select:none] [-webkit-user-select:none] [touch-action:none] [-webkit-touch-callout:none]",
              status === "idle" &&
                "text-muted/70 bg-white/[0.04] border border-white/10 active:bg-white/[0.08]",
              status === "recording" &&
                "text-red-300 bg-red-400/10 border border-red-400/30 animate-pulse",
              status === "recognizing" &&
                "text-glow-gold bg-glow-gold/10 border border-glow-gold/30",
              status === "done" &&
                "text-green-400 bg-green-400/10 border border-green-400/30"
            )}
            aria-label="按住说话"
          >
            {status === "idle" && (
              <>
                <Mic className="h-4 w-4" />
                <span>按住说话</span>
              </>
            )}
            {status === "recording" && (
              <>
                <Mic className="h-4 w-4" />
                <span>松开结束</span>
              </>
            )}
            {status === "recognizing" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>识别中</span>
              </>
            )}
            {status === "done" && (
              <>
                <Check className="h-4 w-4" />
                <span>已插入</span>
              </>
            )}

            {/* Progress bar (60s countdown) */}
            {status === "recording" && progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-900/30">
                <div
                  className="h-full bg-red-400/70 transition-all duration-100 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
          </button>
        </div>
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

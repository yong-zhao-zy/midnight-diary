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
  const isIOS = useRef(getIsIOS()).current;
  const SpeechRecognitionClass = useRef(getSpeechRecognitionClass()).current;
  const isSupported = SpeechRecognitionClass !== null;

  // ─── Refs to avoid stale closures ───────────────────────────────────────────
  // These refs always hold the latest value/onChange so recognition callbacks
  // never operate on stale data.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const cursorPosRef = useRef(0);

  // ─── Voice state ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<"idle" | "recording" | "recognizing" | "done">("idle");
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // ─── Internal refs ──────────────────────────────────────────────────────────
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const manualStopRef = useRef(false);
  const pressStartRef = useRef(0);
  const isPressedRef = useRef(false);
  const isTouchRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const showError = useCallback((msg: string, duration = 3000) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), duration);
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const updateCursorPos = useCallback(() => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart;
    }
  }, []);

  // ─── Insert transcript at cursor (uses refs, no stale closure) ──────────────

  const insertAtCursor = useCallback((transcript: string) => {
    const pos = cursorPosRef.current;
    const currentValue = valueRef.current;
    const before = currentValue.slice(0, pos);
    const after = currentValue.slice(pos);
    let insertion = transcript;

    if (maxLength) {
      const available = maxLength - before.length - after.length;
      if (available <= 0) return;
      if (insertion.length > available) {
        insertion = insertion.slice(0, available);
      }
    }

    const newValue = before + insertion + after;
    const newPos = pos + insertion.length;

    // Update ref immediately so next call sees correct position
    cursorPosRef.current = newPos;
    valueRef.current = newValue;
    onChangeRef.current(newValue);

    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
      }
    });
  }, [maxLength]);

  // ─── Recognition lifecycle ──────────────────────────────────────────────────

  const createAndStartRecognition = useCallback(() => {
    if (!SpeechRecognitionClass) return;

    manualStopRef.current = false;
    setInterimText("");
    setErrorMessage(null);

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = !isIOS;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setStatus("recording");
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
        insertAtCursor(finalTranscript);
      }
      if (interim) {
        setInterimText(interim);
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
        clearProgress();
        isPressedRef.current = false;
        if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      }
    };

    recognition.onend = () => {
      if (!manualStopRef.current) {
        // Auto-restart for continuous recognition while user holds button
        const delay = isIOS ? 300 : 50;
        setTimeout(() => {
          if (!manualStopRef.current) {
            try {
              const fresh = new SpeechRecognitionClass();
              fresh.lang = "zh-CN";
              fresh.continuous = true;
              fresh.interimResults = !isIOS;
              fresh.onstart = recognition.onstart;
              fresh.onresult = recognition.onresult;
              fresh.onerror = recognition.onerror;
              fresh.onend = recognition.onend;
              recognitionRef.current = fresh;
              fresh.start();
            } catch {
              setStatus("idle");
              setInterimText("");
            }
          }
        }, delay);
      } else {
        // Manual stop or auto-stop
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
  }, [SpeechRecognitionClass, isIOS, insertAtCursor, showError, clearProgress]);

  const stopRecognition = useCallback(() => {
    manualStopRef.current = true;
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    setStatus((prev) => (prev === "recording" ? "recognizing" : prev));
  }, []);

  // ─── Press handlers ─────────────────────────────────────────────────────────

  const handlePressStart = useCallback(() => {
    if (status === "recording" || status === "recognizing") return;
    isPressedRef.current = true;
    pressStartRef.current = Date.now();

    // Snapshot cursor position at press time
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart;
    }

    // Start recognition
    createAndStartRecognition();

    // Start 60s progress countdown
    setProgress(1);
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / 60000);
      setProgress(remaining);
      if (remaining <= 0) {
        clearProgress();
      }
    }, 100);

    // 60s auto-stop
    autoStopTimerRef.current = setTimeout(() => {
      manualStopRef.current = true;
      isPressedRef.current = false;
      clearProgress();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // noop
        }
      }
      showError("可继续按住说话", 3000);
    }, 60000);
  }, [status, createAndStartRecognition, clearProgress, showError]);

  const handlePressEnd = useCallback(() => {
    if (!isPressedRef.current) return;
    isPressedRef.current = false;
    clearProgress();
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    const pressDuration = Date.now() - pressStartRef.current;
    if (pressDuration < 300) {
      // Mistouch: too short, abort without inserting
      manualStopRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // noop
        }
      }
      setStatus("idle");
      setInterimText("");
      showError("按久一点再说话", 2000);
      return;
    }

    stopRecognition();
  }, [clearProgress, stopRecognition, showError]);

  // ─── Mouse events (desktop) ─────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchRef.current) return;
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

  // ─── Touch events (mobile) ─────────────────────────────────────────────────

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

  // ─── Textarea change handler ────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      if (maxLength && newVal.length > maxLength) return;
      onChange(newVal);
      cursorPosRef.current = e.target.selectionStart;
    },
    [maxLength, onChange]
  );

  // ─── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (recognitionRef.current) {
        manualStopRef.current = true;
        try {
          recognitionRef.current.abort();
        } catch {
          // noop
        }
      }
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const showMirror = !!(interimText && !isIOS);
  const mirrorBefore = showMirror ? value.slice(0, cursorPosRef.current) : "";
  const mirrorAfter = showMirror ? value.slice(cursorPosRef.current) : "";

  return (
    <div className="relative">
      {/* Mirror div for interim text display */}
      {showMirror && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-20 pointer-events-none overflow-hidden whitespace-pre-wrap break-words rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-foreground",
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
          showMirror && "text-transparent",
          className
        )}
        style={showMirror ? { caretColor: "var(--color-foreground)" } : undefined}
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
              "relative z-20 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs transition-all duration-200 overflow-hidden",
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
            {progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-900/30">
                <div
                  className="h-full bg-red-400/70 transition-[width] duration-100 ease-linear"
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
            className="mt-2 text-center text-xs text-red-300/80"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoiceTextInput;

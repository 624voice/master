import type { CallState } from "~/hooks/useVoiceDemo";

type DemoWaveformProps = {
  callState: CallState;
  className?: string;
};

export function DemoWaveform({ callState, className = "" }: DemoWaveformProps) {
  const isActive =
    callState === "connecting" ||
    callState === "listening" ||
    callState === "speaking" ||
    callState === "requestingPermission";
  const isSpeaking = callState === "speaking";
  const isIdle = callState === "idle";

  return (
    <div className={`relative w-full px-2 ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 520 48"
        className={`h-8 w-full sm:h-9 ${
          isIdle ? "motion-safe:animate-[wave-breathe_3s_ease-in-out_infinite]" : ""
        } ${isActive && !isSpeaking ? "motion-safe:animate-[wave-pulse_1.2s_ease-in-out_infinite]" : ""} ${
          isSpeaking ? "motion-safe:animate-[wave-speak_0.6s_ease-in-out_infinite]" : ""
        }`}
        preserveAspectRatio="none"
      >
        <path
          d="M0 24 H12 L14 18 L16 30 L18 12 L20 36 L22 20 L24 28 L26 14 L28 34 L30 16 L32 32 L34 10 L36 38 L38 18 L40 30 L42 14 L44 34 L46 16 L48 28 L50 12 L52 36 L54 20 L56 28 L58 14 L60 34 L62 16 L64 30 L66 10 L68 38 L70 18 L72 28 L74 14 L76 34 L78 16 L80 32 L82 12 L84 36 L86 20 L88 28 L90 14 L92 34 L94 16 L96 30 L98 10 L100 38 L102 18 L104 28 L106 14 L108 34 L110 16 L112 32 L114 12 L116 36 L118 20 L120 28 L122 14 L124 34 L126 16 L128 30 L130 10 L132 38 L134 18 L136 28 L138 14 L140 34 L142 16 L144 32 L146 12 L148 36 L150 20 L152 28 L154 14 L156 34 L158 16 L160 30 L162 10 L164 38 L166 18 L168 28 L170 14 L172 34 L174 16 L176 32 L178 12 L180 36 L182 20 L184 28 L186 14 L188 34 L190 16 L192 30 L194 10 L196 38 L198 18 L200 28 L202 14 L204 34 L206 16 L208 32 L210 12 L212 36 L214 20 L216 28 L218 14 L220 34 L222 16 L224 30 L226 10 L228 38 L230 18 L232 28 L234 14 L236 34 L238 16 L240 32 L242 12 L244 36 L246 20 L248 28 L250 14 L252 34 L254 16 L256 30 L258 10 L260 38 L262 18 L264 28 L266 14 L268 34 L270 16 L272 32 L274 12 L276 36 L278 20 L280 28 L282 14 L284 34 L286 16 L288 30 L290 10 L292 38 L294 18 L296 28 L298 14 L300 34 L302 16 L304 32 L306 12 L308 36 L310 20 L312 28 L314 14 L316 34 L318 16 L320 30 L322 10 L324 38 L326 18 L328 28 L330 14 L332 34 L334 16 L336 32 L338 12 L340 36 L342 20 L344 28 L346 14 L348 34 L350 16 L352 30 L354 10 L356 38 L358 18 L360 28 L362 14 L364 34 L366 16 L368 32 L370 12 L372 36 L374 20 L376 28 L378 14 L380 34 L382 16 L384 30 L386 10 L388 38 L390 18 L392 28 L394 14 L396 34 L398 16 L400 32 L402 12 L404 36 L406 20 L408 28 L410 14 L412 34 L414 16 L416 30 L418 10 L420 38 L422 18 L424 28 L426 14 L428 34 L430 16 L432 32 L434 12 L436 36 L438 20 L440 28 L442 14 L444 34 L446 16 L448 30 L450 10 L452 38 L454 18 L456 28 L458 14 L460 34 L462 16 L464 32 L466 12 L468 36 L470 20 L472 28 L474 14 L476 34 L478 16 L480 30 L482 10 L484 38 L486 18 L488 28 L490 14 L492 34 L494 16 L496 32 L498 12 L500 36 L502 20 L504 28 L506 14 L508 34 L510 16 L512 30 L514 10 L516 38 L518 24 H520"
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={callState === "ended" ? 0.35 : 0.9}
        />
      </svg>
    </div>
  );
}

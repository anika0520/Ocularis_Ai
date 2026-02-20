import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Activity, Zap, Clock, Maximize2, Volume2, VolumeX,
  AlertTriangle, CheckCircle, RefreshCw, Mic, Droplets, Timer,
} from "lucide-react";
import {
  ResponsiveContainer, Area, AreaChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

import { getEyeHealthAdvice } from "./services/geminiService";
import { getEAR } from "./utils/blinkUtils";
import { estimateDistance, calibrateFocalLength } from "./utils/distanceUtils";
import { calculateFatigue, resetFatigueSmoothing } from "./utils/fatigueScore";
import { estimateBrightness } from "./utils/lightUtils";

// ─────────────────────────────────────────────
//  VOICE ASSISTANT
// ─────────────────────────────────────────────
class VoiceAssistant {
  constructor() {
    this.synth = window.speechSynthesis;
    this.enabled = true;
    this.cooldowns = {};
    if (this.synth) { this.synth.getVoices(); this.synth.onvoiceschanged = () => {}; }
  }
  _getBestVoice() {
    const voices = this.synth.getVoices();
    return voices.find((v) => v.name === "Google US English") ||
      voices.find((v) => v.lang === "en-US" && v.name.includes("Google")) ||
      voices.find((v) => v.lang === "en-US") || voices[0];
  }
  speak(text, { key = null, cooldown = 60000 } = {}) {
    if (!this.enabled || !this.synth) return false;
    const now = Date.now();
    if (key && this.cooldowns[key] && now - this.cooldowns[key] < cooldown) return false;
    if (this.synth.speaking) return false;
    if (key) this.cooldowns[key] = now;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92; u.pitch = 1.05; u.volume = 1.0;
    const v = this._getBestVoice(); if (v) u.voice = v;
    this.synth.speak(u); return true;
  }
  stop() { this.synth?.cancel(); }
}
const va = new VoiceAssistant();

// ─────────────────────────────────────────────
//  FACE MESH CONSTANTS
// ─────────────────────────────────────────────
const LEFT_EYE_OUTLINE  = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
const RIGHT_EYE_OUTLINE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
const LEFT_IRIS  = [468,469,470,471,472];
const RIGHT_IRIS = [473,474,475,476,477];
const FACE_OVAL  = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

function drawFaceMesh(ctx, lm, W, H, fatigue) {
  const pt = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
  const irisColor = fatigue > 65 ? "rgba(239,68,68,0.85)" : fatigue > 40 ? "rgba(251,191,36,0.85)" : "rgba(0,245,255,0.85)";
  ctx.beginPath();
  FACE_OVAL.forEach((idx, i) => { const p = pt(idx); i === 0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y); });
  ctx.closePath(); ctx.strokeStyle = "rgba(0,245,255,0.15)"; ctx.lineWidth = 0.8; ctx.stroke();
  [LEFT_EYE_OUTLINE, RIGHT_EYE_OUTLINE].forEach((outline) => {
    ctx.beginPath();
    outline.forEach((idx, i) => { const p = pt(idx); i === 0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y); });
    ctx.closePath(); ctx.strokeStyle = irisColor; ctx.lineWidth = 1.3;
    ctx.shadowColor = irisColor; ctx.shadowBlur = 4; ctx.stroke(); ctx.shadowBlur = 0;
  });
  [LEFT_IRIS, RIGHT_IRIS].forEach((iris) => {
    if (!lm[iris[0]] || !lm[iris[1]]) return;
    const center = pt(iris[0]), edge = pt(iris[1]);
    const r = Math.max(3, Math.hypot(edge.x-center.x, edge.y-center.y));
    ctx.beginPath(); ctx.arc(center.x,center.y,r,0,Math.PI*2);
    ctx.strokeStyle = irisColor; ctx.lineWidth = 1.8;
    ctx.shadowColor = irisColor; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(center.x,center.y,r*0.35,0,Math.PI*2);
    ctx.fillStyle = irisColor; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
  });
  [168,6,197,195].forEach((idx) => {
    const p = pt(idx); ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2);
    ctx.fillStyle = "rgba(0,245,255,0.25)"; ctx.fill();
  });
}

// ─────────────────────────────────────────────
//  UI COMPONENTS
// ─────────────────────────────────────────────
function MetricCard({ label, value, unit, color, borderColor, icon, warning, pct }) {
  return (
    <div className="relative glass-card p-4 card-hover overflow-hidden"
      style={{ borderColor: warning ? "rgba(239,68,68,0.5)" : undefined }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${borderColor},transparent)` }} />
      <div className="flex items-center justify-between mb-2">
        <p className="font-orbitron text-xs tracking-widest text-gray-500 uppercase">{label}</p>
        <span className={color + " opacity-70"}>{icon}</span>
      </div>
      <p className={`number-ticker text-2xl font-bold ${color} ${warning ? "animate-pulse" : ""}`}>
        {value}<span className="text-xs ml-1 text-gray-500 font-normal">{unit}</span>
      </p>
      {pct != null && (
        <div className="mt-2 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100,pct)}%`, background: warning ? "linear-gradient(90deg,#ef4444,#f97316)" : `linear-gradient(90deg,${borderColor},${borderColor}66)` }} />
        </div>
      )}
    </div>
  );
}

function FatigueGauge({ value }) {
  const clr = value < 30 ? "#10b981" : value < 60 ? "#f59e0b" : value < 80 ? "#f97316" : "#ef4444";
  const lbl = value < 30 ? "OPTIMAL" : value < 60 ? "MODERATE" : value < 80 ? "HIGH" : "CRITICAL";
  const toRad = (d) => (d * Math.PI) / 180;
  const cx = 85, cy = 85, r = 68;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 170, height: 170 }}>
        <svg width="170" height="170" viewBox="0 0 170 170">
          <path d="M 22 132 A 68 68 0 1 1 148 132" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" strokeLinecap="round"/>
          {Array.from({ length: 10 }, (_, i) => {
            const filled = i < Math.round(value / 10);
            const sa = -222 + i * 26.4, ea = sa + 22;
            const x1 = cx + r * Math.cos(toRad(sa)), y1 = cy + r * Math.sin(toRad(sa));
            const x2 = cx + r * Math.cos(toRad(ea)), y2 = cy + r * Math.sin(toRad(ea));
            return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none" stroke={filled ? clr : "rgba(255,255,255,0.04)"} strokeWidth="9" strokeLinecap="round"
              style={{ transition: "stroke 0.6s", filter: filled ? `drop-shadow(0 0 3px ${clr}90)` : "none" }}/>;
          })}
          <g style={{ transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)", transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${-135+(value/100)*270}deg)` }}>
            <line x1={cx} y1={cy} x2={cx} y2={24} stroke={clr} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${clr})` }}/>
            <circle cx={cx} cy={cy} r="5" fill={clr} style={{ filter: `drop-shadow(0 0 8px ${clr})` }}/>
            <circle cx={cx} cy={cy} r="2" fill="#0b0f1e"/>
          </g>
          <text x={cx} y="118" textAnchor="middle" fill={clr} fontSize="24" fontFamily="'Share Tech Mono'" fontWeight="bold" style={{ filter: `drop-shadow(0 0 10px ${clr})` }}>{value}%</text>
          <text x={cx} y="136" textAnchor="middle" fill="rgba(200,214,240,0.35)" fontSize="7.5" fontFamily="'Orbitron'" letterSpacing="3">FATIGUE INDEX</text>
        </svg>
        <div className="absolute rounded-full spin-slow pointer-events-none" style={{ inset: -10, border: "1px dashed rgba(0,245,255,0.07)" }}/>
      </div>
      <p className="font-orbitron text-xs tracking-widest mt-1" style={{ color: clr, textShadow: `0 0 10px ${clr}50` }}>{lbl}</p>
    </div>
  );
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs font-mono-tech border border-cyan-500/20">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name === "Fatigue" ? "%" : " bpm"}</p>)}
    </div>
  );
};

function FatigueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={148}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -26, bottom: 0 }}>
        <defs>
          <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.35}/><stop offset="95%" stopColor="#00f5ff" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.05)"/>
        <XAxis dataKey="t" stroke="rgba(200,214,240,0.1)" tick={{ fontSize: 8, fill: "rgba(200,214,240,0.3)", fontFamily: "Share Tech Mono" }}/>
        <YAxis domain={[0,100]} stroke="rgba(200,214,240,0.1)" tick={{ fontSize: 8, fill: "rgba(200,214,240,0.3)", fontFamily: "Share Tech Mono" }}/>
        <Tooltip content={<ChartTip/>}/>
        <ReferenceLine y={70} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4"/>
        <Area type="monotone" dataKey="fatigue" name="Fatigue" stroke="#00f5ff" strokeWidth={2} fill="url(#gF)" dot={false} activeDot={{ r:3, fill:"#00f5ff", strokeWidth:0 }}/>
        <Area type="monotone" dataKey="blinks" name="Blinks" stroke="#a855f7" strokeWidth={1.5} fill="url(#gB)" dot={false} activeDot={{ r:3, fill:"#a855f7", strokeWidth:0 }}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VoiceWave({ active }) {
  if (!active) return null;
  return <div className="voice-wave ml-1">{[1,2,3,4,5].map((i) => <span key={i}/>)}</div>;
}

function Toast({ message, type, onDismiss }) {
  const cfg = {
    danger:  { border: "#ef4444", bg: "rgba(239,68,68,0.12)",  text: "#fca5a5", icon: <AlertTriangle size={13}/> },
    warning: { border: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "#fcd34d", icon: <AlertTriangle size={13}/> },
    success: { border: "#10b981", bg: "rgba(16,185,129,0.12)", text: "#6ee7b7", icon: <CheckCircle size={13}/> },
    info:    { border: "#00f5ff", bg: "rgba(0,245,255,0.08)",  text: "#67e8f9", icon: <Mic size={13}/> },
  }[type] || {};
  return (
    <motion.div initial={{ x:60, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:60, opacity:0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border font-mono-tech text-xs"
      style={{ borderColor: cfg.border+"50", background: cfg.bg, color: cfg.text }}>
      <span style={{ color: cfg.border }}>{cfg.icon}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onDismiss} className="text-base leading-none opacity-50 hover:opacity-100 ml-1">×</button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [isMonitoring, setIsMonitoring]     = useState(false);
  const [voiceEnabled, setVoiceEnabled]     = useState(true);
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [metrics, setMetrics]               = useState({ blinkRate:0, pupilDilation:0, screenDistance:60, fatigueScore:0 });
  const [aiAdvice, setAiAdvice]             = useState("Initialize monitoring to begin neural analysis...");
  const [errorMsg, setErrorMsg]             = useState(null);
  const [sessionTime, setSessionTime]       = useState(0);
  const [focalLength, setFocalLength]       = useState(null);
  const [fatigueHistory, setFatigueHistory] = useState([]);
  const [toasts, setToasts]                 = useState([]);
  const [breakCountdown, setBreakCountdown] = useState(null);
  const [calibrated, setCalibrated]         = useState(false);
  const [faceDetected, setFaceDetected]     = useState(false);
  const [ambientBrightness, setAmbientBrightness] = useState(0.5);
  const [voiceLog, setVoiceLog]             = useState([]);
  const [showDebug, setShowDebug]           = useState(false);
  const [debugInfo, setDebugInfo]           = useState({});

  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);
  const blinkTimes      = useRef([]);
  const toastId         = useRef(0);
  const metricsRef      = useRef(metrics);
  const sessionRef      = useRef(0);
  const voiceEnabledRef = useRef(voiceEnabled);
  const focalLengthRef  = useRef(null);
  const lastIpdPxRef    = useRef(0);

  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { sessionRef.current = sessionTime; }, [sessionTime]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; va.enabled = voiceEnabled; if (!voiceEnabled) va.stop(); }, [voiceEnabled]);
  useEffect(() => { focalLengthRef.current = focalLength; }, [focalLength]);

  // Press D to toggle debug panel
  useEffect(() => {
    const h = (e) => { if (e.key === "d" || e.key === "D") setShowDebug((v) => !v); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const addToast = useCallback((msg, type = "warning") => {
    const id = ++toastId.current;
    setToasts((p) => [...p.slice(-3), { id, message: msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 7000);
  }, []);

  const speak = useCallback((text, opts = {}) => {
    if (!voiceEnabledRef.current) return;
    const spoke = va.speak(text, opts);
    if (spoke) {
      setIsSpeaking(true);
      setVoiceLog((p) => [text, ...p].slice(0, 5));
      setTimeout(() => setIsSpeaking(false), Math.max(2000, text.length * 65));
    }
  }, []); // stable — no deps

  const onResults = useCallback((results) => {
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    if (!results?.multiFaceLandmarks?.length) { setFaceDetected(false); return; }
    setFaceDetected(true);
    const lm = results.multiFaceLandmarks[0];
    drawFaceMesh(ctx, lm, W, H, metricsRef.current.fatigueScore);

    // ── EAR blink detection ──────────────────────────────────────────
    const leftEye  = [33, 160, 158, 133, 153, 144].map((i) => lm[i]);
    const rightEye = [362, 385, 387, 263, 373, 380].map((i) => lm[i]);
    const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;
    const now = Date.now();
    if (ear < 0.20 && now - (blinkTimes.current.at(-1) || 0) > 250) blinkTimes.current.push(now);
    blinkTimes.current = blinkTimes.current.filter((t) => now - t < 60000);
    const blinkRate = blinkTimes.current.length;

    // ── Distance (pinhole camera model) ─────────────────────────────
    // lm[468]=left iris center, lm[473]=right iris center (NORMALIZED 0-1)
    // Multiply by W/H to convert to pixels
    const lp = lm[468], rp = lm[473];
    let ipdPx = 0;
    if (lp && rp) {
      ipdPx = Math.hypot((lp.x - rp.x) * W, (lp.y - rp.y) * H);
      if (ipdPx > 5) lastIpdPxRef.current = ipdPx; // save last valid reading
    }
    const distance = estimateDistance(ipdPx, focalLengthRef.current);

    // ── Brightness from VIDEO (not canvas) ──────────────────────────
    const brightness = estimateBrightness(video);
    setAmbientBrightness(brightness);

    // ── Pupil dilation proxy ─────────────────────────────────────────
    // iris width (lm469→lm471, normalized) / eye vertical opening (lm159→lm145, normalized)
    // typical dilation ratio: 0.15–0.35
    const irisW   = Math.hypot(lm[469].x - lm[471].x, lm[469].y - lm[471].y);
    const eyeOpen = Math.abs(lm[159].y - lm[145].y);
    const dilation = eyeOpen > 0.005 ? irisW / eyeOpen : 0.2;

    // ── Head tilt ────────────────────────────────────────────────────
    const tilt = (Math.atan2(lm[10].x - lm[152].x, lm[10].y - lm[152].y) * 180) / Math.PI;

    // ── Fatigue score ────────────────────────────────────────────────
    const fatigue = calculateFatigue({ blinkRate, distance, tilt, dilation, sessionSeconds: sessionRef.current });
    setMetrics({ blinkRate, pupilDilation: dilation, screenDistance: distance, fatigueScore: fatigue });

    // ── Debug values ─────────────────────────────────────────────────
    setDebugInfo({ ear: ear.toFixed(3), ipdPx: ipdPx.toFixed(1), focalLength: (focalLengthRef.current ?? 457).toFixed(0), irisW: irisW.toFixed(4), eyeOpen: eyeOpen.toFixed(4), dilation: dilation.toFixed(3), tilt: tilt.toFixed(1), brightness: brightness.toFixed(2), distance: distance.toFixed(1), fatigue, blinkRate });

    // ── Distance label on canvas ──────────────────────────────────────
    const dClr = distance < 40 ? "#ef4444" : distance < 50 ? "#f59e0b" : "#10b981";
    ctx.font = "bold 10px Share Tech Mono"; ctx.fillStyle = dClr; ctx.textAlign = "left";
    ctx.shadowColor = dClr; ctx.shadowBlur = 6; ctx.fillText(`${distance.toFixed(0)} cm`, 6, H-6); ctx.shadowBlur = 0;

    // ── VOICE ALERTS (warnings only) ─────────────────────────────────
    if (distance < 40) { speak("Warning! You are too close to the screen. Please move back.", { key: "tooClose", cooldown: 90_000 }); addToast(`⚠ Too close! ${distance.toFixed(0)}cm — move back!`, "danger"); }
    if (blinkRate < 8 && blinkRate > 0 && sessionRef.current > 60) { speak("Your blink rate is very low. Please blink your eyes slowly.", { key: "lowBlink", cooldown: 120_000 }); addToast("👁 Low blink rate — blink more!", "warning"); }
    if (fatigue >= 80) { speak("Critical eye fatigue detected. Please close your eyes and rest.", { key: "critFatigue", cooldown: 180_000 }); addToast("🔴 Critical fatigue! Rest your eyes now.", "danger"); }
  }, [speak, addToast]);

  useEffect(() => {
    if (!isMonitoring) return;
    const faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.55, minTrackingConfidence:0.55 });
    faceMesh.onResults(onResults);
    const camera = new Camera(videoRef.current, {
      onFrame: async () => { if (videoRef.current) await faceMesh.send({ image: videoRef.current }); },
      width: 640, height: 480,
    });
    camera.start().catch(() => { setErrorMsg("Camera access denied. Please allow camera permission and refresh."); setIsMonitoring(false); });
    return () => { camera.stop(); faceMesh.close(); };
  }, [isMonitoring, onResults]);

  useEffect(() => { if (!isMonitoring) return; const t = setInterval(() => setSessionTime((s) => s+1), 1000); return () => clearInterval(t); }, [isMonitoring]);
  useEffect(() => { if (!isMonitoring || sessionTime === 0 || sessionTime % 1200 !== 0) return; speak("20-20-20 break time. Look at something 20 feet away for 20 seconds.", { key:`rule20_${sessionTime}`, cooldown:1000 }); addToast("⏱ 20-20-20 Break! Look 20ft away for 20 seconds.", "warning"); setBreakCountdown(20); }, [sessionTime, isMonitoring, speak, addToast]);
  useEffect(() => { if (!isMonitoring || sessionTime === 0 || sessionTime % 900 !== 0) return; addToast("💧 Hydration reminder — drink some water!", "info"); }, [sessionTime, isMonitoring, addToast]);
  useEffect(() => { if (!isMonitoring || sessionTime === 0 || sessionTime % 3000 !== 0) return; addToast("☕ 50-min mark — take a 5-min proper break!", "info"); }, [sessionTime, isMonitoring, addToast]);
  useEffect(() => { if (breakCountdown === null) return; if (breakCountdown === 0) { setBreakCountdown(null); addToast("✔ Eye break complete!", "success"); return; } const t = setTimeout(() => setBreakCountdown((c) => c-1), 1000); return () => clearTimeout(t); }, [breakCountdown, addToast]);
  useEffect(() => { if (!isMonitoring) return; const t = setInterval(() => { const m = metricsRef.current; const mm = Math.floor(sessionRef.current/60), ss = sessionRef.current%60; setFatigueHistory((p) => [...p.slice(-59), { t:`${mm}:${ss.toString().padStart(2,"0")}`, fatigue:m.fatigueScore, blinks:m.blinkRate }]); }, 5000); return () => clearInterval(t); }, [isMonitoring]);
  useEffect(() => { if (!isMonitoring) return; const t = setInterval(async () => { const a = await getEyeHealthAdvice(metricsRef.current, []); setAiAdvice(a); }, 15000); return () => clearInterval(t); }, [isMonitoring]);

  const handleCalibrate = () => {
    const ipdPx = lastIpdPxRef.current;
    if (ipdPx > 5) {
      const fl = calibrateFocalLength(ipdPx, 60); // assumes user is at 60cm
      setFocalLength(fl); setCalibrated(true);
      addToast(`✔ Calibrated! (sit 60cm away for best accuracy)`, "success");
    } else {
      addToast("⚠ Face not detected — look at camera and try again.", "warning");
    }
  };

  const handleToggle = () => {
    if (isMonitoring) {
      va.stop(); va.cooldowns = {}; resetFatigueSmoothing();
      setSessionTime(0); setFatigueHistory([]); setToasts([]);
      setMetrics({ blinkRate:0, pupilDilation:0, screenDistance:60, fatigueScore:0 });
      setBreakCountdown(null); setFaceDetected(false); setVoiceLog([]); setIsSpeaking(false); setDebugInfo({});
      blinkTimes.current = [];
      canvasRef.current?.getContext("2d")?.clearRect(0,0,640,480);
    }
    setIsMonitoring((m) => !m);
  };

  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const distOk = metrics.screenDistance >= 50 && metrics.screenDistance <= 80;

  return (
    <>
      <div className="bg-grid"/><div className="bg-radial"/>
      <div className="app-scroll">
        <div className="min-h-screen flex flex-col gap-3 p-3 relative z-10">

          {/* HEADER */}
          <header className="glass-card px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-md"/>
                <Eye className="neon-text relative z-10" size={22}/>
                <div className="absolute inset-0 rounded-full spin-slow border border-dashed border-cyan-500/20"/>
              </div>
              <div>
                <h1 className="font-orbitron text-xl font-black neon-text tracking-widest leading-none">OCULARIS AI</h1>
                <p className="font-mono-tech text-xs text-gray-600 tracking-widest mt-0.5">EYE HEALTH MONITOR · v2.2</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="glass px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className={`status-dot ${isMonitoring ? "active" : "inactive"}`}/>
                <span className="font-mono-tech text-xs text-gray-400">{isMonitoring ? "LIVE" : "IDLE"}</span>
                <VoiceWave active={isSpeaking}/>
              </div>
              {isMonitoring && <div className={`glass px-3 py-1.5 rounded-full font-mono-tech text-xs ${faceDetected ? "text-emerald-400" : "text-red-400"}`}>{faceDetected ? "● TRACKING" : "○ NO FACE"}</div>}
              <button onClick={() => setVoiceEnabled((v) => !v)} className={`glass px-2.5 py-1.5 rounded-full transition-all ${voiceEnabled ? "neon-text-sm" : "text-gray-600"}`} aria-label="Toggle voice">
                {voiceEnabled ? <Volume2 size={15}/> : <VolumeX size={15}/>}
              </button>
              <button onClick={handleCalibrate} className={`glass px-2.5 py-1.5 rounded-full transition-all ${calibrated ? "text-emerald-400" : "text-gray-500 hover:text-cyan-400"}`} title="Sit 60cm from screen then click" aria-label="Calibrate distance">
                <RefreshCw size={15}/>
              </button>
              <button onClick={handleToggle} className={`btn-activate px-5 py-2.5 text-xs tracking-widest ${isMonitoring ? "btn-deactivate" : ""}`}>
                {isMonitoring ? "▪ STOP" : "▶ START MONITORING"}
              </button>
            </div>
          </header>

          {/* CALIBRATION HINT */}
          {isMonitoring && !calibrated && faceDetected && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="glass-card px-5 py-2 flex items-center gap-3" style={{ borderColor:"rgba(0,245,255,0.3)" }}>
              <RefreshCw size={14} className="text-cyan-400"/>
              <p className="font-mono-tech text-xs text-cyan-400">For accurate distance: sit <strong>60cm</strong> from your screen, then press the ↺ calibrate button above.</p>
            </motion.div>
          )}

          {/* BREAK COUNTDOWN */}
          <AnimatePresence>
            {breakCountdown !== null && (
              <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="glass-card px-5 py-3 flex items-center justify-between" style={{ borderColor:"rgba(245,158,11,0.4)" }}>
                <div className="flex items-center gap-3">
                  <Timer size={18} className="text-amber-400"/>
                  <div><p className="font-orbitron text-sm text-amber-400 tracking-wider">20-20-20 EYE BREAK</p><p className="font-mono-tech text-xs text-gray-500">Look at something 20 feet away</p></div>
                </div>
                <div className="font-orbitron text-3xl font-black text-amber-400" style={{ textShadow:"0 0 20px #f59e0b80" }}>{breakCountdown}s</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DEBUG PANEL (press D) */}
          {showDebug && (
            <div className="glass-card p-3 font-mono text-xs text-cyan-400 grid grid-cols-4 gap-x-4 gap-y-1" style={{ fontSize:10 }}>
              <span>EAR: {debugInfo.ear}</span><span>IPD px: {debugInfo.ipdPx}</span><span>Focal: {debugInfo.focalLength}px</span><span>Dist: {debugInfo.distance}cm</span>
              <span>irisW: {debugInfo.irisW}</span><span>eyeOpen: {debugInfo.eyeOpen}</span><span>Dilation: {debugInfo.dilation}</span><span>Tilt: {debugInfo.tilt}°</span>
              <span>Brightness: {debugInfo.brightness}</span><span>Blinks: {debugInfo.blinkRate}/min</span><span>Fatigue: {debugInfo.fatigue}%</span><span style={{ color:"#444" }}>Press D to hide</span>
            </div>
          )}

          {/* MAIN GRID */}
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-3">

            {/* LEFT */}
            <div className="flex flex-col gap-3">
              <div className="glass-card overflow-hidden relative" style={{ aspectRatio:"4/3", minHeight:240 }}>
                <div className="corner-bracket corner-tl"/><div className="corner-bracket corner-tr"/>
                <div className="corner-bracket corner-bl"/><div className="corner-bracket corner-br"/>
                {isMonitoring && <div className="scanline"/>}
                <video ref={videoRef} autoPlay muted playsInline style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", opacity: isMonitoring ? 0.88 : 0, transition:"opacity 0.6s ease", background:"#000" }}/>
                <canvas ref={canvasRef} width={640} height={480} style={{ position:"absolute", inset:0, width:"100%", height:"100%", transform:"scaleX(-1)", pointerEvents:"none" }}/>
                {!isMonitoring && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background:"rgba(5,8,16,0.8)" }}>
                    <div className="relative mb-4"><Eye className="text-gray-700" size={52}/><div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 rounded-full border border-dashed border-gray-700 spin-slow"/></div></div>
                    <p className="font-orbitron text-sm text-gray-600 tracking-wider">CAMERA OFFLINE</p>
                    <p className="font-mono-tech text-xs text-gray-700 mt-1">Press START MONITORING</p>
                  </div>
                )}
                {isMonitoring && (
                  <>
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-full backdrop-blur-sm" style={{ background:"rgba(0,0,0,0.75)", border:"1px solid rgba(0,245,255,0.2)" }}>
                      <span className="status-dot active"/><span className="font-mono-tech text-xs neon-text-sm">LIVE</span>
                    </div>
                    <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-full backdrop-blur-sm" style={{ background:"rgba(0,0,0,0.75)" }}>
                      <span className={`font-orbitron text-xs font-bold ${distOk ? "text-emerald-400" : "text-red-400"}`} style={{ textShadow: distOk ? "0 0 8px #10b98160" : "0 0 8px #ef444460" }}>{metrics.screenDistance.toFixed(0)} cm</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between" style={{ background:"linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-tech text-xs text-gray-400">BLINK: <span className="text-cyan-400">{metrics.blinkRate}/min</span></span>
                        <span className={`font-mono-tech text-xs ${faceDetected ? "text-emerald-400" : "text-red-400"}`}>{faceDetected ? "● TRACKING" : "○ SEARCHING"}</span>
                      </div>
                      <span className="font-orbitron text-gray-700" style={{ fontSize:8, letterSpacing:2 }}>OCULARIS·CAM</span>
                    </div>
                    {metrics.screenDistance < 40 && metrics.screenDistance > 0 && (
                      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="absolute inset-x-3 top-14 rounded-xl px-3 py-2 text-center backdrop-blur-sm" style={{ background:"rgba(127,0,0,0.7)", border:"1px solid rgba(239,68,68,0.6)" }}>
                        <p className="font-orbitron text-xs text-red-300 tracking-wider animate-pulse">⚠ TOO CLOSE — MOVE BACK</p>
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mic size={13} className="neon-text-sm"/>
                  <h3 className="font-orbitron text-xs tracking-widest neon-text-sm">VOICE ASSISTANT</h3>
                  <VoiceWave active={isSpeaking}/>
                  <div className="ml-auto"><span className={`font-mono-tech text-xs ${voiceEnabled ? "text-cyan-400" : "text-gray-600"}`}>{voiceEnabled ? "🔊 ALERTS ONLY" : "🔇 OFF"}</span></div>
                </div>
                <p className="font-mono-tech text-gray-600 mb-2" style={{ fontSize:9 }}>Speaks only when: distance &lt;40cm · blinks &lt;8/min · fatigue ≥80%</p>
                <div className="space-y-1.5" style={{ minHeight:64 }}>
                  {voiceLog.length === 0
                    ? <p className="font-mono-tech text-xs text-gray-700 italic">No warnings yet — looking good!</p>
                    : voiceLog.map((msg, i) => <p key={i} className="font-mono-tech text-xs leading-snug" style={{ color: i===0 ? "#67e8f9" : `rgba(200,214,240,${0.25+0.15*(voiceLog.length-i)})` }}>{i===0 ? "▶ " : "  "}{msg}</p>)}
                </div>
              </div>

              <div className="glass-card p-4 flex-1">
                <div className="flex items-center gap-2 mb-3"><Eye size={13} className="text-purple-400"/><h3 className="font-orbitron text-xs tracking-widest text-purple-300">NEURAL COACH</h3></div>
                <div className="border-l-2 border-cyan-500/30 pl-3"><p className="font-mono-tech text-xs text-gray-300 leading-relaxed italic">"{aiAdvice}"</p></div>
              </div>
            </div>

            {/* CENTER */}
            <div className="flex flex-col gap-3">
              <div className="glass-card p-5 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-3 w-full"><Activity size={13} className="text-purple-400"/><h3 className="font-orbitron text-xs tracking-widest text-purple-300">FATIGUE TELEMETRY</h3></div>
                <FatigueGauge value={metrics.fatigueScore}/>
                <div className="w-full mt-4 space-y-2.5">
                  {[
                    { label:"Blink Stability", v:Math.max(0,100-metrics.blinkRate*2.5), c:"#10b981" },
                    { label:"Posture Score", v:distOk?90:25, c:"#f59e0b" },
                    { label:"Strain Index", v:Math.min(100,metrics.fatigueScore*1.1), c:"#a855f7" },
                  ].map(({ label,v,c }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1"><span className="font-mono-tech text-xs text-gray-500">{label}</span><span className="font-mono-tech text-xs font-bold" style={{ color:c }}>{v.toFixed(0)}%</span></div>
                      <div className="h-1 rounded-full bg-white/5"><div className="h-full rounded-full transition-all duration-700" style={{ width:`${v}%`, background:c, boxShadow:`0 0 4px ${c}50` }}/></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-4 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><Activity size={13} className="neon-text-sm"/><h3 className="font-orbitron text-xs tracking-widest neon-text-sm">FATIGUE HISTORY</h3></div>
                  <div className="flex gap-3 font-mono-tech text-gray-500" style={{ fontSize:10 }}>
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-px bg-cyan-400"/>Fatigue</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-px bg-purple-400"/>Blinks</span>
                  </div>
                </div>
                {fatigueHistory.length > 1 ? <FatigueChart data={fatigueHistory}/> : <div className="flex items-center justify-center h-36 font-mono-tech text-xs text-gray-600">{isMonitoring ? "Collecting data..." : "Start monitoring to see chart"}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Blink Rate" value={metrics.blinkRate} unit="bpm" color={metrics.blinkRate < 10 && isMonitoring ? "text-red-400" : "text-cyan-400"} borderColor="#00f5ff" icon={<Activity size={13}/>} warning={metrics.blinkRate < 10 && isMonitoring} pct={(metrics.blinkRate/20)*100}/>
                <MetricCard label="Pupil Load" value={(metrics.pupilDilation*10).toFixed(1)} unit="/10" color="text-purple-400" borderColor="#a855f7" icon={<Zap size={13}/>} pct={Math.min(100, metrics.pupilDilation*300)}/>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Distance" value={metrics.screenDistance.toFixed(0)} unit="cm" color={!distOk && isMonitoring ? "text-red-400" : "text-emerald-400"} borderColor="#10b981" icon={<Maximize2 size={13}/>} warning={!distOk && isMonitoring} pct={Math.min(100,(metrics.screenDistance/80)*100)}/>
                <MetricCard label="Session" value={fmt(sessionTime)} unit="" color="text-orange-400" borderColor="#f97316" icon={<Clock size={13}/>}/>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3"><Zap size={13} className="text-amber-400"/><h3 className="font-orbitron text-xs tracking-widest text-amber-300">SYSTEM STATUS</h3></div>
                <div className="space-y-1.5">
                  {[
                    { label:"FaceMesh Engine", ok:isMonitoring, val:isMonitoring?"ONLINE":"STANDBY" },
                    { label:"Face Tracking",   ok:faceDetected, val:faceDetected?"LOCKED":"SEARCHING" },
                    { label:"Voice Assistant", ok:voiceEnabled, val:voiceEnabled?"ALERTS ONLY":"MUTED" },
                    { label:"Distance Model",  ok:calibrated,   val:calibrated?"CALIBRATED":"DEFAULT 60cm" },
                    { label:"Ambient Light",   ok:true, val:ambientBrightness>0.6?"BRIGHT":ambientBrightness>0.3?"NORMAL":"DIM" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                      <span className="font-mono-tech text-xs text-gray-500">{s.label}</span>
                      <span className={`font-orbitron text-xs font-bold ${s.ok ? "text-emerald-400" : "text-gray-600"}`} style={s.ok ? { textShadow:"0 0 8px #10b98155" } : {}}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3"><Clock size={13} className="text-orange-400"/><h3 className="font-orbitron text-xs tracking-widest text-orange-300">SESSION ANALYTICS</h3></div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label:"Total Blinks", value:blinkTimes.current.length },
                    { label:"Avg Fatigue",  value:fatigueHistory.length ? Math.round(fatigueHistory.reduce((a,b)=>a+b.fatigue,0)/fatigueHistory.length)+"%" : "—" },
                    { label:"Peak Fatigue", value:fatigueHistory.length ? Math.max(...fatigueHistory.map((d)=>d.fatigue))+"%" : "—" },
                    { label:"Eye Breaks",   value:Math.floor(sessionTime/1200) },
                  ].map((s) => (
                    <div key={s.label} className="glass rounded-xl p-2.5 text-center">
                      <p className="font-orbitron text-gray-600 mb-0.5" style={{ fontSize:8, letterSpacing:1 }}>{s.label}</p>
                      <p className="number-ticker text-lg font-bold neon-text-sm">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-4 flex-1">
                <div className="flex items-center gap-2 mb-3"><Droplets size={13} className="text-cyan-400"/><h3 className="font-orbitron text-xs tracking-widest neon-text-sm">EYE HEALTH TIPS</h3></div>
                <div className="space-y-2">
                  {[
                    { icon:"👁", tip:"20-20-20 Rule",    sub:"Every 20 min, look 20ft away for 20s" },
                    { icon:"💧", tip:"Stay Hydrated",    sub:"Drink water every 15 minutes" },
                    { icon:"📏", tip:"Optimal Distance", sub:"Keep screen 50–80 cm away" },
                    { icon:"☕", tip:"Take Breaks",      sub:"Rest 5 min every 50 minutes" },
                    { icon:"👁️", tip:"Blink Often",      sub:"15-20 blinks per minute is healthy" },
                  ].map(({ icon,tip,sub }) => (
                    <div key={tip} className="flex items-start gap-2.5 py-1.5 border-b border-white/[0.04]">
                      <span className="text-sm mt-0.5">{icon}</span>
                      <div><p className="font-orbitron text-gray-300" style={{ fontSize:9, letterSpacing:1 }}>{tip}</p><p className="font-mono-tech text-gray-600" style={{ fontSize:9 }}>{sub}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between px-1">
            <p className="font-mono-tech text-xs text-gray-700">OCULARIS AI · BIOMETRIC EYE MONITOR · V2.2</p>
            <div className="flex items-center gap-4 text-xs font-mono-tech text-gray-700">
              <span>EAR: 0.20</span><span>FL: {focalLength ? focalLength.toFixed(0) : "457(default)"}px</span><span>RES: 640×480</span><span style={{ color:"#333" }}>D=debug</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-xs w-full" aria-live="polite">
        <AnimatePresence>{toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))}/>)}</AnimatePresence>
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-3 font-mono-tech text-xs flex items-center gap-3 z-50 rounded-xl" style={{ borderColor:"rgba(239,68,68,0.4)", background:"rgba(127,0,0,0.2)", color:"#fca5a5" }}>
            <AlertTriangle size={14}/>{errorMsg}<button onClick={() => setErrorMsg(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
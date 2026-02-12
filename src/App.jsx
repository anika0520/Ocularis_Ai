import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye,
  Activity,
  Zap,
  Clock,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

import MetricCard from "./components/MetricCard";
import { getEyeHealthAdvice } from "./services/geminiService";
import { getEAR } from "./utils/blinkUtils";
import { estimateDistance } from "./utils/distanceUtils";
import { calculateFatigue } from "./utils/fatigueScore";
import { estimateBrightness } from "./utils/lightUtils";

const BreakType = { NONE: "NONE", MICRO: "MICRO" };

export default function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [metrics, setMetrics] = useState({
    blinkRate: 0,
    pupilDilation: 0,
    screenDistance: 60,
    fatigueScore: 0,
  });

  const [aiAdvice, setAiAdvice] = useState("Initializing Ocularis AI...");
  const [errorMsg, setErrorMsg] = useState(null);
  const [ambientBrightness, setAmbientBrightness] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [latency, setLatency] = useState(12); // fake for style

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const blinkTimes = useRef([]);
  const historyRef = useRef([]);

  // ────────────────────────────────────────────────
  //  Face landmark processing (same logic, just cleaner)
  // ────────────────────────────────────────────────
  const onResults = useCallback((results) => {
    if (!results?.multiFaceLandmarks?.length) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const landmarks = results.multiFaceLandmarks[0];
    ctx.clearRect(0, 0, 640, 480);

    const leftEye = [33, 160, 158, 133, 153, 144].map((i) => landmarks[i]);
    const rightEye = [362, 385, 387, 263, 373, 380].map((i) => landmarks[i]);

    const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;

    const now = Date.now();
    if (ear < 0.22 && now - (blinkTimes.current.at(-1) || 0) > 300) {
      blinkTimes.current.push(now);
      blinkTimes.current = blinkTimes.current.filter((t) => now - t < 60000);
    }

    const blinkRate = blinkTimes.current.length;

    const lp = landmarks[468],
      rp = landmarks[473];
    const ipd = lp && rp ? Math.hypot(lp.x - rp.x, lp.y - rp.y) * 640 : 0;
    const distance = estimateDistance(62, ipd); // average IPD ~62mm

    const brightness = estimateBrightness(ctx);
    setAmbientBrightness(brightness);

    const irisSize = Math.hypot(
      landmarks[469].x - landmarks[471].x,
      landmarks[469].y - landmarks[471].y,
    );
    const eyeOpen = Math.abs(landmarks[159].y - landmarks[145].y) || 0.01;
    const dilation = (irisSize / eyeOpen) * (1 + brightness - 0.5);

    const tilt =
      (Math.atan2(
        landmarks[10].x - landmarks[152].x,
        landmarks[10].y - landmarks[152].y,
      ) *
        180) /
      Math.PI;

    const fatigue = calculateFatigue({ blinkRate, distance, tilt, dilation });

    const newMetrics = {
      blinkRate,
      pupilDilation: dilation,
      screenDistance: distance,
      fatigueScore: fatigue,
    };
    setMetrics(newMetrics);

    historyRef.current.push({ ...newMetrics, time: now });
    historyRef.current = historyRef.current.slice(-200);
  }, []);

  // Camera setup
  useEffect(() => {
    if (!isMonitoring) return;

    const faceMesh = new FaceMesh({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await faceMesh.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    camera.start().catch(() => {
      setErrorMsg("Camera access denied");
      setIsMonitoring(false);
    });

    return () => {
      camera.stop();
      faceMesh.close();
    };
  }, [isMonitoring, onResults]);

  // Session timer
  useEffect(() => {
    if (!isMonitoring) return;
    const t = setInterval(() => setSessionTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isMonitoring]);

  // AI advice
  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(async () => {
      const advice = await getEyeHealthAdvice(metrics, historyRef.current);
      setAiAdvice(advice);
    }, 12000);
    return () => clearInterval(interval);
  }, [isMonitoring, metrics]);

  const toggleMonitoring = () => setIsMonitoring((prev) => !prev);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-mono">
      {/* Header / Title Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#00ff9d20] bg-black/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Eye className="text-[#00ff9d] w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight neon-text">
              OCULARIS AI
            </h1>
            <p className="text-xs text-[#00ff9d80]">
              V2.1 STABLE • BIO-METRIC MONITORING SUITE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="latency-badge">LATENCY: {latency} ms</div>

          <motion.button
            onClick={toggleMonitoring}
            className={`px-8 py-3 rounded-full font-bold text-lg transition-all duration-300 shadow-lg
              ${
                isMonitoring
                  ? "bg-red-600/80 hover:bg-red-700 border-red-400/30"
                  : "bg-[#00ff9d] text-black hover:bg-[#00ff9dc0] pulse-button"
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            {isMonitoring ? "DEACTIVATE" : "ACTIVATE VISION"}
          </motion.button>

          <Settings className="w-6 h-6 text-[#00ff9d80] hover:text-[#00ff9d] cursor-pointer" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
        {/* Left Column - Control & Status */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* Engine Standby Card */}
          <div className="glow-card p-6 flex flex-col items-center justify-center text-center h-64">
            <Eye className="w-16 h-16 text-[#00ff9d] mb-4" />
            <h2 className="text-xl font-bold neon-text mb-2">
              {isMonitoring ? "VISION ACTIVE" : "ENGINE STANDBY"}
            </h2>
            <p className="text-sm text-[#94a3b8] mb-6">
              Click ACTIVATE VISION to launch eye-tracking suite
            </p>
            {!isMonitoring && (
              <div className="text-xs text-[#00ff9d80] italic">
                Neural Coach Feed initializing...
              </div>
            )}
          </div>

          {/* Bottom-left small metrics */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="BLINK RATE"
              value={metrics.blinkRate}
              unit="BPM"
              color="text-[#00ff9d]"
              icon={<Activity size={18} />}
            />
            <MetricCard
              label="LOAD INDEX"
              value={(metrics.pupilDilation * 10).toFixed(1)}
              unit="pu"
              color="text-cyan-400"
              icon={<Zap size={18} />}
            />
          </div>

          <div className="glow-card p-5 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#94a3b8]">Iris Refinement</span>
              <span className="text-[#00ff9d]">Sub-mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94a3b8]">Flux Compensation</span>
              <span className="text-[#00ff9d]">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94a3b8]">Processing Mode</span>
              <span className="text-[#00ff9d]">Device-Only</span>
            </div>
          </div>
        </div>

        {/* Center - Main Video + Telemetry */}
        <div className="lg:col-span-6 flex flex-col gap-5">
          <div className="glow-card overflow-hidden relative h-[480px]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full"
            />

            {isMonitoring && (
              <div className="absolute bottom-4 left-4 bg-black/60 px-4 py-2 rounded-full text-sm flex items-center gap-2">
                <span className="status-dot ready" />
                LIVE • {metrics.screenDistance.toFixed(0)} cm
              </div>
            )}

            <div className="absolute top-4 right-4 latency-badge">
              REAL-TIME BIO-STREAM HUB
            </div>
          </div>

          {/* Advice / Neural Coach */}
          <div className="glow-card p-6">
            <h3 className="text-lg font-semibold neon-text mb-3">
              NEURAL COACH FEED
            </h3>
            <p className="text-[#e2e8f0] leading-relaxed italic">{aiAdvice}</p>
          </div>
        </div>

        {/* Right Column - Small panels */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* Fatigue Telemetry Card */}
          <div className="glow-card p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold neon-text">FATIGUE TELEMETRY</h3>
              <div className="latency-badge">LATENCY: {latency} ms</div>
            </div>

            <div className="space-y-4 mt-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Fatigue Delta</span>
                  <span>{metrics.fatigueScore}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00ff9d] to-cyan-500"
                    style={{ width: `${metrics.fatigueScore}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Blink Stability</span>
                  <span>{Math.round(100 - metrics.blinkRate * 2)}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${100 - metrics.blinkRate * 2}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Screen Lock Risk</span>
                  <span>LOW</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-1/5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="border-t border-[#00ff9d20] bg-black/70 backdrop-blur-md py-3 px-6 text-sm flex justify-between items-center">
        <div className="flex items-center gap-6">
          <span>
            <span className="status-dot ready" /> BIOMETRIC READY
          </span>
          <span>
            <span className="status-dot ready" /> GENAI CONNECTED
          </span>
          <span>
            <span className="status-dot ready" /> STABLE REL. 2.1.0
          </span>
        </div>
        <div className="text-[#00ff9d80] flex items-center gap-4">
          <span>DEVICE-ONLY PROCESSING</span>
          <span>PRIVACY POLICY</span>
          <span>© 2025 OCULARIS AI</span>
        </div>
      </footer>

      {errorMsg && (
        <div className="fixed bottom-20 right-8 bg-red-900/80 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
          <AlertTriangle /> {errorMsg}
        </div>
      )}
    </div>
  );
}

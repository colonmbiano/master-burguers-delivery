// GPSTracker.tsx — Componente de tracking nativo con Capacitor
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";
import { Geolocation } from '@capacitor/geolocation';

const TRACK_INTERVAL = 60000; // 1 minuto

interface Props {
  driverId: string;
  activeOrderId?: string;
  onRouteStart?: () => void;
  onRouteEnd?: () => void;
}

export default function GPSTracker({ driverId, activeOrderId, onRouteStart, onRouteEnd }: Props) {
  const [tracking, setTracking]       = useState(false);
  const [distFromOrigin, setDistFromOrigin] = useState<number|null>(null);
  const [accuracy, setAccuracy]       = useState<number|null>(null);
  const [permDenied, setPermDenied]   = useState(false);
  const [pointsSent, setPointsSent]   = useState(0);

  const watchIdRef = useRef<string|null>(null);
  const timerRef   = useRef<any>(null);

  const startRoute = useCallback(async (lat: number, lng: number, trigger = "MANUAL") => {
    try {
      await api.post(`/api/gps/${driverId}/route/start`, {
        lat, lng, orderId: activeOrderId || null, trigger
      });
      setTracking(true);
      onRouteStart?.();
    } catch (err) {
      console.error("Error al iniciar ruta", err);
    }
  }, [driverId, activeOrderId, onRouteStart]);

  const sendLocation = useCallback(async (lat: number, lng: number, acc: number, speed: number|null, heading: number|null) => {
    setAccuracy(Math.round(acc));
    try {
      const { data } = await api.post(`/api/gps/${driverId}/location`, {
        lat, lng, accuracy: acc, speed, heading, orderId: activeOrderId || null
      });
      setDistFromOrigin(data.distFromOrigin);
      setPointsSent(p => p + 1);
    } catch (err) {
      console.error("Error enviando ubicación", err);
    }
  }, [driverId, activeOrderId]);

  const startWatching = useCallback(async () => {
    // 1. Pedir permisos nativos
    const permission = await Geolocation.requestPermissions();
    if (permission.location !== 'granted') {
      setPermDenied(true);
      return;
    }

    // 2. Iniciar watch continuo (más preciso para el sistema)
    watchIdRef.current = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      (pos) => {
        if (pos) {
          sendLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            pos.coords.speed,
            pos.coords.heading
          );
        }
      }
    );

    // 3. También un timer de respaldo cada minuto
    timerRef.current = setInterval(async () => {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      sendLocation(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.accuracy,
        pos.coords.speed,
        pos.coords.heading
      );
    }, TRACK_INTERVAL);

  }, [sendLocation]);

  async function handleStartTracking() {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      await startRoute(pos.coords.latitude, pos.coords.longitude, "MANUAL");
      await startWatching();
    } catch (e) {
      setPermDenied(true);
    }
  }

  async function handleStopTracking() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current) Geolocation.clearWatch({ id: watchIdRef.current });

    try { await api.post(`/api/gps/${driverId}/route/end`); } catch {}
    setTracking(false); setPointsSent(0);
    onRouteEnd?.();
  }

  // Auto-iniciar cuando se asigna un pedido
  useEffect(() => {
    if (activeOrderId && !tracking) {
      Geolocation.getCurrentPosition({ enableHighAccuracy: true }).then(async (pos) => {
        await startRoute(pos.coords.latitude, pos.coords.longitude, "ORDER_ASSIGNED");
        await startWatching();
      }).catch(() => {});
    }
  }, [activeOrderId, tracking, startRoute, startWatching]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current) Geolocation.clearWatch({ id: watchIdRef.current });
    };
  }, []);

  if (permDenied) return (
    <div className="mx-5 mb-3 px-4 py-3 rounded-xl text-xs"
      style={{background:"rgba(239,68,68,0.1)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)"}}>
      ⚠️ Permiso de ubicación denegado. Por favor, actívalo en los ajustes de la aplicación en Android.
    </div>
  );

  return (
    <div className="mx-5 mb-3">
      {tracking ? (
        <div className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)"}}>
          <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{background:"#22c55e"}} />
          <div className="flex-1">
            <div className="text-xs font-bold" style={{color:"#22c55e"}}>GPS Activo (Nativo) · {pointsSent} pts</div>
            {distFromOrigin !== null && (
              <div className="text-xs" style={{color:"#22c55e"}}>{distFromOrigin}m del local · ±{accuracy}m</div>
            )}
          </div>
          <button onClick={handleStopTracking}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
            style={{background:"rgba(239,68,68,0.15)",color:"#ef4444"}}>
            ⏹ Detener
          </button>
        </div>
      ) : (
        <button onClick={handleStartTracking}
          className="w-full px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)"}}>
          📍 Activar Rastreo GPS Nativo
        </button>
      )}
    </div>
  );
}

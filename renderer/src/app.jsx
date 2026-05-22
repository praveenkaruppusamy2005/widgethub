import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import headphonesImg from "./assets/headphones.png";

// Precalculated SVG path for 12-lobed scallop clock face (size 200, r0=85, amp=13)
const SCALLOP_PATH = (() => {
  const size = 200;
  const lobes = 12;
  const r0 = 93;
  const amp = 3;
  const center = size / 2;
  const points = [];
  const totalPoints = lobes * 8; // 96 points
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / totalPoints) * 2 * Math.PI;
    const r = r0 + amp * Math.cos(lobes * angle);
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  points.push('Z');
  return points.join(' ');
})();

// --- IPC Utilities ---
const isElectron = typeof window !== "undefined" && window.electronAPI !== undefined;

function minimizeWindow() {
  if (isElectron) window.electronAPI.minimizeWindow();
}

function maximizeWindow() {
  if (isElectron) window.electronAPI.maximizeWindow();
}

function closeWindow() {
  if (isElectron) window.electronAPI.closeWindow();
}

function spawnWidget(type) {
  if (isElectron) window.electronAPI.spawnWidget(type);
}

// --- Synthesized Flip Sound ---
function playMechanicalFlipSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Low frequency thump for cardboard/plastic rotation
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);

    // High-pitched plastic click for the card landing on the stopper
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(2200, audioCtx.currentTime);
    clickOsc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.02);
    clickGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickOsc.start();
    clickOsc.stop(audioCtx.currentTime + 0.03);
  } catch (e) {
    console.warn("Failed to play synthesized click: ", e);
  }
}

// --- Flip Card Component ---
function FlipCard({ value, soundEnabled }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [nextValue, setNextValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (value !== displayValue) {
      setNextValue(value);
      setIsFlipping(true);

      if (soundEnabled) {
        playMechanicalFlipSound();
      }

      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsFlipping(false);
      }, 450); // Slightly less than 500ms to align with transition

      return () => clearTimeout(timer);
    }
  }, [value, displayValue, soundEnabled]);

  return (
    <div className="flip-card-container">
      {/* Top Half static: displays next value when flipping */}
      <div className="flip-card-half top">
        <span>{isFlipping ? nextValue : displayValue}</span>
      </div>

      {/* Bottom Half static: displays current value when flipping */}
      <div className="flip-card-half bottom">
        <span>{isFlipping ? displayValue : nextValue}</span>
      </div>

      {/* Top Half folding down */}
      {isFlipping && (
        <div className="flip-card-half top flip-animate">
          <span>{displayValue}</span>
        </div>
      )}

      {/* Bottom Half folding down */}
      {isFlipping && (
        <div className="flip-card-half bottom flip-animate">
          <span>{nextValue}</span>
        </div>
      )}

      {/* Notch line divider */}
      <div className="flip-card-divider"></div>
    </div>
  );
}

// --- Standalone Battery Widgets ---
function BatteryCircleWidget() {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  return (
    <div className="widget-window-container">
      <div className="battery-widget-body circle">
        <div className="widget-overlay-controls center-top">
          <button
            className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handlePinToggle}
            title={isPinned ? 'Unpin widget' : 'Pin widget (Always on top)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <DotMatrixBattery shape="circle" width={160} height={160} />
      </div>
    </div>
  );
}

// (Removed Square widget per user request)

// --- Main App / Router ---
function useLiveTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours24 = time.getHours();
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  const minutes = time.getMinutes().toString().padStart(2, "0");

  const seconds = time.getSeconds();
  const mins = time.getMinutes();
  const hrs = time.getHours();

  const secondDegrees = seconds * 6;
  const minuteDegrees = mins * 6 + seconds * 0.1;
  const hourDegrees = (hrs % 12) * 30 + mins * 0.5;

  return {
    hour: hours12.toString(),
    minute: minutes,
    ampm,
    secondDegrees,
    minuteDegrees,
    hourDegrees
  };
}

// --- App Titlebar (Main Window Controls) ---
function Titlebar({ title = "Widget Hub" }) {
  return (
    <div className="titlebar">
      <div className="titlebar-logo">
        <div className="wh-logo-container" style={{ transform: 'scale(0.4)', margin: '-10px -5px -10px -10px' }}>
          <div className="wh-logo-pill"></div>
          <div className="wh-logo-text">
            <span>W</span>
            <span>h</span>
            <span className="wh-logo-dot">.</span>
          </div>
        </div>
        <span>{title}</span>
      </div>
      <div className="titlebar-drag-spacer"></div>
      <div className="titlebar-controls">
        <button className="control-btn" onClick={minimizeWindow} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button className="control-btn" onClick={maximizeWindow} title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button className="control-btn close" onClick={closeWindow} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- Custom Bluetooth Status Hook ---
function useBluetoothStatus(enabled = true) {
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectedBattery, setConnectedBattery] = useState(null);
  const [lastPairedDevice, setLastPairedDevice] = useState(null);

  const updateBluetoothStatus = async () => {
    if (!enabled) return;
    if (isElectron) {
      try {
        const list = await window.electronAPI.getBluetoothDevices();
        const active = list.find(d => d.connected);
        if (active) {
          setConnectedDevice(active.name);
          setConnectedBattery(active.batteryLevel);
        } else {
          setConnectedDevice(null);
          setConnectedBattery(null);
          if (list.length > 0) {
            setLastPairedDevice(list[0].name);
          } else {
            setLastPairedDevice(null);
          }
        }
      } catch (err) {
        console.error("Error in updateBluetoothStatus:", err);
      }
    } else {
      // Mock for development / browser preview
      setConnectedDevice("Sony WH-1000XM4");
      setConnectedBattery(95);
    }
  };

  useEffect(() => {
    if (!enabled) {
      // Static details for Dashboard preview card without scanning
      setConnectedDevice("Sony WH-1000XM4");
      setConnectedBattery(95);
      setLastPairedDevice("Sony WH-1000XM4");
      return;
    }
    let timerId;
    const poll = async () => {
      try {
        await updateBluetoothStatus();
      } finally {
        timerId = setTimeout(poll, 10000);
      }
    };
    poll();
    return () => clearTimeout(timerId);
  }, [enabled]);

  return { connectedDevice, connectedBattery, lastPairedDevice };
}

// --- Standalone Date/Calendar Widget View ---
function DateWidget() {
  const { hour, minute } = useLiveTime();
  const { status, weatherData } = useWeather();
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("calendar-theme") || "light");

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("calendar-theme", newTheme);
  };

  const now = new Date();
  const dayStr = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });

  const { icon } = (weatherData && status === 'success')
    ? getWeatherInfo(weatherData.code, weatherData.isDay)
    : { icon: 'cloud' };

  return (
    <div className="widget-window-container">
      <div className={`calendar-widget-body ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <div className="widget-overlay-controls" style={{ top: '8px' }}>
          <button
            className="overlay-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <button
            className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handlePinToggle}
            title={isPinned ? 'Unpin widget' : 'Pin widget (Always on top)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="calendar-top-row">
          <div className="calendar-time-block">
            <svg className="calendar-alarm-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9281c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8"></circle>
              <polyline points="12 9 12 13 14 15"></polyline>
              <path d="M5 3L2 6"></path>
              <path d="M19 3l3 3"></path>
            </svg>
            <span className="calendar-time">{hour}:{minute}</span>
          </div>
          <div className="calendar-weather-block">
            {status === 'success' && <WeatherDotIcon iconKey={icon} size={48} color="#d9281c" />}
          </div>
        </div>

        <div className="calendar-center">
          <DotMatrixText text={dayStr} height={50} color="var(--calendar-text-color)" />
          <div className="calendar-date-text">{dateStr}</div>
        </div>
      </div>
      <div className="drag-indicator-text" style={{ bottom: '-15px' }}>Hold Widget To Drag</div>
    </div>
  );
}

// --- Standalone Spotify Widget View ---
function SpotifyWidget() {
  const { media, interpolatedPosition } = useLiveMedia(true);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = (e) => {
    e.stopPropagation();
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (isElectron) window.electronAPI.controlMedia("playpause");
  };
  const handlePrev = (e) => {
    e.stopPropagation();
    if (isElectron) window.electronAPI.controlMedia("previous");
  };
  const handleNext = (e) => {
    e.stopPropagation();
    if (isElectron) window.electronAPI.controlMedia("next");
  };

  const handleOpenApp = () => {
    if (isElectron && sourceApp) {
      window.electronAPI.openApp(sourceApp);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isPlaying = media ? media.PlaybackStatus === 'Playing' : false;
  const track = media ? media.Title : '';
  const artist = media ? media.Artist : '';
  const artwork = media && media.Thumbnail ? `data:image/jpeg;base64,${media.Thumbnail}` : '';
  const progress = interpolatedPosition || 0;
  const end = media && media.EndTime ? media.EndTime : 0;
  const sourceApp = media ? media.SourceAppId : '';
  const progressPct = end > 0 ? (progress / end) * 100 : 0;

  return (
    <div className="widget-window-container">
      <div className="spotify-widget-body" onClick={handleOpenApp} style={{ cursor: 'pointer' }}>
        <div className="widget-overlay-controls">
          <button
            className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handlePinToggle}
            title={isPinned ? 'Unpin widget' : 'Pin widget (Always on top)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Top App Logo */}
        <div className="spotify-app-logo-row">
          {getSourceIcon(sourceApp)}
          <span className="spotify-app-name">
            {sourceApp && sourceApp.toLowerCase().includes('spotify') ? 'Spotify' : (sourceApp || 'Music')}
          </span>
        </div>

        <div className="spotify-content-row">
          <div className="spotify-art-container">
            <img src={artwork || "https://images.unsplash.com/photo-1619983081563-430f63602796?w=200&h=200&fit=crop"} alt="Album Art" className="spotify-large-art" />

            <div className="spotify-hover-controls">
              <button className="spotify-ctrl-btn" onClick={handlePrev} title="Previous">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
              </button>
              <button className="spotify-play-btn" onClick={handlePlayPause} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                )}
              </button>
              <button className="spotify-ctrl-btn" onClick={handleNext} title="Next">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
              </button>
            </div>
          </div>

          <div className="spotify-track-details">
            <div className={`spotify-large-title ${(track || "Gimme shelter").length > 15 ? 'marquee' : ''}`}>
              <span>{track || "Gimme shelter"}</span>
            </div>
            <div className={`spotify-large-artist ${(artist || "The Rolling Stones").length > 20 ? 'marquee' : ''}`}>
              <span>{artist || "The Rolling Stones"}</span>
            </div>

            <div className="spotify-progress-container">
              <div className="spotify-time-row">
                <span>{formatTime(progress || 154)}</span>
                <span>{formatTime(end || 260)}</span>
              </div>
              <div className="spotify-progress-bar-large">
                <div className="spotify-progress-fill-large" style={{ width: `${progressPct || 59}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Dashboard Component (The app hub) ---
function Dashboard() {
  const { hour, minute, ampm, secondDegrees, minuteDegrees, hourDegrees } = useLiveTime();
  const { connectedDevice, connectedBattery, lastPairedDevice } = useBluetoothStatus(false);

  return (
    <div className="app-container">
      <Titlebar />
      <div className="dashboard-content">
        <div className="dashboard-hero" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="wh-logo-container" style={{ marginBottom: '20px', transform: 'scale(1.5)' }}>
            <div className="wh-logo-pill"></div>
            <div className="wh-logo-text">
              <span>W</span>
              <span>h</span>
              <span className="wh-logo-dot">.</span>
            </div>
          </div>
          <h1 className="dashboard-title">Widget Hub</h1>
          <p className="dashboard-subtitle">Select and pin beautiful interactive widgets to your Windows desktop</p>
        </div>

        <div className="widgets-grid">
          {/* Horolize Clock Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.7)', transformOrigin: 'center', width: '240px', height: '280px', pointerEvents: 'none' }}>
                <div className="horolize-widget-body" style={{ cursor: 'default', boxShadow: 'none' }}>
                  <div className="clock-recessed-display">
                    <FlipCard value={hour} soundEnabled={false} />
                    <FlipCard value={minute} soundEnabled={false} />
                  </div>
                  <div className="widget-bottom-row">
                    <div className="speaker-grill-container">
                      <div className="speaker-icon-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                      </div>
                      <div className="speaker-grill">
                        {Array.from({ length: 32 }).map((_, i) => (
                          <div key={i} className="speaker-hole"></div>
                        ))}
                      </div>
                    </div>
                    <div className="ampm-indicator">
                      <div className="ampm-track">
                        <div className={`ampm-slider ${ampm.toLowerCase()}`} />
                        <span className={`ampm-label ${ampm === "AM" ? "active" : ""}`}>AM</span>
                        <span className={`ampm-label ${ampm === "PM" ? "active" : ""}`}>PM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Horolize</h3>
              <p className="widget-desc">A premium skeuomorphic flip clock desktop widget with realistic flip physics, sound feedback, speaker styling, and AM/PM needle indicator.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("horolize")}>
              Add to Desktop
            </button>
          </div>

          {/* Bloom Analog Clock Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.7)', transformOrigin: 'center', width: '240px', height: '240px', pointerEvents: 'none' }}>
                <div className="bloom-widget-body" style={{ cursor: 'default', boxShadow: 'none' }}>
                  <div className="scallop-face">
                    <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: 0, left: 0 }}>
                      <path d={SCALLOP_PATH} fill="#121214" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.5" />
                    </svg>
                    <div className="clock-hands-container">
                      <div
                        className="hand hour"
                        style={{ transform: `rotate(${hourDegrees}deg)` }}
                      ></div>
                      <div
                        className="hand minute"
                        style={{ transform: `rotate(${minuteDegrees}deg)` }}
                      ></div>
                      <div
                        className="second-dot-container"
                        style={{ transform: `rotate(${secondDegrees}deg)` }}
                      >
                        <div className="second-dot"></div>
                      </div>
                      <div className="center-pivot-cap"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Bloom</h3>
              <p className="widget-desc">An elegant scalloped analog clock desktop widget styled in modern Android 12 design, featuring thick solid hour hands, outlined capsule minute hands, and a rotating red second indicator dot.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("bloom")}>
              Add to Desktop
            </button>
          </div>

          {/* AirBuds Bluetooth Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.7)', transformOrigin: 'center', width: '260px', height: '290px', pointerEvents: 'none' }}>
                <div className="buds-widget-body" style={{ cursor: 'default', boxShadow: 'none' }}>
                  <div className="buds-face">
                    <div className="buds-top-pane">
                      <HeadphonesImage connected={!!connectedDevice} />
                    </div>
                    <div className="buds-bottom-pane">
                      <div className={`buds-status-label ${connectedDevice ? 'connected' : ''}`}>
                        {connectedDevice ? "CONNECTED" : "DISCONNECTED"}
                      </div>
                      <div className="buds-status-dots">
                        <span className={`status-dot ${connectedDevice ? 'connected' : ''}`}></span>
                        <span className={`status-dot ${connectedDevice ? 'connected' : ''}`}></span>
                        <span className={`status-dot ${connectedDevice ? 'connected' : ''}`}></span>
                      </div>
                      <div className={`buds-device-name ${!connectedDevice ? 'disconnected' : ''}`}>
                        {connectedDevice ? connectedDevice : "Not Connected"}
                      </div>
                      {connectedDevice && connectedBattery !== null && (
                        <div className="buds-battery-container">
                          <svg className="battery-icon" width="22" height="12" viewBox="0 0 24 14" fill="none">
                            <rect x="1" y="1" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                            <path d="M21 4.5V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <rect x="3.5" y="3.5" width={Math.round((connectedBattery / 100) * 13)} height="7" rx="1" fill={getBatteryColor(connectedBattery)} />
                          </svg>
                          <span className="battery-text" style={{ color: getBatteryColor(connectedBattery) }}>
                            {connectedBattery}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">AirBuds</h3>
              <p className="widget-desc">A squircle desktop widget displaying currently connected Bluetooth earbuds or audio devices with status indicators and real-time PnP device detection.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("buds")}>
              Add to Desktop
            </button>
          </div>

          {/* Media Player Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.68)', transformOrigin: 'center', width: '340px', height: '190px', pointerEvents: 'none' }}>
                <div className="media-widget-body" style={{ cursor: 'default', boxShadow: 'none' }}>
                  <div className="media-face" style={{ background: "linear-gradient(135deg, #f72585 0%, #7209b7 100%)" }}>
                    <div className="buds-media-container">
                      <div className="buds-media-top">
                        <div className="media-source-logo" style={{ color: '#1db954' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.076-.67-.135-.747-.472-.077-.336.136-.67.472-.747 3.855-.88 7.15-.505 9.822 1.13.295.18.387.563.206.864zm1.225-2.72c-.227.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.667-1.11 8.24-.567 11.344 1.344.367.226.488.707.26 1.07zm.106-2.833C14.384 8.71 8.445 8.514 5.01 9.557c-.528.16-1.084-.14-1.244-.668-.16-.527.143-1.083.67-1.243 3.978-1.207 10.536-.98 14.61 1.438.476.283.63.897.347 1.373-.284.477-.898.632-1.375.35z" />
                          </svg>
                        </div>
                        <div className="media-device-pill">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}>
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                          </svg>
                          Sony WH-1000XM4
                        </div>
                      </div>

                      <div className="buds-media-middle">
                        <div className="media-track-info">
                          <div className="media-track-title">Man is an Artist</div>
                          <div className="media-track-artist">Billie Eilish</div>
                        </div>
                        <button className="media-play-btn">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="5.5" y="4" width="4.5" height="16" rx="2" />
                            <rect x="14" y="4" width="4.5" height="16" rx="2" />
                          </svg>
                        </button>
                      </div>

                      <div className="buds-media-bottom">
                        <button className="media-icon-btn add-btn active">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="#ff3b30" stroke="#ff3b30" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>

                        <div className="media-timeline-container">
                          <svg viewBox="0 0 120 12" className="media-timeline-svg">
                            <defs>
                              <clipPath id="preview-elapsed-clip">
                                <rect x="0" y="0" width="55" height="12" />
                              </clipPath>
                              <clipPath id="preview-remaining-clip">
                                <rect x="55" y="0" width="65" height="12" />
                              </clipPath>
                            </defs>
                            <line x1="0" y1="6" x2="120" y2="6" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" strokeLinecap="round" clipPath="url(#preview-remaining-clip)" />
                            <path d={WAVE_PATH} fill="none" stroke="#ccebff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="media-timeline-wave" clipPath="url(#preview-elapsed-clip)" />
                            <circle cx="55" cy="6" r="4" fill="#ffffff" />
                          </svg>
                        </div>

                        <button className="media-icon-btn next-btn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                            <line x1="19" y1="5" x2="19" y2="19" />
                          </svg>
                        </button>

                        <button className="media-icon-btn cast-btn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 16a4 4 0 0 1 4 4" />
                            <path d="M2 12a8 8 0 0 1 8 8" />
                            <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                            <circle cx="2" cy="20" r="1" fill="currentColor" />
                          </svg>
                        </button>

                        <button className="media-icon-btn repeat-btn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9" />
                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                            <polyline points="7 23 3 19 7 15" />
                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Media Player</h3>
              <p className="widget-desc">A beautiful landscape desktop music widget with dynamic background artwork, live Windows SMTC session tracking, playback controls, and wiggling waveform progress.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("media")}>
              Add to Desktop
            </button>
          </div>

          {/* Atmosphere Weather Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'center', width: '220px', height: '220px', pointerEvents: 'none' }}>
                <div className="weather-widget-body" style={{ cursor: 'default' }}>
                  <div className="weather-face">
                    <div className="weather-icon-area">
                      <WeatherDotIcon iconKey="sunny" size={100} />
                    </div>
                    <div className="weather-bottom-area">
                      <div className="weather-temp-row">
                        <span className="weather-temp">28</span>
                        <span className="weather-temp-deg">°C</span>
                      </div>
                      <div className="weather-condition">SUNNY DAY</div>
                      <div className="weather-location">Your Location</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Atmosphere</h3>
              <p className="widget-desc">A pixel dot-matrix weather widget showing real-time temperature and conditions for your GPS location, powered by Open-Meteo with no API key needed.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("weather")}>
              Add to Desktop
            </button>
          </div>

          {/* Calendar Widget Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'center', width: '220px', height: '220px', pointerEvents: 'none' }}>
                <div className="calendar-widget-body" style={{ cursor: 'default' }}>
                  <div className="calendar-top-row">
                    <div className="calendar-time-block">
                      <svg className="calendar-alarm-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9281c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13" r="8"></circle>
                        <polyline points="12 9 12 13 14 15"></polyline>
                        <path d="M5 3L2 6"></path>
                        <path d="M19 3l3 3"></path>
                      </svg>
                      <span className="calendar-time">10:30</span>
                    </div>
                    <div className="calendar-weather-block">
                      <WeatherDotIcon iconKey="sunny" size={48} color="#d9281c" />
                    </div>
                  </div>
                  <div className="calendar-center">
                    <DotMatrixText text="MON" height={50} color="var(--calendar-text-color)" />
                    <div className="calendar-date-text">23 April</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Date</h3>
              <p className="widget-desc">A clean, serif-styled calendar widget featuring live time, pixelated weather conditions, and a bold dot-matrix day indicator.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("calendar")}>
              Add to Desktop
            </button>
          </div>

          {/* Spotify Widget Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container" style={{ background: '#0a0a0a' }}>
              <div style={{ transform: 'scale(0.6)', transformOrigin: 'center', pointerEvents: 'none' }}>
                <div className="spotify-widget-body" style={{ cursor: 'default', margin: 'auto' }}>
                  {/* Top App Logo */}
                  <div className="spotify-app-logo-row">
                    {getSourceIcon('spotify')}
                    <span className="spotify-app-name">Spotify</span>
                  </div>

                  <div className="spotify-content-row">
                    <div className="spotify-art-container">
                      <img src="https://images.unsplash.com/photo-1619983081563-430f63602796?w=200&h=200&fit=crop" alt="Album Art" className="spotify-large-art" />
                    </div>

                    <div className="spotify-track-details">
                      <div className="spotify-large-title">Goindhamma</div>
                      <div className="spotify-large-artist">Hiphop Tamizha</div>

                      <div className="spotify-progress-container">
                        <div className="spotify-time-row">
                          <span>0:52</span>
                          <span>3:12</span>
                        </div>
                        <div className="spotify-progress-bar-large">
                          <div className="spotify-progress-fill-large" style={{ width: `30%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Spotify Player</h3>
              <p className="widget-desc">A dark, elegant mini-player dedicated to tracking your music. Features standard media controls and live progress tracking.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("spotify")}>
              Add to Desktop
            </button>
          </div>
          {/* Battery Circle Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.8)', transformOrigin: 'center', pointerEvents: 'none' }}>
                <div style={{ background: '#121214', borderRadius: '50%', padding: '20px', margin: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DotMatrixBattery shape="circle" width={160} height={160} />
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Battery (Circle)</h3>
              <p className="widget-desc">A circular dot-matrix battery indicator monitoring your system's battery level and charging status in real-time.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("battery-circle")}>
              Add to Desktop
            </button>
          </div>

          {/* Analog Clock Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.8)', transformOrigin: 'center', pointerEvents: 'none' }}>
                <div style={{ width: '160px', height: '160px', margin: 'auto', borderRadius: '50%', background: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: '700', fontFamily: 'Impact, sans-serif', fontSize: '60px', lineHeight: 0.8, letterSpacing: '-2px', color: '#cbd5e1' }}>12</div>
                  <div style={{ position: 'absolute', top: '85%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: '700', fontFamily: 'Impact, sans-serif', fontSize: '60px', lineHeight: 0.8, letterSpacing: '-2px', color: '#cbd5e1' }}>06</div>
                  <div style={{ position: 'absolute', top: '50%', left: '15%', transform: 'translate(-50%, -50%)', fontWeight: '700', fontFamily: 'Impact, sans-serif', fontSize: '60px', lineHeight: 0.8, letterSpacing: '-2px', color: '#cbd5e1' }}>9</div>
                  <div style={{ position: 'absolute', top: '50%', left: '85%', transform: 'translate(-50%, -50%)', fontWeight: '700', fontFamily: 'Impact, sans-serif', fontSize: '60px', lineHeight: 0.8, letterSpacing: '-2px', color: '#cbd5e1' }}>3</div>
                  {/* Hands */}
                  <div style={{ position: 'absolute', bottom: '50%', left: '50%', width: '12px', height: '25%', marginLeft: '-6px', background: '#64748b', borderRadius: '10px' }}></div>
                  <div style={{ position: 'absolute', bottom: '50%', left: '50%', width: '16px', height: '40%', marginLeft: '-8px', border: '3px solid #94a3b8', borderRadius: '10px' }}></div>
                  
                  {/* Second Hand with Counterweight */}
                  <div style={{ position: 'absolute', bottom: '50%', left: '50%', width: '2px', height: '45%', marginLeft: '-1px', background: '#ff3b30' }}>
                    <div style={{ position: 'absolute', top: '100%', left: '0', width: '100%', height: '15px', background: '#ff3b30' }}></div>
                    <div style={{ position: 'absolute', bottom: '0', left: '50%', width: '8px', height: '8px', transform: 'translate(-50%, 50%)', borderRadius: '50%', background: '#ff3b30', border: '2px solid #1e1e1e' }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Analog Clock</h3>
              <p className="widget-desc">A beautiful, Pixel-inspired analog clock with dynamic light and dark theme modes.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("analog-clock")}>
              Add to Desktop
            </button>
          </div>

          {/* Photo Frame Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.8)', transformOrigin: 'center', pointerEvents: 'none' }}>
                <div style={{ width: '160px', height: '160px', margin: 'auto', borderRadius: '24px', border: '6px solid white', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <img src="https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=200&h=200&fit=crop" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Photo Frame</h3>
              <p className="widget-desc">A squircle-shaped resizable photo frame. Display your favorite memories directly on your desktop.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("photo-frame")}>
              Add to Desktop
            </button>
          </div>

          {/* Screen Time Card */}
          <div className="widget-preview-card">
            <div className="widget-preview-container">
              <div style={{ transform: 'scale(0.8)', transformOrigin: 'center', pointerEvents: 'none' }}>
                <div style={{ width: '160px', height: '160px', margin: 'auto', borderRadius: '24px', background: '#f0f0f2', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '30px', left: '15px', right: '15px', height: '40px', display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i < 22 ? '#1e1e1e' : i === 22 ? '#ff3b30' : '#c7c7cc' }} />
                    ))}
                  </div>
                  <div style={{ position: 'absolute', bottom: '20px', left: '20px', fontFamily: 'Impact, sans-serif', fontSize: '24px', letterSpacing: '2px', background: 'radial-gradient(circle, #1e1e1e 40%, transparent 40%)', backgroundSize: '4px 4px', color: 'transparent', WebkitBackgroundClip: 'text' }}>
                    1<span style={{fontSize: '14px'}}>H</span> 11<span style={{fontSize: '14px'}}>M</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="widget-info">
              <h3 className="widget-name">Screen Time</h3>
              <p className="widget-desc">Track your daily session time with a beautiful dot-matrix progress indicator.</p>
            </div>
            <button className="add-widget-btn" onClick={() => spawnWidget("screen-time")}>
              Add to Desktop
            </button>
          </div>

          {/* (Removed Square Card) */}
        </div>
      </div>
    </div>
  );
}

// --- Standalone Horolize Widget View ---
function HorolizeWidget() {
  const { hour, minute, ampm } = useLiveTime();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("horolize-theme") || "orange";
  });

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const newTheme = theme === "orange" ? "dark" : "orange";
    setTheme(newTheme);
    localStorage.setItem("horolize-theme", newTheme);
  };

  return (
    <div className="widget-window-container">
      <div className={`horolize-widget-body ${theme === 'dark' ? 'dark-theme' : ''}`}>
        {/* Floating Hover Controls */}
        <div className="widget-overlay-controls">
          <button
            className="overlay-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'orange' ? 'dark' : 'orange'} theme`}
          >
            {theme === 'orange' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>
          <button
            className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handlePinToggle}
            title={isPinned ? "Unpin widget" : "Pin widget (Always on top)"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z"></path>
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
            <svg width="12" height="12" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
        {/* Main Recessed Face */}
        <div className="clock-recessed-display">
          <FlipCard value={hour} soundEnabled={soundEnabled} />
          <FlipCard value={minute} soundEnabled={soundEnabled} />
        </div>

        {/* Lower row details */}
        <div className="widget-bottom-row">
          <div className="speaker-grill-container">
            <button
              className={`speaker-icon-btn ${!soundEnabled ? 'muted' : ''}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute tick sound" : "Unmute tick sound"}
            >
              {soundEnabled ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <line x1="23" y1="9" x2="17" y2="15"></line>
                  <line x1="17" y1="9" x2="23" y2="15"></line>
                </svg>
              )}
            </button>
            <div className="speaker-grill">
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className="speaker-hole"></div>
              ))}
            </div>
          </div>

          <div className="ampm-indicator">
            <div className="ampm-track">
              <div className={`ampm-slider ${ampm.toLowerCase()}`} />
              <span className={`ampm-label ${ampm === "AM" ? "active" : ""}`}>AM</span>
              <span className={`ampm-label ${ampm === "PM" ? "active" : ""}`}>PM</span>
            </div>
          </div>
        </div>

        {/* Floating text hints on hover */}
        <div className="drag-indicator-text">
          Hold Card To Drag
        </div>
      </div>
    </div>
  );
}

// --- Standalone Bloom Widget View ---
function BloomWidget() {
  const { hourDegrees, minuteDegrees, secondDegrees } = useLiveTime();
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("bloom-theme") || "dark";
  });

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("bloom-theme", newTheme);
  };

  return (
    <div className="widget-window-container">
      <div className={`bloom-widget-body ${theme === 'light' ? 'light-theme' : ''}`}>
        {/* Scallop clock face */}
        <div className="scallop-face">
          {/* Floating Hover Controls moved inside scallop-face */}
          <div className="widget-overlay-controls">
            <button
              className="overlay-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <button
              className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
              onClick={handlePinToggle}
              title={isPinned ? "Unpin widget" : "Pin widget (Always on top)"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z"></path>
              </svg>
            </button>
            <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
              <svg width="12" height="12" viewBox="0 0 10 10">
                <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', top: 0, left: 0 }}>
            <path
              d={SCALLOP_PATH}
              fill={theme === 'light' ? '#f0efe9' : '#121214'}
              stroke={theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'}
              strokeWidth="1.5"
            />
          </svg>

          {/* Hands */}
          <div className="clock-hands-container">
            <div
              className="hand hour"
              style={{ transform: `rotate(${hourDegrees}deg)` }}
            ></div>
            <div
              className="hand minute"
              style={{ transform: `rotate(${minuteDegrees}deg)` }}
            ></div>
            <div
              className="second-dot-container"
              style={{ transform: `rotate(${secondDegrees}deg)` }}
            >
              <div className="second-dot"></div>
            </div>
            <div className="center-pivot-cap"></div>
          </div>
        </div>

        {/* Floating text hints on hover */}
        <div className="drag-indicator-text">
          Hold Widget To Drag
        </div>
      </div>
    </div>
  );
}

const getBatteryColor = (level) => {
  if (level === null || level === undefined) return '#8e8e9f';
  if (level > 40) return '#34c759'; // iOS green
  if (level > 20) return '#ff9500'; // orange
  return '#ff3b30'; // red
};

// --- Source Application Icon Helper ---
const getSourceIcon = (appId) => {
  const idLower = (appId || "").toLowerCase();
  if (idLower.includes("spotify")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.076-.67-.135-.747-.472-.077-.336.136-.67.472-.747 3.855-.88 7.15-.505 9.822 1.13.295.18.387.563.206.864zm1.225-2.72c-.227.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.667-1.11 8.24-.567 11.344 1.344.367.226.488.707.26 1.07zm.106-2.833C14.384 8.71 8.445 8.514 5.01 9.557c-.528.16-1.084-.14-1.244-.668-.16-.527.143-1.083.67-1.243 3.978-1.207 10.536-.98 14.61 1.438.476.283.63.897.347 1.373-.284.477-.898.632-1.375.35z" />
      </svg>
    );
  }
  if (idLower.includes("chrome")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#4285f4" }}>
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="4"></circle>
        <line x1="10.8" y1="8" x2="21" y2="8"></line>
        <line x1="8" y1="12.8" x2="13" y2="21.5"></line>
        <line x1="15.2" y1="17.7" x2="5.2" y2="9.3"></line>
      </svg>
    );
  }
  if (idLower.includes("edge")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#0078d4" }}>
        <path d="M12 2a10 10 0 0 0-7.54 3.42c1 .43 2.1.58 3.14.43A5 5 0 0 1 12 7c2.2 0 4.14 1.41 4.79 3.42A5 5 0 0 1 12 17a5 5 0 0 1-4.79-3.42A10 10 0 1 0 12 2z"></path>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ccebff" }}>
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  );
};

// --- Seamless Wave path precalculation ---
const WAVE_PATH = (() => {
  const points = [];
  const wavelength = 10;
  const amplitude = 2.5;
  const yOffset = 6;
  for (let x = -10; x <= 130; x += 0.5) {
    const y = yOffset + amplitude * Math.sin((2 * Math.PI * x) / wavelength);
    points.push(`${x === -10 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
})();

// --- Weather Widget: Pixel Dot-Matrix Icon Grids (11x11 each) ---
const DOT_GRIDS = {
  sunny: [
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  ],
  moon: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  cloud: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  partlyCloudy: [
    [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  rain: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  snow: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  fog: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  thunder: [
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  location: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

// Maps WMO weather code → { label, icon }
function getWeatherInfo(code, isDay) {
  if (code === 0) return { label: isDay ? 'SUNNY DAY' : 'CLEAR NIGHT', icon: isDay ? 'sunny' : 'moon' };
  if (code === 1) return { label: isDay ? 'MAINLY CLEAR' : 'MAINLY CLEAR', icon: isDay ? 'sunny' : 'moon' };
  if (code === 2) return { label: 'PARTLY CLOUDY', icon: 'partlyCloudy' };
  if (code === 3) return { label: 'OVERCAST', icon: 'cloud' };
  if (code <= 48) return { label: 'FOGGY', icon: 'fog' };
  if (code <= 57) return { label: 'DRIZZLE', icon: 'rain' };
  if (code <= 67) return { label: 'RAIN', icon: 'rain' };
  if (code <= 77) return { label: 'SNOW', icon: 'snow' };
  if (code <= 82) return { label: 'SHOWERS', icon: 'rain' };
  if (code <= 86) return { label: 'SNOW SHOWERS', icon: 'snow' };
  return { label: 'THUNDERSTORM', icon: 'thunder' };
}

// Pixel dot-matrix SVG icon renderer
function WeatherDotIcon({ iconKey, size = 100, color }) {
  const grid = DOT_GRIDS[iconKey] || DOT_GRIDS.cloud;
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = size / cols;
  const cellH = size / rows;
  const r = Math.min(cellW, cellH) * 0.36;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
    >
      {grid.map((row, ri) =>
        row.map((cell, ci) => (
          <circle
            key={`${ri}-${ci}`}
            cx={ci * cellW + cellW / 2}
            cy={ri * cellH + cellH / 2}
            r={r}
            fill={cell ? (color || 'var(--weather-dot-active)') : (color ? 'transparent' : 'var(--weather-dot-inactive)')}
          />
        ))
      )}
    </svg>
  );
}

// --- Pixel Dot-Matrix Text Renderer (5x7) for Days of the Week ---
const ALPHABET = {
  M: [[1, 0, 0, 0, 1], [1, 1, 0, 1, 1], [1, 0, 1, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1]],
  O: [[0, 1, 1, 1, 0], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [0, 1, 1, 1, 0]],
  N: [[1, 0, 0, 0, 1], [1, 1, 0, 0, 1], [1, 0, 1, 0, 1], [1, 0, 0, 1, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1]],
  T: [[1, 1, 1, 1, 1], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0]],
  U: [[1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [0, 1, 1, 1, 0]],
  E: [[1, 1, 1, 1, 1], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 1, 1, 1, 0], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 1, 1, 1, 1]],
  W: [[1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 1, 0, 1], [1, 0, 1, 0, 1], [1, 1, 0, 1, 1], [1, 0, 0, 0, 1]],
  D: [[1, 1, 1, 1, 0], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 0]],
  H: [[1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1]],
  F: [[1, 1, 1, 1, 1], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 1, 1, 1, 0], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0]],
  R: [[1, 1, 1, 1, 0], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 0], [1, 0, 1, 0, 0], [1, 0, 0, 1, 0], [1, 0, 0, 0, 1]],
  I: [[0, 1, 1, 1, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 1, 1, 1, 0]],
  S: [[0, 1, 1, 1, 1], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [0, 1, 1, 1, 0], [0, 0, 0, 0, 1], [0, 0, 0, 0, 1], [1, 1, 1, 1, 0]],
  A: [[0, 1, 1, 1, 0], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1]]
};

function DotMatrixText({ text, height = 40, color = "#1a1a1a" }) {
  const letters = text.toUpperCase().split('');
  const letterWidth = 5;
  const letterSpacing = 2;
  const totalCols = letters.length * letterWidth + (letters.length - 1) * letterSpacing;
  const totalRows = 7;

  const cellSize = height / totalRows;
  const width = totalCols * cellSize;
  const r = cellSize * 0.4;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {letters.map((char, charIdx) => {
        const grid = ALPHABET[char];
        if (!grid) return null;
        const startCol = charIdx * (letterWidth + letterSpacing);

        return grid.map((row, ri) =>
          row.map((cell, ci) => cell === 1 ? (
            <circle
              key={`${charIdx}-${ri}-${ci}`}
              cx={(startCol + ci) * cellSize + cellSize / 2}
              cy={ri * cellSize + cellSize / 2}
              r={r}
              fill={color}
            />
          ) : null)
        );
      })}
    </svg>
  );
}

// --- Windows Media Session Custom Hook with Interpolation ---
function useLiveMedia(enabled) {
  const [rawMedia, setRawMedia] = useState(null);
  const [interpolatedPosition, setInterpolatedPosition] = useState(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled || !isElectron) {
      setRawMedia(null);
      return;
    }

    const poll = async () => {
      try {
        const session = await window.electronAPI.getMediaSession();
        if (session && session.Title) {
          setRawMedia(session);
        } else {
          setRawMedia(null);
        }
      } catch (e) {
        setRawMedia(null);
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (rawMedia) {
      setInterpolatedPosition(rawMedia.Position || 0);
      lastUpdateRef.current = Date.now();
    } else {
      setInterpolatedPosition(0);
    }
  }, [rawMedia?.Title, rawMedia?.Artist, rawMedia?.PlaybackStatus, rawMedia?.Position]);

  useEffect(() => {
    if (!rawMedia || rawMedia.PlaybackStatus !== "Playing") return;

    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - lastUpdateRef.current) / 1000;
      const newPos = (rawMedia.Position || 0) + elapsedSec;
      setInterpolatedPosition(Math.min(rawMedia.EndTime || 0, newPos));
    }, 100);

    return () => clearInterval(interval);
  }, [rawMedia?.Title, rawMedia?.PlaybackStatus, rawMedia?.Position, rawMedia?.EndTime]);

  return { media: rawMedia, interpolatedPosition };
}

// --- Weather Data Hook (Open-Meteo + Nominatim, no API key required) ---
function useWeather() {
  const [status, setStatus] = useState('idle'); // idle | requesting | loading | success | denied | error
  const [weatherData, setWeatherData] = useState(null);

  const fetchWeather = async (lat, lon) => {
    setStatus('loading');
    try {
      const [wRes, gRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`),
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`),
      ]);
      const wJson = await wRes.json();
      const gJson = await gRes.json();
      const temp = Math.round(wJson.current.temperature_2m);
      const code = wJson.current.weather_code;
      const isDay = wJson.current.is_day === 1;
      const addr = gJson.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || 'Your Location';
      setWeatherData({ temp, code, isDay, city });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    setStatus('requesting');

    const fallbackToIP = async () => {
      try {
        const res = await fetch('http://ip-api.com/json/');
        const data = await res.json();
        if (data && data.lat && data.lon) {
          fetchWeather(data.lat, data.lon);
        } else {
          setStatus('denied');
        }
      } catch {
        setStatus('denied');
      }
    };

    if (!navigator.geolocation) {
      fallbackToIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => fallbackToIP(), // On error/denial, try IP
      { timeout: 10000 }
    );
  }, []);

  // Refresh every 10 minutes
  useEffect(() => {
    if (status !== 'success') return;
    const id = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
          () => { }
        );
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [status]);

  return { status, weatherData, fetchWeather };
}

// --- Battery Status Hook ---
function useBattery() {
  const [battery, setBattery] = useState({ level: 1, charging: false, available: false });

  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(bat => {
        const update = () => setBattery({ level: bat.level, charging: bat.charging, available: true });
        update();
        bat.addEventListener('levelchange', update);
        bat.addEventListener('chargingchange', update);
        return () => {
          bat.removeEventListener('levelchange', update);
          bat.removeEventListener('chargingchange', update);
        };
      }).catch(() => {
        setBattery({ level: 0.5, charging: false, available: false }); // Fallback
      });
    }
  }, []);

  return battery;
}

// --- Dot Matrix Battery Visualizer ---
function DotMatrixBattery({ shape = 'circle', width = 160, height = 160 }) {
  const canvasRef = useRef(null);
  const battery = useBattery();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId;
    let startTime = Date.now();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const dotSize = 3;
      const gap = 2;
      const cellSize = dotSize + gap;

      const cols = Math.floor(width / cellSize);
      const rows = Math.floor(height / cellSize);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 2;

      const basePct = Math.round(battery.level * 100);
      let displayPct = basePct;

      if (battery.charging && basePct < 100) {
        // Sweep animation: loop every 2 seconds
        const elapsed = (Date.now() - startTime) % 2000;
        const addPct = ((100 - basePct) * elapsed) / 2000;
        displayPct = Math.min(100, basePct + addPct);
      }

      let activeColor = '#ffffff'; // white
      if (basePct <= 20 && !battery.charging) activeColor = '#ff3b30'; // red if low and not charging
      else if (battery.charging) activeColor = '#0a84ff'; // charging blue! (or white if you prefer, user said white but let's make it white charging)
      
      // User requested "white not green", let's keep it mostly white even when charging, but maybe pulse opacity?
      // Actually, we'll just keep it white, and let the sweep animation be the indicator.
      activeColor = '#ffffff'; 

      const inactiveColor = '#2c2c2e'; // dim gray

      const activeRowThreshold = rows - Math.floor((displayPct / 100) * rows);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cellSize + dotSize / 2;
          const y = r * cellSize + dotSize / 2;

          let shouldDraw = false;

          if (shape === 'circle') {
            const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            if (dist <= radius) shouldDraw = true;
          } else {
            shouldDraw = true;
          }

          if (shouldDraw) {
            const isActive = r >= activeRowThreshold;
            ctx.fillStyle = isActive ? activeColor : inactiveColor;
            ctx.fillRect(x, y, dotSize, dotSize);
          }
        }
      }

      // Draw text in center (always show base pct)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const text = battery.charging ? `⚡${basePct}%` : `${basePct}%`;
      // Adjust font size if lightning bolt is included
      if (battery.charging) ctx.font = 'bold 32px "Courier New", monospace';
      
      ctx.fillText(text, centerX, centerY);

      if (battery.charging) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [battery.level, battery.charging, width, height, shape]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
    />
  );
}

// --- Headphones Image Component ---
function HeadphonesImage({ connected = true }) {
  const handleClick = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openBluetoothSettings) {
      window.electronAPI.openBluetoothSettings();
    }
  };

  return (
    <div className="headphones-container" style={{ position: "relative", width: "165px", height: "165px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className={`buds-glow-ring ${connected ? 'connected' : ''}`} />
      <img
        src={headphonesImg}
        alt="Headphones"
        className="headphones-img"
        onClick={handleClick}
        title="Click to open Bluetooth settings"
        style={{
          width: '165px',
          height: '165px',
          objectFit: 'contain',
          opacity: connected ? 1 : 0.35,
          transition: 'opacity 0.4s ease, filter 0.4s ease, transform 0.15s ease',
          display: 'block',
          cursor: 'pointer',
          pointerEvents: 'auto',
          zIndex: 2
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      />
    </div>
  );
}

// --- Standalone Weather Widget View ---
function WeatherWidget() {
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("weather-theme") || "dark");
  const { status, weatherData } = useWeather();

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("weather-theme", newTheme);
  };

  const { label, icon } = (weatherData && status === 'success')
    ? getWeatherInfo(weatherData.code, weatherData.isDay)
    : { label: '', icon: 'cloud' };

  const renderBody = () => {
    if (status === 'denied') {
      return (
        <div className="weather-state-container">
          <WeatherDotIcon iconKey="location" size={80} />
          <div className="weather-state-label">LOCATION<br />PERMISSION<br />NEEDED</div>
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="weather-state-container">
          <WeatherDotIcon iconKey="cloud" size={80} />
          <div className="weather-state-label">WEATHER<br />UNAVAILABLE</div>
        </div>
      );
    }
    if (status !== 'success') {
      return (
        <div className="weather-state-container">
          <div className="weather-loading-dots">
            <div className="weather-loading-dot" />
            <div className="weather-loading-dot" />
            <div className="weather-loading-dot" />
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="weather-icon-area">
          <WeatherDotIcon iconKey={icon} size={110} />
        </div>
        <div className="weather-bottom-area">
          <div className="weather-temp-row">
            <span className="weather-temp">{weatherData.temp}</span>
            <span className="weather-temp-deg">°C</span>
          </div>
          <div className="weather-condition">{label}</div>
          <div className="weather-location">{weatherData.city}</div>
        </div>
      </>
    );
  };

  return (
    <div className="widget-window-container">
      <div className={`weather-widget-body ${theme === 'dark' ? '' : 'light-theme'}`}>
        <div className="weather-face">
          <div className="widget-overlay-controls">
            <button
              className="overlay-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <button
              className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
              onClick={handlePinToggle}
              title={isPinned ? 'Unpin widget' : 'Pin widget (Always on top)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
              </svg>
            </button>
            <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {renderBody()}
        </div>
        <div className="drag-indicator-text">Hold Widget To Drag</div>
      </div>
    </div>
  );
}

// --- Standalone Buds Widget View ---
// --- Standalone Buds Widget View ---
function BudsWidget() {
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("buds-theme") || "light";
  });
  const { connectedDevice, connectedBattery } = useBluetoothStatus(true);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("buds-theme", newTheme);
  };

  return (
    <div className="widget-window-container">
      <div className={`buds-widget-body ${theme === 'dark' ? 'dark-theme' : ''}`}>
        {/* Squircle Buds Face */}
        <div className="buds-face">
          {/* Floating Hover Controls */}
          <div className="widget-overlay-controls">
            <button
              className="overlay-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <button
              className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
              onClick={handlePinToggle}
              title={isPinned ? "Unpin widget" : "Pin widget (Always on top)"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z"></path>
              </svg>
            </button>
            <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
              <svg width="12" height="12" viewBox="0 0 10 10">
                <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="buds-top-pane">
            <HeadphonesImage connected={!!connectedDevice} />
          </div>

          <div className="buds-bottom-pane">
            <div className={`buds-status-label ${connectedDevice ? 'connected' : ''}`}>
              {connectedDevice ? "CONNECTED" : "DISCONNECTED"}
            </div>
            <div className="buds-status-dots">
              <span className={`status-dot ${connectedDevice ? 'connected' : ''}`}></span>
              <span className={`status-dot ${connectedDevice ? 'connected' : ''}`}></span>
              <span className={`status-dot ${connectedDevice ? 'connected' : ''}`}></span>
            </div>
            <div className={`buds-device-name ${!connectedDevice ? 'disconnected' : ''}`}>
              {connectedDevice ? connectedDevice : "Not Connected"}
            </div>
            {connectedDevice && connectedBattery !== null && (
              <div className="buds-battery-container">
                <svg className="battery-icon" width="22" height="12" viewBox="0 0 24 14" fill="none">
                  <rect x="1" y="1" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 4.5V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <rect x="3.5" y="3.5" width={Math.round((connectedBattery / 100) * 13)} height="7" rx="1" fill={getBatteryColor(connectedBattery)} />
                </svg>
                <span className="battery-text" style={{ color: getBatteryColor(connectedBattery) }}>
                  {connectedBattery}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Floating text hints on hover */}
        <div className="drag-indicator-text">
          Hold Widget To Drag
        </div>
      </div>
    </div>
  );
}

// --- Standalone Media Player Widget View ---
function MediaWidget() {
  const [isPinned, setIsPinned] = useState(false);
  const { connectedDevice } = useBluetoothStatus(true);

  // Media session states
  const { media, interpolatedPosition } = useLiveMedia(true);

  // Bottom row button interactions
  const [isAdded, setIsAdded] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);

  // Dragging slider states
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (isElectron) {
      window.electronAPI.controlMedia("playpause");
    }
  };

  const handleNextTrack = (e) => {
    e.stopPropagation();
    if (isElectron) {
      window.electronAPI.controlMedia("next");
    }
  };

  const isMediaActive = !!(media && media.Title);
  const activeTrack = media;
  const currentPos = interpolatedPosition;

  const progressPercent = (activeTrack && activeTrack.EndTime > 0)
    ? (currentPos / activeTrack.EndTime) * 100
    : 0;

  const activePercent = isDragging ? dragProgress : progressPercent;
  const elapsedWidth = (activePercent / 100) * 120;

  const handleTimelineMouseDown = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    mouseDownEvent.stopPropagation();
    if (!activeTrack || activeTrack.EndTime <= 0) return;

    const rect = mouseDownEvent.currentTarget.getBoundingClientRect();
    const updateProgress = (clientX) => {
      const clickX = clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
      setDragProgress(percent);
    };

    setIsDragging(true);
    updateProgress(mouseDownEvent.clientX);

    const handleMouseMove = (mouseMoveEvent) => {
      updateProgress(mouseMoveEvent.clientX);
    };

    const handleMouseUp = (mouseUpEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);

      const finalPercent = Math.max(0, Math.min(100, ((mouseUpEvent.clientX - rect.left) / rect.width) * 100));
      const targetTime = (finalPercent / 100) * activeTrack.EndTime;

      if (isElectron) {
        window.electronAPI.controlMedia("seek", targetTime);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTimelineTouchStart = (touchStartEvent) => {
    touchStartEvent.preventDefault();
    touchStartEvent.stopPropagation();
    if (!activeTrack || activeTrack.EndTime <= 0) return;

    const rect = touchStartEvent.currentTarget.getBoundingClientRect();
    const updateProgress = (clientX) => {
      const clickX = clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
      setDragProgress(percent);
    };

    setIsDragging(true);
    const touch = touchStartEvent.touches[0];
    updateProgress(touch.clientX);

    const handleTouchMove = (touchMoveEvent) => {
      const touch = touchMoveEvent.touches[0];
      updateProgress(touch.clientX);
    };

    const handleTouchEnd = (touchEndEvent) => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      setIsDragging(false);

      const touch = touchEndEvent.changedTouches[0];
      const finalPercent = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
      const targetTime = (finalPercent / 100) * activeTrack.EndTime;

      if (isElectron) {
        window.electronAPI.controlMedia("seek", targetTime);
      }
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const hasThumbnail = !!(isMediaActive && activeTrack && activeTrack.Thumbnail);
  let faceStyle = { background: '#18181b' };
  if (hasThumbnail) {
    faceStyle = {
      backgroundImage: `url(data:image/jpeg;base64,${activeTrack.Thumbnail})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }

  return (
    <div className="widget-window-container">
      <div className={`media-widget-body ${isDragging ? 'no-drag-active' : ''}`}>
        <div className={`media-face ${hasThumbnail ? 'has-thumbnail' : ''}`} style={faceStyle}>
          {/* Floating Hover Controls */}
          <div className="widget-overlay-controls">
            <button
              className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
              onClick={handlePinToggle}
              title={isPinned ? "Unpin widget" : "Pin widget (Always on top)"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
              </svg>
            </button>
            <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {isMediaActive ? (
            <div className="buds-media-container">
              {/* Top Row: Logo & Output device */}
              <div className="buds-media-top">
                <div className="media-source-logo">
                  {getSourceIcon(activeTrack.SourceAppId)}
                </div>
                <div className="media-device-pill">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}>
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                  </svg>
                  {connectedDevice || "Internal Speakers"}
                </div>
              </div>

              {/* Middle Row: Song details & play btn */}
              <div className="buds-media-middle">
                <div className="media-track-info">
                  <div className="media-track-title" title={activeTrack.Title}>{activeTrack.Title || "Unknown Title"}</div>
                  <div className="media-track-artist" title={activeTrack.Artist}>{activeTrack.Artist || "Unknown Artist"}</div>
                </div>
                <button className="media-play-btn" onClick={handlePlayPause}>
                  {activeTrack.PlaybackStatus === "Playing" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5.5" y="4" width="4.5" height="16" rx="2" />
                      <rect x="14" y="4" width="4.5" height="16" rx="2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1.5px)' }}>
                      <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Bottom Row: Cast/Repeat & Timeline */}
              <div className="buds-media-bottom">
                <button
                  className={`media-icon-btn add-btn ${isAdded ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsAdded(!isAdded); }}
                  title={isAdded ? "Remove from Library" : "Add to Library"}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={isAdded ? "#ff3b30" : "none"} stroke={isAdded ? "#ff3b30" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>

                <div
                  className="media-timeline-container"
                  onMouseDown={handleTimelineMouseDown}
                  onTouchStart={handleTimelineTouchStart}
                >
                  <svg viewBox="0 0 120 12" className="media-timeline-svg">
                    <defs>
                      <clipPath id="media-elapsed-clip">
                        <rect x="0" y="0" width={elapsedWidth} height="12" />
                      </clipPath>
                      <clipPath id="media-remaining-clip">
                        <rect x={elapsedWidth} y="0" width={120 - elapsedWidth} height="12" />
                      </clipPath>
                    </defs>

                    <line
                      x1="0"
                      y1="6"
                      x2="120"
                      y2="6"
                      stroke="rgba(255, 255, 255, 0.25)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      clipPath="url(#media-remaining-clip)"
                    />

                    <path
                      d={WAVE_PATH}
                      fill="none"
                      stroke="#ccebff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`media-timeline-wave ${activeTrack.PlaybackStatus !== "Playing" ? 'paused' : ''}`}
                      clipPath="url(#media-elapsed-clip)"
                    />

                    <circle
                      cx={elapsedWidth}
                      cy="6"
                      r={isDragging ? 5.5 : 4}
                      fill="#ffffff"
                      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))", transition: "r 0.15s ease" }}
                    />
                  </svg>
                </div>

                <button className="media-icon-btn next-btn" onClick={handleNextTrack} title="Next Track">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>

                <button
                  className={`media-icon-btn cast-btn ${isCasting ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsCasting(!isCasting); }}
                  title="Cast"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 16a4 4 0 0 1 4 4" />
                    <path d="M2 12a8 8 0 0 1 8 8" />
                    <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                    <circle cx="2" cy="20" r="1" fill="currentColor" />
                  </svg>
                </button>

                <button
                  className={`media-icon-btn repeat-btn ${isRepeating ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setIsRepeating(!isRepeating); }}
                  title="Repeat"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="media-fallback-container">
              <div className="media-fallback-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <div className="media-fallback-text">No Media Playing</div>
              <div className="media-fallback-subtext">Play music or video on your system to see it here.</div>
            </div>
          )}
        </div>

        {/* Floating text hints on hover */}
        <div className="drag-indicator-text">
          Hold Widget To Drag
        </div>
      </div>
    </div>
  );
}

// --- Screen Time Widget ---
function ScreenTimeWidget() {
  const [isPinned, setIsPinned] = useState(false);
  const canvasRef = useRef(null);
  
  const [startTime] = useState(Date.now());
  const [timeStr, setTimeStr] = useState({ h: 0, m: 0 });

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
    
    const fetchUptime = async () => {
      try {
        let uptimeSecs = 0;
        if (isElectron && window.electronAPI.getSystemUptime) {
          uptimeSecs = await window.electronAPI.getSystemUptime();
        } else {
          // Fallback if not available
          uptimeSecs = (Date.now() - startTime) / 1000;
        }
        
        const totalMins = Math.floor(uptimeSecs / 60);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        setTimeStr({ h: hours, m: mins });
      } catch (e) {
        console.error("Failed to fetch uptime", e);
      }
    };
    
    fetchUptime();
    const timer = setInterval(fetchUptime, 60000);
    return () => clearInterval(timer);
  }, [startTime]);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const width = 200;
    const height = 200;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    
    const cols = 12;
    const rows = 3;
    const dotRadius = 4;
    const spacing = 12;
    const startX = (width - (cols * spacing)) / 2 + dotRadius + 5; // slight right adjust
    const startY = 50;
    
    const totalMins = timeStr.h * 60 + timeStr.m;
    const maxMins = 8 * 60; // 8 hours max scale for the dots
    const progressPct = Math.min(1, totalMins / maxMins);
    const progressDots = Math.max(1, Math.floor(progressPct * (cols * rows))); 
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dotIndex = r * cols + c;
        ctx.beginPath();
        ctx.arc(startX + c * spacing, startY + r * spacing, dotRadius, 0, Math.PI * 2);
        
        if (dotIndex < progressDots - 1) {
          ctx.fillStyle = '#1e1e1e'; // Filled
        } else if (dotIndex === progressDots - 1) {
          ctx.fillStyle = '#ff3b30'; // Current (Red)
        } else {
          ctx.fillStyle = '#c7c7cc'; // Empty (Grey)
        }
        ctx.fill();
      }
    }
    
  }, [timeStr]);

  return (
    <div className="widget-window-container">
      <div className="screen-time-body">
        <div className="widget-overlay-controls center-top">
          <button className={`overlay-btn ${isPinned ? 'pinned' : ''}`} onClick={handlePinToggle}>
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <canvas ref={canvasRef} style={{ width: '200px', height: '200px', pointerEvents: 'none' }} />
        
        <div className="screen-time-text">
          {timeStr.h}<span>H</span> {timeStr.m.toString().padStart(2, '0')}<span>M</span>
        </div>
      </div>
    </div>
  );
}

// --- Analog Clock Widget ---
function AnalogClockWidget() {
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("clock-theme") || "light");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("clock-theme", newTheme);
  };

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  const secDeg = seconds * 6;
  const minDeg = minutes * 6 + seconds * 0.1;
  const hrDeg = hours * 30 + minutes * 0.5;

  const isLight = theme === 'light';
  const bgColor = isLight ? '#f3f4f6' : '#121214';
  const numColor = isLight ? '#cbd5e1' : '#27272a';
  const handColor = isLight ? '#64748b' : '#94a3b8';

  return (
    <div className="widget-window-container">
      <div className="analog-clock-body" style={{ background: bgColor }}>
        <div className="widget-overlay-controls center-top">
          <button className="overlay-btn" onClick={toggleTheme} title="Toggle Theme">
            {isLight ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button
            className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handlePinToggle}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Clock Face */}
        <div className="clock-face">
          <div className="clock-number num-12" style={{ color: numColor }}>12</div>
          <div className="clock-number num-3" style={{ color: numColor }}>3</div>
          <div className="clock-number num-06" style={{ color: numColor }}>06</div>
          <div className="clock-number num-9" style={{ color: numColor }}>9</div>

          {/* Hands */}
          <div className="clock-hand hour-hand" style={{ transform: `rotate(${hrDeg}deg)`, backgroundColor: handColor }} />
          <div className="clock-hand minute-hand" style={{ transform: `rotate(${minDeg}deg)`, borderColor: handColor }} />
          <div className="clock-hand second-hand" style={{ transform: `rotate(${secDeg}deg)` }}>
            <div className="second-hand-dot" />
          </div>
          
        </div>
      </div>
    </div>
  );
}

// --- Photo Frame Widget ---
function PhotoFrameWidget() {
  const [isPinned, setIsPinned] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(() => localStorage.getItem("photo-frame-url") || "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400&h=400&fit=crop");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAlwaysOnTop().then(state => setIsPinned(state));
    }
  }, []);

  const handlePinToggle = () => {
    if (isElectron) {
      window.electronAPI.toggleAlwaysOnTop().then(state => setIsPinned(state));
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target.result;
        setPhotoUrl(result);
        localStorage.setItem("photo-frame-url", result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="widget-window-container photo-frame-container" style={{ width: '100%', height: '100%' }}>
      <div className="photo-frame-body" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div className="widget-overlay-controls center-top">
          <button className="overlay-btn edit-widget" onClick={handlePhotoClick} title="Change Photo">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.17 3.83a3 3 0 0 0-4.24 0L4 16.76V21h4.24l12.93-12.93a3 3 0 0 0 0-4.24z"></path>
            </svg>
          </button>
          <button
            className={`overlay-btn ${isPinned ? 'pinned' : ''}`}
            onClick={handlePinToggle}
            title={isPinned ? 'Unpin widget' : 'Pin widget'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.48A2 2 0 0 1 15 9.28V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1-1v4.28c0 .4-.12.8-.38 1.1l-2.78 3.48A2 2 0 0 0 5 15.24V17z" />
            </svg>
          </button>
          <button className="overlay-btn close-widget" onClick={closeWindow} title="Close widget">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <img 
          src={photoUrl} 
          alt="Frame" 
          className="photo-frame-img"
        />
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleFileChange} 
        />
      </div>
    </div>
  );
}

// --- Simple Routing Router Hook ---
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash || "#/");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return hash;
}

function App() {
  const hash = useHashRoute();

  if (hash.startsWith("#/widget/")) {
    const widgetType = hash.replace("#/widget/", "");
    if (widgetType === "horolize") {
      return <HorolizeWidget />;
    } else if (widgetType === "bloom") {
      return <BloomWidget />;
    } else if (widgetType === "buds") {
      return <BudsWidget />;
    } else if (widgetType === "media") {
      return <MediaWidget />;
    } else if (widgetType === "weather") {
      return <WeatherWidget />;
    } else if (widgetType === "calendar") {
      return <DateWidget />;
    } else if (widgetType === "spotify") {
      return <SpotifyWidget />;
    } else if (widgetType === "battery-circle") {
      return <BatteryCircleWidget />;
    } else if (widgetType === "analog-clock") {
      return <AnalogClockWidget />;
    } else if (widgetType === "photo-frame") {
      return <PhotoFrameWidget />;
    } else if (widgetType === "screen-time") {
      return <ScreenTimeWidget />;
    }
  }

  return <Dashboard />;
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

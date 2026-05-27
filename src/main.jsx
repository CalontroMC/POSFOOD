import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import SetupServer, { getServerUrl } from "./pages/SetupServer.jsx";

// Detect Capacitor-hosted (Android APK / iOS) WebView
function isCapacitor() {
  if (typeof window === "undefined") return false;
  if (window.Capacitor && window.Capacitor.isNativePlatform?.()) return true;
  // Heuristic: capacitor schemes
  const href = window.location.href || "";
  return /^capacitor:\/\//i.test(href) || /^https?:\/\/localhost\/?$/i.test(window.location.origin + "/");
}

const root = createRoot(document.getElementById("root"));

if (isCapacitor()) {
  const target = getServerUrl();
  if (target) {
    // We're inside the APK and already configured — bounce the WebView to the LAN server
    // The bundled index.html is just a launcher; user's actual app runs on the server.
    window.location.replace(target + "/");
    // Render a tiny loader while redirecting
    root.render(
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "Sarabun, sans-serif",
        color: "#6b7280", background: "#FAF9F7",
      }}>
        กำลังเชื่อมต่อ Server...
      </div>
    );
  } else {
    // First launch — show the setup screen
    root.render(
      <StrictMode>
        <SetupServer />
      </StrictMode>
    );
  }
} else {
  // Normal browser usage — render the full React app
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

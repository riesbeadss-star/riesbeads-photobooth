import React, { useEffect, useRef, useState } from "react";

const PALETTE = {
  blue: "#A7D8FF",
  blueSoft: "#D8EEFF",
  white: "#FFFFFF",
  ink: "#0F172A",
};

// Helpers
export const getAspectForCount = (count: 2 | 3 | 4) =>
  count === 2 ? 3 / 4 : count === 3 ? 1 : 4 / 3;
export const validateUploadCount = (n: number) => n >= 2 && n <= 4;

export default function RiesBeadsWebPhotobooth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captures, setCaptures] = useState<HTMLImageElement[]>([]);
  const [autoMode, setAutoMode] = useState(true);
  const [isShooting, setIsShooting] = useState(false);
  const [started, setStarted] = useState(false);

  const [frames, setFrames] = useState<2 | 3 | 4>(4);
  const [theme, setTheme] = useState<"blue" | "white">("blue");
  const [stripBg, setStripBg] = useState<"white" | "blue">("white");
  const [footerText, setFooterText] = useState("riesbeads.com • Singapore");
  const [borderRadius, setBorderRadius] = useState(28);
  const [gap, setGap] = useState(24);
  const [includeShadow, setIncludeShadow] = useState(true);
  const [frameBorder, setFrameBorder] = useState(true);

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoEl, setLogoEl] = useState<HTMLImageElement | null>(null);
  const [logoScale, setLogoScale] = useState(0.7);
  const [wmOpacity, setWmOpacity] = useState(1);

  useEffect(() => {
    if (!logoDataUrl) {
      setLogoEl(null);
      return;
    }
    const img = new Image();
    img.src = logoDataUrl;
    img.onload = () => setLogoEl(img);
    img.onerror = () => setLogoEl(null);
  }, [logoDataUrl]);

  const STRIP_W = 3000;
  const STRIP_H = 10000;

  // Camera
  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(s);
      setIsCameraOn(true);
      if (videoRef.current) {
        // @ts-ignore
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch (e: any) {
      alert("Could not access camera: " + e.message);
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setIsCameraOn(false);
  };

  const grabFrame = async () => {
    if (!videoRef.current) return null;
    const v = videoRef.current as HTMLVideoElement;
    const tmp = document.createElement("canvas");
    tmp.width = v.videoWidth || 1280;
    tmp.height = v.videoHeight || 720;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(v, 0, 0, tmp.width, tmp.height);
    const img = new Image();
    img.src = tmp.toDataURL("image/jpeg", 0.95);
    await img.decode();
    return img as HTMLImageElement;
  };

  const waitMs = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
  const runCountdown = async (secs: number) => {
    for (let i = secs; i > 0; i--) {
      setCountdown(i);
      await waitMs(800);
    }
    setCountdown(0);
  };

  const autoCapture = async () => {
    if (!isCameraOn || isShooting) return;
    setIsShooting(true);
    setCaptures([]);
    for (let i = 0; i < frames; i++) {
      await runCountdown(3);
      const img = await grabFrame();
      if (img) setCaptures((c) => [...c, img]);
      if (i < frames - 1) await waitMs(900);
    }
    setIsShooting(false);
  };

  const manualSnap = async () => {
    const img = await grabFrame();
    if (img) setCaptures((c) => (c.length < frames ? [...c, img] : c));
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesRaw = Array.from(e.target.files || []);
    if (!validateUploadCount(filesRaw.length)) {
      alert("Please upload 2–4 images.");
      return;
    }
    const files = filesRaw.slice(0, 4);
    const loaded: HTMLImageElement[] = [];
    for (const f of files) {
      const img = new Image();
      img.src = URL.createObjectURL(f);
      await new Promise((ok, err) => {
        img.onload = () => ok(true);
        img.onerror = err as any;
      });
      loaded.push(img as HTMLImageElement);
    }
    const count = Math.min(Math.max(loaded.length, 2), 4) as 2 | 3 | 4;
    setFrames(count);
    setCaptures(loaded.slice(0, count));
  };

  const onUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = (e.target.files || [])[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const composeStrip = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = STRIP_W;
    canvas.height = STRIP_H;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = stripBg === "blue" ? PALETTE.blueSoft : PALETTE.white;
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);

    const margin = Math.round(STRIP_W * 0.04);
    const cardX = margin;
    const cardY = margin;
    const cardW = STRIP_W - margin * 2;
    const cardH = STRIP_H - margin * 2;

    roundedRect(ctx, cardX, cardY, cardW, cardH, borderRadius);
    ctx.fillStyle = PALETTE.white;
    ctx.fill();

    // Header
    const innerPad = Math.round(STRIP_W * 0.02);
    const headerH = Math.round(STRIP_H * 0.12);
    ctx.save();
    ctx.fillStyle = theme === "blue" ? PALETTE.blue : PALETTE.white;
    roundedRect(ctx, cardX + innerPad, cardY + innerPad, cardW - innerPad * 2, headerH, 20);
    ctx.fill();

    if (logoEl) {
      const maxLogoW = (cardW - innerPad * 2) * logoScale;
      const maxLogoH = headerH * logoScale;
      let lw = logoEl.width, lh = logoEl.height;
      const scale = Math.min(maxLogoW / lw, maxLogoH / lh);
      lw *= scale;
      lh *= scale;
      const lx = STRIP_W / 2 - lw / 2;
      const ly = cardY + innerPad + headerH / 2 - lh / 2;
      ctx.drawImage(logoEl, lx, ly, lw, lh);
    } else {
      ctx.fillStyle = theme === "blue" ? PALETTE.white : PALETTE.ink;
      ctx.font = `${Math.round(STRIP_W * 0.028)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "Upload RiesBeads logo to brand header and frames",
        STRIP_W / 2,
        cardY + innerPad + headerH / 2
      );
    }
    ctx.restore();

    // Frames
    const footerReserve = Math.round(STRIP_H * 0.06);
    const availableH = cardH - headerH - innerPad * 3 - footerReserve;
    const frameCount = Math.min(frames, (captures.length || frames)) as 2 | 3 | 4;
    const ar = getAspectForCount(frameCount);
    const frameAreaW = cardW - innerPad * 2;
    const hMaxByHeight = (availableH - gap * (frameCount - 1)) / frameCount;
    const wMaxByWidth = frameAreaW;
    let frameH = Math.min(hMaxByHeight, wMaxByWidth / ar);
    let frameWActual = frameH * ar;
    const frameXBase = cardX + innerPad + (frameAreaW - frameWActual) / 2;
    let frameY = cardY + innerPad * 2 + headerH;

    for (let i = 0; i < frameCount; i++) {
      const img = captures[i];
      const inset = 12;
      const drawX = frameXBase + inset;
      const drawY = frameY + inset;
      const drawW = frameWActual - inset * 2;
      const drawH = frameH - inset * 2;

      if (img) {
        drawImageCover(ctx, img, drawX, drawY, drawW, drawH, 18);
      } else {
        ctx.fillStyle = PALETTE.blueSoft;
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }

      if (logoEl) {
        ctx.save();
        ctx.globalAlpha = wmOpacity;
        const maxW = drawW * 0.5;
        const maxH = drawH * 0.2;
        let lw = logoEl.width,
          lh = logoEl.height;
        const s = Math.min(maxW / lw, maxH / lh);
        lw *= s;
        lh *= s;
        const lx = drawX + (drawW - lw) / 2;
        const ly = drawY + 10;
        ctx.drawImage(logoEl, lx, ly, lw, lh);
        ctx.restore();
      }

      frameY += frameH + gap;
    }

    // Footer
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(STRIP_W * 0.018)}px system-ui`;
    ctx.fillText(footerText, STRIP_W / 2, cardY + cardH - innerPad * 2);
  };

  const roundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    r = 0
  ) => {
    const iw = img.width,
      ih = img.height;
    const scale = Math.max(w / iw, h / ih);
    const nw = iw * scale,
      nh = ih * scale;
    const nx = x + (w - nw) / 2;
    const ny = y + (h - nh) / 2;
    ctx.save();
    if (r) {
      roundedRect(ctx, x, y, w, h, r);
      ctx.clip();
    }
    ctx.drawImage(img, nx, ny, nw, nh);
    ctx.restore();
  };

  useEffect(() => {
    composeStrip();
  }, [
    captures,
    frames,
    theme,
    stripBg,
    logoEl,
    logoScale,
    wmOpacity,
    footerText,
    borderRadius,
    gap,
  ]);

  const downloadPNG = () => {
    if (!logoEl) {
      alert("Please upload the RiesBeads logo before downloading");
      return;
    }
    const link = document.createElement("a");
    link.download = `RiesBeads-Photostrip-${Date.now()}.png`;
    link.href = canvasRef.current!.toDataURL("image/png");
    link.click();
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: PALETTE.white, color: PALETTE.ink }}
    >
      {!started && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${PALETTE.blue} 0%, ${PALETTE.blueSoft} 100%)`,
          }}
        >
          <div className="text-center p-8 rounded-3xl shadow-2xl bg-white">
            <div className="text-3xl font-extrabold mb-3">
              Click Start to begin!
            </div>
            <p className="mb-6 text-slate-600">
              Use your webcam or upload 2–4 photos, then download your RiesBeads
              strip.
            </p>
            <button
              onClick={() => {
                setStarted(true);
                composeStrip();
              }}
              className="px-6 py-3 rounded-2xl font-semibold"
              style={{ background: PALETTE.blue }}
            >
              Start
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <div className="mb-3 font-semibold">Capture</div>
            <video
              ref={videoRef}
              className="w-full aspect-video bg-black"
              playsInline
              muted
            />
            {countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-6xl">
                {countdown}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              {!isCameraOn ? (
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl font-semibold"
                  style={{ background: PALETTE.blue }}
                >
                  Start camera
                </button>
              ) : (
                <>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-xl font-semibold border"
                  >
                    Stop camera
                  </button>
                  {autoMode ? (
                    <button
                      disabled={isShooting}
                      onClick={autoCapture}
                      className="px-4 py-2 rounded-xl font-semibold"
                      style={{ background: PALETTE.blue }}
                    >
                      {isShooting ? "Shooting…" : `Start ${frames}-shot`}
                    </button>
                  ) : (
                    <button
                      onClick={manualSnap}
                      className="px-4 py-2 rounded-xl font-semibold"
                      style={{ background: PALETTE.blue }}
                    >
                      Snap photo
                    </button>
                  )}
                </>
              )}
              <label className="px-4 py-2 rounded-xl font-semibold border cursor-pointer">
                Upload images (2–4)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onUpload}
                />
              </label>
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-white shadow-sm grid gap-4">
            <div>
              <label className="text-sm font-semibold">Frames</label>
              <select
                className="w-full mt-1 border rounded-lg p-2"
                value={frames}
                onChange={(e) =>
                  setFrames(parseInt(e.target.value) as 2 | 3 | 4)
                }
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Footer text</label>
              <input
                className="w-full mt-1 border rounded-lg p-2"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Upload logo</label>
              <input
                type="file"
                accept="image/*"
                className="w-full mt-1"
                onChange={onUploadLogo}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Logo scale</label>
              <input
                type="range"
                min={0.3}
                max={0.9}
                step={0.05}
                value={logoScale}
                onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Watermark opacity</label>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Photo Strip Preview</div>
            <div className="flex gap-3">
              <button
                onClick={composeStrip}
                className="px-3 py-1.5 rounded-lg border"
              >
                Preview
              </button>
              <button
                onClick={downloadPNG}
                className="px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: PALETTE.blue }}
              >
                Download PNG
              </button>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full max-h-[70vh] bg-slate-100"
          />
          <p className="text-xs text-slate-500 mt-3">
            Tip: Upload your RiesBeads logo — it shows in the header + as
            watermark on each frame. Only the bottom text is editable.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

// --- ADDED START ---
// Phase 25: reusable mouse/touch signature drawing pad.
// Add this file to frontend/src and use it in any signing workflow.
function SignaturePad({ value, onChange, height = 180 }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#111827";

    if (value) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = value;
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [value]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event.changedTouches?.[0] || event;

    return {
      x: ((source.clientX - rect.left) / rect.width) * canvas.width,
      y: ((source.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = getPoint(event);

    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = getPoint(event);

    context.lineTo(point.x, point.y);
    context.stroke();

    const dataUrl = canvas.toDataURL("image/png");
    setHasSignature(true);
    onChange?.(dataUrl);
  };

  const stopDrawing = (event) => {
    if (!drawingRef.current) return;

    event.preventDefault();
    drawingRef.current = false;

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");

    setHasSignature(true);
    onChange?.(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange?.("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={900}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{
          width: "100%",
          height,
          border: "1px solid #d1d5db",
          borderRadius: 10,
          background: "white",
          touchAction: "none"
        }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button type="button" onClick={clearSignature}>Clear Signature</button>
        <span style={{ color: hasSignature ? "green" : "#64748b" }}>
          {hasSignature ? "Signature captured" : "Draw signature above"}
        </span>
      </div>
    </div>
  );
}

export default SignaturePad;
// --- ADDED END ---

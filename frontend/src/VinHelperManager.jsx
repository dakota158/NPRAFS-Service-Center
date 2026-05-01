import { useState } from "react";

function VinHelperManager() {
  const [vin, setVin] = useState("");
  const [decoded, setDecoded] = useState(null);
  const [message, setMessage] = useState("");

  const decodeVin = () => {
    setMessage("");

    const cleanVin = vin.trim().toUpperCase();

    if (cleanVin.length !== 17) {
      setMessage("VIN must be 17 characters.");
      setDecoded(null);
      return;
    }

    const yearMap = {
      A: "2010 / 1980",
      B: "2011 / 1981",
      C: "2012 / 1982",
      D: "2013 / 1983",
      E: "2014 / 1984",
      F: "2015 / 1985",
      G: "2016 / 1986",
      H: "2017 / 1987",
      J: "2018 / 1988",
      K: "2019 / 1989",
      L: "2020 / 1990",
      M: "2021 / 1991",
      N: "2022 / 1992",
      P: "2023 / 1993",
      R: "2024 / 1994",
      S: "2025 / 1995",
      T: "2026 / 1996",
      V: "2027 / 1997",
      W: "2028 / 1998",
      X: "2029 / 1999",
      Y: "2030 / 2000",
      1: "2001",
      2: "2002",
      3: "2003",
      4: "2004",
      5: "2005",
      6: "2006",
      7: "2007",
      8: "2008",
      9: "2009"
    };

    const wmi = cleanVin.slice(0, 3);
    const yearCode = cleanVin[9];
    const plantCode = cleanVin[10];
    const serial = cleanVin.slice(11);

    setDecoded({
      vin: cleanVin,
      wmi,
      yearCode,
      modelYear: yearMap[yearCode] || "Unknown",
      plantCode,
      serial,
      vds: cleanVin.slice(3, 9),
      checkDigit: cleanVin[8]
    });
  };

  const copyDecoded = async () => {
    if (!decoded) return;

    const text = `VIN: ${decoded.vin}
WMI: ${decoded.wmi}
Possible Model Year: ${decoded.modelYear}
VDS: ${decoded.vds}
Check Digit: ${decoded.checkDigit}
Plant: ${decoded.plantCode}
Serial: ${decoded.serial}`;

    try {
      await navigator.clipboard.writeText(text);
      setMessage("VIN details copied.");
    } catch {
      setMessage("Could not copy VIN details.");
    }
  };

  return (
    <div>
      <h2>VIN Helper</h2>

      {message && (
        <p style={{ color: message.includes("copied") ? "green" : "red" }}>
          {message}
        </p>
      )}

      <div style={panelStyle}>
        <h3>Decode Basic VIN Info</h3>

        <p>
          This helper decodes basic VIN structure offline. It does not call a paid
          VIN API, so make/model decoding should still be verified.
        </p>

        <label>
          VIN
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            maxLength={17}
            placeholder="Enter 17-character VIN"
            style={inputStyle}
          />
        </label>

        <button type="button" onClick={decodeVin}>
          Decode VIN
        </button>{" "}
        <button type="button" onClick={copyDecoded}>
          Copy Details
        </button>
      </div>

      {decoded && (
        <div style={panelStyle}>
          <h3>Decoded Details</h3>
          <p><strong>VIN:</strong> {decoded.vin}</p>
          <p><strong>WMI:</strong> {decoded.wmi}</p>
          <p><strong>Possible Model Year:</strong> {decoded.modelYear}</p>
          <p><strong>Vehicle Descriptor:</strong> {decoded.vds}</p>
          <p><strong>Check Digit:</strong> {decoded.checkDigit}</p>
          <p><strong>Plant Code:</strong> {decoded.plantCode}</p>
          <p><strong>Serial:</strong> {decoded.serial}</p>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: "100%", padding: 8, boxSizing: "border-box", marginTop: 4, marginBottom: 12 };
const panelStyle = { border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 14, marginBottom: 18 };

export default VinHelperManager;

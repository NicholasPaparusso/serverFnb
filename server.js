const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdf2table = require("pdf2table");

const app = express();
app.use( cors());

const upload = multer({ dest: "uploads/" });
const turniData = JSON.parse(fs.readFileSync("./data/turni.json", "utf8"));

const getTurnoDetails = (code) => {
  if (code === "R") {
    return {
      descrizione: "Riposo",
      inizio: "",
      fine: "",
      durata: "",
      treni: [],
      diaria: false,
      td: false,
      tc: false,
      mg: ""
    };
  } else if (turniData[code] || turniData[code.replace(/\./g, "")]) {
    return turniData[code]
      ? turniData[code]
      : turniData[code.replace(/\./g, "")];
  } else {
    return {
      descrizione: "Turno non trovato",
      inizio: "",
      fine: "",
      durata: "",
      treni: [],
      diaria: false,
      td: false,
      tc: false,
      mg: ""
    };
  }
};

function giorniNelMese(year, month) {
  return new Date(year, month, 0).getDate();
}

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("📢 Ricevuta una richiesta POST a /upload");

  if (!req.file) {
    console.log("⚠️ Nessun file ricevuto!");
    return res.status(400).json({ error: "Nessun file ricevuto" });
  }

  const buffer = fs.readFileSync(req.file.path);
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  pdf2table.parse(buffer, (err, rows) => {
    if (err) {
      // In caso di errore, elimina il file temporaneo
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: "Errore estrazione tabelle" });
    }

    const cleanRows = rows
      .filter(
        row =>
          row &&
          row.length >= 10 &&
          !row.some(
            cell =>
              typeof cell === "string" &&
              cell.toUpperCase().includes("AGENT")
          )
      )
      .map(row => (!isNaN(parseFloat(row[0])) ? row.slice(1) : row))
      .filter(row => row[0] && row[0].length > 3);

    const calendarioFinale = {};

    cleanRows.forEach(row => {
      const nomePersona = row[0].trim();
      calendarioFinale[nomePersona] = {};

      row.slice(1).forEach((codiceTurno, idx) => {
        if (idx < giorniNelMese(year, month)) {
          const dataTurno = `${year}-${String(month).padStart(2, "0")}-${String(
            idx + 1
          ).padStart(2, "0")}`;
          calendarioFinale[nomePersona][dataTurno] = {
            codice: codiceTurno,
            dettagli: getTurnoDetails(codiceTurno)
          };
        }
      });
    });

    // Salva il file caricato come "turni_mensili.pdf"
    const newPath = "./turni_mensili.pdf";
    fs.renameSync(req.file.path, newPath);

    // Salva il calendario finale in un file JSON
    fs.writeFileSync(
      "calendario_finale.json",
      JSON.stringify(calendarioFinale, null, 2),
      "utf8"
    );
    res.json(calendarioFinale);
  });
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});

// Conversão mm ↔ px (96 DPI)
const MM_TO_PX = 96 / 25.4;

// Map de formatos suportados em mm (largura x altura, retrato)
function getPdfPageSize() {
  const formato = document.getElementById("pdf-format").value;

  // Valores em mm (ISO 216) e Super A3 330 x 440 mm [web:132][web:137]
  switch (formato) {
    case "A3":
      return { width: 297, height: 420 };
    case "SUPER_A3":
      return { width: 330, height: 440 }; // 33 x 44 cm
    case "A2":
      return { width: 420, height: 594 };
    case "A1":
      return { width: 594, height: 841 };
    case "A4":
    default:
      return { width: 210, height: 297 };
  }
}

// Utilitário: gera array de códigos de um número ao outro com padding automático.
function gerarListaCodigos(inicioStr, fimStr) {
  const maxLen = Math.max(inicioStr.length, fimStr.length);
  const inicio = parseInt(inicioStr, 10);
  const fim = parseInt(fimStr, 10);

  if (isNaN(inicio) || isNaN(fim) || fim < inicio) {
    Swal.fire({
      icon: "error",
      title: "Intervalo inválido",
      text: "Verifique os números inicial e final (ex.: 001 até 100)."
    });
    return [];
  }

  const lista = [];
  for (let n = inicio; n <= fim; n++) {
    lista.push(String(n).padStart(maxLen, "0"));
  }
  return lista;
}

// Atualiza texto do rodapé com ano automático
function atualizarRodape() {
  const ano = new Date().getFullYear();
  const footer = document.getElementById("footer-text");
  footer.textContent =
    "Desenvolvido por Ideia no Bolso LTDA - 64.016.500/0001-02 - " + ano;
}

// Lê estados de negrito/itálico/sublinhado
function getFontStyles() {
  const bold = document.getElementById("font-bold").value === "1";
  const italic = document.getElementById("font-italic").value === "1";
  const underline = document.getElementById("font-underline").value === "1";

  let fontOptions = "";
  if (bold) fontOptions += "bold";
  if (italic) fontOptions += (fontOptions ? " " : "") + "italic";

  let jsPdfStyle = "normal";
  if (bold && italic) jsPdfStyle = "bolditalic";
  else if (bold) jsPdfStyle = "bold";
  else if (italic) jsPdfStyle = "italic";

  return {
    bold,
    italic,
    underline,
    fontOptions,
    jsPdfStyle
  };
}

// Gera pré-visualização em HTML (usando mm → px)
function gerarPreview() {
  const inicio = document.getElementById("range-start").value.trim();
  const fim = document.getElementById("range-end").value.trim();

  const alturaMm =
    parseFloat(document.getElementById("barcode-height").value) || 20;
  let larguraMm =
    parseFloat(document.getElementById("barcode-width").value) || 29;

  if (larguraMm > 29) larguraMm = 29;

  const alturaPx = alturaMm * MM_TO_PX;
  const larguraPx = larguraMm * MM_TO_PX;

  const fonte = document.getElementById("font-family").value;
  const fontSizePt = parseInt(document.getElementById("font-size").value, 10);
  const textPosition = document.getElementById("text-position").value;

  const { fontOptions } = getFontStyles();

  const codigos = gerarListaCodigos(inicio, fim);
  if (!codigos.length) return;

  const previewArea = document.getElementById("preview-area");
  previewArea.innerHTML = "";

  codigos.forEach((codigo) => {
    const box = document.createElement("div");
    box.className = "label-box";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    const moduleWidth = larguraPx / (codigo.length * 15);

    JsBarcode(svg, codigo, {
      format: "CODE39",
      width: Math.max(1, moduleWidth),
      height: alturaPx,
      displayValue: true,
      text: codigo,
      font: fonte,
      fontOptions: fontOptions,
      fontSize: fontSizePt,
      textPosition: textPosition,
      margin: 4
    });

    box.style.fontFamily = fonte;
    box.appendChild(svg);
    previewArea.appendChild(box);
  });
}

// Converte SVG para base64 PNG usando canvas
function svgToBase64(svgElement) {
  return new Promise((resolve, reject) => {
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL("image/png");
        resolve({
          data: base64,
          width: img.width,
          height: img.height
        });
      };

      img.onerror = function (err) {
        reject(new Error("Erro ao converter SVG: " + err));
      };

      img.src =
        "data:image/svg+xml;base64," +
        btoa(unescape(encodeURIComponent(svgString)));
    } catch (err) {
      reject(err);
    }
  });
}

// Gera PDF com as etiquetas, no formato escolhido
async function gerarPDF() {
  try {
    const btn = document.getElementById("generate-pdf");
    btn.disabled = true;
    btn.classList.add("disabled");

    const inicio = document.getElementById("range-start").value.trim();
    const fim = document.getElementById("range-end").value.trim();

    const alturaMm =
      parseFloat(document.getElementById("barcode-height").value) || 20;
    let larguraMmConfig =
      parseFloat(document.getElementById("barcode-width").value) || 29;

    if (larguraMmConfig > 29) larguraMmConfig = 29;

    const alturaPx = alturaMm * MM_TO_PX;
    const larguraPx = larguraMmConfig * MM_TO_PX;

    const fonte = document.getElementById("font-family").value;
    const fontSizePt = parseInt(document.getElementById("font-size").value, 10);
    const textPosition = document.getElementById("text-position").value;

    const labelWidthMm =
      parseFloat(document.getElementById("label-width-mm").value) || 41;
    const labelHeightMm =
      parseFloat(document.getElementById("label-height-mm").value) || 39;

    const { underline, fontOptions, jsPdfStyle } = getFontStyles();

    const codigos = gerarListaCodigos(inicio, fim);
    if (!codigos.length) {
      btn.disabled = false;
      btn.classList.remove("disabled");
      return;
    }

    // Dimensões da página de acordo com o formato escolhido
    const pageSize = getPdfPageSize();
    const pageWidth = pageSize.width;
    const pageHeight = pageSize.height;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, pageHeight] // formato custom em mm [web:23][web:131]
    });

    const marginLeft = 10;
    const marginTop = 10;
    const marginBottom = 25;

    const availableWidth = pageWidth - marginLeft * 2;
    const availableHeight = pageHeight - marginTop - marginBottom;

    const cols = Math.floor(availableWidth / labelWidthMm) || 1;
    const rows = Math.floor(availableHeight / labelHeightMm) || 1;

    let posX = marginLeft;
    let posY = marginTop;
    let colIndex = 0;
    let rowIndex = 0;

    for (let i = 0; i < codigos.length; i++) {
      const codigo = codigos[i];

      const svgElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      const moduleWidth = larguraPx / (codigo.length * 15);

      JsBarcode(svgElement, codigo, {
        format: "CODE39",
        width: Math.max(1, moduleWidth),
        height: alturaPx,
        displayValue: true,
        text: codigo,
        font: fonte,
        fontOptions: fontOptions,
        fontSize: fontSizePt,
        textPosition: textPosition,
        margin: 4
      });

      const imgData = await svgToBase64(svgElement);

      doc.setLineWidth(0.3);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(posX, posY, labelWidthMm, labelHeightMm);
      doc.setLineDashPattern([], 0);

      const padding = 3;
      const maxImgWidthMm = Math.min(
        larguraMmConfig,
        labelWidthMm - padding * 2
      );
      const maxImgHeightMm = labelHeightMm - padding * 2;

      const svgWidthMm = imgData.width / MM_TO_PX;
      const svgHeightMm = imgData.height / MM_TO_PX;
      const svgRatio = svgHeightMm / svgWidthMm;

      let finalWidthMm = Math.min(maxImgWidthMm, svgWidthMm);
      let finalHeightMm = finalWidthMm * svgRatio;

      if (finalHeightMm > maxImgHeightMm) {
        finalHeightMm = maxImgHeightMm;
        finalWidthMm = finalHeightMm / svgRatio;
      }

      const imgPosX = posX + (labelWidthMm - finalWidthMm) / 2;
      const imgPosY = posY + (labelHeightMm - finalHeightMm) / 2;

      doc.addImage(
        imgData.data,
        "PNG",
        imgPosX,
        imgPosY,
        finalWidthMm,
        finalHeightMm
      );

      if (underline) {
        doc.setFont(fonte === "Arial" ? "helvetica" : "times", jsPdfStyle);
        doc.setFontSize(fontSizePt);

        const textWidth = doc.getTextWidth(codigo);
        const centerX = posX + labelWidthMm / 2;
        const lineY =
          textPosition === "top"
            ? posY + 4
            : posY + labelHeightMm - 3;

        doc.setLineWidth(0.3);
        doc.line(
          centerX - textWidth / 2,
          lineY,
          centerX + textWidth / 2,
          lineY
        );
      }

      colIndex++;
      if (colIndex >= cols) {
        colIndex = 0;
        rowIndex++;
        posX = marginLeft;
        posY += labelHeightMm;
      } else {
        posX += labelWidthMm;
      }

      if (rowIndex >= rows && i < codigos.length - 1) {
        const ano = new Date().getFullYear();
        const footerText =
          "Desenvolvido por Ideia no Bolso LTDA - 64.016.500/0001-02 - " + ano;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setLineWidth(0.5);
        doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
        doc.text(footerText, pageWidth / 2, pageHeight - 10, {
          align: "center"
        });

        doc.addPage([pageWidth, pageHeight], "portrait");
        posX = marginLeft;
        posY = marginTop;
        colIndex = 0;
        rowIndex = 0;
      }
    }

    const ano = new Date().getFullYear();
    const footerText =
      "Desenvolvido por Ideia no Bolso LTDA - 64.016.500/0001-02 - " + ano;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setLineWidth(0.5);
    doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });

    let pdfName = document.getElementById("pdf-name").value.trim();
    if (!pdfName) pdfName = "codigos_barras_code39";
    if (!pdfName.toLowerCase().endsWith(".pdf")) pdfName += ".pdf";

    doc.save(pdfName);

    btn.disabled = false;
    btn.classList.remove("disabled");

    Swal.fire({
      icon: "success",
      title: "PDF gerado!",
      text: "Arquivo salvo como: " + pdfName,
      confirmButtonColor: "#16a34a"
    });
  } catch (error) {
    console.error("Erro:", error);
    const btn = document.getElementById("generate-pdf");
    btn.disabled = false;
    btn.classList.remove("disabled");

    Swal.fire({
      icon: "error",
      title: "Erro ao gerar PDF",
      text: error.message || "Verifique os dados e tente novamente."
    });
  }
}

// Eventos dos botões de estilo
function setupStyleButtons() {
  const btnBold = document.getElementById("btn-bold");
  const btnItalic = document.getElementById("btn-italic");
  const btnUnderline = document.getElementById("btn-underline");

  btnBold.addEventListener("click", (e) => {
    e.preventDefault();
    btnBold.classList.toggle("active");
    document.getElementById("font-bold").value = btnBold.classList.contains(
      "active"
    )
      ? "1"
      : "0";
  });

  btnItalic.addEventListener("click", (e) => {
    e.preventDefault();
    btnItalic.classList.toggle("active");
    document.getElementById("font-italic").value = btnItalic.classList.contains(
      "active"
    )
      ? "1"
      : "0";
  });

  btnUnderline.addEventListener("click", (e) => {
    e.preventDefault();
    btnUnderline.classList.toggle("active");
    document.getElementById("font-underline").value =
      btnUnderline.classList.contains("active") ? "1" : "0";
  });
}

// Inicialização
window.addEventListener("DOMContentLoaded", function () {
  atualizarRodape();
  setupStyleButtons();

  document
    .getElementById("generate-preview")
    .addEventListener("click", (e) => {
      e.preventDefault();

      Swal.fire({
        title: "Gerando pré-visualização!",
        text: "Ideia no Bolso está preparando seus códigos de barras.",
        width: 600,
        padding: "2.5em",
        color: "#ffffff",
        background:
          "#1d1b52 url('https://media.giphy.com/media/sIIhZliB2McAo/giphy.gif') center/cover no-repeat",
        backdrop:
          "rgba(0,0,0,0.6) url('https://media.giphy.com/media/sIIhZliB2McAo/giphy.gif') center top / 200px no-repeat",
        timer: 1500,
        showConfirmButton: false
      });

      gerarPreview();
    });

  document
    .getElementById("generate-pdf")
    .addEventListener("click", (e) => {
      e.preventDefault();
      gerarPDF();
    });
});

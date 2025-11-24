import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export const extractTextFromFile = async (req) => {
  try {
    const fileBuffer = req.file?.buffer || req.files?.resume?.[0]?.buffer;

    if (!fileBuffer) {
      throw new Error("File buffer missing — check upload middleware");
    }

    const data = await pdfParse(fileBuffer);
    return data.text; 
  } catch (error) {
    console.error("PDF Extract Error:", error);
    return "";
  }
};

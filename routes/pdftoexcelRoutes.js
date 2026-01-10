import express from "express";
import multer from "multer";
import { convertPDFToExcel } from "../controllers/pdftoexcelController.js";

const router = express.Router();
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Accept single PDF file with field name 'file'
router.post("/", upload.single("file"), convertPDFToExcel);

export default router;

import fs from "fs";
import axios from "axios";
import FormData from "form-data";

console.log("Split Controller - API Keys loaded:", {
  hasApiKey: !!process.env.API_KEY,
  hasApiSecret: !!process.env.API_SECRET
});

export const splitPDF = async (req, res) => {
  try {
    console.log("Split PDF request received");
    
    if (!req.file) {
      return res.status(400).json({ error: "File missing!" });
    }

    const { pages, split_mode } = req.body;
    
    // split_mode: 'single' = all pages in one PDF, 'individual' = separate PDF per page in ZIP
    const splitMode = split_mode || 'single';
    
    // Check if this is an "all pages" request
    const isAllPages = pages === 'all' || !pages;
    
    // Pages is required unless it's an "all pages" split to individual PDFs
    if (!isAllPages && !pages) {
      return res.status(400).json({ error: "Pages parameter is required!" });
    }

    console.log("File received:", {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });
    console.log("Pages to extract:", pages || "all");
    console.log("Split mode:", splitMode);
    console.log("Is all pages:", isAllPages);
    
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    
    const formData = new FormData();
    formData.append("file", fileBuffer, req.file.originalname);
    
    // For "all pages" mode, we need to send "all" or let the API handle it
    if (isAllPages) {
      formData.append("pages", "all");
    } else {
      formData.append("pages", pages);
    }
    
    // Only add split_mode if individual (API default is single PDF)
    if (splitMode === 'individual') {
      formData.append("split_mode", "individual");
    }
    
    console.log("Sending to RobotPDF Split API...");
    
    const headers = {
      "x-api-key": process.env.API_KEY,
      "x-api-secret": process.env.API_SECRET,
      ...formData.getHeaders()
    };
    
    const response = await axios.post(
      "https://api.robotpdf.com/api/v1/split",
      formData,
      {
        headers,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: 'arraybuffer' // Get raw binary data
      }
    );

    console.log("RobotPDF Split response received");
    console.log("Response content-type:", response.headers['content-type']);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    const contentType = response.headers['content-type'] || '';
    const originalName = req.file.originalname.replace('.pdf', '');
    const isZipMode = splitMode === 'individual' || isAllPages;
    let result;
    
    if (contentType.includes('application/json')) {
      // API returned JSON (possibly with base64)
      const jsonData = JSON.parse(response.data.toString());
      const apiData = jsonData.data || jsonData;
      result = {
        fileBase64: apiData.file_base64 || "",
        fileName: isZipMode ? `${originalName}_split.zip` : `${originalName}_split.pdf`,
        pageCount: apiData.page_count || 0,
        fileSize: apiData.file_size || 0,
        isZip: isZipMode,
      };
    } else {
      // API returned binary data directly (PDF or ZIP)
      const fileBuffer = Buffer.from(response.data);
      const fileBase64 = fileBuffer.toString('base64');
      const isPdf = contentType.includes('application/pdf');
      
      result = {
        fileBase64: fileBase64,
        fileName: isPdf ? `${originalName}_split.pdf` : `${originalName}_split.zip`,
        pageCount: 0, // Not available in binary response
        fileSize: fileBuffer.length,
        isZip: !isPdf || isZipMode,
      };
    }
    
    console.log("Sending result with base64 length:", result.fileBase64?.length);
    console.log("File size:", result.fileSize);

    res.status(200).json(result);
  } catch (error) {
    console.error("Split Error Details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    let errorMessage = error?.response?.data?.message || 
                       error?.response?.data?.error || 
                       error.message || 
                       "RobotPDF API error";
    
    // Provide helpful messages for common errors
    if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT") || error.response?.status === 504) {
      errorMessage = "Request timed out. The file may be too large or the server is busy. Please try again.";
    } else if (error.response?.status === 503) {
      errorMessage = "RobotPDF service is temporarily unavailable. Please try again later.";
    } else if (error.response?.status === 400) {
      errorMessage = errorMessage || "Invalid page range or file format.";
    }
    
    res.status(error.response?.status || 500).json({
      error: "Split failed",
      message: errorMessage
    });
  }
};

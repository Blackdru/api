import fs from "fs";
import axios from "axios";
import FormData from "form-data";

console.log("Merge Controller - API Keys loaded:", {
  hasApiKey: !!process.env.API_KEY,
  hasApiSecret: !!process.env.API_SECRET
});

export const mergePDFs = async (req, res) => {
  const files = req.files;
  
  try {
    console.log("Merge PDF request received");
    
    // Validate files
    if (!files || files.length < 2) {
      return res.status(400).json({ 
        success: false,
        error: "At least 2 PDF files are required for merging" 
      });
    }

    if (files.length > 10) {
      return res.status(400).json({ 
        success: false,
        error: "Maximum 10 PDF files allowed for merging" 
      });
    }

    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 100 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false,
        error: "Total file size exceeds 100MB limit" 
      });
    }

    console.log("Files received:", files.map(f => ({
      name: f.originalname,
      size: f.size,
      path: f.path
    })));

    // Create form data for API request
    const formData = new FormData();
    
    for (const file of files) {
      const fileBuffer = fs.readFileSync(file.path);
      formData.append("files", fileBuffer, file.originalname);
    }

    console.log("Sending to RobotPDF Merge API...");

    const headers = {
      "x-api-key": process.env.API_KEY,
      "x-api-secret": process.env.API_SECRET,
      ...formData.getHeaders()
    };

    const response = await axios.post(
      "https://api.robotpdf.com/api/v1/merge",
      formData,
      {
        headers,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: 'arraybuffer'
      }
    );

    console.log("RobotPDF Merge response received");
    console.log("Response content-type:", response.headers['content-type']);

    // Clean up uploaded files
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error("Error deleting temp file:", err);
      }
    }

    const contentType = response.headers['content-type'] || '';
    let result;

    if (contentType.includes('application/json')) {
      // API returned JSON (possibly with base64)
      const jsonData = JSON.parse(response.data.toString());
      const apiData = jsonData.data || jsonData;
      result = {
        success: true,
        fileBase64: apiData.file_base64 || "",
        fileName: `merged_${Date.now()}.pdf`,
        fileCount: files.length,
        fileSize: apiData.file_size || 0,
      };
    } else {
      // API returned binary data directly (PDF)
      const fileBuffer = Buffer.from(response.data);
      const fileBase64 = fileBuffer.toString('base64');
      
      result = {
        success: true,
        fileBase64: fileBase64,
        fileName: `merged_${Date.now()}.pdf`,
        fileCount: files.length,
        fileSize: fileBuffer.length,
      };
    }

    console.log("Sending result with base64 length:", result.fileBase64?.length);
    console.log("File size:", result.fileSize);

    res.status(200).json(result);

  } catch (error) {
    console.error("Merge Error Details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Clean up files on error
    if (files) {
      for (const file of files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    let errorMessage = error?.response?.data?.message || 
                       error?.response?.data?.error || 
                       error.message || 
                       "RobotPDF API error";
    
    // Provide helpful messages for common errors
    if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT") || error.response?.status === 504) {
      errorMessage = "Request timed out. The files may be too large or the server is busy. Please try again.";
    } else if (error.response?.status === 503) {
      errorMessage = "RobotPDF service is temporarily unavailable. Please try again later.";
    } else if (error.response?.status === 400) {
      errorMessage = errorMessage || "Invalid file format.";
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage,
    });
  }
};

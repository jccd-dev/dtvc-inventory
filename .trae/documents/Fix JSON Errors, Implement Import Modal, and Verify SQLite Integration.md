I will fix the JSON parsing errors, implement the file import modal, and ensure robust SQLite integration.

### **1. Fix JSON Parsing Errors & API Stability**
*   **Problem**: The "Unexpected token <" error occurs when the frontend tries to parse an HTML error page (like a 404 or 500) as JSON.
*   **Fix**:
    *   Update `src/app/page.tsx` to check `res.ok` before calling `res.json()`.
    *   Implement safe response parsing that reads `res.text()` first if the status is not OK, preventing the app from crashing on server errors.
    *   Ensure all API routes return strict JSON responses, even for errors.

### **2. Implement File Import Modal**
*   **Frontend (`src/app/page.tsx`)**:
    *   Replace the current "Import from Excel" button with a **Dialog (Modal)**.
    *   Add a file input (`<input type="file" accept=".xlsx" />`) to allow users to select a file from their device.
    *   Use `FormData` to send the selected file to the server.
*   **Backend (`src/app/api/inventory/import/route.ts`)**:
    *   Modify the API to accept `multipart/form-data` uploads instead of reading a hardcoded file path.
    *   Parse the uploaded file buffer using `xlsx`.
    *   Map the Excel columns to the SQLite database schema.

### **3. Configure & Verify SQLite Integration**
*   **Database**:
    *   Confirm `prisma/schema.prisma` and `prisma.config.ts` are correctly configured for SQLite.
    *   The import logic will use `prisma.inventoryItem.createMany` (or loop with `create`) to efficiently save data.
*   **Data Integrity**:
    *   Ensure numeric fields (Price, Quantity) are safely parsed from the Excel data.
    *   Handle date fields (Expiry Date) correctly, converting Excel serial dates to JavaScript Date objects.

### **4. Testing & Validation**
*   **Verification Steps**:
    *   **JSON Error**: Verify that network errors show a user-friendly alert instead of a console crash.
    *   **Import**: Upload a sample `.xlsx` file and verify items appear in the table.
    *   **Database**: Check that data persists in the `dev.db` SQLite file after restart.

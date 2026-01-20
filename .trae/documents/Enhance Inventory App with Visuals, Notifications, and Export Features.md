I will implement the requested enhancements in stages, ensuring functionality and design requirements are met.

### **1. Status Color Coding & Modal Fix**

* **Color System**: Update the `Badge` component usage in the table to use specific Tailwind classes matching the requirements:

  * "Not yet": `bg-red-600` (approx #DC2626)

  * "Checked": `bg-amber-500` (approx #F59E0B)

  * "Updated": `bg-emerald-500` (approx #10B981)

* **Modal Fix**: Normalize status values to lowercase ("checked", "updated", "not yet") throughout the app (Database, UI, Import) to ensure the Select component in the modal correctly reflects the current status.

### **2. Notification System**

* **Implementation**: Install and configure `sonner` (Shadcn's recommended toast library).

* **Usage**: Replace all browser `alert()` calls with `toast.success()`, `toast.error()`, or `toast.warning()` for better UX.

### **3. Date Selection & Components**

* **Components**: Install `calendar` and `popover` components from Shadcn.

* **Implementation**: Replace the native `<Input type="date">` with a proper `DatePicker` component using `date-fns` for formatting and validation.

### **4. Table Enhancements**

* **Sorting**: Implement client-side sorting for all columns (Name, Price, Qty, Status). Add visual indicators (arrows) for sort direction.

* **Row Count**: Add a summary section displaying "Showing X of Y items" to track filtered vs. total results.

### **5. Data Export**

* **Feature**: Implement `handleExport` using the `xlsx` library.

* **Format**: Export data with proper headers and formatting. File name: `Inventory_export_YYYYMMDD.xlsx`.

### **6. Testing & Documentation**

* **Testing**: Set up `Jest` and `React Testing Library`. Create unit tests for the Status Logic and Export functionality.

* **Documentation**: Update `README.md` with details on the new features, color coding guide, and export usage.


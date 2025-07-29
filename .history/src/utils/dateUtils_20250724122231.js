// European date formatting utilities
export const formatDateEuropean = (date) => {
  if (!date) return "-";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  
  return `${day}-${month}-${year}`;
};

export const formatDateEuropeanFull = (date) => {
  if (!date) return "-";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}; 
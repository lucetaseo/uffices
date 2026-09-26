import * as XLSX from 'xlsx';
import { today } from './date.js';

export function downloadExcel(rows, sheetName, filePrefix) {
  if (!rows.length) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filePrefix}_${today()}.xlsx`);
}

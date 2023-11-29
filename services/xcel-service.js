const json2xls = require('json2xls');
const fs = require('fs')
const XLSX = require('xlsx');
const exceljs = require('exceljs')

const createExcel = async (headers, rows) => {

    const workbook =  new exceljs.stream.xlsx.WorkbookWriter({});
    const sheet =  workbook.addWorksheet('My Worksheet');
    sheet.columns = headers;
    for (let i = 0; i < rows.length; i++) {
        sheet.addRow(rows[i]);
    }
    sheet.commit();
    return new Promise((resolve, reject) => {
        workbook.commit().then(() => {
            const stream = (workbook).stream;
            const result = stream.read();
            resolve(result);
        }).catch((e) => {
            reject(e);
        });
    });
}

function generateCollectionFromExcel(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  
    // Extract the header row from the worksheet
    const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
  
    // Generate the collection based on the header fields
    const collection = XLSX.utils.sheet_to_json(worksheet, {
      header: headerRow,
      range: 1 // Start from the second row to exclude the header row
    });
    console.log(headerRow, collection);
    return collection;
  }
  
module.exports = {
    createExcel,
    generateCollectionFromExcel,
}
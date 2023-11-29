const XLSX = require("xlsx");
const { IGMInfoDetails, containerDetails, cargoDetails } = require('./igmparser');


const bufferToJSONParser = (bufferData) => {

    var workbook = XLSX.read(bufferData, { type: 'buffer' });
    var sheet_name_list = workbook.SheetNames;
    var worksheet = workbook.Sheets[sheet_name_list[0]];
    let data = null;
    const headers = [['isoCode', 'isoCodeDetails', 'containerSize', 'containerType', 'emptyContainerWeight']];

    XLSX.utils.sheet_add_aoa(worksheet, headers);
    data = XLSX.utils.sheet_to_json(worksheet, { defval: "N.A." });

    for (let obj of data) {
        obj.isoCode += "";
    }
    return data;
}


const fileDataToString = (fileData) => {

    return fileData.buffer.toString();

}


const getIGMFileData = (fileData) => {

    let igmDetails = fileDataToString(fileData);

    let IGMInfo = IGMInfoDetails(igmDetails.split("\r\n")[0]);


    let contStartPos = igmDetails.indexOf("<contain>") + 11;
    let contEndPos = igmDetails.indexOf("<END-contain>") - 2;
    let containerDetailsObj = containerDetails(igmDetails.substring(contStartPos, contEndPos));

    let cargStartPos = igmDetails.indexOf("<cargo>") + 9;
    let cargEndPos = igmDetails.indexOf("<END-cargo>") - 2;
    let cargoDetailsObj = cargoDetails(igmDetails.substring(cargStartPos, cargEndPos));

    const IGMDetailsObj = {
        IGMInfo: IGMInfo,
        containerDetails: containerDetailsObj,
        cargoDetails: cargoDetailsObj
    }
    return IGMDetailsObj;

}

const getParsedData = (fileData) => {
    return bufferToJSONParser(fileData.buffer);
}

module.exports = {
    getParsedData,
    bufferToJSONParser,
    getIGMFileData
}
const IGMInfoDetails = (IGMInfoString) => {
    const IGMInfoObj = (IGMInfoString.split("\u001D"))
    const IGMInfo = {
        senderId: IGMInfoObj[2],
        receiverId: IGMInfoObj[4],
        versionNo: IGMInfoObj[5],
        prodOrTest: IGMInfoObj[6],
        msgID: IGMInfoObj[8],
        IGMDocNo: IGMInfoObj[9],
        date: IGMInfoObj[10],
        time: IGMInfoObj[11]
    }
    return IGMInfo;
}

const containerDetails = (contDetailsString) => {
    let contInfoStringArr = (contDetailsString.split("\r\n"));

    let contDetailsArr = [];
    let contDetailObjArr = [];

    for (let i = 0; i < contInfoStringArr.length; i++) {
        contDetailsArr[i] = contInfoStringArr[i].split("\u001D");
    }

    for (let i = 0; i < contDetailsArr.length; i++) {
        let contDetailsObj = {
            vesselCode1: contDetailsArr[i][2],
            vesselCode2: contDetailsArr[i][3],
            voyageNo: contDetailsArr[i][4],
            itemNo: contDetailsArr[i][7],
            subItemNo: contDetailsArr[i][8],
            containerId: contDetailsArr[i][9],
            noOfPackages: contDetailsArr[i][13],
            isoCode: contDetailsArr[i][15]
        }

        contDetailObjArr.push(contDetailsObj);
    }
    return contDetailObjArr;
}

const cargoDetails = (cargoDetailsString) => {
    let cargoInfoStringArr = (cargoDetailsString.split("\r\n"));
    let cargoObjArr = [];

    for (let i = 0; i < cargoInfoStringArr.length; i++) {
        let cargoSubString1EndPos = cargoInfoStringArr[i].search("KGS") + 3;
        let cargoSubstring1 = (cargoInfoStringArr[i].substring(0, cargoSubString1EndPos));
        let cargoSubString2 = (cargoInfoStringArr[i].substring(cargoSubString1EndPos));
        let cargodetails1Arr = cargoSubstring1.split("\u001D");
        let cargoDetails1length = cargodetails1Arr.length;
        let cargoObj = {
            receiverId: cargodetails1Arr[1],
            vesselCode1: cargodetails1Arr[2],
            vesselCode2: cargodetails1Arr[3],
            voyageNo: cargodetails1Arr[4],
            itemNo: cargodetails1Arr[7],
            subItemNo: cargodetails1Arr[8],
            billNo: cargodetails1Arr[9],
            date: cargodetails1Arr[10],
            portOfLoading: cargodetails1Arr[11],
            weightOfCargo: +cargodetails1Arr[cargoDetails1length - 2],
            typeofPackage: cargodetails1Arr[cargoDetails1length - 3],
            noOfPackages: +cargodetails1Arr[cargoDetails1length - 4],
            cfsCode: cargodetails1Arr[cargoDetails1length - 5],

        }
        let importerName = cargodetails1Arr[15];
        let importerAddress = "";

        for (let i = 16; i < (cargoDetails1length - 8); i++) {

            if (cargodetails1Arr[i] == importerName)
                break;
            else {
                importerAddress += cargodetails1Arr[i] + " ";
            }

        }
        cargoObj.importerName = importerName;
        cargoObj.importerAddress = importerAddress;
        let cargoContents = cargoSubString2.split("\u001D");
        let cargoContentString = "";

        for (let i = 0; i < cargoContents.length; i++) {
            if (cargoContents[i] == "ZZZZZ" || cargoContents[i] == "ZZZ") {
                //pass
            }

            else {
                cargoContentString += cargoContents[i] + " ";
            }

        }
        cargoObj.contents = cargoContentString;
        cargoObjArr.push(cargoObj);

    }
    return cargoObjArr;
}

module.exports = {
    IGMInfoDetails,
    containerDetails,
    cargoDetails
}
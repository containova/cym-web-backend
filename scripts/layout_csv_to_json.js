/**
 * 1. Convert the CSV file to JSON using https://www.convertcsv.com/csv-to-json.htm
 * 2. Use this script to generate slots out of a JSON file
 */

const layoutJSON = require('./layout.json');
var fs = require('fs');

let slots = [];
let containerIds = [];

generateRandomAlphaNumericString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        if (i < 4) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        } else {
            result += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
    }
    return result;
}

getEpochTime = () => {
    return Math.floor(new Date().getTime() / 1000);
}

getRandomId = () => {
    const id = containerIds[0];
    containerIds.splice(0, 1);
    return id;
}

bothLevelsNeedToBeOccupied = () => {
    const num = Math.floor(Math.random() * 100) + 1;
    return num % 2 === 0;
}

keepSlotEmpty = () => {
    const num = Math.floor(Math.random() * 100) + 1;
    return num % 2 === 0;
}

getOccupancy = (skipSlot, enterContainerInBothLevels) => {

	// uncomment the below line to skip occupancy
	// return [];

    if (skipSlot)
        return [
            {
                level: 1,
                status: 'empty',
                containerId: "",
            },
            {
                level: 2,
                status: 'empty',
                containerId: "",
            }
        ];

    let level1Id = "";
    let level2Id = "";
    let level1Status = 'empty';
    let level2Status = 'empty';

    if (enterContainerInBothLevels) {
        level1Id = getRandomId();
        level2Id = getRandomId();
        level1Status = level1Id ? 'occupied' : 'empty';
        level2Status = level2Id ? 'occupied' : 'empty';
    } else {
        level1Id = getRandomId();
        level1Status = level1Id ? 'occupied' : 'empty';
    }

    return [
        {
            level: 1,
            status: level1Status,
            containerId: level1Id,
        },
        {
            level: 2,
            status: level2Status,
            containerId: level2Id,
        }
    ]
}

prepareSlotOccupancy = (containersCount) => {

    while (containerIds.length < containersCount) {
        const containerId = generateRandomAlphaNumericString(11);
        if (!containerIds.includes(containerId)) {
            containerIds.push(containerId);
        }
    }

    for (let i = 0; i < layoutJSON.length; i++) {

        let enterContainerInBothLevels = bothLevelsNeedToBeOccupied();
        let skipSlot = keepSlotEmpty();

        let slot = {
            clientId: 'c0592234-974c-46a0-94cb-b1fbeb9bf230',
            fsId: 'e30ffd67-1a74-4b71-b742-4ae8b1bb56ac',
            name: layoutJSON[i].name,
            row: layoutJSON[i].row,
            col: layoutJSON[i].col,
            slotCoordinates: {
                c_1: JSON.parse(layoutJSON[i].c_1),
                c_2: JSON.parse(layoutJSON[i].c_2),
                c_3: JSON.parse(layoutJSON[i].c_3),
                c_4: JSON.parse(layoutJSON[i].c_4),
                centroid: JSON.parse(layoutJSON[i].centroid)
            },
            occupancy: getOccupancy(skipSlot, enterContainerInBothLevels),
            markerDetails: {
                label: "",
                coordinates: [22.45456, 88.454545],
                orientation: -10
            }
        }

        slots.push(slot);
    }


    fs.writeFile('slots.json', JSON.stringify(slots), 'utf8', () => console.log('File Generated!'));
}

prepareSlotOccupancy(1500)

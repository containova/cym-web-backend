const makeGETRequest = async (url, headers, params) => {
	const response = await fetch(
		url + new URLSearchParams(params).toString(), {
		method: 'get',
		headers
	});
	return response.json();
}

const makePOSTRequest = async (url, headers, data) => {
	const response = await fetch(
		url, {
		method: 'post',
		body: JSON.stringify(data),
		headers: {
			'Content-Type': 'application/json',
			...headers
		}
	});
	return response.json();
}

module.exports = {
	makeGETRequest,
	makePOSTRequest
}
